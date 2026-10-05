using System.Net.Http.Headers;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;

namespace ResumeTailor.Infrastructure.Storage;

public class MinioS3StorageService : IS3StorageService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MinioS3StorageService> _logger;
    private readonly IAmazonS3 _s3Client;
    private readonly string _endpoint;
    private readonly string _publicEndpoint;
    private readonly string _bucket;
    private readonly string _accessKey;
    private readonly string _secretKey;
    private readonly string _localStorageDir;
    private bool _bucketChecked = false;

    public MinioS3StorageService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<MinioS3StorageService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        _endpoint = configuration["S3Settings:Endpoint"] 
                    ?? configuration["MINIO_ENDPOINT"] 
                    ?? "localhost:9000";
        _publicEndpoint = configuration["S3Settings:PublicEndpoint"] 
                          ?? configuration["MINIO_PUBLIC_ENDPOINT"] 
                          ?? $"http://{_endpoint}";
        _bucket = configuration["S3Settings:BucketName"] 
                  ?? configuration["MINIO_BUCKET"] 
                  ?? "vedha-resumes";
        _accessKey = configuration["S3Settings:AccessKey"] 
                     ?? configuration["MINIO_ACCESS_KEY"] 
                     ?? "minioadmin";
        _secretKey = configuration["S3Settings:SecretKey"] 
                     ?? configuration["MINIO_SECRET_KEY"] 
                     ?? "minioadmin";

        _localStorageDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "s3_local_cache", _bucket);
        Directory.CreateDirectory(_localStorageDir);

        // Configure AmazonS3Client for MinIO compatibility (ForcePathStyle = true, SigV4)
        var serviceUrl = _endpoint.StartsWith("http://") || _endpoint.StartsWith("https://")
            ? _endpoint
            : $"http://{_endpoint}";

        var s3Config = new AmazonS3Config
        {
            ServiceURL = serviceUrl,
            ForcePathStyle = true,
            UseHttp = !serviceUrl.StartsWith("https://")
        };

        var credentials = new BasicAWSCredentials(_accessKey, _secretKey);
        _s3Client = new AmazonS3Client(credentials, s3Config);
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        if (_bucketChecked) return;
        try
        {
            var exists = await AmazonS3Util.DoesS3BucketExistV2Async(_s3Client, _bucket);
            if (!exists)
            {
                await _s3Client.PutBucketAsync(new PutBucketRequest { BucketName = _bucket }, cancellationToken);
                _logger.LogInformation("Successfully created MinIO bucket: '{Bucket}'", _bucket);
            }
            _bucketChecked = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not verify/create MinIO bucket '{Bucket}'. Proceeding with resilient local caching.", _bucket);
        }
    }

    public async Task<string> UploadResumePdfAsync(
        Guid applicationId,
        byte[] pdfBytes,
        string fileName = "resume.pdf",
        CancellationToken cancellationToken = default)
    {
        var objectKey = $"resumes/{applicationId}/{fileName}";
        var localFilePath = Path.Combine(_localStorageDir, $"{applicationId}_{fileName}");

        // 1. Resilient local filesystem caching (both flat and hierarchical)
        try
        {
            await File.WriteAllBytesAsync(localFilePath, pdfBytes, cancellationToken);
            var hierarchicalPath = Path.Combine(_localStorageDir, "resumes", applicationId.ToString(), fileName);
            var hierarchicalDir = Path.GetDirectoryName(hierarchicalPath);
            if (!string.IsNullOrEmpty(hierarchicalDir))
                Directory.CreateDirectory(hierarchicalDir);
            await File.WriteAllBytesAsync(hierarchicalPath, pdfBytes, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Local cache write failed for {FileName}", fileName);
        }

        var s3Url = $"{_publicEndpoint.TrimEnd('/')}/{_bucket}/{objectKey}";

        // 2. Upload to MinIO using standard AWS S3 SigV4 SDK
        try
        {
            await EnsureBucketExistsAsync(cancellationToken);

            using var memoryStream = new MemoryStream(pdfBytes);
            var putRequest = new PutObjectRequest
            {
                BucketName = _bucket,
                Key = objectKey,
                InputStream = memoryStream,
                ContentType = "application/pdf"
            };

            var response = await _s3Client.PutObjectAsync(putRequest, cancellationToken);
            if (response.HttpStatusCode == System.Net.HttpStatusCode.OK)
            {
                _logger.LogInformation("Successfully uploaded resume PDF to MinIO S3: {S3Url}", s3Url);
                return s3Url;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MinIO S3 SDK upload failed for {ObjectKey}. Relying on local storage proxy URL: {S3Url}", objectKey, s3Url);
        }

        return s3Url;
    }

    public async Task<byte[]> DownloadFileAsync(string s3UrlOrKey, CancellationToken cancellationToken = default)
    {
        // 1. Check local cache first for sub-millisecond retrieval
        var fileName = Path.GetFileName(s3UrlOrKey);
        var localMatches = Directory.GetFiles(_localStorageDir, $"*{fileName}*", SearchOption.AllDirectories);
        if (localMatches.Length > 0 && File.Exists(localMatches[0]))
        {
            return await File.ReadAllBytesAsync(localMatches[0], cancellationToken);
        }

        // 2. Attempt download via MinIO S3 SDK
        try
        {
            var key = s3UrlOrKey;
            if (s3UrlOrKey.Contains(_bucket))
            {
                var idx = s3UrlOrKey.IndexOf(_bucket, StringComparison.OrdinalIgnoreCase);
                key = s3UrlOrKey.Substring(idx + _bucket.Length).TrimStart('/');
            }

            var getRequest = new GetObjectRequest
            {
                BucketName = _bucket,
                Key = key
            };

            using var response = await _s3Client.GetObjectAsync(getRequest, cancellationToken);
            using var memoryStream = new MemoryStream();
            await response.ResponseStream.CopyToAsync(memoryStream, cancellationToken);
            return memoryStream.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MinIO SDK download failed for {Key}. Attempting HTTP fallback.", s3UrlOrKey);
        }

        // 3. Fallback to HTTP download
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
