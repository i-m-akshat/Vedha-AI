namespace ResumeTailor.Domain.ValueObjects;

public class JobDescriptionSchema
{
    public string Title { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string EmploymentType { get; set; } = string.Empty;
    public string Seniority { get; set; } = string.Empty;
    public string? ExperienceRequired { get; set; }
    public string? Salary { get; set; }
    public List<string> Responsibilities { get; set; } = new();
    public List<string> MustHaveSkills { get; set; } = new();
    public List<string> NiceToHaveSkills { get; set; } = new();
    public List<string> Tools { get; set; } = new();
    public List<string> Frameworks { get; set; } = new();
    public List<string> Databases { get; set; } = new();
    public List<string> Cloud { get; set; } = new();
    public List<string> Certifications { get; set; } = new();
    public List<string> SoftSkills { get; set; } = new();
    public List<string> Keywords { get; set; } = new();
    public List<string> Benefits { get; set; } = new();

    public void EnsureKeywordsPopulated(string? rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return;

        var knownTech = new[]
        {
            "C#", ".NET", ".NET Core", "ASP.NET", "ASP.NET MVC", "ASP.NET Web API", "ASP.NET Core", "Web API", "REST", "REST APIs", "RESTful", "Web Services",
            "Entity Framework", "Entity Framework Core", "EF Core", "LINQ", "SQL", "SQL Server", "MS SQL", "T-SQL", "PostgreSQL", "MySQL", "Oracle",
            "MongoDB", "Redis", "Elasticsearch", "NoSQL", "Angular", "AngularJS", "React", "React.js", "Vue", "Next.js", "Node.js", "TypeScript",
            "JavaScript", "HTML", "HTML5", "CSS", "CSS3", "Tailwind", "Bootstrap", "Azure", "AWS", "GCP", "Google Cloud", "Docker", "Kubernetes", "Microservices",
            "CI/CD", "DevOps", "Git", "GitHub", "GitLab", "Bitbucket", "Agile", "Scrum", "Jira", "Unit Testing", "xUnit", "NUnit", "Moq", "TDD",
            "OOP", "SOLID", "Design Patterns", "Clean Architecture", "CQRS", "MediatR", "RabbitMQ", "Kafka", "NATS", "Python", "Java", "Go", "C++"
        };

        var extracted = new HashSet<string>(Keywords, StringComparer.OrdinalIgnoreCase);
        foreach (var s in MustHaveSkills) extracted.Add(s);

        const string leftDelim = @"[\s,;:\(\)\[\]\{\}\/\-""'`]";
        const string rightDelim = @"[\s,;:\(\)\[\]\{\}\/\-""'`\.\?!]";

        foreach (var tech in knownTech)
        {
            var escaped = System.Text.RegularExpressions.Regex.Escape(tech);
            var pattern = $@"(?<=^|{leftDelim}){escaped}(?=$|{rightDelim})";
            if (System.Text.RegularExpressions.Regex.IsMatch(rawText, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            {
                extracted.Add(tech);
                if (!MustHaveSkills.Any(s => s.Equals(tech, StringComparison.OrdinalIgnoreCase)))
                {
                    MustHaveSkills.Add(tech);
                }
            }
        }

        Keywords = extracted.ToList();
    }
}

public class AtsScoreBreakdown
{
    public int OverallScore { get; set; }
    public int KeywordMatchScore { get; set; }
    public int SkillsMatchScore { get; set; }
    public int ExperienceRelevanceScore { get; set; }
    public int FormattingAtsScore { get; set; }
    
    public List<string> MatchingKeywords { get; set; } = new();
    public List<string> MissingKeywords { get; set; } = new();
    public List<string> MatchingSkills { get; set; } = new();
    public List<string> MissingSkills { get; set; } = new();
    
    public List<string> Strengths { get; set; } = new();
    public List<string> Weaknesses { get; set; } = new();
    public string RecruiterFeedback { get; set; } = string.Empty;
    public List<string> ImprovementSuggestions { get; set; } = new();
    public List<SkillRoadmapItem> SkillRoadmap { get; set; } = new();
}

public class SkillRoadmapItem
{
    public string SkillName { get; set; } = string.Empty;
    public string Priority { get; set; } = "High"; // High, Medium, Low
    public string RecommendedAction { get; set; } = string.Empty;
    public string? EstimatedLearningTime { get; set; }
}
