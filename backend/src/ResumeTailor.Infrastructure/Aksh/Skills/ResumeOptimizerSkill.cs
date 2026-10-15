using System.Text.RegularExpressions;
using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public class ResumeOptimizerSkill : IAkshSkill
{
    public string Id => "resume-optimizer";
    public string DisplayName => "Resume & ATS Bullet Optimizer";
    public string Description => "Critiques master resumes, rewrites bullets with Google's XYZ impact formula, and benchmarks ATS keyword density.";
    public IReadOnlyList<string> RequiredTools => new[] { AkshTools.GetMasterResume, AkshTools.PreparePackage, AkshTools.ScrapeJob };

    private static readonly string[] TriggerKeywords =
    [
        "resume", "cv", "bullet", "bullets", "ats", "work experience",
        "rewrite", "critique", "impact", "summary", "keywords", "score my resume",
        "tailor", "tailoring", "tailored", "customise", "customize", "target my resume"
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
            "SKILL ACTIVE: Resume & ATS Bullet Optimizer\n" +
            "Specialized Directives:\n" +
            "1. When reviewing or optimizing, call `get_master_resume` if not already loaded to ground your advice on the candidate's actual experience.\n" +
            "2. Enforce Google's XYZ Impact Formula: 'Accomplished [X] as measured by [Y], by doing [Z]'.\n" +
            "3. Replace weak verbs (e.g. 'worked on', 'helped with', 'responsible for') with decisive power verbs (e.g. 'Architected', 'Spearheaded', 'Optimized', 'Decoupled').\n" +
            "4. Quantify impact wherever possible (latency reductions, throughput increases, team size, cost savings, test coverage).\n" +
            "5. If comparing against a job description, identify critical keyword gaps and suggest exact placement in experience bullets.\n" +
            "6. Provide constructive, line-by-line before/after suggestions with bold formatting.\n" +
            "7. If the user requests to tailor their resume for a target job/company or generate the final ATS resume, and a job description or URL is provided, invoke `prepare_package` and provide the tailored bullet highlights along with the direct PDF download link `[Download Tailored Resume (PDF)](/api/resumes/{generatedResumeId}/export?format=Pdf)` directly in your chat response.\n" +
            "8. PROACTIVE INPUT ELICITATION: If the candidate requests to tailor their resume (e.g. 'I want my resume to be tailored', 'tailor my resume for a role') but HAS NOT provided the Job Description (JD) text or a job posting link, DO NOT call prepare_package or invent a job posting! Instead, acknowledge their request enthusiastically, inspect their master resume (`get_master_resume`) to acknowledge their background, and politely ask them to paste the Job Description (JD) text or share the job URL (e.g. LinkedIn, Greenhouse, Lever, Workday) so you can tailor it accurately against real requirements.\n" +
            "9. DOMAIN GUARDRAIL: Restrict all assistance strictly to resume optimization, ATS keywords, work experience bullet tailoring, and Vedha AI features. Politely decline any requests unrelated to career or resume development.";
    }
}
