using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Billing;

public class CreditTransactionService : ICreditTransactionService
{
    private readonly IApplicationDbContext _context;
    private readonly ITailoringProgressNotifier _progressNotifier;
    private readonly ILogger<CreditTransactionService> _logger;

    public CreditTransactionService(
        IApplicationDbContext context,
        ITailoringProgressNotifier progressNotifier,
        ILogger<CreditTransactionService> logger)
    {
        _context = context;
        _progressNotifier = progressNotifier;
        _logger = logger;
    }

    public async Task<bool> DeductCreditOnWorkerSuccessAsync(
        Guid userId,
        Guid applicationId,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        // 1. Idempotency Check: Prevent double-charge if message redelivered
        var existingTx = await _context.IdempotentTransactions
            .FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey, cancellationToken);

        if (existingTx != null)
        {
            _logger.LogInformation("Idempotent hit: Transaction for key {Key} was already processed at {Date}. Skipping credit deduction.",
                idempotencyKey, existingTx.ProcessedAtUtc);
            return true;
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            _logger.LogError("Cannot deduct credit: User {UserId} not found.", userId);
            return false;
        }

        // 2. Atomic credit deduction
        if (user.CreditsBalance > 0)
        {
            user.CreditsBalance -= 1;
            _logger.LogInformation("Deducted 1 credit for user {UserId}. Remaining balance: {Balance}", userId, user.CreditsBalance);
        }
        else
        {
            _logger.LogWarning("User {UserId} has zero credits balance but application succeeded.", userId);
        }

        // 3. Record transaction in IdempotentTransactions
        var transaction = new IdempotentTransaction
        {
            IdempotencyKey = idempotencyKey,
            UserId = userId,
            ApplicationId = applicationId,
            CreditsDeducted = 1,
            ProcessedAtUtc = DateTime.UtcNow
        };
        _context.IdempotentTransactions.Add(transaction);

        // 4. Update ApplicationAudit status to success
        var application = await _context.ApplicationAudits
            .FirstOrDefaultAsync(a => a.Id == applicationId, cancellationToken);

        if (application != null)
        {
            application.Status = "success";
            application.AppliedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        // 5. Notify user in real-time
        try
        {
            await _progressNotifier.SendProgressAsync(
                userId,
                "Applied",
                $"Application to {application?.CompanyName ?? "Company"} submitted successfully! Credits remaining: {user.CreditsBalance}",
                100,
                cancellationToken);
        }
        catch { }

        return true;
    }

    public async Task<int> GetUserCreditsBalanceAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        return user?.CreditsBalance ?? 0;
    }
}
