using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Infrastructure.Aksh;

/// <summary>
/// Pacing governor (spike §4 + ADR-006): daily submission cap plus a
/// concurrent-run cap, checked before any submission side effect.
/// Blocks are non-consuming — the approval stays valid so the candidate
/// can simply decide again once the window passes.
/// </summary>
public class AkshPacingGovernor : IPacingGovernor
{

    private readonly IApplicationDbContext _context;
    private readonly int _maxConcurrentRuns;

    public AkshPacingGovernor(IApplicationDbContext context, IConfiguration? configuration = null)
    {
        _context = context;
        _maxConcurrentRuns = 3;
        if (configuration != null
            && int.TryParse(configuration["Aksh:MaxConcurrentRuns"], out var configured)
            && configured > 0)
        {
            _maxConcurrentRuns = configured;
        }
    }

    public async Task<PacingDecision> CheckCanSubmitAsync(
        Guid userId,
        Guid currentSessionId,
        CancellationToken cancellationToken = default)
    {
        // 1. Daily cap (per profile setting, default 10): counts SUBMITTED
        // applications, not preparations. Counting created items blocked
        // candidates who prepared (but never submitted) anything.
        var profile = await _context.CandidateProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
        var dailyCap = profile?.MaxApplicationsPerDay ?? 10;
        var todayUtc = DateTime.UtcNow.Date;
        var submittedToday = await _context.ApplicationQueueItems
            .CountAsync(q => q.UserId == userId
                && q.Status == PipelineExecutionStatus.Submitted
                && q.AppliedAtUtc != null
                && q.AppliedAtUtc >= todayUtc, cancellationToken);
        if (submittedToday >= dailyCap)
        {
            return new PacingDecision(false, "governor_cap",
                $"Daily application cap reached ({dailyCap}). The approval stays valid — decide again tomorrow.");
        }

        // 2. Concurrent-run cap: bound simultaneous agentic runs per user so
        // one account never fans out across portals (ban-surface + cost guard).
        // NOTE: explicit status comparisons (not array.Contains) — EF Core
        // cannot funcletize the ReadOnlySpan-based Contains over this enum
        // array and throws at query-evaluation time (regression covered by
        // DecideApproval_GovernorConcurrency_BlocksFourthRun).
        var activeRuns = await _context.AkshSessions
            .CountAsync(s => s.UserId == userId
                && s.Id != currentSessionId
                && (s.Status == AkshSessionStatus.Planning
                    || s.Status == AkshSessionStatus.Executing
                    || s.Status == AkshSessionStatus.AwaitingApproval), cancellationToken);
        if (activeRuns >= _maxConcurrentRuns)
        {
            return new PacingDecision(false, "governor_concurrency",
                $"Too many concurrent runs ({activeRuns + 1} of max {_maxConcurrentRuns}). Finish or cancel one before launching another.");
        }

        return PacingDecision.Allow();
    }
}
