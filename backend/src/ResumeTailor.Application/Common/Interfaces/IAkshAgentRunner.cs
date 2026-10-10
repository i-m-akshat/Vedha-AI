using ResumeTailor.Application.Features.Aksh;

namespace ResumeTailor.Application.Common.Interfaces;

/// <summary>
/// Runs Aksh conversational turns. Implemented in Infrastructure (the only layer
/// allowed to touch Microsoft Agent Framework). All data access stays user-scoped.
/// </summary>
public interface IAkshAgentRunner
{
    IAsyncEnumerable<AkshStreamEvent> StreamTurnAsync(
        Guid userId,
        Guid sessionId,
        string message,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Pacing governor: submission-rate guardrails. Blocks runs BEFORE any
/// side effect (NOT consumed on block — retry works after the window passes).
/// </summary>
public record PacingDecision(bool Allowed, string? ReasonCode, string? Message)
{
    public static PacingDecision Allow() => new(true, null, null);
}

public interface IPacingGovernor
{
    Task<PacingDecision> CheckCanSubmitAsync(
        Guid userId,
        Guid currentSessionId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Token ledger: estimated per-call usage persisted for spend visibility and
/// budget enforcement. Estimates are char/4 and always labeled as estimates —
/// providers in this codebase do not expose usage metadata.
/// </summary>
public interface ITokenLedger
{
    Task RecordEstimatedAsync(
        Guid userId,
        Guid? sessionId,
        string tool,
        string? model,
        int inputChars,
        int outputChars,
        bool success,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Records MEASURED provider usage (e.g. Gemini usageMetadata). Stored
    /// WITHOUT the "(est.)" marker so estimates and actuals stay distinguishable.
    /// Callers must record a turn exactly once — actuals OR estimates, never both.
    /// </summary>
    Task RecordActualAsync(
        Guid userId,
        Guid? sessionId,
        string tool,
        string? model,
        int promptTokens,
        int completionTokens,
        bool success,
        CancellationToken cancellationToken = default);
}
