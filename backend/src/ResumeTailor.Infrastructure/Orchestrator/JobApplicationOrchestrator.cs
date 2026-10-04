using System.Text.Json;
using Microsoft.EntityFrameworkCore;
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

    public JobApplicationOrchestrator(
        IApplicationDbContext context,
        IEnumerable<IJobApplicationProvider> providers,
        IResumeExportService exportService,
        ITailoringProgressNotifier progressNotifier)
    {
        _context = context;
        _providers = providers;
        _exportService = exportService;
        _progressNotifier = progressNotifier;
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

        // 4. Update status to Running Automation
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
        // If the item is already paused at the review gateway OR copilotMode is explicitly false,
        // this execution represents candidate authorization/finalization, so we bypass pause and finalize submission.
        bool isFinalizingSubmission = queueItem.Status == PipelineExecutionStatus.PausedForUserReview || !copilotMode;
        bool effectiveCopilotReviewMode = !isFinalizingSubmission && (copilotMode || queueItem.RequiresManualReview);

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
            LogCallback,
            cancellationToken);

        // 5. Update Status and DB
        stepLogs.AddRange(result.ExecutionLogs);

        if (result.PausedForUserReview)
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
