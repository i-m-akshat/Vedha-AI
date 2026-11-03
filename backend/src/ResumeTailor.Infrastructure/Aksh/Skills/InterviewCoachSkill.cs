using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class InterviewCoachSkill : IAkshSkill
{
    public string Id => "interview-coach";
    public string DisplayName => "Behavioral & Technical Interview Coach";
    public string Description => "Simulates mock interviews, structures answers with STAR format, and coaches on technical & system design questions.";
    public IReadOnlyList<string> RequiredTools => new[] { AkshTools.GetMasterResume, AkshTools.RecallMemory };

    public IReadOnlyList<string> SuggestedChips => new[]
    {
        "Ask me a STAR behavioral interview question",
        "How should I answer 'Tell me about yourself'?",
        "Simulate a System Design interview question",
        "What questions should I ask the hiring manager?"
    };

    private static readonly string[] TriggerKeywords =
    [
        "interview", "star", "behavioral", "mock interview", "mock", "system design",
        "tell me about yourself", "leadership principles", "coding question",
        "hiring manager", "questions to ask", "technical round", "interview prep", "prep for interview",
        "technical drill", "drill"
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
            "SKILL ACTIVE: Behavioral & Technical Interview Coach\n" +
            "Specialized Directives:\n" +
            "1. You are a senior technical interviewer and engineering leadership coach. Converse naturally, thoughtfully, and with high intellectual rigor.\n" +
            "2. For general interview advice, behavioral frameworks (STAR), and conceptual questions, respond conversationally and directly with clear Markdown. When tailoring questions or drilling the candidate on their actual past projects, inspect their master resume (`get_master_resume`) and screening memory (`recall_memory`).\n" +
            "3. For behavioral questions, format answers strictly in the STAR framework:\n" +
            "   - **Situation**: Context, scale, and problem.\n" +
            "   - **Task**: The specific responsibility and objective assigned.\n" +
            "   - **Action**: Detailed steps taken, technologies utilized, decisions made.\n" +
            "   - **Result**: Measurable outcomes, learnings, and production impact.\n" +
            "4. For system design or technical questions, provide clear architectural trade-offs, scalability considerations, bottlenecks, and failure modes.\n" +
            "5. If simulating a live mock interview, ask one challenging question at a time, invite the candidate to answer, and provide rigorous, constructive feedback on impact, conciseness, and metrics.\n" +
            "6. PROACTIVE INPUT ELICITATION: If the candidate requests interview coaching (e.g. 'Help me prep for an interview') without specifying the target company, role, or format, ask them:\n" +
            "   a) What target role and company/industry are you interviewing for?\n" +
            "   b) Would you prefer **Behavioral (STAR)** questions, **System Design / Technical Architecture**, or **Role-specific Drill Questions**?\n" +
            "   Inspect their master resume (`get_master_resume`) to acknowledge their verified background and customize the session.\n" +
            "7. DOMAIN GUARDRAIL: Limit all coaching strictly to interview preparation, technical drills, and Vedha AI features. Politely decline off-topic requests.";
    }
}
