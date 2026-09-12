using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Application.Common.Interfaces;

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? UserEmail { get; }
}

public interface IJwtTokenGenerator
{
    string GenerateToken(Guid userId, string email, string role);
}

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}

public interface IDocumentParser
{
    bool CanParse(string fileName, string contentType);
    Task<Result<string>> ExtractTextAsync(Stream fileStream, string fileName, CancellationToken cancellationToken = default);
}

public interface IJobScraperService
{
    Task<Result<(string CleanedText, string? Company, string? Title, JobSource Source)>> ScrapeAsync(string url, CancellationToken cancellationToken = default);
}

public interface IAiProvider
{
    AiProviderType ProviderType { get; }
    Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default);
    Task<Result<string>> GenerateTextAsync(string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default);
}

public interface IAiServiceFactory
{
    IAiProvider GetProvider(AiProviderType providerType);
    IAiProvider GetDefaultProvider();
}

public interface IAtsScoringEngine
{
    AtsScoreBreakdown CalculateScore(ResumeSchema resume, JobDescriptionSchema job);
    Result ValidateTruthPreservation(ResumeSchema masterResume, ResumeSchema tailoredResume);
}

public interface IResumeExportService
{
    Task<byte[]> ExportPdfAsync(ResumeSchema resume, TemplateStyle style, CancellationToken cancellationToken = default);
    Task<byte[]> ExportDocxAsync(ResumeSchema resume, TemplateStyle style, CancellationToken cancellationToken = default);
    string ExportMarkdown(ResumeSchema resume);
}

public interface ITailoringProgressNotifier
{
    Task SendProgressAsync(Guid userId, string stage, string message, int percentComplete, CancellationToken cancellationToken = default);
}

public class ApplicationAutomationResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? FinalPageUrl { get; set; }
    public bool PausedForUserReview { get; set; }
    public List<string> ExecutionLogs { get; set; } = new();
    public string? ErrorDetails { get; set; }
}

public interface IJobApplicationProvider
{
    JobSource SupportedSource { get; }
    bool CanHandle(string url);
    Task<ApplicationAutomationResult> ExecuteFlowAsync(
        string targetUrl,
        Domain.Entities.CandidateProfile profile,
        ResumeSchema resumeData,
        byte[] resumePdfBytes,
        string coverLetter,
        List<ScreeningAnswerPayload> prefilledAnswers,
        bool copilotReviewMode,
        Func<string, Task>? logCallback = null,
        CancellationToken cancellationToken = default);
}

public class ScreeningAnswerPayload
{
    public string QuestionText { get; set; } = string.Empty;
    public string AnswerText { get; set; } = string.Empty;
    public string FieldType { get; set; } = "text";
}

public interface IJobApplicationOrchestrator
{
    Task<Result<ApplicationAutomationResult>> RunPipelineAsync(
        Guid queueItemId,
        bool headed,
        bool copilotMode,
        CancellationToken cancellationToken = default);
}

