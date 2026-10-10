using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.Orchestrator;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Application.Features.ExtensionDispatch;

/// <summary>
/// Phase 4 backend-to-extension dispatch (claim-based pull model).
/// The extension polls, atomically claims one run, executes it in the
/// candidate's own browser, and posts receipts. The claim ticket's PK on
/// QueueItemId is the atomicity gate — no raw SQL, provider-agnostic.
/// </summary>
public class ExtensionRunPackageDto
{
    public Guid RunId { get; set; }
    public Guid ClaimToken { get; set; }
    public string JobUrl { get; set; } = string.Empty;
    public string ResolvedDestinationUrl { get; set; } = string.Empty;
    public string TargetCompany { get; set; } = string.Empty;
    public string TargetRole { get; set; } = string.Empty;
    public string CoverLetterText { get; set; } = string.Empty;
    public List<ScreeningQuestionAnswerDto> PrefilledAnswers { get; set; } = new();
    public bool Headed { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
}

public class ExtensionReceiptResultDto
{
    public bool Accepted { get; set; }
    public string ReasonCode { get; set; } = string.Empty;
    public PipelineExecutionStatus Status { get; set; }
}

/// <summary>Null <see cref="Result{T}.Value"/> means "no dispatched runs" → controller returns 204.</summary>
public record ClaimExtensionRunQuery(Guid UserId) : IRequest<Result<ExtensionRunPackageDto?>>;

public record PostExtensionReceiptCommand(
    Guid UserId,
    Guid QueueItemId,
    Guid ClaimToken,
    string State,
    int? FilledCount = null,
    int? EscalatedCount = null,
    string? Message = null,
    List<string>? Logs = null
) : IRequest<Result<ExtensionReceiptResultDto>>;

public class ExtensionDispatchHandlers :
    IRequestHandler<ClaimExtensionRunQuery, Result<ExtensionRunPackageDto?>>,
    IRequestHandler<PostExtensionReceiptCommand, Result<ExtensionReceiptResultDto>>
{
    /// <summary>Claim lease: receipts double as heartbeats; the sweeper releases older claims.</summary>
    public static readonly TimeSpan ClaimLease = TimeSpan.FromMinutes(10);

    private static readonly PipelineExecutionStatus[] TerminalStatuses =
    {
        PipelineExecutionStatus.Submitted,
        PipelineExecutionStatus.Failed,
        PipelineExecutionStatus.Cancelled,
    };

    private readonly IApplicationDbContext _context;
    private readonly ISender _sender;

    public ExtensionDispatchHandlers(IApplicationDbContext context, ISender sender)
    {
        _context = context;
        _sender = sender;
    }

    public async Task<Result<ExtensionRunPackageDto?>> Handle(ClaimExtensionRunQuery request, CancellationToken cancellationToken)
    {
        // Try the oldest dispatchable items; a lost atomic race simply moves to the next.
        var candidateIds = await _context.ApplicationQueueItems
            .Where(q => q.UserId == request.UserId && q.Status == PipelineExecutionStatus.DispatchedToExtension)
            .OrderBy(q => q.CreatedAtUtc)
            .Select(q => q.Id)
            .Take(3)
            .ToListAsync(cancellationToken);

        foreach (var candidateId in candidateIds)
        {
            var package = await TryClaimAsync(request.UserId, candidateId, cancellationToken);
            if (package != null)
                return Result<ExtensionRunPackageDto?>.Success(package);
        }

        return Result<ExtensionRunPackageDto?>.Success(null);
    }

    private async Task<ExtensionRunPackageDto?> TryClaimAsync(Guid userId, Guid queueItemId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var token = Guid.NewGuid();

        var ticket = new ExtensionRunClaim
        {
            QueueItemId = queueItemId,
            UserId = userId,
            ClaimToken = token,
            ClaimedAtUtc = now,
        };

        var attached = false;
        try
        {
            // NOTE: Add() itself can throw the tracking conflict when this
            // scope already tracks the winner's ticket — it belongs in try.
            _context.ExtensionRunClaims.Add(ticket);
            attached = true;
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is DbUpdateException || ex is InvalidOperationException)
        {
            // Lost the atomic race: PK clash across processes surfaces as
            // DbUpdateException; an already-tracked ticket in a shared scope
            // surfaces as InvalidOperationException. Either way this run is
            // held elsewhere — remove ONLY our loser entry (still Added, so
            // this detaches with no DELETE) and move to the next candidate.
            // Skipped when Add() itself threw: nothing was attached then.
            if (attached)
                _context.ExtensionRunClaims.Remove(ticket);
            return null;
        }

        var item = await _context.ApplicationQueueItems
            .FirstOrDefaultAsync(q => q.Id == queueItemId && q.UserId == userId, cancellationToken);
        if (item == null || item.Status != PipelineExecutionStatus.DispatchedToExtension)
        {
            // Item vanished or left dispatchable state between select and claim
            // (cancelled, executed elsewhere): release the ticket, move on.
            var orphan = await _context.ExtensionRunClaims
                .FirstOrDefaultAsync(c => c.QueueItemId == queueItemId, cancellationToken);
            if (orphan != null)
                _context.ExtensionRunClaims.Remove(orphan);
            await _context.SaveChangesAsync(cancellationToken);
            return null;
        }

        item.Status = PipelineExecutionStatus.RunningAutomation;
        item.ClaimedAtUtc = now;
        item.ClaimToken = token;
        AppendLogs(item, new[] { $"[{now:HH:mm:ss}] [Dispatch] Claimed by browser extension (lease {ClaimLease.TotalMinutes:0}m). Run the posting tab to execute." });
        await _context.SaveChangesAsync(cancellationToken);

        return new ExtensionRunPackageDto
        {
            RunId = item.Id,
            ClaimToken = token,
            JobUrl = item.JobUrl,
            ResolvedDestinationUrl = item.ResolvedDestinationUrl,
            TargetCompany = item.TargetCompany,
            TargetRole = item.TargetRole,
            CoverLetterText = item.CoverLetterText,
            PrefilledAnswers = ParseAnswers(item.PrefilledAnswersJson),
            Headed = false,
            ExpiresAtUtc = now + ClaimLease,
        };
    }

    public async Task<Result<ExtensionReceiptResultDto>> Handle(PostExtensionReceiptCommand request, CancellationToken cancellationToken)
    {
        var state = (request.State ?? string.Empty).Trim().ToLowerInvariant();

        var item = await _context.ApplicationQueueItems
            .FirstOrDefaultAsync(q => q.Id == request.QueueItemId && q.UserId == request.UserId, cancellationToken);
        if (item == null)
            return Result<ExtensionReceiptResultDto>.Failure("run_not_found");

        if (item.Status == PipelineExecutionStatus.Cancelled)
            return Result<ExtensionReceiptResultDto>.Failure("run_cancelled");

        // Idempotent terminal receipts: a retried terminal POST converges, never conflicts.
        if (item.Status == PipelineExecutionStatus.Submitted && state == "submitted")
            return Result<ExtensionReceiptResultDto>.Success(new ExtensionReceiptResultDto { Accepted = true, ReasonCode = "already_submitted", Status = item.Status });
        if (item.Status == PipelineExecutionStatus.Failed && state == "failed")
            return Result<ExtensionReceiptResultDto>.Success(new ExtensionReceiptResultDto { Accepted = true, ReasonCode = "already_failed", Status = item.Status });
        if (TerminalStatuses.Contains(item.Status))
            return Result<ExtensionReceiptResultDto>.Failure("stale_claim");

        var ticket = await _context.ExtensionRunClaims
            .FirstOrDefaultAsync(c => c.QueueItemId == item.Id, cancellationToken);
        if (ticket == null || ticket.UserId != request.UserId || ticket.ClaimToken != request.ClaimToken)
            return Result<ExtensionReceiptResultDto>.Failure("stale_claim");

        var now = DateTime.UtcNow;
        ticket.ClaimedAtUtc = now; // every accepted receipt is a heartbeat
        item.ClaimedAtUtc = now;

        var summary = $"filled={request.FilledCount ?? 0} escalated={request.EscalatedCount ?? 0}"
            + (string.IsNullOrWhiteSpace(request.Message) ? string.Empty : $" — {request.Message!.Trim()}");

        switch (state)
        {
            case "started":
            case "step":
                AppendLogs(item, (request.Logs ?? new()).Prepend($"[{now:HH:mm:ss}] [Dispatch:{state}] {summary}"));
                await SyncAkshSessionAsync(request.UserId, item.Id, AkshSessionStatus.Executing, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<ExtensionReceiptResultDto>.Success(new ExtensionReceiptResultDto { Accepted = true, ReasonCode = state, Status = item.Status });

            case "paused":
                AppendLogs(item, (request.Logs ?? new()).Prepend($"[{now:HH:mm:ss}] [Dispatch:paused] {summary}"));
                item.Status = PipelineExecutionStatus.PausedForUserReview;
                RemoveTicket(ticket);
                await SyncAkshSessionAsync(request.UserId, item.Id, AkshSessionStatus.Paused, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<ExtensionReceiptResultDto>.Success(new ExtensionReceiptResultDto { Accepted = true, ReasonCode = "paused", Status = item.Status });

            case "submitted":
                AppendLogs(item, (request.Logs ?? new()).Prepend($"[{now:HH:mm:ss}] [Dispatch:submitted] {summary}"));
                RemoveTicket(ticket);
                await SyncAkshSessionAsync(request.UserId, item.Id, AkshSessionStatus.Completed, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);
                // Reuse the standard submitted path (AppliedAtUtc + tracker upsert).
                await _sender.Send(new UpdateApplicationQueueStatusCommand(
                    request.UserId, item.Id, PipelineExecutionStatus.Submitted), cancellationToken);
                return Result<ExtensionReceiptResultDto>.Success(new ExtensionReceiptResultDto { Accepted = true, ReasonCode = "submitted", Status = PipelineExecutionStatus.Submitted });

            case "failed":
                AppendLogs(item, (request.Logs ?? new()).Prepend($"[{now:HH:mm:ss}] [Dispatch:failed] {summary}"));
                item.Status = PipelineExecutionStatus.Failed;
                item.ErrorMessage = string.IsNullOrWhiteSpace(request.Message) ? "Extension run reported failure." : request.Message!.Trim();
                RemoveTicket(ticket);
                await SyncAkshSessionAsync(request.UserId, item.Id, AkshSessionStatus.Failed, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<ExtensionReceiptResultDto>.Success(new ExtensionReceiptResultDto { Accepted = true, ReasonCode = "failed", Status = item.Status });

            case "cancelled":
                AppendLogs(item, new[] { $"[{now:HH:mm:ss}] [Dispatch:cancelled] Run aborted from the browser. {summary}" });
                item.Status = PipelineExecutionStatus.Cancelled;
                RemoveTicket(ticket);
                await SyncAkshSessionAsync(request.UserId, item.Id, AkshSessionStatus.Cancelled, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<ExtensionReceiptResultDto>.Success(new ExtensionReceiptResultDto { Accepted = true, ReasonCode = "cancelled", Status = item.Status });

            default:
                return Result<ExtensionReceiptResultDto>.Failure("unknown_state");
        }
    }

    private void RemoveTicket(ExtensionRunClaim ticket)
        => _context.ExtensionRunClaims.Remove(ticket);

    private async Task SyncAkshSessionAsync(Guid userId, Guid queueItemId, AkshSessionStatus status, CancellationToken cancellationToken)
    {
        var approval = await _context.AkshApprovals
            .Include(a => a.Session)
            .Where(a => a.Session != null && a.Session.UserId == userId && a.QueueItemId == queueItemId && a.ConsumedAtUtc != null)
            .OrderByDescending(a => a.ConsumedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (approval?.Session != null)
            approval.Session.Status = status;
    }

    private static void AppendLogs(ApplicationQueueItem item, IEnumerable<string> lines)
    {
        List<string> existing;
        try
        {
            existing = JsonSerializer.Deserialize<List<string>>(item.ExecutionLogsJson) ?? new();
        }
        catch
        {
            existing = new();
        }
        existing.AddRange(lines);
        item.ExecutionLogsJson = JsonSerializer.Serialize(existing.Distinct().ToList());
    }

    private static List<ScreeningQuestionAnswerDto> ParseAnswers(string json)
    {
        var answers = new List<ScreeningQuestionAnswerDto>();
        try
        {
            var rawList = JsonSerializer.Deserialize<List<JsonElement>>(string.IsNullOrWhiteSpace(json) ? "[]" : json) ?? new();
            foreach (var elem in rawList)
            {
                var qText = elem.TryGetProperty("QuestionText", out var q) ? q.GetString() ?? "" : "";
                var aText = elem.TryGetProperty("AnswerText", out var a) ? a.GetString() ?? "" : "";
                var fType = elem.TryGetProperty("FieldType", out var f) ? f.GetString() ?? "text" : "text";
                if (!string.IsNullOrWhiteSpace(qText))
                    answers.Add(new ScreeningQuestionAnswerDto { QuestionText = qText, AnswerText = aText, FieldType = fType });
            }
        }
        catch
        {
            // Malformed answers JSON must never break a claim; the run proceeds
            // with profile-driven fills and the extension reports honestly.
        }
        return answers;
    }
}
