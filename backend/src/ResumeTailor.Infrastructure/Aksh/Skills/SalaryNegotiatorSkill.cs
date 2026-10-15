using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class SalaryNegotiatorSkill : IAkshSkill
{
    public string Id => "salary-negotiator";
    public string DisplayName => "Compensation Benchmarking & Negotiation";
    public string Description => "Analyzes total compensation, formulates counter-offers, and scripts professional salary negotiation conversations.";
    public IReadOnlyList<string> RequiredTools => new[] { AkshTools.GetCandidateProfile, AkshTools.RecallMemory };

    private static readonly string[] TriggerKeywords =
    [
        "salary", "ctc", "compensation", "negotiate", "negotiation", "counter offer",
        "offer letter", "equity", "rsu", "bonus", "market rate", "pay range", "raise"
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
            "1. Inspect candidate compensation baseline and currency by calling `get_candidate_profile`.\n" +
            "2. Break down Total Compensation (TC) across Base Salary, Performance Bonuses, Signing Bonus, and Equity/RSU vesting schedules.\n" +
            "3. Help the candidate establish a firm walk-away number, target number, and anchor number.\n" +
            "4. Provide realistic, respectful counter-offer email templates and verbal talking points for conversations with recruiters.\n" +
            "5. Advise on non-salary levers: remote flexibility, signing bonus, extra PTO, accelerated vesting, and review cycles.\n" +
            "6. PROACTIVE INPUT ELICITATION: If the candidate asks for salary or offer negotiation advice without providing concrete offer details, ask them for:\n" +
            "   a) The company name, role title/level, and location (or remote status);\n" +
            "   b) The offer breakdown (Base salary, annual bonus %, equity/RSU grant over 4 years, signing bonus);\n" +
            "   c) Any competing offers or deadlines so you can craft an optimal leverage strategy.\n" +
            "7. DOMAIN GUARDRAIL: Limit all advice strictly to career compensation, offer evaluations, and Vedha AI features. Politely decline off-topic requests.";
    }
}
