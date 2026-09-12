using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Domain.Entities;

public class User : AuditableEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = "User"; // User, Admin
    
    // User-specific AI configuration overrides
    public string? CustomOpenAiKey { get; set; }
    public string? CustomClaudeKey { get; set; }
    public string? CustomGeminiKey { get; set; }
    public AiProviderType PreferredAiProvider { get; set; } = AiProviderType.Gemini;
    public string? PreferredModel { get; set; }

    public ICollection<MasterResume> MasterResumes { get; set; } = new List<MasterResume>();
    public ICollection<GeneratedResume> GeneratedResumes { get; set; } = new List<GeneratedResume>();
    public ICollection<JobDescription> JobDescriptions { get; set; } = new List<JobDescription>();
    public ICollection<ApplicationRecord> Applications { get; set; } = new List<ApplicationRecord>();
    public ICollection<PromptTemplate> CustomPrompts { get; set; } = new List<PromptTemplate>();
}

public class MasterResume : AuditableEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Title { get; set; } = "Default Master Resume";
    public string OriginalFileName { get; set; } = string.Empty;
    public ResumeFormat Format { get; set; }
    public string RawExtractedText { get; set; } = string.Empty;
    
    // JSON serialized string of ResumeSchema
    public string StructuredJson { get; set; } = "{}";
    
    public bool IsActive { get; set; } = true;
    public int VersionNumber { get; set; } = 1;

    public ICollection<ResumeVersion> Versions { get; set; } = new List<ResumeVersion>();
    public ICollection<GeneratedResume> DerivedTailoredResumes { get; set; } = new List<GeneratedResume>();
}
