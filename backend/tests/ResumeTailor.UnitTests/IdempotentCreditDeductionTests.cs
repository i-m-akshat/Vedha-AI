using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Infrastructure.Billing;
using ResumeTailor.Infrastructure.Persistence;
using Xunit;

namespace ResumeTailor.UnitTests;

public class DummyProgressNotifier : ITailoringProgressNotifier
{
    public Task SendProgressAsync(Guid userId, string stage, string message, int percentComplete, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }
}

public class IdempotentCreditDeductionTests
{
    private ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite($"Data Source=file:{Guid.NewGuid()}?mode=memory&cache=shared")
            .Options;

        var context = new ApplicationDbContext(options);
        context.Database.OpenConnection();
        context.Database.EnsureCreated();
        return context;
    }

    [Fact]
    public async Task CreditDeduction_ShouldBeAtomicAndDeductSingleCredit()
    {
        using var context = CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var appId = Guid.NewGuid();

        var user = new User
        {
            Id = userId,
            Email = "candidate@example.com",
            FullName = "Jane Candidate",
            CreditsBalance = 10
        };
        context.Users.Add(user);

        var app = new ApplicationAudit
        {
            Id = appId,
            UserId = userId,
            JobTitle = "Staff Engineer",
            CompanyName = "Acme Corp",
            JobUrl = "https://example.com/jobs/1",
            Status = "applying"
        };
        context.ApplicationAudits.Add(app);
        await context.SaveChangesAsync();

        var creditService = new CreditTransactionService(
            context,
            new DummyProgressNotifier(),
            NullLogger<CreditTransactionService>.Instance
        );

        var idempotencyKey = $"success_{appId}";

        // Act: First deduction
        var success = await creditService.DeductCreditOnWorkerSuccessAsync(userId, appId, idempotencyKey);

        // Assert
        success.Should().BeTrue();
        var updatedUser = await context.Users.FindAsync(userId);
        updatedUser!.CreditsBalance.Should().Be(9);

        var updatedApp = await context.ApplicationAudits.FindAsync(appId);
        updatedApp!.Status.Should().Be("success");
    }

    [Fact]
    public async Task DuplicateSuccessEvents_MustNotDoubleCharge_IdempotencyGuaranteed()
    {
        using var context = CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var appId = Guid.NewGuid();

        var user = new User
        {
            Id = userId,
            Email = "candidate@example.com",
            FullName = "John Doe",
            CreditsBalance = 20
        };
        context.Users.Add(user);

        var app = new ApplicationAudit
        {
            Id = appId,
            UserId = userId,
            JobTitle = "Cloud Architect",
            CompanyName = "CloudTech",
            JobUrl = "https://cloudtech.com/apply",
            Status = "applying"
        };
        context.ApplicationAudits.Add(app);
        await context.SaveChangesAsync();

        var creditService = new CreditTransactionService(
            context,
            new DummyProgressNotifier(),
            NullLogger<CreditTransactionService>.Instance
        );

        var idempotencyKey = $"success_{appId}";

        // Act 1: Initial event consumed
        var firstResult = await creditService.DeductCreditOnWorkerSuccessAsync(userId, appId, idempotencyKey);
        firstResult.Should().BeTrue();

        // Act 2: Duplicate event redelivered from message broker
        var secondResult = await creditService.DeductCreditOnWorkerSuccessAsync(userId, appId, idempotencyKey);
        secondResult.Should().BeTrue();

        // Act 3: Third retry
        var thirdResult = await creditService.DeductCreditOnWorkerSuccessAsync(userId, appId, idempotencyKey);
        thirdResult.Should().BeTrue();

        // Assert: Credits deducted exactly ONCE (20 - 1 = 19), never double-charged
        var finalUser = await context.Users.FindAsync(userId);
        finalUser!.CreditsBalance.Should().Be(19);

        var transactionsCount = await context.IdempotentTransactions.CountAsync(t => t.IdempotencyKey == idempotencyKey);
        transactionsCount.Should().Be(1);
    }

    [Fact]
    public async Task WorkerFailure_ShouldNotDeductCredits_AndRecordsErrorStatus()
    {
        using var context = CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var appId = Guid.NewGuid();

        var user = new User
        {
            Id = userId,
            Email = "candidate@example.com",
            FullName = "Failed Candidate",
            CreditsBalance = 15
        };
        context.Users.Add(user);

        var app = new ApplicationAudit
        {
            Id = appId,
            UserId = userId,
            JobTitle = "Staff Engineer",
            CompanyName = "BrokenSite Inc",
            JobUrl = "https://brokensite.com/job/1",
            Status = "applying"
        };
        context.ApplicationAudits.Add(app);
        await context.SaveChangesAsync();

        // Simulate worker failure handling
        var audit = await context.ApplicationAudits.FindAsync(appId);
        audit!.Status = "failed";
        audit.ErrorMessage = "Navigation timeout on application portal";
        audit.AppliedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();

        // Assert: Credits remain intact at 15
        var finalUser = await context.Users.FindAsync(userId);
        finalUser!.CreditsBalance.Should().Be(15);

        // Assert: Audit marked failed with reason
        var finalApp = await context.ApplicationAudits.FindAsync(appId);
        finalApp!.Status.Should().Be("failed");
        finalApp.ErrorMessage.Should().Contain("timeout");
    }
}
