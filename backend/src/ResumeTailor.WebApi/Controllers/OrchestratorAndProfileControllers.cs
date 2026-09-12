using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.CandidateProfile;
using ResumeTailor.Application.Features.Orchestrator;
using ResumeTailor.Domain.Enums;

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
            req.MasterResumeId
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
}

public record DetectSourceRequest(string Url);

public record GenerateAnswersRequest(
    string Company,
    List<string> Questions,
    Guid? MasterResumeId
);

public record PreparePackageRequest(
    Guid MasterResumeId,
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
