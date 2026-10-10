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

        // 5. Verify Role Titles: tailored titles are routinely rewritten toward
        // the JD, so exact equality is wrong — but a title sharing ZERO
        // significant tokens with ANY master role is an invented promotion.
        var masterRoleTokens = masterResume.Experience
            .SelectMany(e => SignificantTokens(e.Role))
            .ToHashSet();
        foreach (var exp in tailoredResume.Experience)
        {
            var tailoredTokens = SignificantTokens(exp.Role);
            if (tailoredTokens.Count > 0 && masterRoleTokens.Count > 0
                && !tailoredTokens.Overlaps(masterRoleTokens))
            {
                violations.Add($"Tailored resume introduced unauthorized role title: '{exp.Role}' at '{exp.Company}' (shares no wording with any master role).");
            }
        }

        // 6. Verify Employment Dates: dates are never legitimately rewritten.
        // Matched by normalized company; start/end/IsCurrent must round-trip.
        var masterDatesByCompany = masterResume.Experience
            .Where(e => !string.IsNullOrEmpty(Normalize(e.Company)))
            .GroupBy(e => Normalize(e.Company))
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => (
                    Start: (e.StartDate ?? string.Empty).Trim(),
                    End: (e.EndDate ?? string.Empty).Trim(),
                    Current: e.IsCurrent)).ToList());
        foreach (var exp in tailoredResume.Experience)
        {
            var norm = Normalize(exp.Company);
            if (string.IsNullOrEmpty(norm) || !masterDatesByCompany.TryGetValue(norm, out var masterDates))
            {
                continue;
            }

            var tailored = (
                Start: (exp.StartDate ?? string.Empty).Trim(),
                End: (exp.EndDate ?? string.Empty).Trim(),
                Current: exp.IsCurrent);
            if (!masterDates.Any(d =>
                string.Equals(d.Start, tailored.Start, StringComparison.OrdinalIgnoreCase)
                && string.Equals(d.End, tailored.End, StringComparison.OrdinalIgnoreCase)
                && d.Current == tailored.Current))
            {
                violations.Add($"Tailored resume altered employment dates for '{exp.Company}' (was not in master history).");
            }
        }

        // 7. Verify Skills: tailoring reorders and selects, never invents.
        var masterSkills = masterResume.Skills
            .SelectMany(c => c.Skills ?? new List<string>())
            .Select(Normalize)
            .Where(s => !string.IsNullOrEmpty(s))
            .ToHashSet();
        foreach (var cat in tailoredResume.Skills)
        {
            foreach (var skill in cat.Skills ?? new List<string>())
            {
                var norm = Normalize(skill);
                if (!string.IsNullOrEmpty(norm) && !masterSkills.Contains(norm))
                {
                    violations.Add($"Tailored resume introduced unauthorized skill: '{skill}'.");
                }
            }
        }

        // 8. Verify Project Titles: bullets are rewritten, titles identify.
        var masterProjects = masterResume.Projects
            .Select(p => Normalize(p.Title))
            .Where(t => !string.IsNullOrEmpty(t))
            .ToHashSet();
        foreach (var proj in tailoredResume.Projects)
        {
            var norm = Normalize(proj.Title);
            if (!string.IsNullOrEmpty(norm) && !masterProjects.Contains(norm))
            {
                violations.Add($"Tailored resume introduced unauthorized project: '{proj.Title}'.");
            }
        }

        // 9. Verify Education Details: degree/field/year values must come from
        // the master set (reordered at most, never invented).
        var masterDegrees = masterResume.Education.Select(e => Normalize(e.Degree)).Where(s => !string.IsNullOrEmpty(s)).ToHashSet();
        var masterFields = masterResume.Education.Select(e => Normalize(e.FieldOfStudy)).Where(s => !string.IsNullOrEmpty(s)).ToHashSet();
        var masterYears = masterResume.Education.Select(e => Normalize(e.GraduationYear)).Where(s => !string.IsNullOrEmpty(s)).ToHashSet();
        foreach (var edu in tailoredResume.Education)
        {
            var degree = Normalize(edu.Degree);
            if (!string.IsNullOrEmpty(degree) && !masterDegrees.Contains(degree))
            {
                violations.Add($"Tailored resume introduced unauthorized degree: '{edu.Degree}'.");
            }

            var field = Normalize(edu.FieldOfStudy);
            if (!string.IsNullOrEmpty(field) && !masterFields.Contains(field))
            {
                violations.Add($"Tailored resume introduced unauthorized field of study: '{edu.FieldOfStudy}'.");
            }

            var year = Normalize(edu.GraduationYear);
            if (!string.IsNullOrEmpty(year) && !masterYears.Contains(year))
            {
                violations.Add($"Tailored resume introduced unauthorized graduation year: '{edu.GraduationYear}'.");
            }
        }

        if (violations.Any())
        {
            return Result.Failure(string.Join(" ", violations));
        }

        return Result.Success();
    }

    /// <summary>
    /// Significant tokens for title overlap: normalized, stopwords removed,
    /// single characters dropped. "Senior Full-Stack .NET Developer" and
    /// "Senior Software Engineer" overlap on {senior}.
    /// </summary>
    private static HashSet<string> SignificantTokens(string? text)
    {
        var tokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(text))
        {
            return tokens;
        }

        foreach (Match m in Regex.Matches(text.ToLowerInvariant(), @"[a-z0-9#+]+"))
        {
            var token = m.Value;
            if (token.Length > 2 && !StopWords.Contains(token))
            {
                tokens.Add(token);
            }
        }

        return tokens;
    }

    public AtsScoreBreakdown CalculateScore(ResumeSchema resume, JobDescriptionSchema job)
    {
        if (job.Keywords.Count == 0 && job.MustHaveSkills.Count == 0 && job.Responsibilities.Count > 0)
        {
            job.EnsureKeywordsPopulated(string.Join(" ", job.Responsibilities));
        }

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

        var allCandidateSkills = resume.Skills.SelectMany(s => s.Skills).ToList();

        foreach (var kw in jdKeywords)
        {
            if (MatchesKeyword(resumeFullText, allCandidateSkills, kw))
            {
                matchingKeywords.Add(kw);
            }
            else
            {
                missingKeywords.Add(kw);
            }
        }

        var totalTargetSkills = job.MustHaveSkills.Count + job.NiceToHaveSkills.Count;
        var hasSkillsOrKeywords = jdKeywords.Count > 0 || totalTargetSkills > 0;

        var keywordScore = jdKeywords.Count > 0
            ? (int)Math.Round((double)matchingKeywords.Count / jdKeywords.Count * 100)
            : (hasSkillsOrKeywords ? 70 : 25);

        // 2. Skills Match Analysis
        var matchingSkills = new List<string>();
        var missingSkills = new List<string>();

        foreach (var skill in job.MustHaveSkills)
        {
            if (MatchesSkill(resumeFullText, allCandidateSkills, skill))
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
            if (MatchesSkill(resumeFullText, allCandidateSkills, skill))
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

        var skillsScore = totalTargetSkills > 0
            ? (int)Math.Round((double)matchingSkills.Count / totalTargetSkills * 100)
            : (hasSkillsOrKeywords ? 70 : 25);

        // 3. Experience Relevance & Metrics Score
        var allHighlights = resume.Experience.SelectMany(e => e.Highlights).Concat(resume.Projects.SelectMany(p => p.Highlights)).ToList();
        var metricBullets = allHighlights.Count(h => Regex.IsMatch(h, @"\d+(?:\.\d+)?%|[\$\€\£\₹]\s*\d+|\b\d+(?:\.\d+)?(?:x|\+|k\+|m\+|ms|s|gb|tb)\b|\b\d{2,}\b", RegexOptions.IgnoreCase));
        var metricRatio = allHighlights.Count > 0 ? (double)metricBullets / allHighlights.Count : 0.0;
        var experienceScore = allHighlights.Count > 0
            ? Math.Min(100, (int)Math.Round(60 + (metricRatio * 40)))
            : (hasSkillsOrKeywords ? 75 : 30);

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

        if (!hasSkillsOrKeywords)
            weaknesses.Add("Could not extract technical competencies or target keywords from this job posting. Please ensure full job requirements are provided.");

        if (keywordScore < 70 && hasSkillsOrKeywords)
            weaknesses.Add("Keyword density can be improved for domain-specific terminology.");

        // Recruiter Feedback
        var recruiterFeedback = !hasSkillsOrKeywords
            ? "Target requirements could not be fully parsed from this job description. The candidate's resume format is ATS-compliant, but skill alignment cannot be verified without technical requirements."
            : overallScore switch
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

    private static readonly Dictionary<string, HashSet<string>> SkillSynonyms = BuildSynonymDictionary();

    private static bool MatchesKeyword(string resumeFullText, List<string> candidateSkills, string kw)
    {
        if (string.IsNullOrWhiteSpace(kw)) return false;

        // 1. Direct or Synonym Match in Resume Full Text
        if (ContainsKeyword(resumeFullText, kw)) return true;

        // 2. Direct normalized match against candidate skills
        var normTarget = Normalize(kw);
        if (candidateSkills.Any(s => Normalize(s) == normTarget)) return true;

        // 3. Synonym check against candidate skills
        if (SkillSynonyms.TryGetValue(kw, out var synonyms))
        {
            foreach (var syn in synonyms)
            {
                var normSyn = Normalize(syn);
                if (candidateSkills.Any(s => Normalize(s) == normSyn)) return true;
            }
        }

        return false;
    }

    private static bool MatchesSkill(string resumeFullText, List<string> candidateSkills, string targetSkill)
    {
        return MatchesKeyword(resumeFullText, candidateSkills, targetSkill);
    }

    private static bool ContainsKeyword(string fullText, string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword) || string.IsNullOrWhiteSpace(fullText)) return false;

        // Bounded match avoiding false substrings while safely handling C#, C++, .NET, CI/CD
        var pattern = $@"(?<![a-zA-Z0-9]){Regex.Escape(keyword)}(?![a-zA-Z0-9])";
        if (Regex.IsMatch(fullText, pattern, RegexOptions.IgnoreCase))
            return true;

        // Check canonical skill synonyms in full text
        if (SkillSynonyms.TryGetValue(keyword, out var synonyms))
        {
            foreach (var syn in synonyms)
            {
                var synPattern = $@"(?<![a-zA-Z0-9]){Regex.Escape(syn)}(?![a-zA-Z0-9])";
                if (Regex.IsMatch(fullText, synPattern, RegexOptions.IgnoreCase))
                    return true;
            }
        }

        return false;
    }

    private static Dictionary<string, HashSet<string>> BuildSynonymDictionary()
    {
        var clusters = new List<string[]>
        {
            new[] { "C#", "CSharp", "C Sharp" },
            new[] { ".NET", "DotNet", "Dot Net", ".NET Core", "ASP.NET", "ASP.NET Core", ".NET 8", ".NET 9" },
            new[] { "C++", "CPP", "C Plus Plus" },
            new[] { "Python", "Python3", "Py" },
            new[] { "Java", "Java 17", "Java 21", "Core Java" },
            new[] { "JavaScript", "JS", "ES6", "ECMAScript" },
            new[] { "TypeScript", "TS" },
            new[] { "Node.js", "NodeJS", "Node" },
            new[] { "React", "React.js", "ReactJS", "React Native" },
            new[] { "Angular", "AngularJS", "Angular 2+" },
            new[] { "Vue", "Vue.js", "VueJS" },
            new[] { "Next.js", "NextJS" },
            new[] { "PostgreSQL", "Postgres", "PSQL" },
            new[] { "MongoDB", "Mongo", "NoSQL" },
            new[] { "Microsoft SQL Server", "SQL Server", "MSSQL", "T-SQL" },
            new[] { "SQL", "Relational Databases", "RDBMS" },
            new[] { "Redis", "Redis Cache", "In-Memory Cache", "In-Memory Caching" },
            new[] { "Elasticsearch", "Elastic Search", "ELK" },
            new[] { "Amazon Web Services", "AWS" },
            new[] { "Microsoft Azure", "Azure" },
            new[] { "Google Cloud Platform", "GCP", "Google Cloud" },
            new[] { "Kubernetes", "K8s" },
            new[] { "Docker", "Containerization", "Containers" },
            new[] { "CI/CD", "Continuous Integration", "Continuous Deployment", "CI / CD", "GitHub Actions", "GitLab CI" },
            new[] { "Terraform", "IaC", "Infrastructure as Code" },
            new[] { "REST", "RESTful", "REST API", "REST APIs", "RESTful APIs", "Web APIs", "RESTful Web Services" },
            new[] { "Microservices", "Microservice Architecture", "Distributed Systems" },
            new[] { "GraphQL", "Apollo GraphQL" },
            new[] { "Clean Architecture", "Domain-Driven Design", "DDD", "SOLID", "Clean Code" },
            new[] { "Agile", "Scrum", "Kanban", "Sprint Planning" },
            new[] { "Unit Testing", "TDD", "Test-Driven Development", "Automated Testing", "xUnit", "NUnit", "Jest" },
            new[] { "Kafka", "Apache Kafka", "Event-Driven Architecture", "Message Queue", "RabbitMQ", "NATS" },
            new[] { "DevOps", "Site Reliability", "SRE" },
            new[] { "Object-Oriented Programming", "OOP" }
        };

        var dict = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var cluster in clusters)
        {
            foreach (var item in cluster)
            {
                if (!dict.TryGetValue(item, out var set))
                {
                    set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    dict[item] = set;
                }
                foreach (var peer in cluster)
                {
                    if (!peer.Equals(item, StringComparison.OrdinalIgnoreCase))
                        set.Add(peer);
                }
            }
        }
        return dict;
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
