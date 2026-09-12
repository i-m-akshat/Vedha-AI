namespace ResumeTailor.Domain.ValueObjects;

public class PersonalInfo
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? LinkedInUrl { get; set; }
    public string? GitHubUrl { get; set; }
    public string? PortfolioUrl { get; set; }
}

public class WorkExperienceItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Company { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public bool IsCurrent { get; set; }
    public List<string> Highlights { get; set; } = new();
}

public class ProjectItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Technologies { get; set; }
    public string? Url { get; set; }
    public List<string> Highlights { get; set; } = new();
}

public class EducationItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Institution { get; set; } = string.Empty;
    public string Degree { get; set; } = string.Empty;
    public string FieldOfStudy { get; set; } = string.Empty;
    public string GraduationYear { get; set; } = string.Empty;
    public string? Gpa { get; set; }
    public string? Honors { get; set; }
}

public class SkillCategory
{
    public string CategoryName { get; set; } = string.Empty;
    public List<string> Skills { get; set; } = new();
}

public class CertificationItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string IssueDate { get; set; } = string.Empty;
    public string? ExpirationDate { get; set; }
    public string? CredentialId { get; set; }
    public string? Url { get; set; }
}

public class AchievementItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Date { get; set; }
}

public class ResumeSchema
{
    public PersonalInfo PersonalInfo { get; set; } = new();
    public string Summary { get; set; } = string.Empty;
    public List<WorkExperienceItem> Experience { get; set; } = new();
    public List<ProjectItem> Projects { get; set; } = new();
    public List<SkillCategory> Skills { get; set; } = new();
    public List<EducationItem> Education { get; set; } = new();
    public List<CertificationItem> Certifications { get; set; } = new();
    public List<AchievementItem> Achievements { get; set; } = new();
}
