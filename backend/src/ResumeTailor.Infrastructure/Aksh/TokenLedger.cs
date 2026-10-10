using Microsoft.Extensions.DependencyInjection;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh;

/// <summary>
/// Estimated token ledger (ADR-006 §11): providers here do not expose usage
/// metadata, so usage is estimated at ~1 token per 4 characters and always
/// labeled estimated in the UI. Estimates roll up per session for budget checks.
/// </summary>
public class TokenLedger : ITokenLedger
{
    private readonly IServiceScopeFactory _scopes;

    public TokenLedger(IServiceScopeFactory scopes)
    {
        _scopes = scopes;
    }

    public async Task RecordEstimatedAsync(
        Guid userId,
        Guid? sessionId,
        string tool,
        string? model,
        int inputChars,
        int outputChars,
        bool success,
        CancellationToken cancellationToken = default)
    {
        var inputTokens = Math.Max(0, inputChars / 4);
        var outputTokens = Math.Max(0, outputChars / 4);

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        db.UsageLogs.Add(new UsageLog
        {
            UserId = userId,
            Action = "Aksh:" + tool,
            Provider = null,
            Model = (model ?? "default") + " (est.)",
            PromptTokens = inputTokens,
            CompletionTokens = outputTokens,
            LatencyMs = 0,
            IsSuccess = success,
        });

        if (sessionId.HasValue)
        {
            var session = await db.AkshSessions.FindAsync(new object[] { sessionId.Value }, cancellationToken);
            if (session != null && session.UserId == userId)
            {
                session.TokenInputTotal += inputTokens;
                session.TokenOutputTotal += outputTokens;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task RecordActualAsync(
        Guid userId,
        Guid? sessionId,
        string tool,
        string? model,
        int promptTokens,
        int completionTokens,
        bool success,
        CancellationToken cancellationToken = default)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        db.UsageLogs.Add(new UsageLog
        {
            UserId = userId,
            Action = "Aksh:" + tool,
            Provider = null,
            Model = model ?? "default",
            PromptTokens = Math.Max(0, promptTokens),
            CompletionTokens = Math.Max(0, completionTokens),
            LatencyMs = 0,
            IsSuccess = success,
        });

        if (sessionId.HasValue)
        {
            var session = await db.AkshSessions.FindAsync(new object[] { sessionId.Value }, cancellationToken);
            if (session != null && session.UserId == userId)
            {
                session.TokenInputTotal += Math.Max(0, promptTokens);
                session.TokenOutputTotal += Math.Max(0, completionTokens);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
