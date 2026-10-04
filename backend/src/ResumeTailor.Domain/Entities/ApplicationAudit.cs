using ResumeTailor.Domain.Common;

namespace ResumeTailor.Domain.Entities;

public class ApplicationAudit : AuditableEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string JobTitle { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string JobUrl { get; set; } = string.Empty;

    // Status: pending, generating_resume, applying, success, failed, hitl_required
    public string Status { get; set; } = "pending";

    public string? ResumeS3Url { get; set; }
    public string? ErrorMessage { get; set; }

    // Human-In-The-Loop (HitL) context
    public string? HitlQuestion { get; set; }
    public string? HitlAnswer { get; set; }

    public DateTime? AppliedAtUtc { get; set; }
}
