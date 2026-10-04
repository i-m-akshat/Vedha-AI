namespace ResumeTailor.Domain.Entities;

public class IdempotentTransaction
{
    // Idempotency key (e.g. application_id or webhook event ID)
    public string IdempotencyKey { get; set; } = string.Empty;

    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid ApplicationId { get; set; }
    public int CreditsDeducted { get; set; } = 1;
    public DateTime ProcessedAtUtc { get; set; } = DateTime.UtcNow;
}
