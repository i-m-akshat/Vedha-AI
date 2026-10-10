using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Infrastructure.Orchestrator;

public class JobApplicationOrchestrator : IJobApplicationOrchestrator
{
    private readonly IApplicationDbContext _context;
    private readonly IEnumerable<IJobApplicationProvider> _providers;
    private readonly IResumeExportService _exportService;
    private readonly ITailoringProgressNotifier _progressNotifier;
    private readonly IConfiguration _configuration;

    public JobApplicationOrchestrator(
        IApplicationDbContext context,
        IEnumerable<IJobApplicationProvider> providers,
        IResumeExportService exportService,
        ITailoringProgressNotifier progressNotifier,
        IConfiguration configuration)
    {
        _context = context;
        _providers = providers;
        _exportService = exportService;
        _progressNotifier = progressNotifier;
        _configuration = configuration;
    }

    public async Task<Result<ApplicationAutomationResult>> RunPipelineAsync(
        Guid userId,
        Guid queueItemId,
        bool headed,
        bool copilotMode,
        CancellationToken cancellationToken = default)
    {
        var queueItem = await _context.ApplicationQueueItems
            .Include(q => q.GeneratedResume)
            .FirstOrDefaultAsync(q => q.Id == queueItemId && q.UserId == userId, cancellationToken);

        if (queueItem == null)
            return Result<ApplicationAutomationResult>.Failure("Queue item not found.");

        var profile = await _context.CandidateProfiles
            .FirstOrDefaultAsync(p => p.UserId == queueItem.UserId, cancellationToken)
            ?? new CandidateProfile { UserId = queueItem.UserId };

        // 1. Prepare Resume Data & PDF
        ResumeSchema resumeSchema = new();
        if (queueItem.GeneratedResume != null && !string.IsNullOrWhiteSpace(queueItem.GeneratedResume.TailoredStructuredJson))
        {
            try
            {
                resumeSchema = JsonSerializer.Deserialize<ResumeSchema>(queueItem.GeneratedResume.TailoredStructuredJson) ?? new ResumeSchema();
            }
            catch { }
        }

        // Harden against explicit JSON nulls ("personalInfo": null, "skills": null, …):
        // every downstream provider dereferences these collections unconditionally.
        resumeSchema = NormalizeResumeSchema(resumeSchema);

        var selectedTemplate = queueItem.GeneratedResume?.SelectedTemplate ?? TemplateStyle.ClassicAts;
        var pdfBytes = await _exportService.ExportPdfAsync(resumeSchema, selectedTemplate, cancellationToken);

        // 2. Prepare Answers Payload
        var answersPayload = new List<ScreeningAnswerPayload>();
        try
        {
            var rawList = JsonSerializer.Deserialize<List<JsonElement>>(queueItem.PrefilledAnswersJson) ?? new();
            foreach (var elem in rawList)
            {
                var qText = elem.TryGetProperty("QuestionText", out var q) ? q.GetString() ?? "" : "";
                var aText = elem.TryGetProperty("AnswerText", out var a) ? a.GetString() ?? "" : "";
                var fType = elem.TryGetProperty("FieldType", out var f) ? f.GetString() ?? "text" : "text";
                if (!string.IsNullOrWhiteSpace(qText))
                {
                    answersPayload.Add(new ScreeningAnswerPayload
                    {
                        QuestionText = qText,
                        AnswerText = aText,
                        FieldType = fType
                    });
                }
            }
        }
        catch { }

        // 3. Resolve Provider
        var targetUrl = !string.IsNullOrWhiteSpace(queueItem.ResolvedDestinationUrl) ? queueItem.ResolvedDestinationUrl : queueItem.JobUrl;

        var provider = _providers.FirstOrDefault(p => p.SupportedSource != JobSource.CompanyCareers && p.CanHandle(targetUrl))
                       ?? _providers.FirstOrDefault(p => p is GenericBrowserProvider)
                       ?? _providers.FirstOrDefault(); // final fallback: any registered provider

        if (provider == null)
        {
            queueItem.Status = PipelineExecutionStatus.Failed;
            queueItem.ErrorMessage = "No application provider registered.";
            await _context.SaveChangesAsync(cancellationToken);
            return Result<ApplicationAutomationResult>.Failure("No application provider registered. Check service configuration.");
        }

        // 4. Update status to Running Automation.
        // Capture the pre-run review state BEFORE overwriting: the tracked
        // entity's Status is mutated here, so testing it afterwards below
        // would always be false and finalize runs would never bypass review.
        bool wasPausedForReview = queueItem.Status == PipelineExecutionStatus.PausedForUserReview;
        queueItem.Status = PipelineExecutionStatus.RunningAutomation;
        await _context.SaveChangesAsync(cancellationToken);

        var stepLogs = new List<string>();
        try
        {
            stepLogs = JsonSerializer.Deserialize<List<string>>(queueItem.ExecutionLogsJson) ?? new();
        }
        catch { }

        async Task LogCallback(string msg)
        {
            stepLogs.Add($"[{DateTime.UtcNow:HH:mm:ss}] {msg}");
            await _progressNotifier.SendProgressAsync(queueItem.UserId, "Automating", msg, 70, cancellationToken);
        }

        await _progressNotifier.SendProgressAsync(queueItem.UserId, "Starting Pipeline", $"Launching {provider.SupportedSource} pipeline adapter...", 10, cancellationToken);

        // Determine effective review mode:
        // If the item was already paused at the review gateway OR copilotMode
        // is explicitly false, this execution represents candidate
        // authorization/finalization, so we bypass pause and finalize submission.
        bool isFinalizingSubmission = wasPausedForReview || !copilotMode;
        bool effectiveCopilotReviewMode = ResolveEffectiveReviewMode(wasPausedForReview, copilotMode, queueItem.RequiresManualReview);

        if (isFinalizingSubmission)
        {
            queueItem.RequiresManualReview = false;
        }

        var result = await provider.ExecuteFlowAsync(
            targetUrl,
            profile,
            resumeSchema,
            pdfBytes,
            queueItem.CoverLetterText,
            answersPayload,
            effectiveCopilotReviewMode,
            headed,
            LogCallback,
            cancellationToken);

        // 5. Update Status and DB
        stepLogs.AddRange(result.ExecutionLogs);

        // Phase 4 dispatch: a paused copilot run becomes a dispatched run waiting
        // for the candidate's browser extension — never log-only "staged" copy.
        // Finalize runs and worker-executed runs are untouched. Providers needed
        // no changes: every portal with a copilot branch is extension-runnable.
        bool dispatchEnabled = _configuration.GetValue<bool>("Dispatch:Enabled", true);
        if (ShouldDispatchToExtension(result.PausedForUserReview, result.Success, isFinalizingSubmission, dispatchEnabled))
        {
            queueItem.Status = PipelineExecutionStatus.DispatchedToExtension;
            stepLogs.Add($"[{DateTime.UtcNow:HH:mm:ss}] [System] Dispatched to your browser extension. Open the job posting in a tab where the Vedha extension is active — it will claim and fill this run, then report back here.");
            queueItem.ExecutionLogsJson = JsonSerializer.Serialize(stepLogs.Distinct().ToList());
            await _progressNotifier.SendProgressAsync(queueItem.UserId, "Dispatched", "Sent to your browser extension. Open the job posting to run it.", 80, cancellationToken);
        }
        else if (result.PausedForUserReview)
        {
            queueItem.Status = PipelineExecutionStatus.PausedForUserReview;
            queueItem.ExecutionLogsJson = JsonSerializer.Serialize(stepLogs.Distinct().ToList());
            await _progressNotifier.SendProgressAsync(queueItem.UserId, "Review Gateway", "Application prepared. Review and authorize final submission.", 95, cancellationToken);
        }
        else if (result.Success)
        {
            queueItem.Status = PipelineExecutionStatus.Submitted;
            queueItem.AppliedAtUtc = DateTime.UtcNow;
            queueItem.RequiresManualReview = false;

            stepLogs.Add($"[{DateTime.UtcNow:HH:mm:ss}] [System] Application package finalized and confirmed by candidate. Marked as Submitted.");
            queueItem.ExecutionLogsJson = JsonSerializer.Serialize(stepLogs.Distinct().ToList());

            // Synchronize with Job Tracker (Applications table)
            await SyncWithJobTrackerAsync(queueItem, cancellationToken);

            await _progressNotifier.SendProgressAsync(queueItem.UserId, "Submitted", "Application successfully submitted!", 100, cancellationToken);
        }
        else
        {
            queueItem.Status = PipelineExecutionStatus.Failed;
            queueItem.ErrorMessage = result.ErrorDetails ?? result.Message;
            queueItem.ExecutionLogsJson = JsonSerializer.Serialize(stepLogs.Distinct().ToList());
        }

        await _context.SaveChangesAsync(cancellationToken);

        return Result<ApplicationAutomationResult>.Success(result);
    }

    /// <summary>
    /// Phase 4 dispatch predicate: a successful paused copilot run becomes a
    /// dispatched run when the flag is on. Finalize runs and worker failures
    /// never dispatch. Pure for the review matrix (see ExtensionDispatchTests).
    /// </summary>
    public static bool ShouldDispatchToExtension(bool pausedForReview, bool success, bool isFinalizing, bool dispatchEnabled)
        => pausedForReview && success && !isFinalizing && dispatchEnabled;

    /// <summary>
    /// Resolves whether this run must pause at the review gateway.
    /// Finalize runs (previously paused, or copilot explicitly off) bypass
    /// review; all other runs pause when copilot mode or the package demands it.
    /// Kept as a pure function so the review-mode matrix is unit-testable
    /// without a database (regression: the tracked-entity status check used
    /// to run after the status had already been overwritten to Running).
    /// </summary>
    public static bool ResolveEffectiveReviewMode(bool wasPausedForReview, bool copilotMode, bool requiresManualReview)
    {
        bool isFinalizingSubmission = wasPausedForReview || !copilotMode;
        return !isFinalizingSubmission && (copilotMode || requiresManualReview);
    }

    /// <summary>
    /// Normalizes a deserialized resume so no collection or personal-info reference
    /// stays null. Guards the execute path against NullReference 500s from AI-shaped JSON.
    /// </summary>
    public static ResumeSchema NormalizeResumeSchema(ResumeSchema? schema)
    {
        schema ??= new ResumeSchema();
        schema.PersonalInfo ??= new PersonalInfo();
        schema.Summary ??= string.Empty;
        schema.Experience ??= new();
        schema.Projects ??= new();
        schema.Skills ??= new();
        schema.Education ??= new();
        schema.Certifications ??= new();
        schema.Achievements ??= new();
        return schema;
    }

    private async Task SyncWithJobTrackerAsync(ApplicationQueueItem queueItem, CancellationToken cancellationToken)
    {
        try
        {
            var existingApp = await _context.Applications.FirstOrDefaultAsync(
                a => a.UserId == queueItem.UserId &&
                     ((queueItem.GeneratedResumeId != null && a.GeneratedResumeId == queueItem.GeneratedResumeId) ||
                      (!string.IsNullOrEmpty(queueItem.JobUrl) && a.JobUrl == queueItem.JobUrl) ||
                      (a.CompanyName == queueItem.TargetCompany && a.JobTitle == queueItem.TargetRole)),
                cancellationToken);

            if (existingApp != null)
            {
                existingApp.Status = ApplicationStatus.Applied;
                existingApp.AppliedDate = DateTime.UtcNow;
                existingApp.Notes = string.IsNullOrWhiteSpace(existingApp.Notes)
                    ? $"Submitted via Copilot Orchestrator on {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC"
                    : $"{existingApp.Notes}\nSubmitted via Copilot Orchestrator on {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC";
                existingApp.UpdatedAtUtc = DateTime.UtcNow;
            }
            else
            {
                var newApp = new ApplicationRecord
                {
                    UserId = queueItem.UserId,
                    GeneratedResumeId = queueItem.GeneratedResumeId,
                    CompanyName = !string.IsNullOrWhiteSpace(queueItem.TargetCompany) ? queueItem.TargetCompany : "Target Company",
                    JobTitle = !string.IsNullOrWhiteSpace(queueItem.TargetRole) ? queueItem.TargetRole : "Target Role",
                    JobUrl = queueItem.JobUrl,
                    Status = ApplicationStatus.Applied,
                    AppliedDate = DateTime.UtcNow,
                    Notes = $"Submitted via Copilot Orchestrator on {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC"
                };
                _context.Applications.Add(newApp);
            }
        }
        catch
        {
            // Do not fail the overall pipeline if tracker sync encounters a non-fatal race
        }
    }
}
