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

public record UpdateTailoredResumeCommand(
    Guid Id,
    ResumeSchema UpdatedSchema,
    TemplateStyle? SelectedTemplate = null
) : IRequest<Result<TailoredResumeResultDto>>;

public class TailorCommandHandler :
    IRequestHandler<GenerateTailoredResumeCommand, Result<TailoredResumeResultDto>>,
    IRequestHandler<UpdateTailoredResumeCommand, Result<TailoredResumeResultDto>>,
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
            if (scrapeResult.IsFailure)
            {
                return Result<TailoredResumeResultDto>.Failure($"Failed to scrape job opening: {scrapeResult.Error}");
            }

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
                TargetCompany = !string.IsNullOrWhiteSpace(jdSchema.Company) ? jdSchema.Company : (company ?? "Company"),
                TargetRole = !string.IsNullOrWhiteSpace(jdSchema.Title) ? jdSchema.Title : (title ?? "Role"),
                RawText = cleanedText,
                CleanedText = cleanedText,
                ExtractedSchemaJson = JsonSerializer.Serialize(jdSchema, JsonOptions)
            };
            _context.JobDescriptions.Add(jobDescription);
            await _context.SaveChangesAsync(cancellationToken);
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
        jobSchema.EnsureKeywordsPopulated(jobDescription.CleanedText);

        var providerType = request.ProviderOverride ?? user.PreferredAiProvider;
        var aiProvider = _aiServiceFactory.GetProvider(providerType);
        var modelName = request.ModelOverride ?? user.PreferredModel;

        // Dedicated AI fallback extraction strictly when none are coming
        if (jobSchema.Keywords.Count == 0 && jobSchema.MustHaveSkills.Count == 0 && !string.IsNullOrWhiteSpace(jobDescription.CleanedText))
        {
            await ExtractKeywordsFallbackWithAiAsync(aiProvider, user, jobSchema, jobDescription.CleanedText, cancellationToken);
            jobSchema.EnsureKeywordsPopulated(jobDescription.CleanedText);
            jobDescription.ExtractedSchemaJson = JsonSerializer.Serialize(jobSchema, JsonOptions);
            await _context.SaveChangesAsync(cancellationToken);
        }

        // 3. AI Tailoring with Strict Never-Lie Guardrails
        await _progressNotifier.SendProgressAsync(userId, "Tailoring", "Crafting ATS-optimized bullet points & reordering experience (Zero-Lie Enforcement)...", 50, cancellationToken);


        var systemPrompt = @"You are a Principal Executive Resume Strategist & ATS Optimization Specialist.
Your task is to produce a HEAVILY TAILORED resume that is visibly and structurally different for each unique Job Description and achieves an ATS match score of 90%+ across modern enterprise parsers (Greenhouse, Lever, Workday, Taleo).

---------------------------------------------------------------------------
STRICT ZERO-LIE RULES (MANDATORY - ZERO TOLERANCE):
---------------------------------------------------------------------------
1. NEVER invent companies, employment periods, job titles, institutions, projects, certifications, or achievements.
2. NEVER inject a skill or technology into a bullet that did not actually appear in that role/project.
3. NEVER fabricate metrics - only use numbers or percentages that exist in the master resume.
4. You MAY rephrase, reframe, restructure, reorder, consolidate, or expand existing bullet points.
5. You MAY add or remove bullet points from a role AS LONG AS every bullet reflects something real that was in the master resume for that role.

---------------------------------------------------------------------------
AGGRESSIVE TAILORING & ATS MAXIMIZATION MANDATES (TARGET: 90%+ ATS SCORE):
---------------------------------------------------------------------------

[PERSONALINFO]:
- Set the 'title' field to the EXACT target job title from the JD (e.g., ""Senior Full-Stack .NET Developer"").

[SUMMARY - CRITICAL ATS KEYWORD ENGINE]:
- The very first sentence MUST name the exact target job title from the JD.
- Seamlessly weave 3-5 of the candidate's verified skills that DIRECTLY MATCH the JD's Must-Have Skills into the first 2 sentences.
- Weave legitimate domain methodologies and competencies (e.g. Agile/Scrum, CI/CD, Code Reviews, Cross-functional collaboration, System Design) from the JD wherever the candidate truthfully performed them.
- Do NOT write a generic summary - make it 3-4 compelling sentences tailored specifically to this company and role.

[EXPERIENCE - BULLET SELECTION & METRIC RETENTION - CRITICAL]:
- CRITICAL: Prioritize retaining and elevating master resume bullets that contain REAL QUANTIFIED METRICS (%, $, multipliers like 3x, scale counts, latency improvements).
- Ensure at least 70%-80% of tailored bullets retain the candidate's genuine quantitative achievements from the master resume to maximize the ATS Experience Relevance Score.
- Each experience role MUST receive a bullet count proportional to its relevance to the JD:
    * HIGH relevance (role directly matches JD stack/responsibilities): 5-7 bullets - expand with maximum detail, JD-aligned language, and metrics.
    * MEDIUM relevance (partial match - some overlap with JD): 3-4 bullets - focus only on overlapping skills and metrics.
    * LOW relevance (minimal overlap with JD): 2 bullets max - use only the 2 most transferable points.
- NEVER give every role the same number of bullets - this signals un-tailored output and is FORBIDDEN.
- CRITICAL CHRONOLOGICAL ORDERING MANDATE: The candidate's CURRENT / PRESENT employment (where isCurrent == true or endDate contains 'Present' / 'Current') MUST ALWAYS APPEAR FIRST in the experience list. Never place an older past role above current employment.
- All subsequent past employment entries MUST strictly follow reverse-chronological order (most recent past role first, descending by end/start date).
- Directly mirror canonical JD vocabulary, technical terms, and action verbs in bullets (e.g., if JD says ""design implement and support"", use those words in the bullet).
- Every HIGH-relevance bullet MUST contain at least one specific JD keyword from Must-Have Skills or Key Responsibilities.
- If a bullet from the master resume is not relevant to this JD, DROP IT - do not rephrase irrelevant bullets just to keep bullet count.

[SKILLS - CANONICAL MATCHING]:
- Organize skills into clear, relevant categories (e.g. ""Languages & Frameworks"", ""Cloud & DevOps"", ""Databases & Storage"", ""Architecture & Methodologies"").
- Place the categories most relevant to the JD first.
- Within each category, sort skills so JD-matching skills appear first.
- Ensure all skills from the candidate's master resume that match the JD are included using canonical industry naming (e.g. C#, .NET Core, PostgreSQL, Docker, AWS, RESTful APIs).
- REMOVE skills from the list that are completely irrelevant to this JD.
- DO NOT add skills the candidate does not have.

[PROJECTS]:
- Reorder projects so the most JD-relevant projects appear first.
- For each project, rewrite bullets to emphasize aspects matching the JD and retain verified metrics.
- If a project has zero relevance to the JD, reduce it to 1-line description only.

---------------------------------------------------------------------------
OUTPUT FORMAT:
---------------------------------------------------------------------------
Output valid JSON exactly matching this ResumeSchema structure:
{
  ""personalInfo"": { ""fullName"": ""..."", ""email"": ""..."", ""phone"": ""..."", ""location"": ""..."", ""title"": ""TARGET JOB TITLE"", ""linkedInUrl"": ""..."", ""gitHubUrl"": ""..."", ""portfolioUrl"": ""..."" },
  ""summary"": ""[First sentence names the target role. Second sentence highlights 2-3 directly matched skills. Rest is tailored to THIS JD.]"",
  ""experience"": [ { ""id"": ""uuid"", ""company"": ""..."", ""role"": ""..."", ""location"": ""..."", ""startDate"": ""..."", ""endDate"": ""..."", ""isCurrent"": false, ""highlights"": [""bullet 1""] } ],
  ""projects"": [ { ""id"": ""uuid"", ""title"": ""..."", ""description"": ""..."", ""technologies"": ""..."", ""url"": null, ""highlights"": [""bullet 1""] } ],
  ""skills"": [ { ""categoryName"": ""Languages"", ""skills"": [""C#""] } ],
  ""education"": [ { ""id"": ""uuid"", ""institution"": ""..."", ""degree"": ""..."", ""fieldOfStudy"": ""..."", ""graduationYear"": ""2024"", ""gpa"": null, ""honors"": null } ],
  ""certifications"": [ { ""id"": ""uuid"", ""name"": ""..."", ""issuer"": ""..."", ""issueDate"": ""..."", ""expirationDate"": null, ""credentialId"": null, ""url"": null } ],
  ""achievements"": [ { ""id"": ""uuid"", ""title"": ""..."", ""description"": ""..."", ""date"": null } ]
}";

        var userPrompt = $@"
TARGET JOB DESCRIPTION:
Title: {jobSchema.Title}
Company: {jobSchema.Company}
Seniority: {jobSchema.Seniority}
Experience Required: {jobSchema.ExperienceRequired}
Employment Type: {jobSchema.EmploymentType}
Must-Have Skills: {string.Join(", ", jobSchema.MustHaveSkills)}
Nice-To-Have Skills: {string.Join(", ", jobSchema.NiceToHaveSkills)}
Key Responsibilities: {string.Join("; ", jobSchema.Responsibilities)}
Required Frameworks: {string.Join(", ", jobSchema.Frameworks)}
Required Tools: {string.Join(", ", jobSchema.Tools)}
Required Databases: {string.Join(", ", jobSchema.Databases)}
Required Cloud: {string.Join(", ", jobSchema.Cloud)}
Keywords: {string.Join(", ", jobSchema.Keywords)}

MASTER RESUME (JSON):
{JsonSerializer.Serialize(masterSchema, JsonOptions)}

INSTRUCTIONS:
1. Classify each experience role as HIGH, MEDIUM, or LOW relevance against the JD above.
2. Assign bullet counts strictly per the rules: HIGH=5-7, MEDIUM=3-4, LOW=2 max.
3. RETAIN at least 70%-80% of verified quantitative metrics (%, $, scale counts) from the master resume to maximize the ATS Experience Score.
4. The summary MUST begin with the exact job title: ""{jobSchema.Title}"" and highlight 3-5 matching core competencies.
5. In personalInfo, set 'title' to ""{jobSchema.Title}"".
6. The candidate's CURRENT / PRESENT employment (isCurrent == true or endDate is 'Present') MUST be FIRST in the experience array, followed by past roles in reverse-chronological order.
7. Return only the tailored ResumeSchema JSON with no commentary.";

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

        if (tailoringResult.IsFailure)
        {
            return Result<TailoredResumeResultDto>.Failure($"AI resume tailoring failed: {tailoringResult.Error}");
        }

        var tailoredSchema = tailoringResult.Value;

        // Preserve candidate's genuine personal contact info while adopting the tailored target job title
        var targetTitle = !string.IsNullOrWhiteSpace(tailoredSchema.PersonalInfo?.Title)
            ? tailoredSchema.PersonalInfo.Title
            : (!string.IsNullOrWhiteSpace(jobSchema.Title) ? jobSchema.Title : masterSchema.PersonalInfo.Title);

        tailoredSchema.PersonalInfo = new PersonalInfo
        {
            FullName = masterSchema.PersonalInfo.FullName,
            Email = masterSchema.PersonalInfo.Email,
            Phone = masterSchema.PersonalInfo.Phone,
            Location = masterSchema.PersonalInfo.Location,
            Title = targetTitle,
            LinkedInUrl = masterSchema.PersonalInfo.LinkedInUrl,
            GitHubUrl = masterSchema.PersonalInfo.GitHubUrl,
            PortfolioUrl = masterSchema.PersonalInfo.PortfolioUrl
        };

        // Preserve unedited sections if AI omitted them
        if (tailoredSchema.Projects == null || !tailoredSchema.Projects.Any())
            tailoredSchema.Projects = masterSchema.Projects;

        if (tailoredSchema.Education == null || !tailoredSchema.Education.Any())
            tailoredSchema.Education = masterSchema.Education;

        if (tailoredSchema.Certifications == null || !tailoredSchema.Certifications.Any())
            tailoredSchema.Certifications = masterSchema.Certifications;

        if (tailoredSchema.Achievements == null || !tailoredSchema.Achievements.Any())
            tailoredSchema.Achievements = masterSchema.Achievements;

        // 4. Validate Truth Preservation
        var truthCheck = _atsScoringEngine.ValidateTruthPreservation(masterSchema, tailoredSchema);
        if (truthCheck.IsFailure)
        {
            // Revert invalid entities back to master values
            tailoredSchema.Experience = masterSchema.Experience;
            tailoredSchema.Education = masterSchema.Education;
            tailoredSchema.Certifications = masterSchema.Certifications;
            tailoredSchema.Projects = masterSchema.Projects;
        }

        // 4b. Enforce strict chronological ordering (Present / Current employment ALWAYS comes first)
        masterSchema.NormalizeAndSortExperience();
        tailoredSchema.NormalizeAndSortExperience();

        // 5. Calculate ATS Score & Recruiter Feedback
        await _progressNotifier.SendProgressAsync(userId, "ATS Scoring", "Performing keyword density, semantic match, and recruiter scorecard analysis...", 80, cancellationToken);
        var atsScore = _atsScoringEngine.CalculateScore(tailoredSchema, jobSchema);

        // 6. Save Generated Resume & ATS Analysis
        var resolvedRole = !string.IsNullOrWhiteSpace(jobSchema.Title)
            ? jobSchema.Title
            : (!string.IsNullOrWhiteSpace(jobDescription.TargetRole) ? jobDescription.TargetRole : "Target Role");

        var resolvedCompany = !string.IsNullOrWhiteSpace(jobSchema.Company)
            ? jobSchema.Company
            : (!string.IsNullOrWhiteSpace(jobDescription.TargetCompany) ? jobDescription.TargetCompany : "Target Company");

        var generatedResume = new GeneratedResume
        {
            UserId = userId,
            MasterResumeId = masterResume.Id,
            JobDescriptionId = jobDescription.Id,
            TargetRole = resolvedRole,
            TargetCompany = resolvedCompany,
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
            .FirstOrDefaultAsync(a => a.UserId == userId && a.CompanyName == resolvedCompany && a.JobTitle == resolvedRole, cancellationToken);

        if (existingApp == null)
        {
            _context.Applications.Add(new ApplicationRecord
            {
                UserId = userId,
                GeneratedResumeId = generatedResume.Id,
                CompanyName = resolvedCompany,
                JobTitle = resolvedRole,
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
        masterSchema.NormalizeAndSortExperience();
        tailoredSchema.NormalizeAndSortExperience();
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

    public async Task<Result<TailoredResumeResultDto>> Handle(UpdateTailoredResumeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var generatedResume = await _context.GeneratedResumes
            .Include(g => g.MasterResume)
            .Include(g => g.JobDescription)
            .Include(g => g.AtsAnalysis)
            .FirstOrDefaultAsync(g => g.Id == request.Id && g.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(GeneratedResume), request.Id);

        var masterSchema = JsonSerializer.Deserialize<ResumeSchema>(generatedResume.MasterResume?.StructuredJson ?? "{}", JsonOptions) ?? new ResumeSchema();
        masterSchema.NormalizeAndSortExperience();
        request.UpdatedSchema.NormalizeAndSortExperience();

        // Validate truth preservation
        var truthResult = _atsScoringEngine.ValidateTruthPreservation(masterSchema, request.UpdatedSchema);
        if (truthResult.IsFailure)
        {
            return Result<TailoredResumeResultDto>.Failure($"Truth preservation check failed: {truthResult.Error}");
        }

        // Recalculate ATS score
        var jdSchema = JsonSerializer.Deserialize<JobDescriptionSchema>(generatedResume.JobDescription?.ExtractedSchemaJson ?? "{}", JsonOptions) ?? new JobDescriptionSchema();
        var atsBreakdown = _atsScoringEngine.CalculateScore(request.UpdatedSchema, jdSchema);

        generatedResume.TailoredStructuredJson = JsonSerializer.Serialize(request.UpdatedSchema, JsonOptions);
        if (request.SelectedTemplate.HasValue)
        {
            generatedResume.SelectedTemplate = request.SelectedTemplate.Value;
        }

        if (generatedResume.AtsAnalysis != null)
        {
            generatedResume.AtsAnalysis.MatchScore = atsBreakdown.OverallScore;
            generatedResume.AtsAnalysis.MatchingKeywordsCount = atsBreakdown.MatchingKeywords.Count;
            generatedResume.AtsAnalysis.MissingKeywordsCount = atsBreakdown.MissingKeywords.Count;
            generatedResume.AtsAnalysis.RecruiterFeedbackSummary = atsBreakdown.RecruiterFeedback;
            generatedResume.AtsAnalysis.AnalysisDataJson = JsonSerializer.Serialize(atsBreakdown, JsonOptions);
        }
        else
        {
            generatedResume.AtsAnalysis = new AtsAnalysis
            {
                GeneratedResumeId = generatedResume.Id,
                MatchScore = atsBreakdown.OverallScore,
                AnalysisDataJson = JsonSerializer.Serialize(atsBreakdown, JsonOptions),
                RecruiterFeedbackSummary = atsBreakdown.RecruiterFeedback,
                MatchingKeywordsCount = atsBreakdown.MatchingKeywords.Count,
                MissingKeywordsCount = atsBreakdown.MissingKeywords.Count
            };
            _context.AtsAnalyses.Add(generatedResume.AtsAnalysis);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return Result<TailoredResumeResultDto>.Success(new TailoredResumeResultDto(
            generatedResume.Id,
            generatedResume.MasterResumeId,
            generatedResume.JobDescriptionId,
            generatedResume.TargetRole,
            generatedResume.TargetCompany,
            generatedResume.SelectedTemplate,
            masterSchema,
            request.UpdatedSchema,
            atsBreakdown,
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

            case ResumeFormat.Json:
                var jsonBytes = System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(schema, JsonOptions));
                return Result<ExportFileDto>.Success(new ExportFileDto(jsonBytes, "application/json", $"{sanitizedName}_Resume.json"));

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
        var systemPrompt = @"You are an expert Job Description Analyzer. Parse the raw job posting text and extract a structured JSON representation matching this exact schema:
{
  ""title"": ""Exact Job Title"",
  ""company"": ""Company Name"",
  ""location"": ""Location"",
  ""seniority"": ""Junior, Mid, Senior, Lead, Principal, etc."",
  ""experienceRequired"": ""e.g. 4-6 years"",
  ""salary"": ""Compensation if mentioned, else null"",
  ""mustHaveSkills"": [""Required core technical skills, programming languages, and critical competencies""],
  ""niceToHaveSkills"": [""Preferred skills, pluses, secondary competencies""],
  ""tools"": [""Developer tools, IDEs, version control, ticketing, e.g. Git, Postman, Docker""],
  ""frameworks"": [""Frameworks and libraries, e.g. .NET Core, ASP.NET Web API, React, Angular, Spring Boot""],
  ""databases"": [""Databases, e.g. SQL Server, PostgreSQL, MongoDB, Redis""],
  ""cloud"": [""Cloud platforms, e.g. AWS, Azure, GCP""],
  ""certifications"": [""Certifications if required""],
  ""softSkills"": [""Soft skills, e.g. Agile, Code Reviews, Communication, Problem Solving""],
  ""keywords"": [""Comprehensive list of technical keywords, role keywords, and domain search terms""],
  ""responsibilities"": [""Core duties and responsibilities""]
}
CRITICAL REQUIREMENT: You MUST extract all technical skills, programming languages, and competencies into mustHaveSkills, frameworks, tools, databases, and keywords. DO NOT leave mustHaveSkills or keywords empty if any technical requirements exist in the posting.";

        var userPrompt = $"Analyze job description and output full JSON matching JobDescriptionSchema:\n\n{rawText}";
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

        JobDescriptionSchema schema;
        if (result.IsSuccess)
        {
            schema = result.Value;
        }
        else
        {
            var lines = rawText.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var inferredTitle = lines.FirstOrDefault(l => l.Length > 3 && l.Length < 60 && !l.StartsWith("http", StringComparison.OrdinalIgnoreCase)) ?? "Target Role";
            var inferredCompany = lines.Skip(1).FirstOrDefault(l => l.Length > 2 && l.Length < 50 && !l.StartsWith("http", StringComparison.OrdinalIgnoreCase)) ?? "Target Company";

            schema = new JobDescriptionSchema
            {
                Title = inferredTitle,
                Company = inferredCompany,
                Responsibilities = lines.Take(5).ToList()
            };
        }

        schema.EnsureKeywordsPopulated(rawText);

        // Dedicated AI fallback extraction strictly when none are coming
        if (schema.Keywords.Count == 0 && schema.MustHaveSkills.Count == 0 && !string.IsNullOrWhiteSpace(rawText))
        {
            await ExtractKeywordsFallbackWithAiAsync(aiProvider, user, schema, rawText, cancellationToken);
            schema.EnsureKeywordsPopulated(rawText);
        }

        return schema;
    }

    private static async Task ExtractKeywordsFallbackWithAiAsync(
        IAiProvider aiProvider,
        User user,
        JobDescriptionSchema schema,
        string rawText,
        CancellationToken cancellationToken)
    {
        var fallbackSystemPrompt = @"You are a Principal Technical Recruiter and ATS Keyword Extraction Engine.
Your SOLE TASK is to analyze the provided job description text and extract a comprehensive, granular list of technical skills, programming languages, libraries, frameworks, cloud services, databases, DevOps tools, architectural concepts, and engineering keywords.
Return valid JSON matching this exact structure:
{
  ""mustHaveSkills"": [""Mandatory technical skills and languages""],
  ""niceToHaveSkills"": [""Secondary or preferred skills""],
  ""tools"": [""Tools and platforms""],
  ""frameworks"": [""Frameworks and SDKs""],
  ""databases"": [""Databases and storage engines""],
  ""cloud"": [""Cloud and infrastructure services""],
  ""keywords"": [""Every distinct technical and role keyword found in the posting""]
}
CRITICAL REQUIREMENT: Extract at least 15-30 granular technical keywords. Do NOT return empty arrays.";

        var fallbackUserPrompt = $"Extract all technical skills and keywords from this job posting:\n\n{rawText}";
        var apiKey = user.PreferredAiProvider switch
        {
            AiProviderType.OpenAi => user.CustomOpenAiKey,
            AiProviderType.Claude => user.CustomClaudeKey,
            AiProviderType.Gemini => user.CustomGeminiKey,
            _ => null
        };

        var fallbackResult = await aiProvider.GenerateStructuredJsonAsync<JobDescriptionSchema>(
            fallbackSystemPrompt,
            fallbackUserPrompt,
            apiKey,
            user.PreferredModel,
            cancellationToken
        );

        if (fallbackResult.IsSuccess && fallbackResult.Value != null)
        {
            var fb = fallbackResult.Value;
            if (fb.MustHaveSkills != null && fb.MustHaveSkills.Any())
            {
                foreach (var s in fb.MustHaveSkills)
                {
                    if (!schema.MustHaveSkills.Contains(s, StringComparer.OrdinalIgnoreCase))
                        schema.MustHaveSkills.Add(s);
                }
            }
            if (fb.Keywords != null && fb.Keywords.Any())
            {
                var set = new HashSet<string>(schema.Keywords, StringComparer.OrdinalIgnoreCase);
                foreach (var k in fb.Keywords) set.Add(k);
                schema.Keywords = set.ToList();
            }
            if (fb.Tools != null && fb.Tools.Any() && !schema.Tools.Any())
                schema.Tools = fb.Tools;
            if (fb.Frameworks != null && fb.Frameworks.Any() && !schema.Frameworks.Any())
                schema.Frameworks = fb.Frameworks;
            if (fb.Databases != null && fb.Databases.Any() && !schema.Databases.Any())
                schema.Databases = fb.Databases;
            if (fb.Cloud != null && fb.Cloud.Any() && !schema.Cloud.Any())
                schema.Cloud = fb.Cloud;
        }
    }
}

