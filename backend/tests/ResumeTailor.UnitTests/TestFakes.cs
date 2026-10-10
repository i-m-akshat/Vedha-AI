using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.UnitTests;

/// <summary>
/// Shared hand-rolled fakes (no mocking framework beyond Moq for narrow cases).
/// Keeps MediatR handler tests hermetic without real providers or browsers.
/// </summary>
public sealed class FakeOrchestrator : IJobApplicationOrchestrator
{
    public Result<ApplicationAutomationResult>? NextResult { get; set; }

    public Task<Result<ApplicationAutomationResult>> RunPipelineAsync(
        Guid userId, Guid queueItemId, bool headed, bool copilotMode, CancellationToken cancellationToken = default)
        => Task.FromResult(NextResult
            ?? Result<ApplicationAutomationResult>.Failure("FakeOrchestrator.NextResult not set"));
}

public sealed class FakeScraper : IJobScraperService
{
    public Task<Result<(string CleanedText, string? Company, string? Title, JobSource Source)>> ScrapeAsync(
        string url, CancellationToken cancellationToken = default)
        => Task.FromResult(Result<(string, string?, string?, JobSource)>.Failure("not used"));
}

public sealed class FakeAiFactory : IAiServiceFactory
{
    public IAiProvider GetProvider(AiProviderType providerType) => throw new NotSupportedException();
    public IAiProvider GetDefaultProvider() => throw new NotSupportedException();
}

public sealed class FakeAtsEngine : IAtsScoringEngine
{
    public Result? TruthResult { get; set; }

    public AtsScoreBreakdown CalculateScore(ResumeSchema resume, JobDescriptionSchema job)
        => new() { OverallScore = 80, RecruiterFeedback = "good" };

    public Result ValidateTruthPreservation(ResumeSchema masterResume, ResumeSchema tailoredResume)
        => TruthResult ?? Result.Success();
}

public sealed class ScriptedAiProvider : IAiProvider
{
    public AiProviderType ProviderType => AiProviderType.Gemini;

    public Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(
        string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default)
    {
        object value = typeof(TResponse).Name switch
        {
            nameof(JobDescriptionSchema) => new JobDescriptionSchema { Title = "Engineer", Company = "Acme" },
            nameof(ResumeSchema) => new ResumeSchema
            {
                PersonalInfo = new PersonalInfo { FullName = "Test Candidate", Email = "t@example.com" },
            },
            _ => Activator.CreateInstance<TResponse>(),
        };
        return Task.FromResult(Result<TResponse>.Success((TResponse)value));
    }

    public Task<Result<string>> GenerateTextAsync(
        string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default)
        => Task.FromResult(Result<string>.Success("scripted answer"));

    public Task<Result<TResponse>> ParseDocumentBytesAsync<TResponse>(
        byte[] fileBytes, string mimeType, string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default)
        => throw new NotSupportedException();
}

public sealed class ScriptedAiFactory : IAiServiceFactory
{
    private readonly IAiProvider _provider = new ScriptedAiProvider();
    public IAiProvider GetProvider(AiProviderType providerType) => _provider;
    public IAiProvider GetDefaultProvider() => _provider;
}

public sealed class FakeNotifier : ITailoringProgressNotifier
{
    public Task SendProgressAsync(Guid userId, string stage, string message, int percentComplete, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
