using ResumeTailor.Application.Features.Aksh;
using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class JobApplicationCopilotSkill : IAkshSkill
{
    public string Id => "job-application-copilot";
    public string DisplayName => "Autonomous Job Application Copilot";
    public string Description => "Orchestrates end-to-end job application preparation, ATS tailoring, cover letters, screening answers, and supervised application dispatch.";
    public IReadOnlyList<string> RequiredTools => new[]
    {
        AkshTools.ScrapeJob,
        AkshTools.PreparePackage,
        AkshTools.AnswerScreening,
        AkshTools.CheckTruth,
        AkshTools.DraftCoverLetter,
        AkshTools.LaunchApply
    };

    public IReadOnlyList<string> SuggestedChips => new[]
    {
        "Prepare tailored application package for this job link",
        "Verify truth score against my master resume",
        "Draft a personalized cover letter",
        "Stage application for LinkedIn Easy Apply"
    };

    public bool CanHandle(string message, AkshSession session)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;

        // Triggers if a job URL is present in the current turn message
        var urls = AkshIntent.ExtractJobUrls(message);
        if (urls.Count > 0) return true;

        if (!string.IsNullOrWhiteSpace(session.JobUrl) && (AkshIntent.HasContinueIntent(message) || AkshIntent.HasApplyIntent(message) || AkshIntent.HasGenerateIntent(message)))
        {
            return true;
        }

        return AkshIntent.HasApplyIntent(message);
    }

    public string GetInstructions(AkshSession session)
    {
        return
            "SKILL ACTIVE: Autonomous Job Application Copilot\n" +
            "Specialized Directives:\n" +
            "1. Multi-Step Workflow: Plan the goal with todo tools before acting.\n" +
            "2. Grounding: Fetch details via `scrape_job` and recall candidate facts.\n" +
            "3. Packaging: Execute `prepare_package`, `answer_screening`, and `check_truth`.\n" +
            "4. Human Approval Gate: `launch_apply` is STRICTLY FORBIDDEN without explicit candidate approval in the Review Gateway.\n" +
            "5. Never invent skills or work history: all claims must pass the ATS Truth Gate against master resume data.";
    }
}
