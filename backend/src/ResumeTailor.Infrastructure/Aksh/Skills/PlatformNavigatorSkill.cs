using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class PlatformNavigatorSkill : IAkshSkill
{
    public string Id => "platform-navigator";
    public string DisplayName => "Platform Guide & Workflow Navigator";
    public string Description => "Guides candidates through Vedha AI features, pages, workflows, Chrome extension, and settings.";
    public IReadOnlyList<string> RequiredTools => new[] { AkshTools.GetCandidateProfile, AkshTools.GetApplicationQueue };

    private static readonly string[] TriggerKeywords =
    [
        "how do i use", "how to use the", "where can i", "where do i", "in the studio",
        "in settings", "chrome extension", "features of vedha", "what can this app do",
        "features of this app", "how does vedha work", "review gateway", "orchestrator page",
        "tailor page", "tracker page", "walkthrough", "autofill extension"
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
            "SKILL ACTIVE: Platform Guide & Workflow Navigator\n" +
            "Specialized Directives:\n" +
            "1. You are the official interactive guide for the Vedha AI platform.\n" +
            "2. Provide accurate, formatted, step-by-step instructions with clickable markdown navigation links:\n" +
            "   - **Master Resume Studio** (`/studio`): Upload and parse Master Resumes (PDF/DOCX), edit verified work experience, and craft impact bullets using Google's XYZ formula.\n" +
            "   - **AI Resume Tailoring** (`/tailor`): Paste any Job Description (JD) to generate bespoke ATS-optimized resumes with match scores, keyword density audits, and bullet adjustments.\n" +
            "   - **Job Orchestrator & Review Gateway** (`/orchestrator`): Track automated application jobs across `PendingReview`, `Approved`, and `Submitted` states. Inspect AI-generated screening answers and approve submission with one click.\n" +
            "   - **Chrome Extension Copilot**: Injects floating HUD directly into LinkedIn Easy Apply, Greenhouse, Lever, Ashby, Workday, Indeed, and Naukri. Extracts job specs, auto-fills multi-step forms using React synthetic event dispatch, and syncs session tokens.\n" +
            "   - **Ask Aksh AI Agent** (`/aksh`): Your conversational career copilot for instant resume tailoring, interview prep, salary negotiation, and queue audits.\n" +
            "   - **Settings & AI Providers** (`/settings`): Configure custom API keys (Google Gemini 2.5 Flash, OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet) and set autonomy levels (Supervised, SemiAutonomous, Autonomous).\n" +
            "3. If the user asks about their own account status, tokens, or profile, call `get_candidate_profile` or `get_application_queue` to provide personalized answers.\n" +
            "4. Enforce the strict domain guardrail: only answer questions regarding Vedha AI features and the candidate's professional career data.";
    }
}
