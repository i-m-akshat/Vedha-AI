using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.CandidateProfile;
using ResumeTailor.Application.Features.Orchestrator;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;
using ResumeTailor.Infrastructure.Persistence;

namespace ResumeTailor.WebApi.Controllers;

[Authorize]
public class CandidateProfileController : BaseApiController
{
    private readonly ICurrentUserService _currentUserService;

    public CandidateProfileController(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new GetCandidateProfileQuery(userId.Value));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateCandidateProfileRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var command = new UpdateCandidateProfileCommand(
            userId.Value,
            req.PhoneNumber,
            req.CurrentCity,
            req.CurrentCountry,
            req.WorkAuthorizationStatus,
            req.RequiresVisaSponsorship,
            req.NoticePeriodDays,
            req.CurrentSalary,
            req.ExpectedSalary,
            req.SalaryCurrency ?? "INR",
            req.WillingToRelocate,
            req.RemotePreference,
            req.LinkedInUrl,
            req.GithubUrl,
            req.PortfolioUrl,
            req.EqualEmploymentGender,
            req.EqualEmploymentRace,
            req.EqualEmploymentVeteran,
            req.EqualEmploymentDisability,
            req.EvidenceKnowledgeBase ?? new()
        );

        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("screening-memories")]
    public async Task<IActionResult> GetScreeningMemories([FromQuery] string? company)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new GetScreeningMemoriesQuery(userId.Value, company));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("screening-memories")]
    public async Task<IActionResult> SaveScreeningMemory([FromBody] SaveScreeningMemoryRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new SaveScreeningMemoryCommand(
            userId.Value,
            req.Company,
            req.QuestionText,
            req.AnswerText,
            req.FieldType ?? "text"
        ));

        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }
}

public record UpdateCandidateProfileRequest(
    string PhoneNumber,
    string CurrentCity,
    string CurrentCountry,
    string WorkAuthorizationStatus,
    bool RequiresVisaSponsorship,
    int NoticePeriodDays,
    string CurrentSalary,
    string ExpectedSalary,
    string? SalaryCurrency,
    bool WillingToRelocate,
    string RemotePreference,
    string LinkedInUrl,
    string GithubUrl,
    string PortfolioUrl,
    string? EqualEmploymentGender,
    string? EqualEmploymentRace,
    string? EqualEmploymentVeteran,
    string? EqualEmploymentDisability,
    Dictionary<string, string>? EvidenceKnowledgeBase
);

public record SaveScreeningMemoryRequest(
    string Company,
    string QuestionText,
    string AnswerText,
    string? FieldType
);

[Authorize]
public class OrchestratorController : BaseApiController
{
    private readonly ICurrentUserService _currentUserService;

    public OrchestratorController(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    [HttpPost("detect-source")]
    public async Task<IActionResult> DetectSource([FromBody] DetectSourceRequest req)
    {
        var result = await Mediator.Send(new DetectJobSourceQuery(req.Url));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("generate-answers")]
    public async Task<IActionResult> GenerateAnswers([FromBody] GenerateAnswersRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new GenerateScreeningAnswersCommand(
            userId.Value,
            req.Company,
            req.Questions,
            req.MasterResumeId,
            req.QuestionItems
        ));

        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("prepare-package")]
    public async Task<IActionResult> PreparePackage([FromBody] PreparePackageRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new PrepareApplicationPackageCommand(
            userId.Value,
            req.MasterResumeId,
            req.JobUrl,
            req.DirectJobDescriptionText,
            req.TemplateStyle,
            req.CustomQuestions
        ));

        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue([FromQuery] PipelineExecutionStatus? status)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new GetApplicationQueueQuery(userId.Value, status));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("queue/{id:guid}")]
    public async Task<IActionResult> GetQueueItem(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new GetApplicationQueueItemByIdQuery(userId.Value, id));
        if (result.IsFailure)
            return NotFound(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut("queue/{id:guid}/status")]
    public async Task<IActionResult> UpdateQueueStatus(Guid id, [FromBody] UpdateQueueStatusRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new UpdateApplicationQueueStatusCommand(userId.Value, id, req.Status, req.ErrorMessage));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("queue/{id:guid}/execute")]
    public async Task<IActionResult> ExecuteQueueItem(Guid id, [FromBody] ExecuteQueueRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new ExecuteApplicationQueueItemCommand(
            userId.Value,
            id,
            req.Headed,
            req.CopilotMode
        ));

        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("quick-match")]
    public async Task<IActionResult> QuickMatch(
        [FromBody] QuickMatchRequest req,
        [FromServices] ApplicationDbContext db,
        [FromServices] IAtsScoringEngine atsEngine)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var masterResume = await db.MasterResumes
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.UserId == userId.Value && r.IsActive);

        if (masterResume == null)
            return BadRequest(new { error = "No active Master Resume found. Please upload one in Vedha AI Studio." });

        ResumeSchema? resumeSchema = null;
        try
        {
            resumeSchema = System.Text.Json.JsonSerializer.Deserialize<ResumeSchema>(
                masterResume.StructuredJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch { }

        if (resumeSchema == null)
            resumeSchema = new ResumeSchema();

        var jobSchema = new JobDescriptionSchema
        {
            Title = req.JobTitle ?? "Target Role",
            Company = req.Company ?? "Target Company",
            Responsibilities = !string.IsNullOrWhiteSpace(req.JobDescription)
                ? req.JobDescription.Split(new[] { '\n', '\r', '.' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim()).Where(s => s.Length > 10).Take(15).ToList()
                : new List<string>()
        };

        if (req.Skills != null && req.Skills.Any())
        {
            jobSchema.MustHaveSkills = req.Skills;
        }

        var atsBreakdown = atsEngine.CalculateScore(resumeSchema, jobSchema);

        return Ok(new
        {
            overallScore = atsBreakdown.OverallScore,
            keywordMatchScore = atsBreakdown.KeywordMatchScore,
            skillsMatchScore = atsBreakdown.SkillsMatchScore,
            experienceRelevanceScore = atsBreakdown.ExperienceRelevanceScore,
            matchedSkills = atsBreakdown.MatchingSkills,
            missingSkills = atsBreakdown.MissingSkills,
            matchingKeywords = atsBreakdown.MatchingKeywords,
            missingKeywords = atsBreakdown.MissingKeywords,
            strengths = atsBreakdown.Strengths,
            weaknesses = atsBreakdown.Weaknesses,
            recommendation = atsBreakdown.OverallScore >= 85
                ? "Excellent Match! Your profile closely aligns with this position."
                : atsBreakdown.OverallScore >= 70
                    ? "Good Match. Consider highlighting missing keywords before applying."
                    : "Partial Match. Recommended to tailor your resume before applying."
        });
    }

    [HttpPost("quick-cover-letter")]
    public async Task<IActionResult> QuickCoverLetter(
        [FromBody] QuickCoverLetterRequest req,
        [FromServices] ApplicationDbContext db,
        [FromServices] IAiServiceFactory aiFactory)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var masterResume = await db.MasterResumes
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.UserId == userId.Value && r.IsActive);

        var profile = await db.CandidateProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId.Value);

        ResumeSchema? resumeSchema = null;
        try
        {
            if (masterResume != null && !string.IsNullOrWhiteSpace(masterResume.StructuredJson))
            {
                resumeSchema = System.Text.Json.JsonSerializer.Deserialize<ResumeSchema>(
                    masterResume.StructuredJson,
                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
        }
        catch { }

        var candidateName = resumeSchema?.PersonalInfo?.FullName ?? "Candidate";
        var candidateEmail = resumeSchema?.PersonalInfo?.Email ?? "";
        var candidatePhone = profile?.PhoneNumber ?? resumeSchema?.PersonalInfo?.Phone ?? "";
        var candidateCity = profile?.CurrentCity ?? resumeSchema?.PersonalInfo?.Location ?? "";
        var company = string.IsNullOrWhiteSpace(req.Company) ? "Hiring Team" : req.Company;
        var role = string.IsNullOrWhiteSpace(req.JobTitle) ? "Target Position" : req.JobTitle;

        var systemPrompt = "You are a world-class executive career coach and ATS optimization specialist. Write a concise, compelling, professional 3-paragraph cover letter tailored to the job description using truthful candidate experience. Return ONLY the clean letter text with no markdown fences, no preambles, and no conversational filler.";

        var candidateText = masterResume?.RawExtractedText ?? string.Empty;
        var candidateSnippet = candidateText.Length > 3000 ? candidateText.Substring(0, 3000) : candidateText;
        var jdSnippet = (req.JobDescription ?? string.Empty).Length > 3000 ? req.JobDescription!.Substring(0, 3000) : (req.JobDescription ?? string.Empty);

        var userPrompt = $@"Write a tailored cover letter for:
Candidate: {candidateName}
Email: {candidateEmail}
Phone: {candidatePhone}
Location: {candidateCity}
Company: {company}
Role: {role}
Tone: {req.Tone ?? "Professional and confident"}

Candidate Background & Highlights:
{candidateSnippet}

Target Job Requirements:
{jdSnippet}

Format guidelines:
- Paragraph 1: Enthusiastic opening stating the exact role ({role}) at {company} and 2 core value propositions.
- Paragraph 2: Specific quantified accomplishments matching the role requirements.
- Paragraph 3: Cultural alignment, enthusiasm, and call to action for an interview.
- Formal sign-off with {candidateName}.";

        var aiProvider = aiFactory.GetDefaultProvider();
        var aiResult = await aiProvider.GenerateTextAsync(systemPrompt, userPrompt);
        if (aiResult.IsFailure)
            return BadRequest(new { error = aiResult.Error });

        var cleanLetter = aiResult.Value.Trim();
        if (cleanLetter.StartsWith("```"))
        {
            var firstLineBreak = cleanLetter.IndexOf('\n');
            if (firstLineBreak > 0) cleanLetter = cleanLetter.Substring(firstLineBreak + 1);
            if (cleanLetter.EndsWith("```")) cleanLetter = cleanLetter.Substring(0, cleanLetter.Length - 3).Trim();
        }

        return Ok(new
        {
            company = company,
            role = role,
            content = cleanLetter
        });
    }
}

public record DetectSourceRequest(string Url);

public record GenerateAnswersRequest(
    string Company,
    List<string>? Questions = null,
    Guid? MasterResumeId = null,
    List<ScreeningQuestionPromptItem>? QuestionItems = null
);

public record PreparePackageRequest(
    Guid? MasterResumeId,
    string JobUrl,
    string? DirectJobDescriptionText,
    TemplateStyle TemplateStyle = TemplateStyle.ClassicAts,
    List<string>? CustomQuestions = null
);

public record UpdateQueueStatusRequest(
    PipelineExecutionStatus Status,
    string? ErrorMessage
);

public record ExecuteQueueRequest(
    bool Headed = false,
    bool CopilotMode = true
);

public record QuickMatchRequest(
    string? JobTitle,
    string? Company,
    string? JobDescription,
    List<string>? Skills
);

public record QuickCoverLetterRequest(
    string? JobTitle,
    string? Company,
    string? JobDescription,
    string? Tone
);
