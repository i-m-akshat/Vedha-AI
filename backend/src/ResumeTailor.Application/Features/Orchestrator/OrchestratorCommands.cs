using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Application.Features.Orchestrator;

public class ScreeningQuestionAnswerDto
{
    public string QuestionText { get; set; } = string.Empty;
    public string AnswerText { get; set; } = string.Empty;
    public string FieldType { get; set; } = "text"; // text, textarea, radio, select, number, boolean
    public double ConfidenceScore { get; set; } = 1.0;
    public string EvidenceSnippet { get; set; } = string.Empty;
    public string Source { get; set; } = "AI Grounding"; // Memory, CandidateProfile, AI Grounding
}

public class ApplicationQueueItemDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string JobUrl { get; set; } = string.Empty;
    public string ResolvedDestinationUrl { get; set; } = string.Empty;
    public string TargetCompany { get; set; } = string.Empty;
    public string TargetRole { get; set; } = string.Empty;
    public JobSource DetectedSource { get; set; }
    public Guid? GeneratedResumeId { get; set; }
    public string CoverLetterText { get; set; } = string.Empty;
    public List<ScreeningQuestionAnswerDto> PrefilledAnswers { get; set; } = new();
    public PipelineExecutionStatus Status { get; set; }
    public bool RequiresManualReview { get; set; }
    public List<string> ExecutionLogs { get; set; } = new();
    public string? ErrorMessage { get; set; }
    public DateTime? AppliedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class DetectedJobSourceDto
{
    public string OriginalUrl { get; set; } = string.Empty;
    public string ResolvedUrl { get; set; } = string.Empty;
    public JobSource DetectedSource { get; set; }
    public string Company { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string CleanedText { get; set; } = string.Empty;
}

public record DetectJobSourceQuery(string Url) : IRequest<Result<DetectedJobSourceDto>>;

public record GenerateScreeningAnswersCommand(
    Guid UserId,
    string Company,
    List<string> Questions,
    Guid? MasterResumeId
) : IRequest<Result<List<ScreeningQuestionAnswerDto>>>;

public record PrepareApplicationPackageCommand(
    Guid UserId,
    Guid MasterResumeId,
    string JobUrl,
    string? DirectJobDescriptionText,
    TemplateStyle TemplateStyle = TemplateStyle.ClassicAts,
    List<string>? CustomQuestions = null
) : IRequest<Result<ApplicationQueueItemDto>>;

public record GetApplicationQueueQuery(Guid UserId, PipelineExecutionStatus? Status = null) : IRequest<Result<List<ApplicationQueueItemDto>>>;

public record GetApplicationQueueItemByIdQuery(Guid UserId, Guid QueueItemId) : IRequest<Result<ApplicationQueueItemDto>>;

public record UpdateApplicationQueueStatusCommand(
    Guid UserId,
    Guid QueueItemId,
    PipelineExecutionStatus Status,
    string? ErrorMessage = null
) : IRequest<Result<bool>>;

public record ExecuteApplicationQueueItemCommand(
    Guid UserId,
    Guid QueueItemId,
    bool Headed = false,
    bool CopilotMode = true
) : IRequest<Result<ApplicationAutomationResult>>;

public class OrchestratorHandlers :
    IRequestHandler<DetectJobSourceQuery, Result<DetectedJobSourceDto>>,
    IRequestHandler<GenerateScreeningAnswersCommand, Result<List<ScreeningQuestionAnswerDto>>>,
    IRequestHandler<PrepareApplicationPackageCommand, Result<ApplicationQueueItemDto>>,
    IRequestHandler<GetApplicationQueueQuery, Result<List<ApplicationQueueItemDto>>>,
    IRequestHandler<GetApplicationQueueItemByIdQuery, Result<ApplicationQueueItemDto>>,
    IRequestHandler<UpdateApplicationQueueStatusCommand, Result<bool>>,
    IRequestHandler<ExecuteApplicationQueueItemCommand, Result<ApplicationAutomationResult>>
{
    private readonly IApplicationDbContext _context;
    private readonly IJobScraperService _scraperService;
    private readonly IAiServiceFactory _aiFactory;
    private readonly IAtsScoringEngine _atsEngine;
    private readonly IJobApplicationOrchestrator _orchestrator;
    private readonly ITailoringProgressNotifier _progressNotifier;

    public OrchestratorHandlers(
        IApplicationDbContext context,
        IJobScraperService scraperService,
        IAiServiceFactory aiFactory,
        IAtsScoringEngine atsEngine,
        IJobApplicationOrchestrator orchestrator,
        ITailoringProgressNotifier progressNotifier)
    {
        _context = context;
        _scraperService = scraperService;
        _aiFactory = aiFactory;
        _atsEngine = atsEngine;
        _orchestrator = orchestrator;
        _progressNotifier = progressNotifier;
    }

    public async Task<Result<DetectedJobSourceDto>> Handle(DetectJobSourceQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Url))
            return Result<DetectedJobSourceDto>.Failure("Job URL cannot be empty.");

        var scrapeResult = await _scraperService.ScrapeAsync(request.Url, cancellationToken);
        if (!scrapeResult.IsSuccess)
        {
            return Result<DetectedJobSourceDto>.Failure(scrapeResult.Error ?? "Failed to scrape job URL.");
        }

        var (cleanedText, company, title, source) = scrapeResult.Value!;

        return Result<DetectedJobSourceDto>.Success(new DetectedJobSourceDto
        {
            OriginalUrl = request.Url,
            ResolvedUrl = request.Url,
            DetectedSource = source,
            Company = company ?? string.Empty,
            Title = title ?? string.Empty,
            CleanedText = cleanedText
        });
    }

    public async Task<Result<List<ScreeningQuestionAnswerDto>>> Handle(GenerateScreeningAnswersCommand request, CancellationToken cancellationToken)
    {
        var answers = new List<ScreeningQuestionAnswerDto>();
        if (request.Questions == null || !request.Questions.Any())
            return Result<List<ScreeningQuestionAnswerDto>>.Success(answers);

        // 1. Load Candidate Profile
        var profile = await _context.CandidateProfiles
            .FirstOrDefaultAsync(p => p.UserId == request.UserId, cancellationToken);

        // 2. Load Master Resume
        MasterResume? masterResume = null;
        if (request.MasterResumeId.HasValue)
        {
            masterResume = await _context.MasterResumes
                .FirstOrDefaultAsync(r => r.Id == request.MasterResumeId.Value && r.UserId == request.UserId, cancellationToken);
        }
        else
        {
            masterResume = await _context.MasterResumes
                .Where(r => r.UserId == request.UserId && r.IsActive)
                .OrderByDescending(r => r.UpdatedAtUtc ?? r.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var resumeJson = masterResume?.StructuredJson ?? "{}";
        var company = request.Company?.Trim() ?? string.Empty;

        // 3. Check Browser Agent Memory for existing answers
        var memoryQuery = _context.ScreeningQuestionMemories
            .Where(m => m.UserId == request.UserId);

        if (!string.IsNullOrWhiteSpace(company))
        {
            memoryQuery = memoryQuery.Where(m => m.Company.ToLower() == company.ToLower());
        }

        var existingMemories = await memoryQuery.ToListAsync(cancellationToken);

        var unansweredQuestions = new List<string>();

        foreach (var q in request.Questions)
        {
            var trimmedQ = q.Trim();
            var hash = ComputeHash(trimmedQ.ToLowerInvariant());

            var memMatch = existingMemories.FirstOrDefault(m => m.QuestionHash == hash);
            if (memMatch != null)
            {
                answers.Add(new ScreeningQuestionAnswerDto
                {
                    QuestionText = trimmedQ,
                    AnswerText = memMatch.AnswerText,
                    FieldType = memMatch.FieldType,
                    ConfidenceScore = 1.0,
                    EvidenceSnippet = $"Retrieved from past application memory for {memMatch.Company}",
                    Source = "Memory"
                });
            }
            else
            {
                // Try rule-based candidate profile matching first
                var directMatch = MatchCandidateProfileDirectly(trimmedQ, profile);
                if (directMatch != null)
                {
                    answers.Add(directMatch);
                }
                else
                {
                    unansweredQuestions.Add(trimmedQ);
                }
            }
        }

        // 4. For remaining questions, invoke Gemini 2.0 Flash for grounded answers
        if (unansweredQuestions.Any())
        {
            var aiService = _aiFactory.GetProvider(AiProviderType.Gemini);
            var systemPrompt = @"You are an expert executive job application assistant.
Your task is to generate precise, 100% truth-grounded answers to job application screening questions using the candidate's Master Resume, verified Profile, and Evidence Base.

CRITICAL RULES:
1. NEVER hallucinate skills, certifications, or metrics not in the resume or candidate profile.
2. For numeric years of experience questions, compute actual elapsed years from the work experience dates.
3. For Work Authorization, Notice Period, and CTC questions, use the candidate profile values.
4. For behavioral or open-ended questions, draft concise STAR-format responses (1-3 paragraphs maximum).
5. Output valid JSON in the exact schema requested.";

            var userPrompt = $@"CANDIDATE PROFILE:
- Phone: {profile?.PhoneNumber}
- Location: {profile?.CurrentCity}, {profile?.CurrentCountry}
- Work Auth: {profile?.WorkAuthorizationStatus}
- Needs Visa Sponsorship: {(profile?.RequiresVisaSponsorship == true ? "Yes" : "No")}
- Notice Period: {profile?.NoticePeriodDays} days
- Current Salary: {profile?.CurrentSalary}
- Expected Salary: {profile?.ExpectedSalary}
- Willing to Relocate: {(profile?.WillingToRelocate == true ? "Yes" : "No")}
- Remote Preference: {profile?.RemotePreference}
- LinkedIn: {profile?.LinkedInUrl}
- GitHub: {profile?.GithubUrl}
- Portfolio: {profile?.PortfolioUrl}
- Evidence Base: {profile?.EvidenceKnowledgeBaseJson}

MASTER RESUME JSON:
{resumeJson}

SCREENING QUESTIONS TO ANSWER:
{JsonSerializer.Serialize(unansweredQuestions)}

Respond with JSON array of objects:
[
  {{
    ""QuestionText"": ""exact question text"",
    ""AnswerText"": ""grounded answer"",
    ""FieldType"": ""text|textarea|radio|select|number|boolean"",
    ""ConfidenceScore"": 0.95,
    ""EvidenceSnippet"": ""direct fact from resume/profile used""
  }}
]";

            var aiResult = await aiService.GenerateStructuredJsonAsync<List<ScreeningQuestionAnswerDto>>(
                systemPrompt, userPrompt, cancellationToken: cancellationToken);

            if (aiResult.IsSuccess && aiResult.Value != null)
            {
                foreach (var aiAns in aiResult.Value)
                {
                    aiAns.Source = "AI Grounding";
                    answers.Add(aiAns);

                    // Save to ScreeningQuestionMemory for instant future recall
                    if (!string.IsNullOrWhiteSpace(company))
                    {
                        var normQ = aiAns.QuestionText.Trim().ToLowerInvariant();
                        var hash = ComputeHash(normQ);

                        var newMem = new ScreeningQuestionMemory
                        {
                            UserId = request.UserId,
                            Company = company,
                            QuestionHash = hash,
                            QuestionText = aiAns.QuestionText.Trim(),
                            AnswerText = aiAns.AnswerText.Trim(),
                            FieldType = aiAns.FieldType ?? "text",
                            SuccessCount = 1,
                            LastUsedAtUtc = DateTime.UtcNow
                        };
                        _context.ScreeningQuestionMemories.Add(newMem);
                    }
                }

                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        return Result<List<ScreeningQuestionAnswerDto>>.Success(answers);
    }

    public async Task<Result<ApplicationQueueItemDto>> Handle(PrepareApplicationPackageCommand request, CancellationToken cancellationToken)
    {
        await _progressNotifier.SendProgressAsync(request.UserId, "Initiating", "Starting multi-pipeline application preparation...", 10, cancellationToken);

        // 1. Load Master Resume
        var masterResume = await _context.MasterResumes
            .FirstOrDefaultAsync(r => r.Id == request.MasterResumeId && r.UserId == request.UserId, cancellationToken);

        if (masterResume == null)
            return Result<ApplicationQueueItemDto>.Failure("Master resume not found.");

        ResumeSchema masterSchema;
        try
        {
            masterSchema = JsonSerializer.Deserialize<ResumeSchema>(masterResume.StructuredJson) ?? new ResumeSchema();
        }
        catch
        {
            return Result<ApplicationQueueItemDto>.Failure("Invalid master resume structure.");
        }

        // 2. Fetch / Scrape Job Description
        string rawJobText = request.DirectJobDescriptionText ?? string.Empty;
        string company = "Target Company";
        string role = "Target Role";
        JobSource source = JobSource.DirectText;
        string resolvedUrl = request.JobUrl;

        if (!string.IsNullOrWhiteSpace(request.JobUrl))
        {
            await _progressNotifier.SendProgressAsync(request.UserId, "Resolving URL", $"Unwinding destination career portal for {request.JobUrl}...", 25, cancellationToken);
            var scrapeResult = await _scraperService.ScrapeAsync(request.JobUrl, cancellationToken);
            if (scrapeResult.IsSuccess)
            {
                var (cleanedText, scrapedCompany, scrapedTitle, detectedSource) = scrapeResult.Value!;
                rawJobText = !string.IsNullOrWhiteSpace(cleanedText) ? cleanedText : rawJobText;
                company = scrapedCompany ?? company;
                role = scrapedTitle ?? role;
                source = detectedSource;
            }
        }

        if (string.IsNullOrWhiteSpace(rawJobText))
            return Result<ApplicationQueueItemDto>.Failure("Job description content could not be found or extracted.");

        // 3. Extract Structured Job Description Schema via Gemini
        await _progressNotifier.SendProgressAsync(request.UserId, "Analyzing Role", $"Extracting technical requirements for {role} at {company}...", 40, cancellationToken);
        var aiService = _aiFactory.GetProvider(AiProviderType.Gemini);

        var jobSchemaPrompt = "Extract key skills, responsibilities, and qualifications from this job description into structured JSON schema.";
        var jobSchemaResult = await aiService.GenerateStructuredJsonAsync<JobDescriptionSchema>(
            "You are a job requirement parser. Extract structured JobDescriptionSchema.",
            $"{jobSchemaPrompt}\n\nJob Description:\n{rawJobText}",
            cancellationToken: cancellationToken);

        var jobSchema = jobSchemaResult.IsSuccess && jobSchemaResult.Value != null ? jobSchemaResult.Value : new JobDescriptionSchema { Company = company, Title = role };

        // Save Job Description Entity
        var jobDescEntity = new JobDescription
        {
            UserId = request.UserId,
            Source = source,
            SourceUrl = request.JobUrl,
            TargetCompany = company,
            TargetRole = role,
            RawText = rawJobText,
            CleanedText = rawJobText,
            ExtractedSchemaJson = JsonSerializer.Serialize(jobSchema)
        };
        _context.JobDescriptions.Add(jobDescEntity);
        await _context.SaveChangesAsync(cancellationToken);

        // 4. Tailor Resume (Truth-Preserving STAR method)
        await _progressNotifier.SendProgressAsync(request.UserId, "Tailoring Resume", "Optimizing resume bullets and ATS keywords without hallucination...", 60, cancellationToken);

        var tailorSystemPrompt = @"You are a Principal Resume Strategist and ATS Specialist.
Tailor the master resume strictly for the target job description.
RULES:
1. Preserve 100% truth. DO NOT invent employers, job titles, degrees, or certifications.
2. Align bullet points to highlight matching experience using the STAR method (Situation, Task, Action, Result) with quantified metrics.
3. Elevate matching technical skills to the top of skill lists.
4. Output valid JSON matching ResumeSchema.";

        var tailorUserPrompt = $@"MASTER RESUME:
{masterResume.StructuredJson}

TARGET JOB DESCRIPTION:
{jobDescEntity.ExtractedSchemaJson}

Generate tailored ResumeSchema in JSON.";

        var tailorResult = await aiService.GenerateStructuredJsonAsync<ResumeSchema>(
            tailorSystemPrompt, tailorUserPrompt, cancellationToken: cancellationToken);

        var tailoredSchema = tailorResult.IsSuccess && tailorResult.Value != null ? tailorResult.Value : masterSchema;

        // Truth validation
        var truthValidation = _atsEngine.ValidateTruthPreservation(masterSchema, tailoredSchema);
        var atsScore = _atsEngine.CalculateScore(tailoredSchema, jobSchema);

        var generatedResume = new GeneratedResume
        {
            UserId = request.UserId,
            MasterResumeId = masterResume.Id,
            JobDescriptionId = jobDescEntity.Id,
            TargetCompany = company,
            TargetRole = role,
            TailoredStructuredJson = JsonSerializer.Serialize(tailoredSchema),
            DiffSummaryJson = "[]",
            SelectedTemplate = request.TemplateStyle,
            GeneratedWithProvider = AiProviderType.Gemini,
            ModelName = "gemini-2.0-flash"
        };
        _context.GeneratedResumes.Add(generatedResume);
        await _context.SaveChangesAsync(cancellationToken);

        var atsAnalysis = new AtsAnalysis
        {
            GeneratedResumeId = generatedResume.Id,
            MatchScore = atsScore.OverallScore,
            AnalysisDataJson = JsonSerializer.Serialize(atsScore),
            RecruiterFeedbackSummary = atsScore.RecruiterFeedback,
            MatchingKeywordsCount = atsScore.MatchingKeywords.Count + atsScore.MatchingSkills.Count,
            MissingKeywordsCount = atsScore.MissingKeywords.Count + atsScore.MissingSkills.Count
        };
        _context.AtsAnalyses.Add(atsAnalysis);

        // 5. Generate Tailored Cover Letter
        await _progressNotifier.SendProgressAsync(request.UserId, "Generating Cover Letter", $"Crafting personalized executive cover letter for {company}...", 80, cancellationToken);
        var coverLetterResult = await aiService.GenerateTextAsync(
            "You are an executive career advisor. Write a compelling, tailored 3-paragraph cover letter based on the candidate's achievements and target company.",
            $"Candidate Resume:\n{masterResume.StructuredJson}\n\nTarget Job:\nRole: {role}\nCompany: {company}\nDescription:\n{rawJobText}",
            cancellationToken: cancellationToken);

        var coverLetterText = coverLetterResult.IsSuccess ? coverLetterResult.Value! : string.Empty;

        // 6. Generate Screening Answers for known or custom questions
        await _progressNotifier.SendProgressAsync(request.UserId, "Answering Questions", "Mapping screening questions with Candidate Profile & Memory...", 90, cancellationToken);
        var questionsToAnswer = request.CustomQuestions ?? new List<string>
        {
            "What is your work authorization status?",
            "Will you now or in the future require visa sponsorship?",
            "What is your expected annual compensation / CTC?",
            "What is your notice period or earliest start date?",
            "Are you comfortable working in the specified location / remote model?",
            $"Why are you interested in joining {company} as a {role}?"
        };

        var qnaResult = await Handle(new GenerateScreeningAnswersCommand(request.UserId, company, questionsToAnswer, masterResume.Id), cancellationToken);
        var prefilledAnswers = qnaResult.IsSuccess ? qnaResult.Value! : new List<ScreeningQuestionAnswerDto>();

        // 7. Enqueue Application Queue Item
        var queueItem = new ApplicationQueueItem
        {
            UserId = request.UserId,
            JobUrl = request.JobUrl ?? string.Empty,
            ResolvedDestinationUrl = resolvedUrl ?? string.Empty,
            TargetCompany = company,
            TargetRole = role,
            DetectedSource = source,
            GeneratedResumeId = generatedResume.Id,
            CoverLetterText = coverLetterText,
            PrefilledAnswersJson = JsonSerializer.Serialize(prefilledAnswers),
            Status = PipelineExecutionStatus.Prepared,
            RequiresManualReview = true, // Review Gateway
            ExecutionLogsJson = JsonSerializer.Serialize(new List<string>
            {
                $"[System] Application package prepared on {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC",
                $"[ATS Engine] Tailored resume generated with ATS score {atsScore.OverallScore}%",
                $"[Memory Engine] {prefilledAnswers.Count(a => a.Source == "Memory")} questions answered from memory, {prefilledAnswers.Count(a => a.Source != "Memory")} grounded via Gemini AI."
            })
        };
        _context.ApplicationQueueItems.Add(queueItem);
        await _context.SaveChangesAsync(cancellationToken);

        await _progressNotifier.SendProgressAsync(request.UserId, "Completed", "Application package ready for review!", 100, cancellationToken);

        return Result<ApplicationQueueItemDto>.Success(MapQueueItemToDto(queueItem, prefilledAnswers));
    }

    public async Task<Result<List<ApplicationQueueItemDto>>> Handle(GetApplicationQueueQuery request, CancellationToken cancellationToken)
    {
        var query = _context.ApplicationQueueItems
            .Where(q => q.UserId == request.UserId);

        if (request.Status.HasValue)
        {
            query = query.Where(q => q.Status == request.Status.Value);
        }

        var items = await query
            .OrderByDescending(q => q.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var dtoList = items.Select(item =>
        {
            List<ScreeningQuestionAnswerDto> answers = new();
            try { answers = JsonSerializer.Deserialize<List<ScreeningQuestionAnswerDto>>(item.PrefilledAnswersJson) ?? new(); } catch { }
            return MapQueueItemToDto(item, answers);
        }).ToList();

        return Result<List<ApplicationQueueItemDto>>.Success(dtoList);
    }

    public async Task<Result<ApplicationQueueItemDto>> Handle(GetApplicationQueueItemByIdQuery request, CancellationToken cancellationToken)
    {
        var item = await _context.ApplicationQueueItems
            .FirstOrDefaultAsync(q => q.Id == request.QueueItemId && q.UserId == request.UserId, cancellationToken);

        if (item == null)
            return Result<ApplicationQueueItemDto>.Failure("Queue item not found.");

        List<ScreeningQuestionAnswerDto> answers = new();
        try { answers = JsonSerializer.Deserialize<List<ScreeningQuestionAnswerDto>>(item.PrefilledAnswersJson) ?? new(); } catch { }

        return Result<ApplicationQueueItemDto>.Success(MapQueueItemToDto(item, answers));
    }

    public async Task<Result<bool>> Handle(UpdateApplicationQueueStatusCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.ApplicationQueueItems
            .FirstOrDefaultAsync(q => q.Id == request.QueueItemId && q.UserId == request.UserId, cancellationToken);

        if (item == null)
            return Result<bool>.Failure("Queue item not found.");

        item.Status = request.Status;
        if (!string.IsNullOrWhiteSpace(request.ErrorMessage))
            item.ErrorMessage = request.ErrorMessage;

        if (request.Status == PipelineExecutionStatus.Submitted)
            item.AppliedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true);
    }

    public async Task<Result<ApplicationAutomationResult>> Handle(ExecuteApplicationQueueItemCommand request, CancellationToken cancellationToken)
    {
        return await _orchestrator.RunPipelineAsync(request.QueueItemId, request.Headed, request.CopilotMode, cancellationToken);
    }

    private static ApplicationQueueItemDto MapQueueItemToDto(ApplicationQueueItem item, List<ScreeningQuestionAnswerDto> answers)
    {
        List<string> logs = new();
        try { logs = JsonSerializer.Deserialize<List<string>>(item.ExecutionLogsJson) ?? new(); } catch { }

        return new ApplicationQueueItemDto
        {
            Id = item.Id,
            UserId = item.UserId,
            JobUrl = item.JobUrl,
            ResolvedDestinationUrl = item.ResolvedDestinationUrl,
            TargetCompany = item.TargetCompany,
            TargetRole = item.TargetRole,
            DetectedSource = item.DetectedSource,
            GeneratedResumeId = item.GeneratedResumeId,
            CoverLetterText = item.CoverLetterText,
            PrefilledAnswers = answers,
            Status = item.Status,
            RequiresManualReview = item.RequiresManualReview,
            ExecutionLogs = logs,
            ErrorMessage = item.ErrorMessage,
            AppliedAtUtc = item.AppliedAtUtc,
            CreatedAtUtc = item.CreatedAtUtc
        };
    }

    private static ScreeningQuestionAnswerDto? MatchCandidateProfileDirectly(string question, Domain.Entities.CandidateProfile? profile)
    {
        if (profile == null) return null;
        var q = question.ToLowerInvariant();

        if (q.Contains("sponsorship") || q.Contains("require visa") || q.Contains("visa sponsorship"))
        {
            return new ScreeningQuestionAnswerDto
            {
                QuestionText = question,
                AnswerText = profile.RequiresVisaSponsorship ? "Yes" : "No",
                FieldType = "radio",
                ConfidenceScore = 1.0,
                EvidenceSnippet = "Grounded in Candidate Profile Visa Sponsorship status",
                Source = "CandidateProfile"
            };
        }

        if (q.Contains("work authorization") || q.Contains("authorized to work") || q.Contains("legally authorized"))
        {
            return new ScreeningQuestionAnswerDto
            {
                QuestionText = question,
                AnswerText = profile.WorkAuthorizationStatus,
                FieldType = "text",
                ConfidenceScore = 1.0,
                EvidenceSnippet = "Grounded in Candidate Profile Work Authorization",
                Source = "CandidateProfile"
            };
        }

        if (q.Contains("notice period") || q.Contains("how soon can you start") || q.Contains("start date"))
        {
            var answer = profile.NoticePeriodDays == 0 ? "Immediately available" : $"{profile.NoticePeriodDays} days";
            return new ScreeningQuestionAnswerDto
            {
                QuestionText = question,
                AnswerText = answer,
                FieldType = "text",
                ConfidenceScore = 1.0,
                EvidenceSnippet = $"Grounded in Candidate Profile ({profile.NoticePeriodDays} days notice)",
                Source = "CandidateProfile"
            };
        }

        if (q.Contains("salary") || q.Contains("compensation") || q.Contains("ctc") || q.Contains("pay expectation"))
        {
            return new ScreeningQuestionAnswerDto
            {
                QuestionText = question,
                AnswerText = !string.IsNullOrWhiteSpace(profile.ExpectedSalary) ? profile.ExpectedSalary : "Negotiable based on total compensation and role scope",
                FieldType = "text",
                ConfidenceScore = 1.0,
                EvidenceSnippet = "Grounded in Candidate Profile Expected Salary",
                Source = "CandidateProfile"
            };
        }

        if (q.Contains("relocate") || q.Contains("willing to relocate"))
        {
            return new ScreeningQuestionAnswerDto
            {
                QuestionText = question,
                AnswerText = profile.WillingToRelocate ? "Yes" : "No",
                FieldType = "radio",
                ConfidenceScore = 1.0,
                EvidenceSnippet = "Grounded in Candidate Profile Relocation Preference",
                Source = "CandidateProfile"
            };
        }

        if (q.Contains("linkedin") && !string.IsNullOrWhiteSpace(profile.LinkedInUrl))
        {
            return new ScreeningQuestionAnswerDto
            {
                QuestionText = question,
                AnswerText = profile.LinkedInUrl,
                FieldType = "text",
                ConfidenceScore = 1.0,
                EvidenceSnippet = "Candidate Profile LinkedIn URL",
                Source = "CandidateProfile"
            };
        }

        if (q.Contains("github") && !string.IsNullOrWhiteSpace(profile.GithubUrl))
        {
            return new ScreeningQuestionAnswerDto
            {
                QuestionText = question,
                AnswerText = profile.GithubUrl,
                FieldType = "text",
                ConfidenceScore = 1.0,
                EvidenceSnippet = "Candidate Profile GitHub URL",
                Source = "CandidateProfile"
            };
        }

        return null;
    }

    private static string ComputeHash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
