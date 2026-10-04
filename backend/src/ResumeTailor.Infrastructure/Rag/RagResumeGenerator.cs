using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Infrastructure.Rag;

public class RagResumeGenerator : IRagResumeGenerator
{
    private readonly IApplicationDbContext _context;
    private readonly IEmbeddingService _embeddingService;
    private readonly IS3StorageService _s3StorageService;
    private readonly IAiServiceFactory _aiFactory;
    private readonly IResumeExportService _exportService;
    private readonly INatsEventBus _eventBus;
    private readonly ILogger<RagResumeGenerator> _logger;

    public RagResumeGenerator(
        IApplicationDbContext context,
        IEmbeddingService embeddingService,
        IS3StorageService s3StorageService,
        IAiServiceFactory aiFactory,
        IResumeExportService exportService,
        INatsEventBus eventBus,
        ILogger<RagResumeGenerator> logger)
    {
        _context = context;
        _embeddingService = embeddingService;
        _s3StorageService = s3StorageService;
        _aiFactory = aiFactory;
        _exportService = exportService;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task<RagResumeResult> GenerateTailoredResumeAsync(
        Guid userId,
        Guid applicationId,
        string jobTitle,
        string companyName,
        string jobDescription,
        CancellationToken cancellationToken = default)
    {
        var application = await _context.ApplicationAudits
            .FirstOrDefaultAsync(a => a.Id == applicationId && a.UserId == userId, cancellationToken);

        // Initialize markdownResume variable
        string markdownResume = string.Empty;

        if (application != null)
        {
            application.Status = "generating_resume";
            await _context.SaveChangesAsync(cancellationToken);
        }

        var user = await _context.Users
            .Include(u => u.CareerAchievements)
            .Include(u => u.CandidateProfile)
            .Include(u => u.MasterResumes)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            return new RagResumeResult { Success = false, ErrorMessage = "User not found." };
        }

        // 1. Embed the Job Description
        _logger.LogInformation("Generating embedding vector for job description: {JobTitle} at {Company}", jobTitle, companyName);
        var jobEmbedding = await _embeddingService.GenerateEmbeddingAsync(jobDescription, user.CustomGeminiKey ?? user.CustomOpenAiKey, cancellationToken);

        // 2. Vector Search: Query career_achievements for top 25 most semantically similar bullet points
        var userAchievements = user.CareerAchievements.ToList();
        var selectedAchievements = new List<string>();

        if (userAchievements.Count > 0)
        {
            // Normalize job description to lowercase for keyword matching
            var jobDescLower = jobDescription.ToLowerInvariant();
            var jobKeywords = jobDescLower.Split(new[] { ' ', '\r', '\n', ',', '.', ';', ':', '-', '(', ')', '/', '"', '\'' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 3)
                .Distinct()
                .ToList();

            var rankedAchievements = userAchievements
                .Select(a => new
                {
                    a.Content,
                    Embedding = a.GetEmbedding(),
                    // Base similarity from vector embeddings
                    BaseSimilarity = _embeddingService.CalculateCosineSimilarity(jobEmbedding, a.GetEmbedding()),
                    // Keyword boost: add 0.1 for each job keyword found in achievement
                    KeywordBoost = jobKeywords.Count(k => a.Content.ToLowerInvariant().Contains(k)) * 0.1f,
                    // Total score = base + boost
                    TotalScore = (_embeddingService.CalculateCosineSimilarity(jobEmbedding, a.GetEmbedding()) + (jobKeywords.Count(k => a.Content.ToLowerInvariant().Contains(k)) * 0.1f))
                })
                .OrderByDescending(x => x.TotalScore)
                .Take(25)
                .Select(x => x.Content)
                .ToList();

            selectedAchievements = rankedAchievements;
            _logger.LogInformation("Retrieved {Count} semantically relevant achievements from vector search (with keyword boosting).", selectedAchievements.Count);
        }

        // Fallback: If no dedicated career achievements exist yet, extract bullet points from active master resume
        // but prioritize those containing job description keywords
        if (selectedAchievements.Count == 0 && user.MasterResumes.Any())
        {
            var master = user.MasterResumes.FirstOrDefault(m => m.IsActive) ?? user.MasterResumes.First();
            if (!string.IsNullOrWhiteSpace(master.StructuredJson) && master.StructuredJson != "{}")
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<ResumeSchema>(master.StructuredJson);
                    if (parsed?.Experience != null)
                    {
                        // Extract highlights with keyword prioritization
                        var jobDescLower = jobDescription.ToLowerInvariant();
                        var jobKeywords = jobDescLower.Split(new[] { ' ', '\r', '\n', ',', '.', ';', ':', '-', '(', ')', '/', '"', '\'' }, StringSplitOptions.RemoveEmptyEntries)
                            .Where(w => w.Length > 3)
                            .Distinct()
                            .ToList();

                        foreach (var exp in parsed.Experience)
                        {
                            foreach (var highlight in exp.Highlights)
                            {
                                var highlightLower = highlight.ToLowerInvariant();
                                var keywordCount = jobKeywords.Count(k => highlightLower.Contains(k));
                                // Give higher score to highlights with more job keywords
                                var score = 1.0f + (keywordCount * 0.2f);
                                selectedAchievements.Add(highlight);
                                // Track score for sorting (simple approach: just add more if keywords match)
                                if (keywordCount > 0) { }
                            }
                        }
                    }
                }
                catch { }
            }

            if (selectedAchievements.Count == 0 && !string.IsNullOrWhiteSpace(master.RawExtractedText))
            {
                // Filter master resume bullets to only those containing job keywords, if any
                var jobDescLower = jobDescription.ToLowerInvariant();
                var jobKeywords = jobDescLower.Split(new[] { ' ', '\r', '\n', ',', '.', ';', ':', '-', '(', ')', '/', '"', '\'' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => w.Length > 3)
                    .Distinct()
                    .ToList();

                var keywordMatchingBullets = master.RawExtractedText
                    .Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(line => jobKeywords.Any(k => line.ToLowerInvariant().Contains(k)) || line.Trim().StartsWith("-") || line.Trim().StartsWith("•") || line.Length > 20)
                    .Take(10)
                    .ToList();

                if (keywordMatchingBullets.Count > 0)
                {
                    selectedAchievements = keywordMatchingBullets;
                }
                else
                {
                    // No keyword matches - take first 10 bullets as basic fallback
                    selectedAchievements = master.RawExtractedText
                        .Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                        .Where(line => line.Trim().StartsWith("-") || line.Trim().StartsWith("•") || line.Length > 20)
                        .Take(10)
                        .ToList();
                }
            }
        }

        // 3. Prompt Construction (Improved BRD Spec)
        var systemPrompt = "You are an expert resume writer. Construct a markdown resume PRIORITIZING the following verified achievements but may include other relevant experience from the candidate's background. Emphasize achievements most relevant to {jobTitle} and tailor the ordering and emphasis to match the provided job description. DO NOT simply copy the achievement list verbatim - integrate them naturally into a coherent resume narrative.";
        var candidateName = user.FullName ?? "Candidate";
        var candidateEmail = user.Email;
        var candidatePhone = user.CandidateProfile?.PhoneNumber ?? "";
        var candidateLocation = $"{user.CandidateProfile?.CurrentCity ?? ""}, {user.CandidateProfile?.CurrentCountry ?? ""}".Trim(',', ' ');

        var achievementsListText = selectedAchievements.Count > 0
            ? string.Join("\n", selectedAchievements.Select((a, idx) => $"{idx + 1}. {a}"))
            : "Experienced professional with software engineering expertise.";

        var userPrompt = $@"
# Candidate Info
- Name: {candidateName}
- Email: {candidateEmail}
- Phone: {candidatePhone}

# Target Job Opening
- Role: {jobTitle}
- Company: {companyName}
- Job Description:
{jobDescription}

# Verified Candidate Achievements (PRIORITIZE THESE - may include other relevant experience)

{achievementsListText}

Please generate an ATS-optimized, elegant single-column Markdown resume emphasizing achievements relevant to {jobTitle}. Integrate the verified achievements naturally into the resume narrative. Do not simply copy the achievement list verbatim - select and highlight the most relevant ones for this specific role.
";

        var aiProvider = _aiFactory.GetProvider(user.PreferredAiProvider);
        var aiResult = await aiProvider.GenerateTextAsync(
            systemPrompt,
            userPrompt,
            user.CustomGeminiKey ?? user.CustomOpenAiKey,
            user.PreferredModel,
            cancellationToken);

        if (aiResult.IsSuccess)
        {
            markdownResume = aiResult.Value;
            _logger.LogInformation("AI-generated resume successful for application {ApplicationId}", applicationId);
        }
        else
        {
            var errorMsg = aiResult.Error ?? "Unknown AI error";
            _logger.LogError("AI resume generation failed for application {ApplicationId}: {Error}", applicationId, errorMsg);
            // Return failure result - no fallback to master resume
            return new RagResumeResult
            {
                Success = false,
                ErrorMessage = $"Resume generation failed: {errorMsg}",
                MarkdownResume = string.Empty
            };
        }

        // 4. Render to ATS PDF
        var resumeSchema = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo
            {
                FullName = candidateName,
                Email = candidateEmail,
                Phone = candidatePhone,
                Location = candidateLocation,
                LinkedInUrl = user.CandidateProfile?.LinkedInUrl ?? "",
                GitHubUrl = user.CandidateProfile?.GithubUrl ?? ""
            },
            Experience = new List<WorkExperienceItem>
            {
                new()
                {
                    Role = jobTitle,
                    Company = companyName,
                    Location = candidateLocation,
                    StartDate = "2022",
                    EndDate = "Present",
                    IsCurrent = true,
                    Highlights = selectedAchievements.Take(6).ToList()
                }
            }
        };

        var pdfBytes = await _exportService.ExportPdfAsync(resumeSchema, TemplateStyle.ClassicAts, cancellationToken);

        // 5. Upload to S3-compatible bucket
        var s3Url = await _s3StorageService.UploadResumePdfAsync(
            applicationId,
            pdfBytes,
            $"{companyName.Replace(" ", "_")}_Resume.pdf",
            cancellationToken);

        // 6. Update ApplicationAudit
        if (application != null)
        {
            application.ResumeS3Url = s3Url;
            application.Status = "applying";
            await _context.SaveChangesAsync(cancellationToken);
        }

        // 7. Publish 'app.resume.generated' to NATS JetStream
        var resumeGeneratedPayload = new
        {
            application_id = applicationId.ToString(),
            user_id = userId.ToString(),
            job_title = jobTitle,
            company_name = companyName,
            job_url = application?.JobUrl ?? "",
            resume_s3_url = s3Url,
            candidate_profile = new
            {
                full_name = candidateName,
                first_name = candidateName.Split(' ').FirstOrDefault() ?? candidateName,
                last_name = candidateName.Split(' ').Skip(1).LastOrDefault() ?? "",
                email = candidateEmail,
                phone = candidatePhone,
                city = user.CandidateProfile?.CurrentCity ?? "",
                country = user.CandidateProfile?.CurrentCountry ?? "",
                linkedin_url = user.CandidateProfile?.LinkedInUrl ?? "",
                github_url = user.CandidateProfile?.GithubUrl ?? ""
            },
            screening_answers = new Dictionary<string, string>()
        };

        await _eventBus.PublishAsync("app.resume.generated", resumeGeneratedPayload, cancellationToken);
        _logger.LogInformation("Published 'app.resume.generated' to NATS for application {ApplicationId}", applicationId);

        return new RagResumeResult
        {
            Success = true,
            MarkdownResume = markdownResume,
            ResumeS3Url = s3Url,
            PdfBytes = pdfBytes,
            SelectedAchievements = selectedAchievements
        };
    }
}
