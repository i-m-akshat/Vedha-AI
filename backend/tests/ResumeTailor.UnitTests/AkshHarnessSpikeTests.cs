using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Infrastructure.Aksh;
using ResumeTailor.Infrastructure.Persistence;
using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// Phase 0 spike tests: the Aksh HarnessAgent constructs on .NET 10 and the
/// read-only recall_memory tool serves real Postgres-shaped state with zero LLM calls.
/// </summary>
public class AkshHarnessSpikeTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _provider;
    private readonly Guid _userId = Guid.NewGuid();

    public AkshHarnessSpikeTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;
        var context = new ApplicationDbContext(options);
        context.Database.EnsureCreated();
        context.Users.Add(new User
        {
            Id = _userId,
            Email = "aksh.spike@test.local",
            PasswordHash = "not-a-real-hash",
            FullName = "Aksh Spike",
        });
        context.ScreeningQuestionMemories.Add(new ScreeningQuestionMemory
        {
            UserId = _userId,
            Company = "Acme",
            QuestionHash = "abc123",
            QuestionText = "Will you require visa sponsorship?",
            AnswerText = "No",
            FieldType = "radio",
        });
        context.SaveChanges();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IApplicationDbContext>(context);
        services.AddSingleton<AkshChatClientAdapter>();
        _provider = services.BuildServiceProvider();
    }

    [Fact]
    public void HarnessAgent_Constructs_WithAkshIdentity()
    {
        var agent = HarnessAgentFactory.CreateTurnAgent(_provider, _userId, Guid.NewGuid());

        agent.Should().NotBeNull();
    }

    [Fact]
    public void NoRegisteredTool_Accepts_ModelSupplied_UserId()
    {
        // Regression: the deleted Phase-0 recall shape took userId from the
        // model (cross-user read primitive). Every catalog tool must bind the
        // server-side user — no userId/sessionId schema parameter, anywhere.
        var scopes = _provider.GetRequiredService<IServiceScopeFactory>();
        var catalog = AkshTools.CreateCatalog(scopes, _userId, Guid.NewGuid());

        catalog.Should().NotBeEmpty();
        foreach (var tool in catalog)
        {
            var schema = tool.JsonSchema.GetRawText().ToLowerInvariant();
            schema.Should().NotContain("userid", $"tool '{tool.Name}' must not accept a model-supplied userId");
            schema.Should().NotContain("sessionid", $"tool '{tool.Name}' must not accept a model-supplied sessionId");
        }
    }

    [Fact]
    public async Task RecallMemoryTool_ReturnsStoredAnswer_WithoutLlm()
    {
        var scopes = _provider.GetRequiredService<IServiceScopeFactory>();
        var tool = AkshTools.CreateRecallMemoryForUser(scopes, _userId);

        tool.Name.Should().Be(AkshTools.RecallMemory);

        var result = await tool.InvokeAsync(new AIFunctionArguments
        {
            ["query"] = "visa",
        });

        result.Should().NotBeNull();
        result!.ToString().Should().Contain("No");
    }

    [Fact]
    public void Agent_Instructions_Bind_Mandatory_Tool_Workflow()
    {
        // Reference pattern (microsoft/agent-framework Harness samples): the harness
        // only plans/acts when instructions mandate the todo→ground→act→gate order.
        AkshPrompts.Core.Should().Contain("todo");
        AkshPrompts.Core.Should().Contain("launch_apply");
        AkshPrompts.Core.Should().Contain("untrusted");
        AkshPrompts.Harness.Should().Contain("todo");
    }

    [Fact]
    public async Task Adapter_Throws_TypedFailure_OnProviderError()
    {
        // Fail-closed: provider errors must surface as AkshModelException
        // (runner maps to error event + parked session), never as apology chat
        // text the harness would chain grounded work onto.
        var providerMock = new Mock<IAiProvider>();
        providerMock
            .Setup(p => p.GenerateTextAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<string>.Failure("Gemini returned no usable text (finishReason=OTHER)."));

        var factoryMock = new Mock<IAiServiceFactory>();
        factoryMock.Setup(f => f.GetProvider(AiProviderType.Gemini)).Returns(providerMock.Object);

        var services = new ServiceCollection();
        services.AddSingleton(factoryMock.Object);
        using var provider = services.BuildServiceProvider();

        var client = new AkshChatClientAdapter(provider.GetRequiredService<IServiceScopeFactory>())
            .WithCredentials(AiProviderType.Gemini, "user-key-123", "gemini-flash-lite-latest");

        var ex = await Assert.ThrowsAsync<AkshModelException>(() =>
            client.GetResponseAsync(new[] { new ChatMessage(ChatRole.User, "hi") }));
        ex.ReasonCode.Should().Be("model_unavailable");
    }

    [Fact]
    public async Task Adapter_Forwards_UserKey_Model_And_Provider()
    {
        var providerMock = new Mock<IAiProvider>();
        providerMock
            .Setup(p => p.GenerateTextAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<string>.Success("hello aksh"));

        var factoryMock = new Mock<IAiServiceFactory>();
        factoryMock.Setup(f => f.GetProvider(AiProviderType.Gemini)).Returns(providerMock.Object);

        var services = new ServiceCollection();
        services.AddSingleton(factoryMock.Object);
        using var provider = services.BuildServiceProvider();

        var client = new AkshChatClientAdapter(provider.GetRequiredService<IServiceScopeFactory>())
            .WithCredentials(AiProviderType.Gemini, "user-key-123", "gemini-flash-lite-latest");

        var response = await client.GetResponseAsync(new[] { new ChatMessage(ChatRole.User, "hi") });

        response.Text.Should().Contain("hello aksh");
        providerMock.Verify(p => p.GenerateTextAsync(
            It.IsAny<string>(), "hi", "user-key-123", "gemini-flash-lite-latest", It.IsAny<CancellationToken>()),
            Times.Once);
        factoryMock.Verify(f => f.GetProvider(AiProviderType.Gemini), Times.Once);
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }
}
