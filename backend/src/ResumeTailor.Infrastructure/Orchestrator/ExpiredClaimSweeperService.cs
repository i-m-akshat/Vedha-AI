using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.ExtensionDispatch;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Infrastructure.Orchestrator;

/// <summary>
/// Phase 4 dispatch lease sweeper. Releases claims older than the lease
/// (default 10 min) back to dispatchable state so a dead browser/tab never
/// wedges a run. Cancelled and terminal runs are never resurrected — only
/// <c>RunningAutomation</c> items with an expired ticket are released.
/// Runs on the existing <see cref="BackgroundService"/> pattern (no Hangfire
/// server exists in this tree); interval 5 minutes.
/// </summary>
public class ExpiredClaimSweeperService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(5);

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ExpiredClaimSweeperService> _logger;

    public ExpiredClaimSweeperService(IServiceProvider serviceProvider, ILogger<ExpiredClaimSweeperService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Starting ExpiredClaimSweeperService (interval {Interval}).", SweepInterval);

        using var timer = new PeriodicTimer(SweepInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                var released = await ReleaseExpiredClaimsAsync(db, DateTime.UtcNow, stoppingToken);
                if (released > 0)
                    _logger.LogInformation("Released {Count} expired extension-dispatch claim(s).", released);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Extension-dispatch claim sweep failed; will retry next interval.");
            }
        }
    }

    /// <summary>
    /// Releases expired claims. Pure against the context for unit testing.
    /// Returns the number of runs returned to dispatchable state.
    /// </summary>
    public static async Task<int> ReleaseExpiredClaimsAsync(
        IApplicationDbContext db,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        var cutoff = now - ExtensionDispatchHandlers.ClaimLease;

        var expired = await db.ExtensionRunClaims
            .Where(c => c.ClaimedAtUtc < cutoff)
            .ToListAsync(cancellationToken);

        var released = 0;
        foreach (var ticket in expired)
        {
            var item = await db.ApplicationQueueItems
                .FirstOrDefaultAsync(q => q.Id == ticket.QueueItemId, cancellationToken);
            if (item != null && item.Status == PipelineExecutionStatus.RunningAutomation)
            {
                item.Status = PipelineExecutionStatus.DispatchedToExtension;
                item.ClaimedAtUtc = null;
                item.ClaimToken = null;
                AppendLog(item, $"[{now:HH:mm:ss}] [Dispatch] Browser claim expired without receipts; run is dispatchable again. Re-poll to claim.");
                released++;
            }
            // The ticket dies in every case: terminal/cancelled runs stay terminal,
            // and already-redispatched items must not accumulate stale tickets.
            db.ExtensionRunClaims.Remove(ticket);
        }

        if (expired.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        return released;
    }

    private static void AppendLog(Domain.Entities.ApplicationQueueItem item, string line)
    {
        List<string> existing;
        try
        {
            existing = System.Text.Json.JsonSerializer.Deserialize<List<string>>(item.ExecutionLogsJson) ?? new();
        }
        catch
        {
            existing = new();
        }
        existing.Add(line);
        item.ExecutionLogsJson = System.Text.Json.JsonSerializer.Serialize(existing);
    }
}
