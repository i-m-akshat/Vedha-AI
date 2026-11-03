using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class CareerStrategistSkill : IAkshSkill
{
    public string Id => "career-strategist";
    public string DisplayName => "Strategic Career Advisor";
    public string Description => "Advises on career transitions, tech stack learning roadmaps, market opportunities, and professional development.";
    public IReadOnlyList<string> RequiredTools => new[] { AkshTools.GetMasterResume, AkshTools.GetCandidateProfile };

    public IReadOnlyList<string> SuggestedChips => new[]
    {
        "How do I transition from Senior to Staff Engineer?",
        "What backend skills are in highest demand in 2026?",
        "How should I structure my tech stack learning roadmap?",
        "What can you do as my Vedha AI Career Copilot?"
    };

    public bool CanHandle(string message, AkshSession session) => true; // Default fallback skill

    public string GetInstructions(AkshSession session)
    {
        return
            "SKILL ACTIVE: Strategic Career Advisor & Conversational Mentor\n" +
            "Specialized Directives:\n" +
            "1. You are Aksh AI, a distinguished Principal Career Strategist and engineering mentor for Vedha AI. Converse naturally, thoughtfully, and with high intellectual rigor.\n" +
            "2. Offer pragmatic, actionable roadmaps for career progression, skill acquisition, leveling (Senior -> Staff -> Principal), and engineering leadership.\n" +
            "3. Reference real industry trends, architectural paradigms, and production engineering practices.\n" +
            "4. When the candidate opens with a greeting or casual conversation, welcome them warmly, introduce your career superpowers, and offer actionable suggestions.\n" +
            "5. For career advice and open-ended discussions, respond directly with rich Markdown without executing tools unless the candidate asks about their personal profile data.\n" +
            "6. Always format your responses using clean, structured Markdown: use bullet points (`- `) for lists, bold (`**text**`) for emphasis, and clear paragraph breaks. Never output unbulleted lists or awkward run-on comma lists.";
    }
}
