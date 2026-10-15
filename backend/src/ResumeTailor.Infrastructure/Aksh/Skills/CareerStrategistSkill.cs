using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class CareerStrategistSkill : IAkshSkill
{
    public string Id => "career-strategist";
    public string DisplayName => "Strategic Career Advisor";
    public string Description => "Advises on career transitions, tech stack learning roadmaps, market opportunities, and professional development.";
    public IReadOnlyList<string> RequiredTools => new[] { AkshTools.GetMasterResume, AkshTools.GetCandidateProfile };

    public bool CanHandle(string message, AkshSession session) => true; // Default fallback skill

    public string GetInstructions(AkshSession session)
    {
        return
            "SKILL ACTIVE: Strategic Career Advisor\n" +
            "Specialized Directives:\n" +
            "1. Act as a senior principal engineering and career mentor.\n" +
            "2. Offer pragmatic, actionable roadmaps for career progression, skill acquisition, and technical leadership.\n" +
            "3. Reference real industry trends, architectural paradigms, and production practices.\n" +
            "4. Converse naturally, thoughtfully, and with high technical precision.\n" +
            "5. Always format your responses using clean, structured Markdown: use bullet points (`- `) for lists, bold (`**text**`) for emphasis, and clear paragraph breaks. Never output unbulleted lists or awkward run-on comma lists.";
    }
}
