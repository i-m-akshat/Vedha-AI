using System.Net.Http.Headers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;

namespace ResumeTailor.Infrastructure.Storage;

public class MinioS3StorageService : IS3StorageService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MinioS3StorageService> _logger;
    private readonly string _endpoint;
    private readonly string _publicEndpoint;
    private readonly string _bucket;
    private readonly string _localStorageDir;

    public MinioS3StorageService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<MinioS3StorageService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        _endpoint = configuration["S3Settings:Endpoint"] ?? "localhost:9000";
        _publicEndpoint = configuration["S3Settings:PublicEndpoint"] ?? $"http://{_endpoint}";
        _bucket = configuration["S3Settings:BucketName"] ?? "vedha-resumes";

        _localStorageDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "s3_local_cache", _bucket);
        Directory.CreateDirectory(_localStorageDir);
    }

    public async Task<string> UploadResumePdfAsync(
        Guid applicationId,
        byte[] pdfBytes,
        string fileName = "resume.pdf",
        CancellationToken cancellationToken = default)
    {
        var objectKey = $"resumes/{applicationId}/{fileName}";
        var localFilePath = Path.Combine(_localStorageDir, $"{applicationId}_{fileName}");

        // 1. Cache to local storage directory for offline / local fallback (both flat and hierarchical)
        await File.WriteAllBytesAsync(localFilePath, pdfBytes, cancellationToken);
        var hierarchicalPath = Path.Combine(_localStorageDir, "resumes", applicationId.ToString(), fileName);
        var hierarchicalDir = Path.GetDirectoryName(hierarchicalPath);
        if (!string.IsNullOrEmpty(hierarchicalDir))
            Directory.CreateDirectory(hierarchicalDir);
        await File.WriteAllBytesAsync(hierarchicalPath, pdfBytes, cancellationToken);

        // 2. Attempt S3 / MinIO REST upload
        var s3Url = $"{_publicEndpoint.TrimEnd('/')}/{_bucket}/{objectKey}";
        try
        {
            var uploadUrl = $"http://{_endpoint.TrimEnd('/')}/{_bucket}/{objectKey}";
            using var request = new HttpRequestMessage(HttpMethod.Put, uploadUrl);
            request.Content = new ByteArrayContent(pdfBytes);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");

            var response = await _httpClient.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully uploaded resume PDF to S3/MinIO: {S3Url}", s3Url);
            }
            else
            {
                _logger.LogWarning("MinIO upload returned status {StatusCode}. Using fallback S3 durable URL.", response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not contact MinIO service directly ({Endpoint}). Stored locally with public URL: {S3Url}", _endpoint, s3Url);
        }

        return s3Url;
    }

    public async Task<byte[]> DownloadFileAsync(string s3UrlOrKey, CancellationToken cancellationToken = default)
    {
        // 1. Check local cache
        var fileName = Path.GetFileName(s3UrlOrKey);
        var localMatches = Directory.GetFiles(_localStorageDir, $"*{fileName}*");
        if (localMatches.Length > 0 && File.Exists(localMatches[0]))
        {
            return await File.ReadAllBytesAsync(localMatches[0], cancellationToken);
        }

        // 2. Attempt HTTP download
        if (s3UrlOrKey.StartsWith("http://") || s3UrlOrKey.StartsWith("https://"))
        {
            try
            {
                return await _httpClient.GetByteArrayAsync(s3UrlOrKey, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed downloading file from URL {Url}", s3UrlOrKey);
            }
        }

        return Array.Empty<byte>();
    }
}
