using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Infrastructure.Ai;

public class AiSettings
{
    public string? OpenAiApiKey { get; set; }
    public string? AnthropicApiKey { get; set; }
    public string? GeminiApiKey { get; set; }
    public string DefaultProvider { get; set; } = "Gemini";
    public string DefaultModel { get; set; } = "gemini-flash-lite-latest";
    public int MaxTokens { get; set; } = 16384;
}

public class OpenAiProvider : IAiProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<OpenAiProvider> _logger;
    private readonly IEncryptionService _encryptionService;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };

    public AiProviderType ProviderType => AiProviderType.OpenAi;

    public OpenAiProvider(HttpClient httpClient, IConfiguration config, ILogger<OpenAiProvider> logger, IEncryptionService encryptionService)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
        _encryptionService = encryptionService;
    }

    public async Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:OpenAiApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<TResponse>.Failure("OpenAI API Key is not configured. Please configure it in Settings.");
        }

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "gpt-4o-mini";
        var maxTokens = int.TryParse(_config["AiSettings:MaxTokens"], out var mt) && mt > 0 ? mt : 8192;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var body = new
            {
                model = model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt + "\nIMPORTANT: Return ONLY valid raw JSON matching the required schema." },
                    new { role = "user", content = userPrompt }
                },
                response_format = new { type = "json_object" },
                temperature = 0.2,
                max_tokens = maxTokens
            };

            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return Result<TResponse>.Failure($"OpenAI API error ({response.StatusCode}): {responseContent}");
            }

            var node = JsonNode.Parse(responseContent);
            var finishReason = node?["choices"]?[0]?["finish_reason"]?.ToString();
            if (string.Equals(finishReason, "length", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("OpenAI output was truncated due to token limit ({MaxTokens}).", maxTokens);
                return Result<TResponse>.Failure($"AI output was truncated due to exceeding maximum token limit ({maxTokens}).");
            }

            var content = node?["choices"]?[0]?["message"]?["content"]?.ToString();
            if (string.IsNullOrEmpty(content))
                return Result<TResponse>.Failure("Empty content returned from OpenAI.");

            var cleanedJson = CleanJsonFences(content);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            if (parsed == null)
                return Result<TResponse>.Failure("AI returned empty or null JSON.");

            return Result<TResponse>.Success(parsed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize JSON from OpenAI response");
            return Result<TResponse>.Failure($"Failed to parse AI output into required schema: {ex.Message}");
        }
    }

    public async Task<Result<string>> GenerateTextAsync(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:OpenAiApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<string>.Failure("OpenAI API Key is not configured. Please configure it in Settings.");
        }

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "gpt-4o-mini";
        var maxTokens = int.TryParse(_config["AiSettings:MaxTokens"], out var mt) && mt > 0 ? mt : 8192;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var body = new
            {
                model = model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                },
                temperature = 0.2,
                max_tokens = maxTokens
            };

            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return Result<string>.Failure($"OpenAI API error ({response.StatusCode}): {responseContent}");
            }

            var node = JsonNode.Parse(responseContent);
            var content = node?["choices"]?[0]?["message"]?["content"]?.ToString();
            return !string.IsNullOrEmpty(content) ? Result<string>.Success(content) : Result<string>.Failure("Empty content returned from OpenAI.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI generation error");
            return Result<string>.Failure($"OpenAI request failed: {ex.Message}");
        }
    }

    public async Task<Result<TResponse>> ParseDocumentBytesAsync<TResponse>(
        byte[] fileBytes,
        string mimeType,
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:OpenAiApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
            return Result<TResponse>.Failure("OpenAI API Key is not configured. Please configure it in Settings.");

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "gpt-4o";

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var base64 = Convert.ToBase64String(fileBytes);
            var isImage = mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);

            if (!isImage)
            {
                using var documentRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses");
                documentRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

                var documentBody = new
                {
                    model,
                    instructions = systemPrompt + "\nIMPORTANT: Return ONLY valid, raw JSON matching the required schema without markdown code fences.",
                    input = new[]
                    {
                        new
                        {
                            role = "user",
                            content = new object[]
                            {
                                new { type = "input_text", text = userPrompt },
                                new
                                {
                                    type = "input_file",
                                    filename = GetDocumentFileName(mimeType),
                                    file_data = $"data:{mimeType};base64,{base64}"
                                }
                            }
                        }
                    },
                    text = new { format = new { type = "json_object" } },
                    temperature = 0.1
                };

                documentRequest.Content = new StringContent(JsonSerializer.Serialize(documentBody), Encoding.UTF8, "application/json");
                var documentResponse = await _httpClient.SendAsync(documentRequest, cancellationToken);
                var documentResponseContent = await documentResponse.Content.ReadAsStringAsync(cancellationToken);

                if (!documentResponse.IsSuccessStatusCode)
                    return Result<TResponse>.Failure($"OpenAI API error ({documentResponse.StatusCode}): {documentResponseContent}");

                var documentNode = JsonNode.Parse(documentResponseContent);
                var documentRawText = documentNode?["output_text"]?.ToString()
                    ?? documentNode?["output"]?[0]?["content"]?[0]?["text"]?.ToString();
                if (string.IsNullOrEmpty(documentRawText))
                    return Result<TResponse>.Failure("Empty content returned from OpenAI.");

                var documentJson = CleanJsonFences(documentRawText);
                var documentParsed = JsonSerializer.Deserialize<TResponse>(documentJson, JsonOptions);
                return documentParsed != null
                    ? Result<TResponse>.Success(documentParsed)
                    : Result<TResponse>.Failure("AI returned empty or null JSON.");
            }

            object userMessageContent = new object[]
            {
                new { type = "text", text = userPrompt },
                new { type = "image_url", image_url = new { url = $"data:{mimeType};base64,{base64}" } }
            };

            var body = new
            {
                model = model,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt + "\nIMPORTANT: Return ONLY valid, raw JSON matching the required schema without markdown code fences." },
                    new { role = "user", content = userMessageContent }
                },
                temperature = 0.1,
                response_format = new { type = "json_object" }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
                return Result<TResponse>.Failure($"OpenAI API error ({response.StatusCode}): {responseContent}");

            var node = JsonNode.Parse(responseContent);
            var rawText = node?["choices"]?[0]?["message"]?["content"]?.ToString();
            if (string.IsNullOrEmpty(rawText))
                return Result<TResponse>.Failure("Empty content returned from OpenAI.");

            var cleanedJson = CleanJsonFences(rawText);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            return parsed != null ? Result<TResponse>.Success(parsed) : Result<TResponse>.Failure("AI returned empty or null JSON.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI document parsing error");
            return Result<TResponse>.Failure($"OpenAI document parsing failed: {ex.Message}");
        }
    }

    private static string CleanJsonFences(string input)
    {
        var text = input.Trim();
        if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            text = text[7..];
        else if (text.StartsWith("```", StringComparison.OrdinalIgnoreCase))
            text = text[3..];

        if (text.EndsWith("```", StringComparison.OrdinalIgnoreCase))
            text = text[..^3];

        return text.Trim();
    }

    private static string GetDocumentFileName(string mimeType) => mimeType.ToLowerInvariant() switch
    {
        "application/pdf" => "resume.pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => "resume.docx",
        "text/markdown" => "resume.md",
        "text/plain" => "resume.txt",
        _ => "resume.document"
    };
}

public class ClaudeProvider : IAiProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<ClaudeProvider> _logger;
    private readonly IEncryptionService _encryptionService;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };

    public AiProviderType ProviderType => AiProviderType.Claude;

    public ClaudeProvider(HttpClient httpClient, IConfiguration config, ILogger<ClaudeProvider> logger, IEncryptionService encryptionService)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
        _encryptionService = encryptionService;
    }

    public async Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:AnthropicApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<TResponse>.Failure("Anthropic Claude API Key is not configured. Please configure it in Settings.");
        }

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "claude-3-5-sonnet-20241022";
        var maxTokens = int.TryParse(_config["AiSettings:MaxTokens"], out var mt) && mt > 0 ? mt : 8192;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
            request.Headers.Add("x-api-key", apiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");

            var body = new
            {
                model = model,
                system = systemPrompt + "\nIMPORTANT: Return ONLY valid raw JSON matching the required schema without markdown code fences.",
                messages = new[] { new { role = "user", content = userPrompt } },
                max_tokens = maxTokens,
                temperature = 0.2
            };

            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return Result<TResponse>.Failure($"Claude API error ({response.StatusCode}): {responseContent}");
            }

            var node = JsonNode.Parse(responseContent);
            var stopReason = node?["stop_reason"]?.ToString();
            if (string.Equals(stopReason, "max_tokens", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Claude output was truncated due to token limit ({MaxTokens}).", maxTokens);
                return Result<TResponse>.Failure($"AI output was truncated due to exceeding maximum token limit ({maxTokens}).");
            }

            var content = node?["content"]?[0]?["text"]?.ToString();
            if (string.IsNullOrEmpty(content))
                return Result<TResponse>.Failure("Empty content returned from Claude.");

            var cleanedJson = CleanJsonFences(content);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            if (parsed == null)
                return Result<TResponse>.Failure("AI returned empty or null JSON.");

            return Result<TResponse>.Success(parsed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize JSON from Claude response");
            return Result<TResponse>.Failure($"Failed to parse AI output into required schema: {ex.Message}");
        }
    }

    public async Task<Result<string>> GenerateTextAsync(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:AnthropicApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<string>.Failure("Anthropic Claude API Key is not configured. Please configure it in Settings.");
        }

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "claude-3-5-sonnet-20241022";
        var maxTokens = int.TryParse(_config["AiSettings:MaxTokens"], out var mt) && mt > 0 ? mt : 8192;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
            request.Headers.Add("x-api-key", apiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");

            var body = new
            {
                model = model,
                system = systemPrompt,
                messages = new[] { new { role = "user", content = userPrompt } },
                max_tokens = maxTokens,
                temperature = 0.2
            };

            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return Result<string>.Failure($"Claude API error ({response.StatusCode}): {responseContent}");
            }

            var node = JsonNode.Parse(responseContent);
            var content = node?["content"]?[0]?["text"]?.ToString();
            return !string.IsNullOrEmpty(content) ? Result<string>.Success(content) : Result<string>.Failure("Empty content returned from Claude.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Claude generation error");
            return Result<string>.Failure($"Claude request failed: {ex.Message}");
        }
    }

    public async Task<Result<TResponse>> ParseDocumentBytesAsync<TResponse>(
        byte[] fileBytes,
        string mimeType,
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:AnthropicApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
            return Result<TResponse>.Failure("Anthropic Claude API Key is not configured. Please configure it in Settings.");

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "claude-3-5-sonnet-20241022";

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
            request.Headers.Add("x-api-key", apiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");

            var base64 = Convert.ToBase64String(fileBytes);
            var isPdf = mimeType.Contains("pdf", StringComparison.OrdinalIgnoreCase);
            var isImage = mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
            var isText = mimeType.StartsWith("text/", StringComparison.OrdinalIgnoreCase);

            if (!isPdf && !isImage && !isText)
            {
                return Result<TResponse>.Failure($"Claude does not support document MIME type '{mimeType}'.");
            }

            var contentList = new List<object>();
            if (isPdf)
            {
                contentList.Add(new
                {
                    type = "document",
                    source = new
                    {
                        type = "base64",
                        media_type = "application/pdf",
                        data = base64
                    }
                });
            }
            else if (isImage)
            {
                contentList.Add(new
                {
                    type = "image",
                    source = new
                    {
                        type = "base64",
                        media_type = mimeType,
                        data = base64
                    }
                });
            }
            else if (isText)
            {
                contentList.Add(new
                {
                    type = "text",
                    text = Encoding.UTF8.GetString(fileBytes)
                });
            }

            contentList.Add(new { type = "text", text = userPrompt });

            var body = new
            {
                model = model,
                system = systemPrompt + "\nIMPORTANT: Return ONLY raw JSON without markdown code fences.",
                messages = new[] { new { role = "user", content = contentList } },
                max_tokens = 8192,
                temperature = 0.1
            };

            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
                return Result<TResponse>.Failure($"Claude API error ({response.StatusCode}): {responseContent}");

            var node = JsonNode.Parse(responseContent);
            var rawText = node?["content"]?[0]?["text"]?.ToString();
            if (string.IsNullOrEmpty(rawText))
                return Result<TResponse>.Failure("Empty content returned from Claude.");

            var cleanedJson = CleanJsonFences(rawText);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            return parsed != null ? Result<TResponse>.Success(parsed) : Result<TResponse>.Failure("AI returned empty or null JSON.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Claude document parsing error");
            return Result<TResponse>.Failure($"Claude document parsing failed: {ex.Message}");
        }
    }

    private static string CleanJsonFences(string input)
    {
        var text = input.Trim();
        if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            text = text[7..];
        else if (text.StartsWith("```", StringComparison.OrdinalIgnoreCase))
            text = text[3..];

        if (text.EndsWith("```", StringComparison.OrdinalIgnoreCase))
            text = text[..^3];

        return text.Trim();
    }
}

public class GeminiProvider : IAiProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<GeminiProvider> _logger;
    private readonly IEncryptionService _encryptionService;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };

    public AiProviderType ProviderType => AiProviderType.Gemini;

    public GeminiProvider(HttpClient httpClient, IConfiguration config, ILogger<GeminiProvider> logger, IEncryptionService encryptionService)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
        _encryptionService = encryptionService;
    }

    public async Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:GeminiApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<TResponse>.Failure("Google Gemini API Key is not configured. Please configure it in Settings.");
        }

        var model = ResolveModelName(modelName);
        var maxTokens = int.TryParse(_config["AiSettings:MaxTokens"], out var mt) && mt > 0 ? mt : 16384;
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        var body = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt + "\nIMPORTANT: Return ONLY valid raw JSON matching the required schema without markdown code fences." } } },
            contents = new[] { new { parts = new[] { new { text = userPrompt } } } },
            generationConfig = CreateGenerationConfig(maxTokens, 0.2, true, model)
        };

        HttpResponseMessage? response = null;
        string? responseContent = null;

        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
                response = await _httpClient.SendAsync(request, cancellationToken);
                responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

                if (response.StatusCode == System.Net.HttpStatusCode.NotFound && !model.Contains("gemini-flash-lite-latest"))
                {
                    _logger.LogWarning("Gemini model '{Model}' returned 404 Not Found. Retrying with fallback model gemini-flash-lite-latest...", model);
                    model = "gemini-flash-lite-latest";
                    url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
                    body = new
                    {
                        system_instruction = new { parts = new[] { new { text = systemPrompt + "\nIMPORTANT: Return ONLY valid raw JSON matching the required schema without markdown code fences." } } },
                        contents = new[] { new { parts = new[] { new { text = userPrompt } } } },
                        generationConfig = CreateGenerationConfig(maxTokens, 0.2, true, model)
                    };
                    continue;
                }

                if ((response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable || (int)response.StatusCode == 429) && attempt < 3)
                {
                    _logger.LogWarning("Gemini API transient {StatusCode} on attempt {Attempt}. Retrying in {Delay}ms...", response.StatusCode, attempt, attempt * 1500);
                    await Task.Delay(attempt * 1500, cancellationToken);
                    continue;
                }

                break;
            }
            catch (Exception ex) when (attempt < 3 && !cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Gemini HTTP request exception on attempt {Attempt}. Retrying...", attempt);
                await Task.Delay(attempt * 1000, cancellationToken);
            }
        }

        if (response == null || !response.IsSuccessStatusCode)
        {
            return Result<TResponse>.Failure($"Gemini API error ({response?.StatusCode}): {responseContent}");
        }

        try
        {
            var node = JsonNode.Parse(responseContent!);
            var candidate = node?["candidates"]?[0];
            var finishReason = candidate?["finishReason"]?.ToString();

            if (string.Equals(finishReason, "MAX_TOKENS", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Gemini output was truncated due to token limit ({MaxTokens}).", maxTokens);
                return Result<TResponse>.Failure($"AI output was truncated due to exceeding maximum token limit ({maxTokens}).");
            }

            var content = candidate?["content"]?["parts"]?[0]?["text"]?.ToString();
            if (string.IsNullOrWhiteSpace(content))
                return Result<TResponse>.Failure("Empty content returned from Gemini.");

            var cleanedJson = CleanJsonFences(content);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            if (parsed == null)
                return Result<TResponse>.Failure("AI returned empty or null JSON.");

            return Result<TResponse>.Success(parsed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize JSON from Gemini response: {Response}", responseContent);
            return Result<TResponse>.Failure($"Failed to parse AI output into required schema: {ex.Message}");
        }
    }

    public async Task<Result<string>> GenerateTextAsync(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:GeminiApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<string>.Failure("Google Gemini API Key is not configured. Please configure it in Settings.");
        }

        var model = ResolveModelName(modelName);
        var maxTokens = int.TryParse(_config["AiSettings:MaxTokens"], out var mt) && mt > 0 ? mt : 16384;
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        var body = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = new[] { new { parts = new[] { new { text = userPrompt } } } },
            generationConfig = CreateGenerationConfig(maxTokens, 0.2, false, model)
        };

        HttpResponseMessage? response = null;
        string? responseContent = null;

        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
                response = await _httpClient.SendAsync(request, cancellationToken);
                responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

                if (response.StatusCode == System.Net.HttpStatusCode.NotFound && !model.Contains("gemini-flash-lite-latest"))
                {
                    _logger.LogWarning("Gemini model '{Model}' returned 404 Not Found. Retrying with fallback model gemini-flash-lite-latest...", model);
                    model = "gemini-flash-lite-latest";
                    url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
                    body = new
                    {
                        system_instruction = new { parts = new[] { new { text = systemPrompt } } },
                        contents = new[] { new { parts = new[] { new { text = userPrompt } } } },
                        generationConfig = CreateGenerationConfig(maxTokens, 0.2, false, model)
                    };
                    continue;
                }

                if ((response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable || (int)response.StatusCode == 429) && attempt < 3)
                {
                    _logger.LogWarning("Gemini API transient {StatusCode} on attempt {Attempt}. Retrying in {Delay}ms...", response.StatusCode, attempt, attempt * 1500);
                    await Task.Delay(attempt * 1500, cancellationToken);
                    continue;
                }

                break;
            }
            catch (Exception ex) when (attempt < 3 && !cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Gemini HTTP request exception on attempt {Attempt}. Retrying...", attempt);
                await Task.Delay(attempt * 1000, cancellationToken);
            }
        }

        if (response == null || !response.IsSuccessStatusCode)
        {
            return Result<string>.Failure($"Gemini API error ({response?.StatusCode}): {responseContent}");
        }

        var node = JsonNode.Parse(responseContent!);
        var candidate = node?["candidates"]?[0];
        var finishReason = candidate?["finishReason"]?.ToString();
        if (string.Equals(finishReason, "MAX_TOKENS", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Gemini text output was truncated due to token limit ({MaxTokens}).", maxTokens);
        }

        var content = candidate?["content"]?["parts"]?[0]?["text"]?.ToString();
        return !string.IsNullOrEmpty(content) ? Result<string>.Success(content) : Result<string>.Failure("Empty content returned from Gemini.");
    }

    public async Task<Result<TResponse>> ParseDocumentBytesAsync<TResponse>(
        byte[] fileBytes,
        string mimeType,
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:GeminiApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;

        if (string.IsNullOrWhiteSpace(apiKey))
            return Result<TResponse>.Failure("Google Gemini API Key is not configured. Please configure it in Settings.");

        var model = ResolveModelName(modelName);
        var maxTokens = int.TryParse(_config["AiSettings:MaxTokens"], out var mt) && mt > 0 ? mt : 16384;
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        try
        {
            var base64 = Convert.ToBase64String(fileBytes);
            var resolvedMime = mimeType.Contains("pdf", StringComparison.OrdinalIgnoreCase) ? "application/pdf" : mimeType;

            var body = new
            {
                system_instruction = new { parts = new[] { new { text = systemPrompt + "\nIMPORTANT: Return ONLY valid raw JSON matching the required schema without markdown code fences." } } },
                contents = new[]
                {
                    new
                    {
                        parts = new object[]
                        {
                            new
                            {
                                inline_data = new
                                {
                                    mime_type = resolvedMime,
                                    data = base64
                                }
                            },
                            new
                            {
                                text = userPrompt
                            }
                        }
                    }
                },
                generationConfig = CreateGenerationConfig(maxTokens, 0.1, true, model)
            };

            HttpResponseMessage? response = null;
            string? responseContent = null;

            for (var attempt = 1; attempt <= 3; attempt++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
                response = await _httpClient.SendAsync(request, cancellationToken);
                responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

                if (response.StatusCode == System.Net.HttpStatusCode.NotFound && !model.Contains("gemini-flash-lite-latest"))
                {
                    _logger.LogWarning("Gemini document parse model '{Model}' returned 404 Not Found. Retrying with fallback model gemini-flash-lite-latest...", model);
                    model = "gemini-flash-lite-latest";
                    url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
                    continue;
                }

                if ((response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable || (int)response.StatusCode == 429) && attempt < 3)
                {
                    _logger.LogWarning("Gemini document parse transient {StatusCode} on attempt {Attempt}. Retrying...", response.StatusCode, attempt);
                    await Task.Delay(attempt * 1500, cancellationToken);
                    continue;
                }

                break;
            }

            if (response == null || !response.IsSuccessStatusCode)
                return Result<TResponse>.Failure($"Gemini API error ({response?.StatusCode}): {responseContent}");

            var node = JsonNode.Parse(responseContent!);
            var rawText = node?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.ToString();
            if (string.IsNullOrEmpty(rawText))
                return Result<TResponse>.Failure("Empty content returned from Gemini visual document parser.");

            var cleanedJson = CleanJsonFences(rawText);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            return parsed != null ? Result<TResponse>.Success(parsed) : Result<TResponse>.Failure("AI returned empty or null JSON from document analysis.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini multimodal document parsing error");
            return Result<TResponse>.Failure($"Gemini visual document parsing failed: {ex.Message}");
        }
    }

    private static object CreateGenerationConfig(int maxTokens, double temperature, bool isJson, string model)
    {
        var isThinkingModel = model.Contains("-2.5-flash", StringComparison.OrdinalIgnoreCase) || 
                              model.Contains("-pro", StringComparison.OrdinalIgnoreCase);

        if (isJson)
        {
            if (isThinkingModel)
            {
                return new
                {
                    temperature = temperature,
                    maxOutputTokens = maxTokens,
                    responseMimeType = "application/json",
                    thinkingConfig = new { thinkingBudget = 0 }
                };
            }
            return new
            {
                temperature = temperature,
                maxOutputTokens = maxTokens,
                responseMimeType = "application/json"
            };
        }

        if (isThinkingModel)
        {
            return new
            {
                temperature = temperature,
                maxOutputTokens = maxTokens,
                thinkingConfig = new { thinkingBudget = 0 }
            };
        }

        return new
        {
            temperature = temperature,
            maxOutputTokens = maxTokens
        };
    }

    private static string CleanJsonFences(string input)
    {
        var text = input.Trim();
        if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            text = text[7..];
        else if (text.StartsWith("```", StringComparison.OrdinalIgnoreCase))
            text = text[3..];

        if (text.EndsWith("```", StringComparison.OrdinalIgnoreCase))
            text = text[..^3];

        return text.Trim();
    }

    private static string ResolveModelName(string? modelName)
    {
        if (string.IsNullOrWhiteSpace(modelName))
            return "gemini-flash-lite-latest";

        var clean = modelName.Trim();
        if (string.Equals(clean, "gemini-3.6-flash", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-2.0-flash", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-1.5-flash", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-3.8-flash", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-2.5-flash-lite", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "flash lite latest", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "flash-lite-latest", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-flash-lite", StringComparison.OrdinalIgnoreCase))
            return "gemini-flash-lite-latest";

        return clean;
    }
}

public class ResilientAiProviderDecorator : IAiProvider
{
    private readonly IAiProvider _primaryProvider;
    private readonly IEnumerable<IAiProvider> _allProviders;
    private readonly ILogger<ResilientAiProviderDecorator> _logger;

    public AiProviderType ProviderType => _primaryProvider.ProviderType;

    public ResilientAiProviderDecorator(
        IAiProvider primaryProvider,
        IEnumerable<IAiProvider> allProviders,
        ILogger<ResilientAiProviderDecorator> logger)
    {
        _primaryProvider = primaryProvider;
        _allProviders = allProviders;
        _logger = logger;
    }

    public async Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        // 1. Try Primary Provider
        var result = await _primaryProvider.GenerateStructuredJsonAsync<TResponse>(systemPrompt, userPrompt, customApiKey, modelName, cancellationToken);
        if (result.IsSuccess || !IsTransientOrQuotaError(result.Error))
            return result;

        _logger.LogWarning("Primary AI provider {Provider} returned transient/quota error: {Error}. Initiating fallback chain...", _primaryProvider.ProviderType, result.Error);

        // 2. Iterate Fallback Providers
        var fallbacks = _allProviders.Where(p => p.ProviderType != _primaryProvider.ProviderType).ToList();
        foreach (var fallback in fallbacks)
        {
            _logger.LogInformation("Attempting AI fallback to {FallbackProvider}...", fallback.ProviderType);
            var fallbackResult = await fallback.GenerateStructuredJsonAsync<TResponse>(systemPrompt, userPrompt, null, null, cancellationToken);
            if (fallbackResult.IsSuccess)
            {
                _logger.LogInformation("Successfully recovered using fallback provider {FallbackProvider}.", fallback.ProviderType);
                return fallbackResult;
            }
        }

        return result;
    }

    public async Task<Result<string>> GenerateTextAsync(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        // 1. Try Primary Provider
        var result = await _primaryProvider.GenerateTextAsync(systemPrompt, userPrompt, customApiKey, modelName, cancellationToken);
        if (result.IsSuccess || !IsTransientOrQuotaError(result.Error))
            return result;

        _logger.LogWarning("Primary AI provider {Provider} failed: {Error}. Initiating fallback...", _primaryProvider.ProviderType, result.Error);

        // 2. Iterate Fallbacks
        var fallbacks = _allProviders.Where(p => p.ProviderType != _primaryProvider.ProviderType).ToList();
        foreach (var fallback in fallbacks)
        {
            _logger.LogInformation("Attempting fallback text generation via {FallbackProvider}...", fallback.ProviderType);
            var fallbackResult = await fallback.GenerateTextAsync(systemPrompt, userPrompt, null, null, cancellationToken);
            if (fallbackResult.IsSuccess)
            {
                return fallbackResult;
            }
        }

        return result;
    }

    public async Task<Result<TResponse>> ParseDocumentBytesAsync<TResponse>(
        byte[] fileBytes,
        string mimeType,
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        // 1. Try Primary Provider
        var result = await _primaryProvider.ParseDocumentBytesAsync<TResponse>(fileBytes, mimeType, systemPrompt, userPrompt, customApiKey, modelName, cancellationToken);
        if (result.IsSuccess)
            return result;

        _logger.LogWarning("Primary AI provider {Provider} failed multimodal document parsing: {Error}. Initiating fallback...", _primaryProvider.ProviderType, result.Error);

        // 2. Iterate Fallback Providers
        var fallbacks = _allProviders.Where(p => p.ProviderType != _primaryProvider.ProviderType).ToList();
        foreach (var fallback in fallbacks)
        {
            _logger.LogInformation("Attempting fallback multimodal document parsing via {FallbackProvider}...", fallback.ProviderType);
            var fallbackResult = await fallback.ParseDocumentBytesAsync<TResponse>(fileBytes, mimeType, systemPrompt, userPrompt, null, null, cancellationToken);
            if (fallbackResult.IsSuccess)
            {
                _logger.LogInformation("Successfully parsed document using fallback provider {FallbackProvider}.", fallback.ProviderType);
                return fallbackResult;
            }
        }

        return result;
    }

    private static bool IsTransientOrQuotaError(string? error)
    {
        if (string.IsNullOrWhiteSpace(error)) return false;
        var lower = error.ToLowerInvariant();
        return lower.Contains("429") || lower.Contains("quota") || lower.Contains("rate limit") ||
               lower.Contains("resource exhausted") || lower.Contains("503") || lower.Contains("500") ||
               lower.Contains("502") || lower.Contains("504") || lower.Contains("overloaded") ||
               lower.Contains("not configured") || lower.Contains("401") || lower.Contains("404") ||
               lower.Contains("unauthorized") || lower.Contains("forbidden") || lower.Contains("timeout");
    }
}

public class AiServiceFactory : IAiServiceFactory
{
    private readonly IEnumerable<IAiProvider> _providers;
    private readonly IConfiguration _config;
    private readonly ILoggerFactory _loggerFactory;

    public AiServiceFactory(IEnumerable<IAiProvider> providers, IConfiguration config, ILoggerFactory loggerFactory)
    {
        _providers = providers;
        _config = config;
        _loggerFactory = loggerFactory;
    }

    public IAiProvider GetProvider(AiProviderType providerType)
    {
        var provider = _providers.FirstOrDefault(p => p.ProviderType == providerType);
        if (provider == null)
            throw new InvalidOperationException($"AI Provider '{providerType}' is not registered.");

        var logger = _loggerFactory.CreateLogger<ResilientAiProviderDecorator>();
        return new ResilientAiProviderDecorator(provider, _providers, logger);
    }

    public IAiProvider GetDefaultProvider()
    {
        var defaultSetting = _config["AiSettings:DefaultProvider"] ?? "Gemini";
        var parsedType = Enum.TryParse<AiProviderType>(defaultSetting, true, out var prov) ? prov : AiProviderType.Gemini;
        return GetProvider(parsedType);
    }
}
