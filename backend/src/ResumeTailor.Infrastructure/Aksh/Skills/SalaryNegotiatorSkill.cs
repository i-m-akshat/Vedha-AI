using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class SalaryNegotiatorSkill : IAkshSkill
{
    public string Id => "salary-negotiator";
    public string DisplayName => "Compensation Benchmarking & Negotiation";
    public string Description => "Analyzes total compensation, formulates counter-offers, and scripts professional salary negotiation conversations.";
    public IReadOnlyList<string> RequiredTools => new[] { AkshTools.GetCandidateProfile, AkshTools.RecallMemory };

    public IReadOnlyList<string> SuggestedChips => new[]
    {
        "How do I negotiate a higher base salary?",
        "Evaluate my offer: Base, Bonus, and RSUs",
        "Script an email counter-offer for more equity",
        "What non-salary benefits should I negotiate?"
    };

    private static readonly string[] TriggerKeywords =
    [
        "salary", "ctc", "compensation", "negotiate", "negotiation", "counter offer", "counter-offer",
        "offer letter", "equity", "rsu", "bonus", "market rate", "pay range", "raise", "total comp"
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
            "SKILL ACTIVE: Compensation Benchmarking & Negotiation\n" +
            "Specialized Directives:\n" +
            "1. You are a senior executive compensation strategist and negotiation coach. Converse naturally, strategically, and with realistic market intelligence.\n" +
            "2. For general compensation benchmarks, offer negotiation strategies, and counter-offer principles, respond directly with structured Markdown. When calculating personalized numbers or adjusting for the candidate's verified baseline, call `get_candidate_profile`.\n" +
            "3. Break down Total Compensation (TC) across Base Salary, Performance Bonuses, Signing Bonus, and Equity/RSU vesting schedules (including 1-year cliffs and backloading).\n" +
            "4. Help the candidate establish a firm walk-away number, target number, and anchor number.\n" +
            "5. Provide realistic, respectful counter-offer email templates and verbal talking points for recruiter calls.\n" +
            "6. Advise on non-salary levers: remote flexibility, signing bonus, extra PTO, accelerated vesting, and title/level review cycles.\n" +
            "7. PROACTIVE INPUT ELICITATION: If the candidate asks for salary or offer negotiation advice without providing concrete offer details, ask them for:\n" +
            "   a) The company name, role title/level, and location (or remote status);\n" +
            "   b) The offer breakdown (Base salary, annual bonus %, equity/RSU grant over 4 years, signing bonus);\n" +
            "   c) Any competing offers or deadlines so you can craft an optimal leverage strategy.\n" +
            "8. DOMAIN GUARDRAIL: Limit all advice strictly to career compensation, offer evaluations, and Vedha AI features. Politely decline off-topic requests.";
    }
}
