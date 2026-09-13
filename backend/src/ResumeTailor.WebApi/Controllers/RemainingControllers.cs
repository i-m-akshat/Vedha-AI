using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResumeTailor.Application.Features.Analytics;
using ResumeTailor.Application.Features.Applications;
using ResumeTailor.Application.Features.Prompts;
using ResumeTailor.Application.Features.Tailoring;
using ResumeTailor.Application.Features.Tools;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.WebApi.Controllers;

public record UpdateTailoredResumeRequest(ResumeSchema UpdatedSchema, TemplateStyle? SelectedTemplate = null);

[Authorize]
public class TailorController : BaseApiController
{
    [HttpPost("generate")]
    public async Task<IActionResult> GenerateTailoredResume([FromBody] GenerateTailoredResumeCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetTailoredResume(Guid id)
    {
        var result = await Mediator.Send(new GetTailoredResumeByIdQuery(id));
        if (result.IsFailure)
            return NotFound(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var result = await Mediator.Send(new GetGeneratedResumesListQuery());
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateTailoredResume(Guid id, [FromBody] UpdateTailoredResumeRequest req)
    {
        var result = await Mediator.Send(new UpdateTailoredResumeCommand(id, req.UpdatedSchema, req.SelectedTemplate));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}/export")]
    public async Task<IActionResult> Export(Guid id, [FromQuery] ResumeFormat format = ResumeFormat.Pdf, [FromQuery] TemplateStyle style = TemplateStyle.ClassicAts)
    {
        var result = await Mediator.Send(new ExportResumeQuery(id, format, style));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return File(result.Value.FileBytes, result.Value.ContentType, result.Value.FileName);
    }
}

[Authorize]
public class ApplicationsController : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> GetApplications([FromQuery] ApplicationStatus? status)
    {
        var result = await Mediator.Send(new GetApplicationsQuery(status));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateApplicationCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateApplicationStatusRequest req)
    {
        var result = await Mediator.Send(new UpdateApplicationStatusCommand(id, req.Status, req.AppliedDate, req.NextInterviewDate));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateDetails(Guid id, [FromBody] UpdateApplicationDetailsCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { error = "Mismatched ID" });

        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await Mediator.Send(new DeleteApplicationCommand(id));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(new { success = true });
    }
}

public record UpdateApplicationStatusRequest(ApplicationStatus Status, DateTime? AppliedDate, DateTime? NextInterviewDate);

[Authorize]
public class ToolsController : BaseApiController
{
    [HttpPost("cover-letter")]
    public async Task<IActionResult> GenerateCoverLetter([FromBody] GenerateCoverLetterCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("interview-prep")]
    public async Task<IActionResult> GenerateInterviewPrep([FromBody] GenerateInterviewPrepCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("skill-roadmap")]
    public async Task<IActionResult> GenerateSkillRoadmap([FromBody] GenerateSkillRoadmapCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }
}

[Authorize]
public class PromptsController : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> GetPrompts()
    {
        var result = await Mediator.Send(new GetPromptTemplatesQuery());
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost]
    public async Task<IActionResult> SavePrompt([FromBody] SavePromptTemplateCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("{key}/reset")]
    public async Task<IActionResult> ResetPrompt(string key)
    {
        var result = await Mediator.Send(new ResetPromptTemplateCommand(key));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(new { success = true });
    }
}

[Authorize]
public class AnalyticsController : BaseApiController
{
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboardMetrics()
    {
        var result = await Mediator.Send(new GetDashboardAnalyticsQuery());
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }
}
