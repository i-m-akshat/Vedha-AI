using System.Text.RegularExpressions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Infrastructure.AtsEngine;

public class AtsScoringEngine : IAtsScoringEngine
{
    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
        "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
        "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
        "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
        "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
        "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd",
        "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
        "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
        "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
        "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
        "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
        "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
        "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
        "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when",
        "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's",
        "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your",
        "yours", "yourself", "yourselves"
    };

    public Result ValidateTruthPreservation(ResumeSchema masterResume, ResumeSchema tailoredResume)
    {
        var violations = new List<string>();

        // 1. Verify Companies
        var masterCompanies = masterResume.Experience
            .Select(e => Normalize(e.Company))
            .Where(c => !string.IsNullOrEmpty(c))
            .ToHashSet();

        foreach (var exp in tailoredResume.Experience)
        {
            var norm = Normalize(exp.Company);
            if (!string.IsNullOrEmpty(norm) && !masterCompanies.Contains(norm))
            {
                violations.Add($"Tailored resume introduced unauthorized company: '{exp.Company}'.");
            }
        }

        // 2. Verify Education Institutions
        var masterInstitutions = masterResume.Education
            .Select(e => Normalize(e.Institution))
            .Where(i => !string.IsNullOrEmpty(i))
            .ToHashSet();

        foreach (var edu in tailoredResume.Education)
        {
            var norm = Normalize(edu.Institution);
            if (!string.IsNullOrEmpty(norm) && !masterInstitutions.Contains(norm))
            {
                violations.Add($"Tailored resume introduced unauthorized educational institution: '{edu.Institution}'.");
            }
        }

        // 3. Verify Certifications
        var masterCerts = masterResume.Certifications
            .Select(c => Normalize(c.Name))
            .Where(c => !string.IsNullOrEmpty(c))
            .ToHashSet();

        foreach (var cert in tailoredResume.Certifications)
        {
            var norm = Normalize(cert.Name);
            if (!string.IsNullOrEmpty(norm) && !masterCerts.Contains(norm))
            {
                violations.Add($"Tailored resume introduced unauthorized certification: '{cert.Name}'.");
            }
        }

        // 4. Verify Quantitative Metric Invariants (Percentages, Dollar amounts, Multipliers, Counts)
        var masterMetrics = ExtractQuantitativeMetrics(masterResume);
        foreach (var exp in tailoredResume.Experience)
        {
            foreach (var highlight in exp.Highlights)
            {
                var tailoredMetrics = ExtractQuantitativeMetricsFromText(highlight);
                foreach (var metric in tailoredMetrics)
                {
                    if (!masterMetrics.Contains(metric))
                    {
                        violations.Add($"Tailored resume introduced unauthorized quantitative metric or claim: '{metric}' in role '{exp.Role}' at '{exp.Company}'.");
                    }
                }
            }
        }

        if (violations.Any())
        {
            return Result.Failure(string.Join(" ", violations));
        }

        return Result.Success();
    }

    public AtsScoreBreakdown CalculateScore(ResumeSchema resume, JobDescriptionSchema job)
    {
        var resumeFullText = ExtractAllResumeText(resume);
        var resumeWords = Tokenize(resumeFullText);

        // 1. Keyword Match Analysis
        var jdKeywords = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kw in job.Keywords) jdKeywords.Add(kw);
        foreach (var sk in job.MustHaveSkills) jdKeywords.Add(sk);
        foreach (var tool in job.Tools) jdKeywords.Add(tool);
        foreach (var fw in job.Frameworks) jdKeywords.Add(fw);
        foreach (var db in job.Databases) jdKeywords.Add(db);
        foreach (var cloud in job.Cloud) jdKeywords.Add(cloud);

        var matchingKeywords = new List<string>();
        var missingKeywords = new List<string>();

        foreach (var kw in jdKeywords)
        {
            if (ContainsKeyword(resumeFullText, kw))
            {
                matchingKeywords.Add(kw);
            }
            else
            {
                missingKeywords.Add(kw);
            }
        }

        var keywordScore = jdKeywords.Count > 0
            ? (int)Math.Round((double)matchingKeywords.Count / jdKeywords.Count * 100)
            : 85;

        // 2. Skills Match Analysis
        var matchingSkills = new List<string>();
        var missingSkills = new List<string>();

        var allCandidateSkills = resume.Skills.SelectMany(s => s.Skills).ToList();

        foreach (var skill in job.MustHaveSkills)
        {
            if (ContainsKeyword(resumeFullText, skill) || allCandidateSkills.Any(s => Normalize(s) == Normalize(skill)))
            {
                matchingSkills.Add(skill);
            }
            else
            {
                missingSkills.Add(skill);
            }
        }

        foreach (var skill in job.NiceToHaveSkills)
        {
            if (ContainsKeyword(resumeFullText, skill) || allCandidateSkills.Any(s => Normalize(s) == Normalize(skill)))
            {
                if (!matchingSkills.Contains(skill, StringComparer.OrdinalIgnoreCase))
                    matchingSkills.Add(skill);
            }
            else
            {
                if (!missingSkills.Contains(skill, StringComparer.OrdinalIgnoreCase))
                    missingSkills.Add(skill);
            }
        }

        var totalTargetSkills = job.MustHaveSkills.Count + job.NiceToHaveSkills.Count;
        var skillsScore = totalTargetSkills > 0
            ? (int)Math.Round((double)matchingSkills.Count / totalTargetSkills * 100)
            : 80;

        // 3. Experience Relevance & Metrics Score
        var allHighlights = resume.Experience.SelectMany(e => e.Highlights).Concat(resume.Projects.SelectMany(p => p.Highlights)).ToList();
        var metricBullets = allHighlights.Count(h => Regex.IsMatch(h, @"\d+%|\$\d+|\d+x|\b\d{2,}\b"));
        var experienceScore = allHighlights.Count > 0
            ? Math.Min(100, 60 + (int)((double)metricBullets / allHighlights.Count * 40))
            : 75;

        // 4. ATS Formatting Score
        var formattingScore = 95; // Since we generate ATS-safe single column templates without unparseable tables/graphics

        // Overall Weighted ATS Score
        var overallScore = (int)Math.Round(
            keywordScore * 0.35 +
            skillsScore * 0.35 +
            experienceScore * 0.20 +
            formattingScore * 0.10
        );

        overallScore = Math.Clamp(overallScore, 10, 98);

        // Strengths & Weaknesses
        var strengths = new List<string>();
        var weaknesses = new List<string>();

        if (matchingSkills.Count > 0)
            strengths.Add($"Strong alignment on core technical requirements: {string.Join(", ", matchingSkills.Take(4))}.");

        if (metricBullets > 0)
            strengths.Add($"{metricBullets} bullet points contain quantified business impact and performance metrics.");

        if (formattingScore >= 90)
            strengths.Add("ATS-safe single-column hierarchy ensures optimal parser readability across Greenhouse, Lever, and Workday.");

        if (missingSkills.Any())
            weaknesses.Add($"Lacks explicit coverage for: {string.Join(", ", missingSkills.Take(3))}.");

        if (keywordScore < 70)
            weaknesses.Add("Keyword density can be improved for domain-specific terminology.");

        // Recruiter Feedback
        var recruiterFeedback = overallScore switch
        {
            >= 85 => $"Candidate demonstrates exceptional alignment for the {job.Title} role at {job.Company}. Work experience is quantified with measurable achievements, and key requirements like {string.Join(", ", matchingSkills.Take(3))} are clearly highlighted.",
            >= 70 => $"Strong profile for {job.Title}. Good match on foundational technical competencies. To maximize interview conversion, focus discussions on practical experience bridging {missingSkills.FirstOrDefault() ?? "secondary stack items"}.",
            _ => $"Moderate profile match. While the candidate brings transferable experience, explicit alignment with {string.Join(", ", missingSkills.Take(3))} is limited in the current profile."
        };

        // Improvement Suggestions
        var suggestions = new List<string>
        {
            "Review bullet points to ensure STAR method (Situation, Task, Action, Result) is clearly emphasized.",
            "If you have academic or side project experience with missing skills, consider adding dedicated project highlights to your master resume.",
            "Ensure job titles reflect industry-standard naming conventions matching ATS parser taxonomies."
        };

        // Skill Roadmap
        var roadmap = missingSkills.Select((skill, index) => new SkillRoadmapItem
        {
            SkillName = skill,
            Priority = index < 2 ? "High" : "Medium",
            RecommendedAction = $"Complete a focused 5-10 hour hands-on lab or project applying {skill} to showcase practical competency.",
            EstimatedLearningTime = index < 2 ? "1-2 weeks" : "2-3 weeks"
        }).ToList();

        return new AtsScoreBreakdown
        {
            OverallScore = overallScore,
            KeywordMatchScore = keywordScore,
            SkillsMatchScore = skillsScore,
            ExperienceRelevanceScore = experienceScore,
            FormattingAtsScore = formattingScore,
            MatchingKeywords = matchingKeywords,
            MissingKeywords = missingKeywords,
            MatchingSkills = matchingSkills,
            MissingSkills = missingSkills,
            Strengths = strengths,
            Weaknesses = weaknesses,
            RecruiterFeedback = recruiterFeedback,
            ImprovementSuggestions = suggestions,
            SkillRoadmap = roadmap
        };
    }

    private static string ExtractAllResumeText(ResumeSchema resume)
    {
        var parts = new List<string>
        {
            resume.PersonalInfo.FullName,
            resume.PersonalInfo.Title ?? string.Empty,
            resume.Summary
        };

        foreach (var exp in resume.Experience)
        {
            parts.Add(exp.Company);
            parts.Add(exp.Role);
            parts.AddRange(exp.Highlights);
        }

        foreach (var proj in resume.Projects)
        {
            parts.Add(proj.Title);
            parts.Add(proj.Description);
            if (!string.IsNullOrEmpty(proj.Technologies)) parts.Add(proj.Technologies);
            parts.AddRange(proj.Highlights);
        }

        foreach (var cat in resume.Skills)
        {
            parts.Add(cat.CategoryName);
            parts.AddRange(cat.Skills);
        }

        foreach (var edu in resume.Education)
        {
            parts.Add(edu.Institution);
            parts.Add(edu.Degree);
            parts.Add(edu.FieldOfStudy);
        }

        foreach (var cert in resume.Certifications)
        {
            parts.Add(cert.Name);
            parts.Add(cert.Issuer);
        }

        return string.Join(" ", parts);
    }

    private static HashSet<string> Tokenize(string text)
    {
        var tokens = Regex.Matches(text.ToLowerInvariant(), @"\b[a-z0-9\+\#\.\-]{2,}\b")
            .Select(m => m.Value)
            .Where(w => !StopWords.Contains(w))
            .ToHashSet();

        return tokens;
    }

    private static bool ContainsKeyword(string fullText, string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword)) return false;
        var pattern = $@"\b{Regex.Escape(keyword)}\b";
        return Regex.IsMatch(fullText, pattern, RegexOptions.IgnoreCase);
    }

    public static HashSet<string> ExtractQuantitativeMetrics(ResumeSchema resume)
    {
        var text = ExtractAllResumeText(resume);
        return ExtractQuantitativeMetricsFromText(text);
    }

    public static HashSet<string> ExtractQuantitativeMetricsFromText(string text)
    {
        var metrics = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(text)) return metrics;

        // 1. Percentages (e.g. 15%, 99.9%, 40%)
        var percentMatches = Regex.Matches(text, @"\b\d+(?:\.\d+)?\s*%", RegexOptions.IgnoreCase);
        foreach (Match m in percentMatches) metrics.Add(NormalizeMetric(m.Value));

        // 2. Currencies (e.g. $500k, $1.2M, €400, ₹50L, £2M)
        var currencyMatches = Regex.Matches(text, @"(?:[\$\€\£\₹]|USD|EUR|INR|GBP)\s*\d+(?:\.\d+)?\s*(?:k|m|b|million|billion|thousand|lakh|crore)?", RegexOptions.IgnoreCase);
        foreach (Match m in currencyMatches) metrics.Add(NormalizeMetric(m.Value));

        // 3. Multipliers & Plus counts (e.g. 3x, 10x, 500+, 50k+, 10M+)
        var multiplierMatches = Regex.Matches(text, @"\b\d+(?:\.\d+)?(?:x|\+|k\+|m\+|b\+)\b", RegexOptions.IgnoreCase);
        foreach (Match m in multiplierMatches) metrics.Add(NormalizeMetric(m.Value));

        return metrics;
    }

    private static string NormalizeMetric(string metric)
    {
        return Regex.Replace(metric.ToLowerInvariant(), @"\s+", "");
    }

    private static string Normalize(string input)
    {
        return Regex.Replace(input.Trim().ToLowerInvariant(), @"[^a-z0-9]", "");
    }
}
