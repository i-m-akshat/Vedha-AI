using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Domain.Entities;

/// <summary>
/// One Aksh run: a candidate goal (e.g. "apply to this posting") tracked from
/// plan through approval to completion. Pure domain state; no framework types.
/// </summary>
public class AkshSession : AuditableEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Goal { get; set; } = string.Empty;
    public string? JobUrl { get; set; }
    public AutonomyLevel AutonomyLevel { get; set; } = AutonomyLevel.Supervised;
    public AkshSessionStatus Status { get; set; } = AkshSessionStatus.Planning;

    // JSON array of {step, tool, detail, state}; the visible, editable plan.
    public string TodoJson { get; set; } = "[]";

    // Estimated token ledger (see ITokenLedger): sums of per-turn estimates.
    public long TokenInputTotal { get; set; }
    public long TokenOutputTotal { get; set; }

    // Per-session turn lock (G1): at most one live turn mutates a session.
    // Claimed atomically with a lease; stale locks expire instead of wedging.
    public Guid? ActiveTurnId { get; set; }
    public DateTime? TurnStartedAtUtc { get; set; }

    public ICollection<AkshMessage> Messages { get; set; } = new List<AkshMessage>();
    public ICollection<AkshApproval> Approvals { get; set; } = new List<AkshApproval>();
}

/// <summary>
/// A persisted turn receipt — summaries and artifact references, never full
/// pasted blobs (resumes and job text are referenced by ID; see ADR-006 §11).
/// </summary>
public class AkshMessage : AuditableEntity
{
    public Guid SessionId { get; set; }
    public AkshSession? Session { get; set; }

    public string Role { get; set; } = "user"; // user | assistant | tool
    public string? ToolName { get; set; }
    public string SummaryText { get; set; } = string.Empty;
    public string? ArtifactRef { get; set; } // e.g. "queue:{guid}", "resume:{guid}"
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
}

/// <summary>
/// Single-use, tool+arguments-bound human approval. An approval authorizes one
/// exact invocation: same tool, same arguments, same session — never a blank cheque.
/// </summary>
public class AkshApproval : AuditableEntity
{
    public Guid SessionId { get; set; }
    public AkshSession? Session { get; set; }

    public Guid? QueueItemId { get; set; }
    public string ToolName { get; set; } = string.Empty;
    public string ArgumentsJson { get; set; } = "{}";
    public AkshApprovalStatus Status { get; set; } = AkshApprovalStatus.Pending;
    public DateTime? DecidedAtUtc { get; set; }
    public DateTime? ConsumedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; } = DateTime.UtcNow.AddMinutes(30);
}
