using FluentAssertions;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ResumeTailor.Application;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.ExtensionDispatch;
using ResumeTailor.Application.Features.Orchestrator;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;
using ResumeTailor.Infrastructure.Orchestrator;
using ResumeTailor.Infrastructure.Persistence;
using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// Phase 4 dispatch: atomic claim (one winner), receipt state machine,
/// idempotent terminals, cancel/IDOR safety. No LLM, no browser.
/// </summary>
public class ExtensionDispatchTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _provider;
    private readonly ISender _sender;

    public ExtensionDispatchTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;
        var context = new ApplicationDbContext(options);
        context.Database.EnsureCreated();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IApplicationDbContext>(context);
        services.AddScoped<IPacingGovernor, ResumeTailor.Infrastructure.Aksh.AkshPacingGovernor>();
        services.AddSingleton<IJobApplicationOrchestrator>(new FakeOrchestrator());
        services.AddSingleton<IJobScraperService>(new FakeScraper());
        services.AddSingleton<IAiServiceFactory>(new FakeAiFactory());
        services.AddSingleton<IAtsScoringEngine>(new FakeAtsEngine());
        services.AddSingleton<ITailoringProgressNotifier>(new FakeNotifier());
        services.AddApplication();
        _provider = services.BuildServiceProvider();
        _sender = _provider.GetRequiredService<ISender>();
    }

    private ApplicationDbContext Db => (ApplicationDbContext)_provider
        .GetRequiredService<IApplicationDbContext>();

    private Guid NewUser(string email)
    {
        var id = Guid.NewGuid();
        Db.Users.Add(new User { Id = id, Email = email, PasswordHash = "x", FullName = "Dispatch Test" });
        Db.SaveChanges();
        return id;
    }

    private ApplicationQueueItem NewDispatchedItem(Guid userId, string url = "https://example.com/j/1")
    {
        var item = new ApplicationQueueItem
        {
            UserId = userId,
            JobUrl = url,
            TargetCompany = "Acme",
            TargetRole = "Engineer",
            Status = PipelineExecutionStatus.DispatchedToExtension,
            PrefilledAnswersJson = "[{\"QuestionText\":\"Q?\",\"AnswerText\":\"A\",\"FieldType\":\"text\"}]",
        };
        Db.ApplicationQueueItems.Add(item);
        Db.SaveChanges();
        return item;
    }

    [Fact]
    public async Task Claim_ReturnsPackage_AndMovesToRunning()
    {
        var userId = NewUser("claim@test.local");
        var item = NewDispatchedItem(userId);

        var result = await _sender.Send(new ClaimExtensionRunQuery(userId));

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.RunId.Should().Be(item.Id);
        result.Value.JobUrl.Should().Be("https://example.com/j/1");
        result.Value.PrefilledAnswers.Should().HaveCount(1);
        result.Value.ClaimToken.Should().NotBeEmpty();

        var reloaded = await Db.ApplicationQueueItems.FindAsync(item.Id);
        reloaded!.Status.Should().Be(PipelineExecutionStatus.RunningAutomation);
        reloaded.ClaimToken.Should().Be(result.Value.ClaimToken);

        var ticket = await Db.ExtensionRunClaims.FindAsync(item.Id);
        ticket.Should().NotBeNull();
        ticket!.UserId.Should().Be(userId);
    }

    [Fact]
    public async Task Claim_NoneWaiting_ReturnsNull()
    {
        var userId = NewUser("empty@test.local");

        var result = await _sender.Send(new ClaimExtensionRunQuery(userId));

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task Claim_LostRace_MovesOn()
    {
        var userId = NewUser("race@test.local");
        var item = NewDispatchedItem(userId);
        // Another device already holds this run.
        Db.ExtensionRunClaims.Add(new ExtensionRunClaim
        {
            QueueItemId = item.Id,
            UserId = userId,
            ClaimToken = Guid.NewGuid(),
            ClaimedAtUtc = DateTime.UtcNow,
        });
        await Db.SaveChangesAsync();

        var result = await _sender.Send(new ClaimExtensionRunQuery(userId));

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task Claim_IsUserScoped()
    {
        var userId = NewUser("mine@test.local");
        var otherId = NewUser("other@test.local");
        NewDispatchedItem(userId);

        var result = await _sender.Send(new ClaimExtensionRunQuery(otherId));

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task Receipt_Step_AppendsLogs_AndKeepsRunning()
    {
        var userId = NewUser("step@test.local");
        var item = NewDispatchedItem(userId);
        var claimed = (await _sender.Send(new ClaimExtensionRunQuery(userId))).Value!;

        var result = await _sender.Send(new PostExtensionReceiptCommand(
            userId, item.Id, claimed.ClaimToken, "step", FilledCount: 5, Logs: new List<string> { "[ext] filled 5" }));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Accepted.Should().BeTrue();
        result.Value.Status.Should().Be(PipelineExecutionStatus.RunningAutomation);

        var reloaded = await Db.ApplicationQueueItems.FindAsync(item.Id);
        reloaded!.ExecutionLogsJson.Should().Contain("filled 5");
    }

    [Fact]
    public async Task Receipt_WrongToken_IsStaleClaim()
    {
        var userId = NewUser("token@test.local");
        var item = NewDispatchedItem(userId);
        await _sender.Send(new ClaimExtensionRunQuery(userId));

        var result = await _sender.Send(new PostExtensionReceiptCommand(
            userId, item.Id, Guid.NewGuid(), "step"));

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be("stale_claim");
    }

    [Fact]
    public async Task Receipt_OtherUser_IsNotFound()
    {
        var userId = NewUser("owner@test.local");
        var otherId = NewUser("intruder@test.local");
        var item = NewDispatchedItem(userId);
        var claimed = (await _sender.Send(new ClaimExtensionRunQuery(userId))).Value!;

        var result = await _sender.Send(new PostExtensionReceiptCommand(
            otherId, item.Id, claimed.ClaimToken, "step"));

        // Other-user item lookup misses entirely: uniform 404, no existence leak.
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be("run_not_found");
    }

    [Fact]
    public async Task Receipt_Paused_SetsReviewGateway_AndSyncsSession()
    {
        var userId = NewUser("paused@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.Executing };
        Db.AkshSessions.Add(session);
        var item = NewDispatchedItem(userId);
        Db.AkshApprovals.Add(new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = item.Id,
            ToolName = "launch_apply",
            ArgumentsJson = "{}",
            Status = AkshApprovalStatus.Consumed,
            ConsumedAtUtc = DateTime.UtcNow,
        });
        await Db.SaveChangesAsync();
        var claimed = (await _sender.Send(new ClaimExtensionRunQuery(userId))).Value!;

        var result = await _sender.Send(new PostExtensionReceiptCommand(
            userId, item.Id, claimed.ClaimToken, "paused", Message: "Review screen reached"));

        result.Value!.Status.Should().Be(PipelineExecutionStatus.PausedForUserReview);
        (await Db.ExtensionRunClaims.FindAsync(item.Id)).Should().BeNull();

        var reloadedSession = await Db.AkshSessions.FindAsync(session.Id);
        reloadedSession!.Status.Should().Be(AkshSessionStatus.Paused);
    }

    [Fact]
    public async Task Receipt_Submitted_IsTerminal_AndIdempotent()
    {
        var userId = NewUser("submitted@test.local");
        var item = NewDispatchedItem(userId);
        var claimed = (await _sender.Send(new ClaimExtensionRunQuery(userId))).Value!;

        var first = await _sender.Send(new PostExtensionReceiptCommand(
            userId, item.Id, claimed.ClaimToken, "submitted", Message: "Applied"));
        first.Value!.Status.Should().Be(PipelineExecutionStatus.Submitted);

        var reloaded = await Db.ApplicationQueueItems.FindAsync(item.Id);
        reloaded!.AppliedAtUtc.Should().NotBeNull();

        // Retried terminal POST converges without conflict.
        var retry = await _sender.Send(new PostExtensionReceiptCommand(
            userId, item.Id, claimed.ClaimToken, "submitted"));
        retry.IsSuccess.Should().BeTrue();
        retry.Value!.ReasonCode.Should().Be("already_submitted");
    }

    [Fact]
    public async Task Receipt_CancelledItem_IsRejected()
    {
        var userId = NewUser("cancelled@test.local");
        var item = NewDispatchedItem(userId);
        var claimed = (await _sender.Send(new ClaimExtensionRunQuery(userId))).Value!;
        await _sender.Send(new UpdateApplicationQueueStatusCommand(userId, item.Id, PipelineExecutionStatus.Cancelled));

        var result = await _sender.Send(new PostExtensionReceiptCommand(
            userId, item.Id, claimed.ClaimToken, "step"));

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be("run_cancelled");
    }

    [Fact]
    public async Task Receipt_UnknownState_IsRejected()
    {
        var userId = NewUser("badstate@test.local");
        var item = NewDispatchedItem(userId);
        var claimed = (await _sender.Send(new ClaimExtensionRunQuery(userId))).Value!;

        var result = await _sender.Send(new PostExtensionReceiptCommand(
            userId, item.Id, claimed.ClaimToken, "teleported"));

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be("unknown_state");
    }

    [Theory]
    [InlineData(true, true, false, true, true)]   // paused copilot run, dispatch on -> dispatched
    [InlineData(true, true, false, false, false)] // dispatch flag off -> stays paused path
    [InlineData(true, true, true, true, false)]   // finalize run -> never dispatched
    [InlineData(false, true, false, true, false)] // worker failure (not paused) -> not dispatched
    [InlineData(true, false, false, true, false)] // unsuccessful result -> not dispatched
    public void ShouldDispatchToExtension_Matrix(
        bool pausedForReview, bool success, bool isFinalizing, bool dispatchEnabled, bool expected)
    {
        JobApplicationOrchestrator.ShouldDispatchToExtension(pausedForReview, success, isFinalizing, dispatchEnabled)
            .Should().Be(expected);
    }

    [Fact]
    public async Task Sweeper_ReleasesExpiredClaim_BackToDispatchable()
    {
        var userId = NewUser("sweep@test.local");
        var item = NewDispatchedItem(userId);
        var claimed = (await _sender.Send(new ClaimExtensionRunQuery(userId))).Value!;
        var ticket = await Db.ExtensionRunClaims.FindAsync(item.Id);
        ticket!.ClaimedAtUtc = DateTime.UtcNow - TimeSpan.FromMinutes(30);
        await Db.SaveChangesAsync();

        var released = await ExpiredClaimSweeperService.ReleaseExpiredClaimsAsync(Db, DateTime.UtcNow);

        released.Should().Be(1);
        (await Db.ApplicationQueueItems.FindAsync(item.Id))!.Status
            .Should().Be(PipelineExecutionStatus.DispatchedToExtension);
        (await Db.ExtensionRunClaims.FindAsync(item.Id)).Should().BeNull();
    }

    [Fact]
    public async Task Sweeper_KeepsFreshClaim_AndTerminalItems()
    {
        var userId = NewUser("fresh@test.local");
        var live = NewDispatchedItem(userId, "https://example.com/j/live");
        await _sender.Send(new ClaimExtensionRunQuery(userId));
        // Age the live ticket past the lease, then simulate the run having
        // submitted through another path before the sweep.
        var liveTicket = await Db.ExtensionRunClaims.FindAsync(live.Id);
        liveTicket!.ClaimedAtUtc = DateTime.UtcNow - TimeSpan.FromMinutes(30);
        (await Db.ApplicationQueueItems.FindAsync(live.Id))!.Status = PipelineExecutionStatus.Submitted;
        // A second item waits untouched in dispatchable state.
        var waiting = NewDispatchedItem(userId, "https://example.com/j/waiting");
        await Db.SaveChangesAsync();

        var released = await ExpiredClaimSweeperService.ReleaseExpiredClaimsAsync(Db, DateTime.UtcNow);

        released.Should().Be(0);
        (await Db.ApplicationQueueItems.FindAsync(live.Id))!.Status
            .Should().Be(PipelineExecutionStatus.Submitted);
        (await Db.ExtensionRunClaims.FindAsync(live.Id)).Should().BeNull();
        (await Db.ApplicationQueueItems.FindAsync(waiting.Id))!.Status
            .Should().Be(PipelineExecutionStatus.DispatchedToExtension);
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }
}
