using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace ResumeTailor.WebApi.Controllers;

[AllowAnonymous]
[ApiController]
public class StorageController : ControllerBase
{
    private readonly ILogger<StorageController> _logger;
    private readonly string _cacheRoot;

    public StorageController(ILogger<StorageController> logger)
    {
        _logger = logger;
        _cacheRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "s3_local_cache");
    }

    [HttpGet("/vedha-resumes/{**key}")]
    public IActionResult GetVedhaResumes(string key)
    {
        return ServeFile("vedha-resumes", key);
    }

    [HttpGet("/api/storage/{bucket}/{**key}")]
    public IActionResult GetStorageFile(string bucket, string key)
    {
        return ServeFile(bucket, key);
    }

    [HttpGet("/api/resumes/{applicationId:guid}/{fileName}")]
    public IActionResult GetResumeByAppId(Guid applicationId, string fileName)
    {
        return ServeFile("vedha-resumes", $"{applicationId}_{fileName}");
    }

    [HttpPut("/vedha-resumes/{**key}")]
    public async Task<IActionResult> PutVedhaResumes(string key, CancellationToken cancellationToken)
    {
        return await SaveFile("vedha-resumes", key, cancellationToken);
    }

    [HttpPut("/api/storage/{bucket}/{**key}")]
    public async Task<IActionResult> PutStorageFile(string bucket, string key, CancellationToken cancellationToken)
    {
        return await SaveFile(bucket, key, cancellationToken);
    }

    private IActionResult ServeFile(string bucket, string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest(new { error = "Key is required." });

        var bucketDir = Path.Combine(_cacheRoot, bucket);
        if (!Directory.Exists(bucketDir))
            return NotFound(new { error = $"Bucket '{bucket}' not found." });

        // 1. Check exact key path
        var sanitizedKey = key.Replace('/', Path.DirectorySeparatorChar).Replace('\\', Path.DirectorySeparatorChar);
        var exactPath = Path.Combine(bucketDir, sanitizedKey);
        if (System.IO.File.Exists(exactPath))
        {
            return ReturnFile(exactPath);
        }

        // 2. Check if fileName is embedded in key (e.g. resumes/appId/fileName.pdf -> appId_fileName.pdf)
        var fileName = Path.GetFileName(sanitizedKey);
        var segments = sanitizedKey.Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries);
        
        if (segments.Length >= 2)
        {
            var potentialAppId = segments[^2];
            var flatCandidate = Path.Combine(bucketDir, $"{potentialAppId}_{fileName}");
            if (System.IO.File.Exists(flatCandidate))
            {
                return ReturnFile(flatCandidate);
            }
        }

        // 3. Search directory for matching filename pattern
        var matches = Directory.GetFiles(bucketDir, $"*{fileName}*", SearchOption.AllDirectories);
        if (matches.Length > 0)
        {
            return ReturnFile(matches[0]);
        }

        _logger.LogWarning("Requested storage object '{Key}' in bucket '{Bucket}' not found on disk.", key, bucket);
        return NotFound(new { error = $"Object '{key}' not found in bucket '{bucket}'." });
    }

    private IActionResult ReturnFile(string filePath)
    {
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        var contentType = ext switch
        {
            ".pdf" => "application/pdf",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".md" => "text/markdown",
            ".json" => "application/json",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            _ => "application/octet-stream"
        };

        var fileName = Path.GetFileName(filePath);
        return PhysicalFile(Path.GetFullPath(filePath), contentType, fileName, enableRangeProcessing: true);
    }

    private async Task<IActionResult> SaveFile(string bucket, string key, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest(new { error = "Key is required." });

        var bucketDir = Path.Combine(_cacheRoot, bucket);
        Directory.CreateDirectory(bucketDir);

        var sanitizedKey = key.Replace('/', Path.DirectorySeparatorChar).Replace('\\', Path.DirectorySeparatorChar);
        var destPath = Path.Combine(bucketDir, sanitizedKey);
        
        var dir = Path.GetDirectoryName(destPath);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        using (var destStream = System.IO.File.Create(destPath))
        {
            await Request.Body.CopyToAsync(destStream, cancellationToken);
        }

        // Also save flat representation if appId is in path
        var segments = sanitizedKey.Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length >= 2)
        {
            var potentialAppId = segments[^2];
            var fileName = Path.GetFileName(sanitizedKey);
            var flatCandidate = Path.Combine(bucketDir, $"{potentialAppId}_{fileName}");
            if (destPath != flatCandidate)
            {
                System.IO.File.Copy(destPath, flatCandidate, overwrite: true);
            }
        }

        _logger.LogInformation("Successfully stored S3 object to {Path}", destPath);
        return Ok(new { success = true, key });
    }
}
