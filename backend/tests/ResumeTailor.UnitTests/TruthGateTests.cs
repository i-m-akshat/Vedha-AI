using FluentAssertions;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ResumeTailor.Application;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.Orchestrator;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Infrastructure.Persistence;using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// AC2: truth-gate violations fail closed — fabricated sections revert to
/// master copies, the failure is logged on the item, and manual review is
/// forced even under SupervisedAuto autonomy.
/// </summary>
public class TruthGateTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _provider;
    private readonly ISender _sender;
    private readonly FakeAtsEngine _ats;

    public TruthGateTests()
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
        services.AddSingleton<IPacingGovernor, ResumeTailor.Infrastructure.Aksh.AkshPacingGovernor>();
        services.AddSingleton<IJobApplicationOrchestrator>(new FakeOrchestrator());
        services.AddSingleton<IJobScraperService>(new FakeScraper());
        services.AddSingleton<IAiServiceFactory>(new ScriptedAiFactory());
        _ats = new FakeAtsEngine();
        services.AddSingleton<IAtsScoringEngine>(_ats);
        services.AddSingleton<ITailoringProgressNotifier>(new FakeNotifier());
        services.AddApplication();
        _provider = services.BuildServiceProvider();
        _sender = _provider.GetRequiredService<ISender>();
    }

    private ApplicationDbContext Db => (ApplicationDbContext)_provider
        .GetRequiredService<IApplicationDbContext>();

    private Guid SeedUserWithResume(AutonomyLevel autonomy)
    {
        var id = Guid.NewGuid();
        Db.Users.Add(new User { Id = id, Email = "truth@test.local", PasswordHash = "x", FullName = "Truth Test" });
        Db.MasterResumes.Add(new MasterResume
        {
            UserId = id,
            IsActive = true,
            StructuredJson = """{"personalInfo":{"fullName":"Truth Test","email":"t@example.com"},"experience":[],"skills":[]}""",
        });
        Db.CandidateProfiles.Add(new CandidateProfile { UserId = id, AutonomyLevel = autonomy });
        Db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task TruthFailure_ForcesReview_And_LogsSignal_EvenWhenSupervisedAuto()
    {
        var userId = SeedUserWithResume(AutonomyLevel.SupervisedAuto);
        _ats.TruthResult = Result.Failure("invented employer");

        var result = await _sender.Send(new PrepareApplicationPackageCommand(
            userId, null, "", "Senior Engineer needed. Must know C#.", TemplateStyle.ClassicAts, null));

        result.IsSuccess.Should().BeTrue();
        var item = Db.ApplicationQueueItems.First(q => q.UserId == userId);
        item.RequiresManualReview.Should().BeTrue();
        item.ExecutionLogsJson.Should().Contain("Truth Gate");
    }

    [Fact]
    public async Task TruthPass_RespectsSupervisedAuto()
    {
        var userId = SeedUserWithResume(AutonomyLevel.SupervisedAuto);
        _ats.TruthResult = Result.Success();

        var result = await _sender.Send(new PrepareApplicationPackageCommand(
            userId, null, "", "Senior Engineer needed. Must know C#.", TemplateStyle.ClassicAts, null));

        result.IsSuccess.Should().BeTrue();
        var item = Db.ApplicationQueueItems.First(q => q.UserId == userId);
        item.RequiresManualReview.Should().BeFalse();
        item.ExecutionLogsJson.Should().NotContain("Truth Gate");
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }
}
