using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.Aksh;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.WebApi.Controllers;

public record AkshStartSessionRequest(string Goal, string? JobUrl, AutonomyLevel? AutonomyLevel);

public record AkshChatRequest(string Message);

public record AkshAnswerEdit(string Question, string? Answer);

public record AkshDecisionRequest(bool Approve, List<AkshAnswerEdit>? EditedAnswers);

/// <summary>
/// Aksh conversational surface. Chat turns stream over SSE; approvals are
/// explicit POSTs; nothing here executes tools directly — the runner and the
/// approval handler own all side effects behind user scoping.
/// </summary>
[Authorize]
public class AkshController : BaseApiController
{
    private readonly ICurrentUserService _currentUserService;

    public AkshController(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    [HttpPost("sessions")]
    public async Task<IActionResult> StartSession([FromBody] AkshStartSessionRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new StartAkshSessionCommand(
            userId.Value,
            req.Goal ?? string.Empty,
            req.JobUrl,
            req.AutonomyLevel ?? AutonomyLevel.Supervised));

        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions([FromQuery] bool activeOnly = true)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new GetAkshSessionsQuery(userId.Value, activeOnly));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("sessions/{id:guid}/messages")]
    public async Task StreamMessage(
        Guid id,
        [FromBody] AkshChatRequest req,
        [FromServices] IAkshAgentRunner runner,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Append("X-Accel-Buffering", "no");

        var aborted = HttpContext.RequestAborted;
        try
        {
            await foreach (var evt in runner.StreamTurnAsync(userId.Value, id, req.Message ?? string.Empty, aborted))
            {
                cancellationToken.ThrowIfCancellationRequested();
                await Response.WriteAsync($"event: {evt.Type}\n", aborted);
                await Response.WriteAsync($"data: {JsonSerializer.Serialize(evt.Data)}\n\n", aborted);
                await Response.Body.FlushAsync(aborted);
            }
        }
        catch (OperationCanceledException)
        {
            // Client disconnected; the persisted receipts already reflect completed work.
        }
        catch (Exception ex)
        {
            try
            {
                await Response.WriteAsync("event: error\n", aborted);
                await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { reasonCode = "stream_failed", message = "Turn interrupted: " + ex.Message })}\n\n", aborted);
                await Response.Body.FlushAsync(aborted);
            }
            catch
            {
                // Response already unusable; nothing further to report.
            }
        }
    }

    [HttpPost("approvals/{id:guid}/decision")]
    public async Task<IActionResult> DecideApproval(Guid id, [FromBody] AkshDecisionRequest req)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        string? editedJson = null;
        if (req.EditedAnswers is { Count: > 0 })
        {
            editedJson = JsonSerializer.Serialize(req.EditedAnswers
                .Where(e => !string.IsNullOrWhiteSpace(e.Question))
                .Select(e => new { question = e.Question.Trim(), answer = e.Answer ?? string.Empty })
                .Take(20)
                .ToList());
        }

        var result = await Mediator.Send(new DecideAkshApprovalCommand(userId.Value, id, req.Approve, editedJson));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("sessions/{id:guid}/audit")]
    public async Task<IActionResult> GetAudit(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        var result = await Mediator.Send(new GetAkshAuditQuery(userId.Value, id));
        if (result.IsFailure)
            return NotFound(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("config")]
    public IActionResult GetConfig([FromServices] IConfiguration config)
    {
        // Non-secret operational surface only. Keys are never exposed here.
        return Ok(new
        {
            enabled = config.GetValue("Aksh:Enabled", false),
            dailyTokenBudget = config.GetValue("Aksh:DailyTokenBudget", 200000),
        });
    }
}
