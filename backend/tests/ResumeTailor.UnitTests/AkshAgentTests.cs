using FluentAssertions;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ResumeTailor.Application;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.Aksh;
using ResumeTailor.Application.Features.CandidateProfile;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Infrastructure.Aksh;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Infrastructure.Persistence;
using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// Aksh session/approval lifecycle: planning, single-use approval binding,
/// expiry, rejection, governor caps, and autonomy settings. No LLM calls.
/// </summary>
public class AkshAgentTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _provider;
    private readonly ISender _sender;
    private readonly FakeOrchestrator _orchestrator;

    public AkshAgentTests()
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
        services.AddSingleton<ResumeTailor.Application.Common.Interfaces.IApplicationDbContext>(context);
        services.AddScoped<ResumeTailor.Application.Common.Interfaces.IPacingGovernor, ResumeTailor.Infrastructure.Aksh.AkshPacingGovernor>();
        _orchestrator = new FakeOrchestrator();
        services.AddSingleton<ResumeTailor.Application.Common.Interfaces.IJobApplicationOrchestrator>(_orchestrator);
        services.AddSingleton<ResumeTailor.Application.Common.Interfaces.IJobScraperService>(new FakeScraper());
        services.AddSingleton<ResumeTailor.Application.Common.Interfaces.IAiServiceFactory>(new FakeAiFactory());
        services.AddSingleton<ResumeTailor.Application.Common.Interfaces.IAtsScoringEngine>(new FakeAtsEngine());
        services.AddSingleton<ResumeTailor.Application.Common.Interfaces.ITailoringProgressNotifier>(new FakeNotifier());
        services.AddApplication();
        _provider = services.BuildServiceProvider();
        _sender = _provider.GetRequiredService<ISender>();
    }

    private ApplicationDbContext Db => (ApplicationDbContext)_provider
        .GetRequiredService<ResumeTailor.Application.Common.Interfaces.IApplicationDbContext>();

    private Guid NewUser(string email)
    {
        var id = Guid.NewGuid();
        Db.Users.Add(new User { Id = id, Email = email, PasswordHash = "x", FullName = "Aksh Test" });
        Db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task StartSession_PlansCatalogSteps_ForJobUrl()
    {
        var userId = NewUser("plan@test.local");

        var result = await _sender.Send(new StartAkshSessionCommand(
            userId, "Apply to this posting", "https://example.com/jobs/1", AutonomyLevel.Supervised));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(AkshSessionStatus.Planning);
        // Plan steps must 1:1 match the AkshTools catalog so todo sync is truthful.
        result.Value.Todos.Select(t => t.Tool).Should().BeEquivalentTo(
            "scrape_job", "prepare_package", "check_truth", "launch_apply");
    }

    [Fact]
    public async Task StartSession_Rejects_EmptyGoal_AndBadUrl()
    {
        var userId = NewUser("valid@test.local");

        var empty = await _sender.Send(new StartAkshSessionCommand(userId, "  ", null, AutonomyLevel.Supervised));
        empty.IsSuccess.Should().BeFalse();

        var badUrl = await _sender.Send(new StartAkshSessionCommand(userId, "Apply", "not-a-url", AutonomyLevel.Supervised));
        badUrl.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task DecideApproval_UnknownId_ReturnsNotFound()
    {
        var userId = NewUser("unknown@test.local");

        var result = await _sender.Send(new DecideAkshApprovalCommand(userId, Guid.NewGuid(), true, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Approved.Should().BeFalse();
        result.Value.ReasonCode.Should().Be("approval_not_found");
    }

    [Fact]
    public async Task DecideApproval_Reject_Pauses_AndSecondDecisionFails()
    {
        var userId = NewUser("reject@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        var queue = new ApplicationQueueItem { UserId = userId, JobUrl = "https://example.com/j/1", Status = PipelineExecutionStatus.Prepared };
        Db.ApplicationQueueItems.Add(queue);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = queue.Id,
            ToolName = "launch_apply",
            ArgumentsJson = AkshBinding.BuildArguments(queue, false),
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        var rejected = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, false, null));
        rejected.Value!.Approved.Should().BeFalse();
        rejected.Value.ReasonCode.Should().Be("rejected");

        var again = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));
        again.Value!.Approved.Should().BeFalse();
        again.Value.ReasonCode.Should().Be("approval_not_pending");
    }

    [Fact]
    public async Task DecideApproval_Expired_MarksExpired()
    {
        var userId = NewUser("expiry@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            ToolName = "launch_apply",
            ArgumentsJson = "{}",
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1),
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        var result = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));

        result.Value!.Approved.Should().BeFalse();
        result.Value.ReasonCode.Should().Be("approval_expired");
    }

    [Fact]
    public async Task DecideApproval_GovernorCap_BlocksWithoutConsuming()
    {
        var userId = NewUser("governor@test.local");
        Db.CandidateProfiles.Add(new Domain.Entities.CandidateProfile { UserId = userId, MaxApplicationsPerDay = 0 });
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        var queue = new ApplicationQueueItem { UserId = userId, JobUrl = "https://example.com/j/2", Status = PipelineExecutionStatus.Prepared };
        Db.ApplicationQueueItems.Add(queue);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = queue.Id,
            ToolName = "launch_apply",
            ArgumentsJson = AkshBinding.BuildArguments(queue, false),
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        var blocked = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));
        blocked.Value!.Approved.Should().BeFalse();
        blocked.Value.ReasonCode.Should().Be("governor_cap");

        // Approval stays Approved-but-unconsumed: re-entry must not report "not pending".
        var retry = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));
        retry.Value!.ReasonCode.Should().Be("governor_cap");
    }

    [Fact]
    public async Task DecideApproval_GovernorConcurrency_BlocksFourthRun()
    {
        var userId = NewUser("concurrency@test.local");
        // Default MaxConcurrentRuns = 3: three other active runs block a fourth.
        for (var i = 0; i < 3; i++)
        {
            Db.AkshSessions.Add(new AkshSession { UserId = userId, Goal = $"Run {i}", Status = AkshSessionStatus.Executing });
        }
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        var queue = new ApplicationQueueItem { UserId = userId, JobUrl = "https://example.com/j/3", Status = PipelineExecutionStatus.Prepared };
        Db.ApplicationQueueItems.Add(queue);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = queue.Id,
            ToolName = "launch_apply",
            ArgumentsJson = AkshBinding.BuildArguments(queue, false),
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        var blocked = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));
        blocked.Value!.Approved.Should().BeFalse();
        blocked.Value.ReasonCode.Should().Be("governor_concurrency");
    }

    [Fact]
    public async Task DecideApproval_ValidationFailures_LeaveRowPending()
    {
        var userId = NewUser("pending@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        await Db.SaveChangesAsync();

        var badTool = new AkshApproval
        {
            SessionId = session.Id,
            ToolName = "nuke_everything",
            ArgumentsJson = "{}",
        };
        var badArgs = new AkshApproval
        {
            SessionId = session.Id,
            ToolName = "launch_apply",
            ArgumentsJson = "{oops",
        };
        Db.AkshApprovals.AddRange(badTool, badArgs);
        await Db.SaveChangesAsync();

        var r1 = await _sender.Send(new DecideAkshApprovalCommand(userId, badTool.Id, true, null));
        r1.Value!.ReasonCode.Should().Be("unknown_tool");
        var r2 = await _sender.Send(new DecideAkshApprovalCommand(userId, badArgs.Id, true, null));
        r2.Value!.ReasonCode.Should().Be("bad_arguments");

        // Neither failure may mutate the row: both stay decidable-Pending.
        (await Db.AkshApprovals.FindAsync(badTool.Id))!.Status.Should().Be(AkshApprovalStatus.Pending);
        (await Db.AkshApprovals.FindAsync(badArgs.Id))!.Status.Should().Be(AkshApprovalStatus.Pending);
    }

    [Fact]
    public async Task DecideApproval_ExecutionFailure_ReturnsToPending_Retryable()
    {
        var userId = NewUser("retry@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        var queue = new ApplicationQueueItem { UserId = userId, JobUrl = "https://example.com/j/9", Status = PipelineExecutionStatus.Prepared };
        Db.ApplicationQueueItems.Add(queue);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = queue.Id,
            ToolName = "launch_apply",
            ArgumentsJson = AkshBinding.BuildArguments(queue, false),
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        _orchestrator.NextResult = Result<ApplicationAutomationResult>.Failure("worker exploded");

        var failed = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));
        failed.Value!.Approved.Should().BeFalse();
        failed.Value.ReasonCode.Should().Be("execution_failed_retryable");

        // Approval is decidable again (not bricked as Consumed); session waits.
        (await Db.AkshApprovals.FindAsync(approval.Id))!.Status.Should().Be(AkshApprovalStatus.Pending);
        (await Db.AkshSessions.FindAsync(session.Id))!.Status.Should().Be(AkshSessionStatus.AwaitingApproval);
    }

    [Fact]
    public async Task DecideApproval_SecondDecide_AfterConsume_Loses()
    {
        var userId = NewUser("race2@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        var queue = new ApplicationQueueItem { UserId = userId, JobUrl = "https://example.com/j/10", Status = PipelineExecutionStatus.Prepared };
        Db.ApplicationQueueItems.Add(queue);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = queue.Id,
            ToolName = "launch_apply",
            ArgumentsJson = AkshBinding.BuildArguments(queue, false),
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        _orchestrator.NextResult = Result<ApplicationAutomationResult>.Success(new ApplicationAutomationResult
        {
            Success = true,
            Message = "paused",
            PausedForUserReview = true,
            ExecutionLogs = new List<string>(),
        });

        var first = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));
        first.Value!.Approved.Should().BeTrue();

        var second = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));
        second.Value!.Approved.Should().BeFalse();
        second.Value.ReasonCode.Should().Be("approval_not_pending");
    }

    [Fact]
    public async Task DecideApproval_PackageMutated_SupersedesApproval()
    {
        var userId = NewUser("supersede@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        var queue = new ApplicationQueueItem
        {
            UserId = userId,
            JobUrl = "https://example.com/j/11",
            TargetCompany = "Acme",
            TargetRole = "Engineer",
            PrefilledAnswersJson = "[{\"QuestionText\":\"Q?\",\"AnswerText\":\"A\"}]",
            Status = PipelineExecutionStatus.Prepared,
        };
        Db.ApplicationQueueItems.Add(queue);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = queue.Id,
            ToolName = "launch_apply",
            ArgumentsJson = AkshBinding.BuildArguments(queue, false),
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        // Candidate's package mutates after reviewing (answers edited elsewhere).
        queue.PrefilledAnswersJson = "[{\"QuestionText\":\"Q?\",\"AnswerText\":\"B\"}]";
        await Db.SaveChangesAsync();

        var result = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));

        result.Value!.Approved.Should().BeFalse();
        result.Value.ReasonCode.Should().Be("args_superseded");
        (await Db.AkshApprovals.FindAsync(approval.Id))!.Status.Should().Be(AkshApprovalStatus.Expired);
    }

    [Fact]
    public async Task DecideApproval_LegacyArgs_PredatingBinding_Supersede()
    {
        var userId = NewUser("legacy@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        var queue = new ApplicationQueueItem { UserId = userId, JobUrl = "https://example.com/j/12", Status = PipelineExecutionStatus.Prepared };
        Db.ApplicationQueueItems.Add(queue);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = queue.Id,
            ToolName = "launch_apply",
            // Deliberately legacy shape (pre-binding era): must supersede.
            ArgumentsJson = $"{{\"queueItemId\":\"{queue.Id}\",\"headed\":false}}",
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        var result = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));

        result.Value!.ReasonCode.Should().Be("args_superseded");
    }

    [Fact]
    public async Task DecideApproval_UnchangedPackage_ProceedsToConsume()
    {
        var userId = NewUser("intact@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.AwaitingApproval };
        Db.AkshSessions.Add(session);
        var queue = new ApplicationQueueItem
        {
            UserId = userId,
            JobUrl = "https://example.com/j/13",
            TargetCompany = "Acme",
            TargetRole = "Engineer",
            Status = PipelineExecutionStatus.Prepared,
        };
        Db.ApplicationQueueItems.Add(queue);
        await Db.SaveChangesAsync();

        var approval = new AkshApproval
        {
            SessionId = session.Id,
            QueueItemId = queue.Id,
            ToolName = "launch_apply",
            ArgumentsJson = AkshBinding.BuildArguments(queue, false),
        };
        Db.AkshApprovals.Add(approval);
        await Db.SaveChangesAsync();

        _orchestrator.NextResult = Result<ApplicationAutomationResult>.Success(new ApplicationAutomationResult
        {
            Success = true,
            Message = "paused",
            PausedForUserReview = true,
            ExecutionLogs = new List<string>(),
        });

        var result = await _sender.Send(new DecideAkshApprovalCommand(userId, approval.Id, true, null));

        result.Value!.Approved.Should().BeTrue();
        (await Db.AkshApprovals.FindAsync(approval.Id))!.Status.Should().Be(AkshApprovalStatus.Consumed);
    }

    [Fact]
    public async Task UpdateProfile_Clamps_InvalidAutonomy_AndCap()
    {
        var userId = NewUser("autonomy@test.local");

        var result = await _sender.Send(new UpdateCandidateProfileCommand(
            userId, "", "", "", "Authorized to work", false, 30, "", "", "INR",
            false, "Remote or Hybrid", "", "", "", null, null, null, null,
            new Dictionary<string, string>(),
            (AutonomyLevel)99, 500));

        result.IsSuccess.Should().BeTrue();
        result.Value!.AutonomyLevel.Should().Be(AutonomyLevel.Supervised);
        result.Value.MaxApplicationsPerDay.Should().Be(100);
    }

    [Fact]
    public async Task TurnLock_SecondClaim_Loses_UntilReleaseOrLeaseExpiry()
    {
        var userId = NewUser("turnlock@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.Planning };
        Db.AkshSessions.Add(session);
        await Db.SaveChangesAsync();

        var now = DateTime.UtcNow;
        var turnA = Guid.NewGuid();
        var turnB = Guid.NewGuid();

        (await ResumeTailor.Infrastructure.Aksh.AkshAgentRunner.TryClaimTurnAsync(Db, session.Id, turnA, now))
            .Should().BeTrue();
        // Live lock held: rival claim loses.
        (await ResumeTailor.Infrastructure.Aksh.AkshAgentRunner.TryClaimTurnAsync(Db, session.Id, turnB, now.AddSeconds(10)))
            .Should().BeFalse();
        // Foreign release is a no-op: still held by A.
        (await ResumeTailor.Infrastructure.Aksh.AkshAgentRunner.ReleaseTurnAsync(Db, session.Id, turnB))
            .Should().Be(0);
        // Owner release frees; rival claims.
        (await ResumeTailor.Infrastructure.Aksh.AkshAgentRunner.ReleaseTurnAsync(Db, session.Id, turnA))
            .Should().Be(1);
        (await ResumeTailor.Infrastructure.Aksh.AkshAgentRunner.TryClaimTurnAsync(Db, session.Id, turnB, now.AddSeconds(11)))
            .Should().BeTrue();
        // Stale lock (older than lease) is reclaimable without release.
        (await ResumeTailor.Infrastructure.Aksh.AkshAgentRunner.TryClaimTurnAsync(
            Db, session.Id, turnA, now.Add(AkshAgentRunner.TurnLease).AddMinutes(1)))
            .Should().BeTrue();
    }

    [Fact]
    public async Task Turn_BudgetBreach_UsesLedgerTotals_AndPauses()
    {
        var userId = NewUser("budget@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.Planning };
        Db.AkshSessions.Add(session);
        Db.UsageLogs.Add(new UsageLog
        {
            UserId = userId,
            Action = "Aksh:chat_turn",
            PromptTokens = 150000,
            CompletionTokens = 60000,
            IsSuccess = true,
        });
        await Db.SaveChangesAsync();

        var runner = new ResumeTailor.Infrastructure.Aksh.AkshAgentRunner(
            _provider,
            Db,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["Aksh:Enabled"] = "true" })
                .Build(),
            new ResumeTailor.Infrastructure.Aksh.TokenLedger(_provider.GetRequiredService<IServiceScopeFactory>()),
            _sender);

        AkshStreamEvent? first = null;
        await foreach (var e in runner.StreamTurnAsync(userId, session.Id, "hi"))
        {
            first = e;
            break;
        }

        first.Should().NotBeNull();
        first!.Type.Should().Be("error");
    }

    [Fact]
    public async Task TokenLedger_WritesSessionTotals_ExactlyOnce()
    {
        // Regression: runner AND ledger both incremented session totals (~2x
        // spend, early budget gate). The ledger is the single writer now.
        var userId = NewUser("ledger@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.Planning };
        Db.AkshSessions.Add(session);
        await Db.SaveChangesAsync();

        var ledger = new ResumeTailor.Infrastructure.Aksh.TokenLedger(_provider.GetRequiredService<IServiceScopeFactory>());
        await ledger.RecordEstimatedAsync(userId, session.Id, "chat_turn", null, 400, 200, true);

        var reloaded = await Db.AkshSessions.FindAsync(session.Id);
        reloaded!.TokenInputTotal.Should().Be(100);
        reloaded.TokenOutputTotal.Should().Be(50);
        Db.UsageLogs.Should().ContainSingle(u => u.Action == "Aksh:chat_turn");
    }

    [Fact]
    public async Task TokenLedger_Actuals_StoreExactCounts_WithoutEstimateMarker()
    {
        var userId = NewUser("actual@test.local");
        var session = new AkshSession { UserId = userId, Goal = "Apply", Status = AkshSessionStatus.Planning };
        Db.AkshSessions.Add(session);
        await Db.SaveChangesAsync();

        var ledger = new ResumeTailor.Infrastructure.Aksh.TokenLedger(_provider.GetRequiredService<IServiceScopeFactory>());
        await ledger.RecordActualAsync(userId, session.Id, "chat_turn", "gemini-flash-lite-latest", 1234, 56, true);

        var reloaded = await Db.AkshSessions.FindAsync(session.Id);
        reloaded!.TokenInputTotal.Should().Be(1234);
        reloaded.TokenOutputTotal.Should().Be(56);
        var log = Db.UsageLogs.Should().ContainSingle(u => u.Action == "Aksh:chat_turn").Subject;
        log.Model.Should().Be("gemini-flash-lite-latest");
        log.Model.Should().NotContain("est.");
    }

    [Fact]
    public async Task Sessions_And_Audit_AreUserScoped()
    {
        var userId = NewUser("scoped@test.local");
        var otherId = NewUser("other@test.local");

        await _sender.Send(new StartAkshSessionCommand(userId, "Goal A", null, AutonomyLevel.Supervised));

        var mine = await _sender.Send(new GetAkshSessionsQuery(userId, true));
        mine.Value!.Should().HaveCount(1);

        var others = await _sender.Send(new GetAkshSessionsQuery(otherId, true));
        others.Value!.Should().BeEmpty();

        var auditMissing = await _sender.Send(new GetAkshAuditQuery(otherId, mine.Value[0].Id));
        auditMissing.IsSuccess.Should().BeFalse();

        var audit = await _sender.Send(new GetAkshAuditQuery(userId, mine.Value[0].Id));
        audit.IsSuccess.Should().BeTrue();
        audit.Value!.Messages.Should().BeEmpty();
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }
}
