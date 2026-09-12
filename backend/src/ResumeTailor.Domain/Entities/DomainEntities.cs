using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Domain.Entities;

public class ResumeVersion : AuditableEntity
{
    public Guid MasterResumeId { get; set; }
    public MasterResume? MasterResume { get; set; }

    public int VersionNumber { get; set; }
    public string ChangeDescription { get; set; } = string.Empty;
    public string StructuredJsonSnapshot { get; set; } = "{}";
}

public class JobDescription : AuditableEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public JobSource Source { get; set; } = JobSource.DirectText;
    public string? SourceUrl { get; set; }
    
    public string TargetCompany { get; set; } = string.Empty;
    public string TargetRole { get; set; } = string.Empty;
    public string RawText { get; set; } = string.Empty;
    public string CleanedText { get; set; } = string.Empty;
    
    // JSON serialized string of JobDescriptionSchema
    public string ExtractedSchemaJson { get; set; } = "{}";
}

public class GeneratedResume : AuditableEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid MasterResumeId { get; set; }
    public MasterResume? MasterResume { get; set; }

    public Guid JobDescriptionId { get; set; }
    public JobDescription? JobDescription { get; set; }

    public string TargetRole { get; set; } = string.Empty;
    public string TargetCompany { get; set; } = string.Empty;

    // JSON serialized string of tailored ResumeSchema
    public string TailoredStructuredJson { get; set; } = "{}";
    public string DiffSummaryJson { get; set; } = "{}";

    public TemplateStyle SelectedTemplate { get; set; } = TemplateStyle.ClassicAts;
    public AiProviderType GeneratedWithProvider { get; set; }
    public string ModelName { get; set; } = string.Empty;

    public AtsAnalysis? AtsAnalysis { get; set; }
    public ApplicationRecord? ApplicationRecord { get; set; }
}

public class AtsAnalysis : AuditableEntity
{
    public Guid GeneratedResumeId { get; set; }
    public GeneratedResume? GeneratedResume { get; set; }

    public int MatchScore { get; set; }
    
    // JSON serialized string of AtsScoreBreakdown
    public string AnalysisDataJson { get; set; } = "{}";
    
    public string RecruiterFeedbackSummary { get; set; } = string.Empty;
    public int MatchingKeywordsCount { get; set; }
    public int MissingKeywordsCount { get; set; }
}

public class ApplicationRecord : AuditableEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid? GeneratedResumeId { get; set; }
    public GeneratedResume? GeneratedResume { get; set; }

    public string CompanyName { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string? JobUrl { get; set; }
    public string? Location { get; set; }
    public string? SalaryRange { get; set; }
    
    public ApplicationStatus Status { get; set; } = ApplicationStatus.Saved;
    public DateTime? AppliedDate { get; set; }
    public DateTime? NextInterviewDate { get; set; }
    
    public string? Notes { get; set; }
    public string? ContactPerson { get; set; }
    public string? ContactEmail { get; set; }
}

public class PromptTemplate : AuditableEntity
{
    public Guid? UserId { get; set; } // Null for system defaults
    public User? User { get; set; }

    public string TemplateKey { get; set; } = string.Empty; // e.g., "ResumeParser", "JobExtractor", "ResumeTailor", "AtsScoring", "CoverLetter", "InterviewPrep"
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public string UserPromptTemplate { get; set; } = string.Empty;
    public bool IsDefault { get; set; } = false;
}

public class UsageLog : AuditableEntity
{
    public Guid UserId { get; set; }
    public string Action { get; set; } = string.Empty; // Scrape, ParseResume, TailorResume, ExportPdf, etc.
    public AiProviderType? Provider { get; set; }
    public string? Model { get; set; }
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public double LatencyMs { get; set; }
    public bool IsSuccess { get; set; }
    public string? ErrorMessage { get; set; }
}
