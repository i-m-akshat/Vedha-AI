using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.AutonomousApplications;

namespace ResumeTailor.WebApi.Controllers;

[Authorize]
[Route("api/autonomous")]
[Route("api/[controller]")]
public class AutonomousApplicationsController : BaseApiController
{
    private readonly ICurrentUserService _currentUserService;

    public AutonomousApplicationsController(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    [HttpPost("ingest-job")]
    public async Task<IActionResult> IngestJob([FromBody] IngestJobRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var command = new IngestJobCommand(
            userId.Value,
            req.JobTitle ?? "",
            req.CompanyName ?? "",
            req.JobUrl,
            req.JobDescription ?? ""
        );

        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("applications")]
    public async Task<IActionResult> GetApplications([FromQuery] string? status)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var query = new GetApplicationAuditsQuery(userId.Value, status);
        var result = await Mediator.Send(query);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("achievements")]
    public async Task<IActionResult> AddAchievement([FromBody] AddAchievementRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var command = new AddCareerAchievementCommand(userId.Value, req.Content);
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("achievements")]
    public async Task<IActionResult> GetAchievements()
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var query = new GetCareerAchievementsQuery(userId.Value);
        var result = await Mediator.Send(query);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("resolve-hitl")]
    public async Task<IActionResult> ResolveHitl([FromBody] ResolveHitlRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var command = new ResolveHitlCommand(userId.Value, req.ApplicationId, req.Answer);
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(new { success = true, message = "HitL question resolved. Worker execution resumed." });
    }

    [HttpGet("credits")]
    public async Task<IActionResult> GetCredits()
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var query = new GetUserCreditsQuery(userId.Value);
        var result = await Mediator.Send(query);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }
}

public record IngestJobRequest(
    string? JobTitle,
    string? CompanyName,
    string JobUrl,
    string? JobDescription
);

public record AddAchievementRequest(
    string Content
);

public record ResolveHitlRequest(
    Guid ApplicationId,
    string Answer
);
