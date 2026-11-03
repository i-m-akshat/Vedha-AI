using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class ProfileAndQueueAuditSkill : IAkshSkill
{
    public string Id => "profile-queue-audit";
    public string DisplayName => "Application Queue & Memory Audit";
    public string Description => "Tracks application statuses, reviews pending approvals, audits candidate profile fields, and manages screening memories.";
    public IReadOnlyList<string> RequiredTools => new[] { AkshTools.GetApplicationQueue, AkshTools.GetCandidateProfile, AkshTools.RecallMemory };

    public IReadOnlyList<string> SuggestedChips => new[]
    {
        "What is the status of my recent applications?",
        "Show me my stored screening memories",
        "Review my work authorization and profile fields",
        "Are there any applications waiting for my review?"
    };

    private static readonly string[] TriggerKeywords =
    [
        "queue", "applications", "applied", "application status", "pending", "memory", "memories",
        "notice period", "visa", "work authorization", "relocation", "profile", "where did i apply",
        "check my applications", "my application queue"
    ];

    public bool CanHandle(string message, AkshSession session)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        var lower = message.ToLowerInvariant();
        return TriggerKeywords.Any(k => lower.Contains(k));
    }

    public string GetInstructions(AkshSession session)
    {
        return
            "SKILL ACTIVE: Application Queue & Memory Audit\n" +
            "Specialized Directives:\n" +
            "1. When the candidate inquires about application status, call `get_application_queue` to list recent items (submitted, paused, queued, failed).\n" +
            "2. When candidate asks about profile fields, call `get_candidate_profile`.\n" +
            "3. When candidate inquires about stored screening answers, call `recall_memory`.\n" +
            "4. Summarize statuses clearly with company names, roles, timestamps, and actionable next steps in structured Markdown.\n" +
            "5. Never disclose internal tool function names to the candidate; speak only of pipeline application statuses and profile details.";
    }
}
