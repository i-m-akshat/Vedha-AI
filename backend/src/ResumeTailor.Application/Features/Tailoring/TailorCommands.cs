using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Exceptions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Application.Features.Tailoring;

public record GenerateTailoredResumeCommand(
    Guid? MasterResumeId,
    Guid? JobDescriptionId,
    string? DirectJobUrl,
    string? DirectJobText,
    TemplateStyle SelectedTemplate = TemplateStyle.ClassicAts,
    AiProviderType? ProviderOverride = null,
    string? ModelOverride = null
) : IRequest<Result<TailoredResumeResultDto>>;

public record GetTailoredResumeByIdQuery(Guid Id) : IRequest<Result<TailoredResumeResultDto>>;

public record GetGeneratedResumesListQuery : IRequest<Result<List<GeneratedResumeSummaryDto>>>;

public record ExportResumeQuery(
    Guid GeneratedResumeId,
    ResumeFormat Format,
    TemplateStyle Style
) : IRequest<Result<ExportFileDto>>;

public record ExportFileDto(byte[] FileBytes, string ContentType, string FileName);

public record TailoredResumeResultDto(
    Guid Id,
    Guid MasterResumeId,
    Guid JobDescriptionId,
    string TargetRole,
    string TargetCompany,
    TemplateStyle SelectedTemplate,
    ResumeSchema MasterSchema,
    ResumeSchema TailoredSchema,
    AtsScoreBreakdown AtsAnalysis,
    DateTime CreatedAtUtc
);

public record GeneratedResumeSummaryDto(
    Guid Id,
    string TargetRole,
    string TargetCompany,
    int MatchScore,
    TemplateStyle SelectedTemplate,
    DateTime CreatedAtUtc
);

public class TailorCommandHandler :
    IRequestHandler<GenerateTailoredResumeCommand, Result<TailoredResumeResultDto>>,
    IRequestHandler<GetTailoredResumeByIdQuery, Result<TailoredResumeResultDto>>,
    IRequestHandler<GetGeneratedResumesListQuery, Result<List<GeneratedResumeSummaryDto>>>,
    IRequestHandler<ExportResumeQuery, Result<ExportFileDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAiServiceFactory _aiServiceFactory;
    private readonly IAtsScoringEngine _atsScoringEngine;
    private readonly IResumeExportService _exportService;
    private readonly IJobScraperService _scraperService;
    private readonly ITailoringProgressNotifier _progressNotifier;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public TailorCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IAiServiceFactory aiServiceFactory,
        IAtsScoringEngine atsScoringEngine,
        IResumeExportService exportService,
        IJobScraperService scraperService,
        ITailoringProgressNotifier progressNotifier)
    {
        _context = context;
        _currentUserService = currentUserService;
        _aiServiceFactory = aiServiceFactory;
        _atsScoringEngine = atsScoringEngine;
        _exportService = exportService;
        _scraperService = scraperService;
        _progressNotifier = progressNotifier;
    }

    public async Task<Result<TailoredResumeResultDto>> Handle(GenerateTailoredResumeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        await _progressNotifier.SendProgressAsync(userId, "Initializing", "Loading master resume and target job profile...", 10, cancellationToken);

        // 1. Get Master Resume
        MasterResume? masterResume;
        if (request.MasterResumeId.HasValue)
        {
            masterResume = await _context.MasterResumes
                .FirstOrDefaultAsync(r => r.Id == request.MasterResumeId && r.UserId == userId, cancellationToken);
        }
        else
        {
            masterResume = await _context.MasterResumes
                .FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive, cancellationToken);
        }

        if (masterResume == null)
            return Result<TailoredResumeResultDto>.Failure("No Master Resume found. Please upload a Master Resume first.");

        var masterSchema = JsonSerializer.Deserialize<ResumeSchema>(masterResume.StructuredJson, JsonOptions) ?? new ResumeSchema();

        // 2. Get or Create Job Description
        JobDescription? jobDescription = null;
        if (request.JobDescriptionId.HasValue)
        {
            jobDescription = await _context.JobDescriptions
                .FirstOrDefaultAsync(j => j.Id == request.JobDescriptionId && j.UserId == userId, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(request.DirectJobUrl))
        {
            await _progressNotifier.SendProgressAsync(userId, "Scraping", $"Scraping job opening from {request.DirectJobUrl}...", 25, cancellationToken);
            var scrapeResult = await _scraperService.ScrapeAsync(request.DirectJobUrl, cancellationToken);
            if (scrapeResult.IsSuccess)
            {
                var (cleanedText, company, title, source) = scrapeResult.Value;
                var aiProv = _aiServiceFactory.GetProvider(request.ProviderOverride ?? user.PreferredAiProvider);
                var jdSchema = await ExtractJdSchemaAsync(aiProv, user, cleanedText, cancellationToken);
                if (!string.IsNullOrEmpty(company)) jdSchema.Company = company;
                if (!string.IsNullOrEmpty(title)) jdSchema.Title = title;

                jobDescription = new JobDescription
                {
                    UserId = userId,
                    Source = source,
                    SourceUrl = request.DirectJobUrl,
                    TargetCompany = !string.IsNullOrWhiteSpace(jdSchema.Company) ? jdSchema.Company : "Target Company",
                    TargetRole = !string.IsNullOrWhiteSpace(jdSchema.Title) ? jdSchema.Title : "Target Role",
                    RawText = cleanedText,
                    CleanedText = cleanedText,
                    ExtractedSchemaJson = JsonSerializer.Serialize(jdSchema, JsonOptions)
                };
                _context.JobDescriptions.Add(jobDescription);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }
        else if (!string.IsNullOrWhiteSpace(request.DirectJobText))
        {
            await _progressNotifier.SendProgressAsync(userId, "Parsing JD", "Analyzing target job requirements...", 25, cancellationToken);
            var aiProv = _aiServiceFactory.GetProvider(request.ProviderOverride ?? user.PreferredAiProvider);
            var jdSchema = await ExtractJdSchemaAsync(aiProv, user, request.DirectJobText, cancellationToken);

            jobDescription = new JobDescription
            {
                UserId = userId,
                Source = JobSource.DirectText,
                TargetCompany = !string.IsNullOrWhiteSpace(jdSchema.Company) ? jdSchema.Company : "Target Company",
                TargetRole = !string.IsNullOrWhiteSpace(jdSchema.Title) ? jdSchema.Title : "Target Role",
                RawText = request.DirectJobText,
                CleanedText = request.DirectJobText,
                ExtractedSchemaJson = JsonSerializer.Serialize(jdSchema, JsonOptions)
            };
            _context.JobDescriptions.Add(jobDescription);
            await _context.SaveChangesAsync(cancellationToken);
        }

        if (jobDescription == null)
            return Result<TailoredResumeResultDto>.Failure("A valid Job Description or URL is required.");

        var jobSchema = JsonSerializer.Deserialize<JobDescriptionSchema>(jobDescription.ExtractedSchemaJson, JsonOptions) ?? new JobDescriptionSchema();

        // 3. AI Tailoring with Strict Never-Lie Guardrails
        await _progressNotifier.SendProgressAsync(userId, "Tailoring", "Crafting ATS-optimized bullet points & reordering experience (Zero-Lie Enforcement)...", 50, cancellationToken);

        var providerType = request.ProviderOverride ?? user.PreferredAiProvider;
        var aiProvider = _aiServiceFactory.GetProvider(providerType);
        var modelName = request.ModelOverride ?? user.PreferredModel;

        var systemPrompt = @"You are a Principal Executive Resume Strategist & ATS Optimization Specialist.
Your goal is to tailor the candidate's Master Resume specifically for the Target Job Description.

STRICT TRUTH-PRESERVATION RULES (MANDATORY & ZERO TOLERANCE):
1. NEVER invent any companies, employment periods, job titles, or institutions.
2. NEVER invent fake projects, fake achievements, or fake certifications.
3. ONLY improve wording, strengthen action verbs, rephrase bullet points with quantifiable impact (STAR method), reorganize experience/projects in order of relevance, and optimize keywords naturally.
4. If the candidate lacks a required skill from the JD, DO NOT falsely inject it into their experience. Leave missing skills for the gap report.
5. Return the tailored resume as valid JSON matching ResumeSchema.";

        var userPrompt = $@"
TARGET JOB DESCRIPTION:
Title: {jobSchema.Title}
Company: {jobSchema.Company}
Must-Have Skills: {string.Join(", ", jobSchema.MustHaveSkills)}
Key Responsibilities: {string.Join("; ", jobSchema.Responsibilities)}
Keywords: {string.Join(", ", jobSchema.Keywords)}

MASTER RESUME:
{JsonSerializer.Serialize(masterSchema, JsonOptions)}

Please return the tailored ResumeSchema JSON:";

        var apiKey = providerType switch
        {
            AiProviderType.OpenAi => user.CustomOpenAiKey,
            AiProviderType.Claude => user.CustomClaudeKey,
            AiProviderType.Gemini => user.CustomGeminiKey,
            _ => null
        };

        var tailoringResult = await aiProvider.GenerateStructuredJsonAsync<ResumeSchema>(
            systemPrompt,
            userPrompt,
            apiKey,
            modelName,
            cancellationToken
        );

        var tailoredSchema = tailoringResult.IsSuccess ? tailoringResult.Value : masterSchema;

        // Ensure PersonalInfo is preserved exactly
        tailoredSchema.PersonalInfo = masterSchema.PersonalInfo;

        // 4. Validate Truth Preservation
        var truthCheck = _atsScoringEngine.ValidateTruthPreservation(masterSchema, tailoredSchema);
        if (truthCheck.IsFailure)
        {
            // Revert invalid entities back to master values
            tailoredSchema.Experience = masterSchema.Experience;
            tailoredSchema.Education = masterSchema.Education;
            tailoredSchema.Certifications = masterSchema.Certifications;
        }

        // 5. Calculate ATS Score & Recruiter Feedback
        await _progressNotifier.SendProgressAsync(userId, "ATS Scoring", "Performing keyword density, semantic match, and recruiter scorecard analysis...", 80, cancellationToken);
        var atsScore = _atsScoringEngine.CalculateScore(tailoredSchema, jobSchema);

        // 6. Save Generated Resume & ATS Analysis
        var generatedResume = new GeneratedResume
        {
            UserId = userId,
            MasterResumeId = masterResume.Id,
            JobDescriptionId = jobDescription.Id,
            TargetRole = jobSchema.Title,
            TargetCompany = jobSchema.Company,
            TailoredStructuredJson = JsonSerializer.Serialize(tailoredSchema, JsonOptions),
            DiffSummaryJson = JsonSerializer.Serialize(new { MasterSummary = masterSchema.Summary, TailoredSummary = tailoredSchema.Summary }),
            SelectedTemplate = request.SelectedTemplate,
            GeneratedWithProvider = providerType,
            ModelName = modelName ?? "default"
        };

        _context.GeneratedResumes.Add(generatedResume);
        await _context.SaveChangesAsync(cancellationToken);

        var atsAnalysis = new AtsAnalysis
        {
            GeneratedResumeId = generatedResume.Id,
            MatchScore = atsScore.OverallScore,
            AnalysisDataJson = JsonSerializer.Serialize(atsScore, JsonOptions),
            RecruiterFeedbackSummary = atsScore.RecruiterFeedback,
            MatchingKeywordsCount = atsScore.MatchingKeywords.Count,
            MissingKeywordsCount = atsScore.MissingKeywords.Count
        };

        _context.AtsAnalyses.Add(atsAnalysis);

        // Also track in applications if not already added
        var existingApp = await _context.Applications
            .FirstOrDefaultAsync(a => a.UserId == userId && a.CompanyName == jobSchema.Company && a.JobTitle == jobSchema.Title, cancellationToken);

        if (existingApp == null)
        {
            _context.Applications.Add(new ApplicationRecord
            {
                UserId = userId,
                GeneratedResumeId = generatedResume.Id,
                CompanyName = !string.IsNullOrWhiteSpace(jobSchema.Company) ? jobSchema.Company : "Target Company",
                JobTitle = !string.IsNullOrWhiteSpace(jobSchema.Title) ? jobSchema.Title : "Target Role",
                JobUrl = jobDescription.SourceUrl,
                Location = jobSchema.Location,
                SalaryRange = jobSchema.Salary,
                Status = ApplicationStatus.Saved
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _progressNotifier.SendProgressAsync(userId, "Complete", "Resume tailored and ATS scorecard generated successfully!", 100, cancellationToken);

        return Result<TailoredResumeResultDto>.Success(new TailoredResumeResultDto(
            generatedResume.Id,
            masterResume.Id,
            jobDescription.Id,
            generatedResume.TargetRole,
            generatedResume.TargetCompany,
            generatedResume.SelectedTemplate,
            masterSchema,
            tailoredSchema,
            atsScore,
            generatedResume.CreatedAtUtc
        ));
    }

    public async Task<Result<TailoredResumeResultDto>> Handle(GetTailoredResumeByIdQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var generatedResume = await _context.GeneratedResumes
            .Include(g => g.MasterResume)
            .Include(g => g.JobDescription)
            .Include(g => g.AtsAnalysis)
            .FirstOrDefaultAsync(g => g.Id == request.Id && g.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(GeneratedResume), request.Id);

        var masterSchema = JsonSerializer.Deserialize<ResumeSchema>(generatedResume.MasterResume?.StructuredJson ?? "{}", JsonOptions) ?? new ResumeSchema();
        var tailoredSchema = JsonSerializer.Deserialize<ResumeSchema>(generatedResume.TailoredStructuredJson, JsonOptions) ?? new ResumeSchema();
        var atsScore = JsonSerializer.Deserialize<AtsScoreBreakdown>(generatedResume.AtsAnalysis?.AnalysisDataJson ?? "{}", JsonOptions) ?? new AtsScoreBreakdown();

        return Result<TailoredResumeResultDto>.Success(new TailoredResumeResultDto(
            generatedResume.Id,
            generatedResume.MasterResumeId,
            generatedResume.JobDescriptionId,
            generatedResume.TargetRole,
            generatedResume.TargetCompany,
            generatedResume.SelectedTemplate,
            masterSchema,
            tailoredSchema,
            atsScore,
            generatedResume.CreatedAtUtc
        ));
    }

    public async Task<Result<List<GeneratedResumeSummaryDto>>> Handle(GetGeneratedResumesListQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var items = await _context.GeneratedResumes
            .Include(g => g.AtsAnalysis)
            .Where(g => g.UserId == userId)
            .OrderByDescending(g => g.CreatedAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(g => new GeneratedResumeSummaryDto(
            g.Id,
            g.TargetRole,
            g.TargetCompany,
            g.AtsAnalysis?.MatchScore ?? 0,
            g.SelectedTemplate,
            g.CreatedAtUtc
        )).ToList();

        return Result<List<GeneratedResumeSummaryDto>>.Success(dtos);
    }

    public async Task<Result<ExportFileDto>> Handle(ExportResumeQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var generatedResume = await _context.GeneratedResumes
            .FirstOrDefaultAsync(g => g.Id == request.GeneratedResumeId && g.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(GeneratedResume), request.GeneratedResumeId);

        var schema = JsonSerializer.Deserialize<ResumeSchema>(generatedResume.TailoredStructuredJson, JsonOptions) ?? new ResumeSchema();
        var sanitizedName = string.Join("_", (schema.PersonalInfo.FullName + "_" + generatedResume.TargetRole).Split(Path.GetInvalidFileNameChars()));

        switch (request.Format)
        {
            case ResumeFormat.Pdf:
                var pdfBytes = await _exportService.ExportPdfAsync(schema, request.Style, cancellationToken);
                return Result<ExportFileDto>.Success(new ExportFileDto(pdfBytes, "application/pdf", $"{sanitizedName}_Resume.pdf"));

            case ResumeFormat.Docx:
                var docxBytes = await _exportService.ExportDocxAsync(schema, request.Style, cancellationToken);
                return Result<ExportFileDto>.Success(new ExportFileDto(docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", $"{sanitizedName}_Resume.docx"));

            case ResumeFormat.Markdown:
            default:
                var mdText = _exportService.ExportMarkdown(schema);
                var mdBytes = System.Text.Encoding.UTF8.GetBytes(mdText);
                return Result<ExportFileDto>.Success(new ExportFileDto(mdBytes, "text/markdown", $"{sanitizedName}_Resume.md"));
        }
    }

    private static async Task<JobDescriptionSchema> ExtractJdSchemaAsync(
        IAiProvider aiProvider,
        User user,
        string rawText,
        CancellationToken cancellationToken)
    {
        var systemPrompt = "Extract key job details into structured JSON matching JobDescriptionSchema.";
        var userPrompt = $"Analyze job description:\n\n{rawText}";
        var result = await aiProvider.GenerateStructuredJsonAsync<JobDescriptionSchema>(
            systemPrompt,
            userPrompt,
            user.PreferredAiProvider switch
            {
                AiProviderType.OpenAi => user.CustomOpenAiKey,
                AiProviderType.Claude => user.CustomClaudeKey,
                AiProviderType.Gemini => user.CustomGeminiKey,
                _ => null
            },
            user.PreferredModel,
            cancellationToken
        );

        return result.IsSuccess ? result.Value : new JobDescriptionSchema
        {
            Title = "Target Position",
            Company = "Target Company",
            Responsibilities = rawText.Split('\n', StringSplitOptions.RemoveEmptyEntries).Take(5).ToList()
        };
    }
}
