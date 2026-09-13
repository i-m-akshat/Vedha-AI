using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResumeTailor.Application.Features.JobDescriptionFeatures;
using ResumeTailor.Application.Features.MasterResumeFeatures;

namespace ResumeTailor.WebApi.Controllers;

public class UploadMasterResumeFormRequest
{
    public required IFormFile File { get; set; }
}

[Authorize]
public class MasterResumeController : BaseApiController
{
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadMasterResume([FromForm] UploadMasterResumeFormRequest form)
    {
        var file = form?.File;
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "Please select a valid resume file (PDF, DOCX, or Markdown)." });

        using var stream = file.OpenReadStream();
        var command = new UploadAndParseMasterResumeCommand(stream, file.FileName, file.ContentType);
        var result = await Mediator.Send(command);

        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet]
    public async Task<IActionResult> GetMasterResume()
    {
        var result = await Mediator.Send(new GetMasterResumeQuery());
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateMasterResume([FromBody] UpdateMasterResumeCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("versions")]
    public async Task<IActionResult> GetVersions()
    {
        var result = await Mediator.Send(new GetResumeVersionsQuery());
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("versions/{versionId:guid}/revert")]
    public async Task<IActionResult> RevertToVersion(Guid versionId)
    {
        var result = await Mediator.Send(new RevertToVersionCommand(versionId));
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteMasterResume()
    {
        var result = await Mediator.Send(new DeleteMasterResumeCommand());
        if (result.IsFailure)
            return NotFound(new { error = result.Error });

        return Ok(new { success = true, message = "Master resume and all version history successfully deleted." });
    }
}

[Authorize]
public class JobController : BaseApiController
{
    [HttpPost("scrape")]
    public async Task<IActionResult> ScrapeUrl([FromBody] ScrapeJobUrlCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("parse")]
    public async Task<IActionResult> ParseRawText([FromBody] ParseRawJobDescriptionCommand command)
    {
        var result = await Mediator.Send(command);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet]
    public async Task<IActionResult> GetRecentJobs()
    {
        var result = await Mediator.Send(new GetJobDescriptionsQuery());
        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }
}
