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
