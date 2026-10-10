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
    string GenerateRefreshToken();
    System.Security.Claims.ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
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

public record Crawl4AiResultDto(bool Success, string Markdown, string? Title, string? ErrorMessage);

public interface ICrawl4AiService
{
    Task<Result<Crawl4AiResultDto>> CrawlAsync(string url, CancellationToken cancellationToken = default);
}

public interface IAiProvider
{
    AiProviderType ProviderType { get; }
    Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default);
    Task<Result<string>> GenerateTextAsync(string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default);
    Task<Result<TResponse>> ParseDocumentBytesAsync<TResponse>(byte[] fileBytes, string mimeType, string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default);
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
        bool headed = false,
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
        Guid userId,
        Guid queueItemId,
        bool headed,
        bool copilotMode,
        CancellationToken cancellationToken = default);
}

// --- Autonomous Job Application SaaS Contracts (System Architecture BRD) ---

public interface IS3StorageService
{
    Task<string> UploadResumePdfAsync(Guid applicationId, byte[] pdfBytes, string fileName = "resume.pdf", CancellationToken cancellationToken = default);
    Task<byte[]> DownloadFileAsync(string s3UrlOrKey, CancellationToken cancellationToken = default);
}

public interface IEmbeddingService
{
    Task<float[]> GenerateEmbeddingAsync(string text, string? customApiKey = null, CancellationToken cancellationToken = default);
    double CalculateCosineSimilarity(float[] vectorA, float[] vectorB);
}

public interface INatsEventBus
{
    Task PublishAsync<T>(string subject, T payload, CancellationToken cancellationToken = default);
    Task SubscribeAsync<T>(string subject, string queueGroup, Func<T, Task> handler, CancellationToken cancellationToken = default);
}

public class RagResumeResult
{
    public bool Success { get; set; }
    public string MarkdownResume { get; set; } = string.Empty;
    public string ResumeS3Url { get; set; } = string.Empty;
    public byte[] PdfBytes { get; set; } = Array.Empty<byte>();
    public List<string> SelectedAchievements { get; set; } = new();
    public string? ErrorMessage { get; set; }
}

public interface IRagResumeGenerator
{
    Task<RagResumeResult> GenerateTailoredResumeAsync(
        Guid userId,
        Guid applicationId,
        string jobTitle,
        string companyName,
        string jobDescription,
        CancellationToken cancellationToken = default);
}

public interface ICreditTransactionService
{
    Task<bool> DeductCreditOnWorkerSuccessAsync(Guid userId, Guid applicationId, string idempotencyKey, CancellationToken cancellationToken = default);
    Task<int> GetUserCreditsBalanceAsync(Guid userId, CancellationToken cancellationToken = default);
}

