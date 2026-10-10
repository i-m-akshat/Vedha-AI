using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.Orchestrator;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Application.Features.Aksh;

public record StartAkshSessionCommand(
    Guid UserId,
    string Goal,
    string? JobUrl,
    AutonomyLevel AutonomyLevel
) : IRequest<Result<AkshSessionDto>>;

public record DecideAkshApprovalCommand(
    Guid UserId,
    Guid ApprovalId,
    bool Approve,
    string? EditedAnswersJson
) : IRequest<Result<AkshDecisionResultDto>>;

public record GetAkshSessionsQuery(Guid UserId, bool ActiveOnly) : IRequest<Result<List<AkshSessionDto>>>;

public record GetAkshAuditQuery(Guid UserId, Guid SessionId) : IRequest<Result<AkshAuditDto>>;

public class AkshHandlers :
    IRequestHandler<StartAkshSessionCommand, Result<AkshSessionDto>>,
    IRequestHandler<DecideAkshApprovalCommand, Result<AkshDecisionResultDto>>,
    IRequestHandler<GetAkshSessionsQuery, Result<List<AkshSessionDto>>>,
    IRequestHandler<GetAkshAuditQuery, Result<AkshAuditDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ISender _sender;
    private readonly IPacingGovernor _governor;

    public AkshHandlers(IApplicationDbContext context, ISender sender, IPacingGovernor governor)
    {
        _context = context;
        _sender = sender;
        _governor = governor;
    }

    public async Task<Result<AkshSessionDto>> Handle(StartAkshSessionCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Goal))
        {
            return Result<AkshSessionDto>.Failure("Goal cannot be empty.");
        }

        if (!string.IsNullOrWhiteSpace(request.JobUrl)
            && !Uri.TryCreate(request.JobUrl.Trim(), UriKind.Absolute, out _))
        {
            return Result<AkshSessionDto>.Failure("Job URL is not a valid absolute URL.");
        }

        // Literal SSRF screen at the front door (no DNS here — the fetch point
        // re-enforces with resolution). Intranet hosts stay allowed by design.
        if (!string.IsNullOrWhiteSpace(request.JobUrl)
            && Uri.TryCreate(request.JobUrl.Trim(), UriKind.Absolute, out var jobUri)
            && (jobUri.Scheme != Uri.UriSchemeHttp && jobUri.Scheme != Uri.UriSchemeHttps
                || !string.IsNullOrWhiteSpace(jobUri.UserInfo)
                || Domain.Common.UrlSafety.IsBlockedHost(jobUri.Host)))
        {
            return Result<AkshSessionDto>.Failure("Job URL host is not allowed (loopback/link-local/metadata).");
        }

        var session = new AkshSession
        {
            UserId = request.UserId,
            Goal = request.Goal.Trim(),
            JobUrl = string.IsNullOrWhiteSpace(request.JobUrl) ? null : request.JobUrl.Trim(),
            AutonomyLevel = request.AutonomyLevel,
            Status = AkshSessionStatus.Planning,
            TodoJson = JsonSerializer.Serialize(AkshPlanner.BuildInitialPlan(request.Goal, request.JobUrl)),
        };

        _context.AkshSessions.Add(session);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<AkshSessionDto>.Success(MapSession(session));
    }

    public async Task<Result<AkshDecisionResultDto>> Handle(DecideAkshApprovalCommand request, CancellationToken cancellationToken)
    {
        var approval = await _context.AkshApprovals
            .Include(a => a.Session)
            .FirstOrDefaultAsync(a => a.Id == request.ApprovalId, cancellationToken);

        if (approval == null || approval.Session == null || approval.Session.UserId != request.UserId)
        {
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "approval_not_found",
                Message = "Approval not found."
            });
        }

        // Single-use binding: only Pending — or Approved-but-unconsumed (governor retry re-entry) — may proceed.
        var reentry = approval.Status == AkshApprovalStatus.Approved && approval.ConsumedAtUtc == null;
        if (approval.Status != AkshApprovalStatus.Pending && !reentry)
        {
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "approval_not_pending",
                Message = $"Approval is {approval.Status} and cannot be decided again."
            });
        }

        if (DateTime.UtcNow > approval.ExpiresAtUtc)
        {
            approval.Status = AkshApprovalStatus.Expired;
            approval.Session.Status = AkshSessionStatus.Paused;
            await _context.SaveChangesAsync(cancellationToken);
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "approval_expired",
                Message = "Approval expired. Start a new turn to request a fresh approval."
            });
        }

        if (!request.Approve)
        {
            approval.Status = AkshApprovalStatus.Rejected;
            approval.DecidedAtUtc = DateTime.UtcNow;
            approval.Session.Status = AkshSessionStatus.Paused;
            await _context.SaveChangesAsync(cancellationToken);
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "rejected",
                Message = "Rejected. The run is paused; send a new message to adjust the plan."
            });
        }

        // Validation first, mutation later: no approval state changes until the
        // atomic consume below. Every early return leaves the row exactly as
        // found (still Pending, still decidable).
        if (!string.Equals(approval.ToolName, "launch_apply", StringComparison.OrdinalIgnoreCase))
        {
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "unknown_tool",
                Message = $"Approval is bound to unsupported tool '{approval.ToolName}'."
            });
        }

        Guid queueItemId;
        var headed = false;
        try
        {
            using var args = JsonDocument.Parse(approval.ArgumentsJson);
            queueItemId = args.RootElement.GetProperty("queueItemId").GetGuid();
            if (args.RootElement.TryGetProperty("headed", out var headedEl)
                && (headedEl.ValueKind == JsonValueKind.True || headedEl.ValueKind == JsonValueKind.False))
            {
                headed = headedEl.GetBoolean();
            }
        }
        catch
        {
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "bad_arguments",
                Message = "Approval arguments are malformed; refusing to execute."
            });
        }

        var queueItem = await _context.ApplicationQueueItems
            .FirstOrDefaultAsync(q => q.Id == queueItemId && q.UserId == request.UserId, cancellationToken);
        if (queueItem == null)
        {
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "queue_item_not_found",
                Message = "The approved queue item no longer exists."
            });
        }

        // Content binding: the approval authorizes the EXACT reviewed package.
        // A mutated package (re-tailor, changed answers/resume/company) never
        // inherits it — the stale approval expires and the candidate reviews anew.
        var bindingMismatch = AkshBinding.VerifyArguments(approval.ArgumentsJson, queueItem);
        if (bindingMismatch != null)
        {
            approval.Status = AkshApprovalStatus.Expired;
            approval.Session.Status = AkshSessionStatus.Paused;
            await _context.SaveChangesAsync(cancellationToken);
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "args_superseded",
                Message = $"The approved package changed ({bindingMismatch}); this approval no longer applies. Review the current package and approve again."
            });
        }

        // Pacing governor: caps before any submission (NOT consumed on block — retry works).
        var pacing = await _governor.CheckCanSubmitAsync(request.UserId, approval.SessionId, cancellationToken);
        if (!pacing.Allowed)
        {
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = pacing.ReasonCode ?? "governor_cap",
                Message = pacing.Message ?? "Pacing governor blocked this submission."
            });
        }

        // Atomic single-use consume: exactly one concurrent decider can flip
        // Pending (or Approved-but-unconsumed governor re-entry) to Consumed.
        // Losers see 0 rows and report approval_not_pending — no double submit.
        var consumedAt = DateTime.UtcNow;
        var consumedRows = await _context.AkshApprovals
            .Where(a => a.Id == approval.Id
                && (a.Status == AkshApprovalStatus.Pending
                    || (a.Status == AkshApprovalStatus.Approved && a.ConsumedAtUtc == null)))
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.Status, AkshApprovalStatus.Consumed)
                .SetProperty(a => a.ConsumedAtUtc, consumedAt)
                .SetProperty(a => a.DecidedAtUtc, consumedAt),
                cancellationToken);
        if (consumedRows == 0)
        {
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "approval_not_pending",
                Message = $"Approval is no longer decidable (concurrent decision won). Current state is final."
            });
        }

        // We hold the single consume: mirror it onto the tracked entity and dispatch.
        // copilotMode:false = finalize-authorized-submission path.
        approval.Status = AkshApprovalStatus.Consumed;
        approval.ConsumedAtUtc = consumedAt;
        approval.DecidedAtUtc ??= consumedAt;
        approval.Session.Status = AkshSessionStatus.Executing;

        // Approve-with-edits: apply candidate corrections to prefilled answers before dispatch.
        if (!string.IsNullOrWhiteSpace(request.EditedAnswersJson))
        {
            TryApplyEditedAnswers(queueItem, request.EditedAnswersJson);
        }
        await _context.SaveChangesAsync(cancellationToken);

        var execResult = await _sender.Send(
            new ExecuteApplicationQueueItemCommand(request.UserId, queueItemId, headed, CopilotMode: false),
            cancellationToken);

        if (execResult.IsFailure || execResult.Value == null)
        {
            // Retryable: the provider reported explicit failure, so nothing was
            // submitted — return the approval to Pending (decidable again, gate
            // reappears) instead of bricking it as Consumed.
            approval.Status = AkshApprovalStatus.Pending;
            approval.ConsumedAtUtc = null;
            approval.DecidedAtUtc = null;
            approval.Session.Status = AkshSessionStatus.AwaitingApproval;
            await _context.SaveChangesAsync(cancellationToken);
            return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
            {
                Approved = false,
                ReasonCode = "execution_failed_retryable",
                Message = (execResult.Error ?? "Execution failed.") + " Nothing was submitted — approve again to retry.",
                QueueItemId = queueItemId,
            });
        }

        var automation = execResult.Value;
        approval.Session.Status = automation.PausedForUserReview
            ? AkshSessionStatus.Paused
            : automation.Success ? AkshSessionStatus.Completed : AkshSessionStatus.Failed;
        await _context.SaveChangesAsync(cancellationToken);

        return Result<AkshDecisionResultDto>.Success(new AkshDecisionResultDto
        {
            Approved = true,
            ReasonCode = automation.PausedForUserReview ? "paused_for_review" : automation.Success ? "submitted" : "execution_failed",
            Message = automation.Message,
            QueueItemId = queueItemId,
            QueueStatus = automation.PausedForUserReview ? "PausedForUserReview" : automation.Success ? "Submitted" : "Failed",
        });
    }

    public async Task<Result<List<AkshSessionDto>>> Handle(GetAkshSessionsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.AkshSessions.Where(s => s.UserId == request.UserId);

        if (request.ActiveOnly)
        {
            query = query.Where(s =>
                s.Status == AkshSessionStatus.Planning ||
                s.Status == AkshSessionStatus.Executing ||
                s.Status == AkshSessionStatus.AwaitingApproval ||
                s.Status == AkshSessionStatus.Paused);
        }

        var sessions = await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        return Result<List<AkshSessionDto>>.Success(sessions.Select(MapSession).ToList());
    }

    public async Task<Result<AkshAuditDto>> Handle(GetAkshAuditQuery request, CancellationToken cancellationToken)
    {
        var session = await _context.AkshSessions
            .Include(s => s.Messages)
            .Include(s => s.Approvals)
            .FirstOrDefaultAsync(s => s.Id == request.SessionId && s.UserId == request.UserId, cancellationToken);

        if (session == null)
        {
            return Result<AkshAuditDto>.Failure("Session not found.");
        }

        return Result<AkshAuditDto>.Success(new AkshAuditDto
        {
            Session = MapSession(session),
            Messages = session.Messages.OrderBy(m => m.CreatedAtUtc).Select(m => new AkshMessageDto
            {
                Id = m.Id,
                Role = m.Role,
                ToolName = m.ToolName,
                SummaryText = m.SummaryText,
                ArtifactRef = m.ArtifactRef,
                InputTokens = m.InputTokens,
                OutputTokens = m.OutputTokens,
                CreatedAtUtc = m.CreatedAtUtc,
            }).ToList(),
            Approvals = session.Approvals.OrderBy(a => a.CreatedAtUtc).Select(a => new AkshApprovalDto
            {
                Id = a.Id,
                SessionId = a.SessionId,
                QueueItemId = a.QueueItemId,
                ToolName = a.ToolName,
                ArgumentsJson = a.ArgumentsJson,
                Status = a.Status,
                ExpiresAtUtc = a.ExpiresAtUtc,
                DecidedAtUtc = a.DecidedAtUtc,
            }).ToList(),
        });
    }

    private static void TryApplyEditedAnswers(ApplicationQueueItem queueItem, string editedAnswersJson)
    {
        try
        {
            var edits = JsonSerializer.Deserialize<List<EditedAnswer>>(editedAnswersJson) ?? new();
            if (edits.Count == 0)
            {
                return;
            }

            var current = JsonSerializer.Deserialize<List<ScreeningQuestionAnswerDto>>(queueItem.PrefilledAnswersJson) ?? new();
            foreach (var edit in edits)
            {
                if (string.IsNullOrWhiteSpace(edit.Question) || edit.Answer == null)
                {
                    continue;
                }

                var match = current.FirstOrDefault(a =>
                    string.Equals(a.QuestionText?.Trim(), edit.Question.Trim(), StringComparison.OrdinalIgnoreCase));
                if (match != null)
                {
                    match.AnswerText = edit.Answer;
                }
            }

            queueItem.PrefilledAnswersJson = JsonSerializer.Serialize(current);
        }
        catch
        {
            // Non-fatal: malformed edits never block an approved submission.
        }
    }

    private sealed class EditedAnswer
    {
        public string Question { get; set; } = string.Empty;
        public string? Answer { get; set; }
    }

    private static AkshSessionDto MapSession(AkshSession session)
    {
        List<AkshTodoItemDto> todos = new();
        try
        {
            todos = JsonSerializer.Deserialize<List<AkshTodoItemDto>>(session.TodoJson) ?? new();
        }
        catch
        {
            // Corrupt plan JSON degrades to an empty plan, never a crash.
        }

        return new AkshSessionDto
        {
            Id = session.Id,
            UserId = session.UserId,
            Goal = session.Goal,
            JobUrl = session.JobUrl,
            AutonomyLevel = session.AutonomyLevel,
            Status = session.Status,
            Todos = todos,
            TokenInputTotal = session.TokenInputTotal,
            TokenOutputTotal = session.TokenOutputTotal,
            CreatedAtUtc = session.CreatedAtUtc,
        };
    }
}
