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
    public string DefaultModel { get; set; } = "gemini-2.0-flash";
}

public class OpenAiProvider : IAiProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<OpenAiProvider> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };

    public AiProviderType ProviderType => AiProviderType.OpenAi;

    public OpenAiProvider(HttpClient httpClient, IConfiguration config, ILogger<OpenAiProvider> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
    }

    public async Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var textResult = await GenerateTextAsync(systemPrompt + "\nIMPORTANT: Return ONLY raw JSON without markdown code fences.", userPrompt, customApiKey, modelName, cancellationToken);
        if (textResult.IsFailure)
            return Result<TResponse>.Failure(textResult.Error!);

        try
        {
            var cleanedJson = CleanJsonFences(textResult.Value);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            if (parsed == null)
                return Result<TResponse>.Failure("AI returned empty or null JSON.");

            return Result<TResponse>.Success(parsed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize JSON from OpenAI response: {Response}", textResult.Value);
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
        var apiKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:OpenAiApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<string>.Failure("OpenAI API Key is not configured. Please configure it in Settings.");
        }

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "gpt-4o-mini";

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
                temperature = 0.2
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

public class ClaudeProvider : IAiProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<ClaudeProvider> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };

    public AiProviderType ProviderType => AiProviderType.Claude;

    public ClaudeProvider(HttpClient httpClient, IConfiguration config, ILogger<ClaudeProvider> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
    }

    public async Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var textResult = await GenerateTextAsync(systemPrompt + "\nIMPORTANT: Return ONLY raw JSON without markdown code fences.", userPrompt, customApiKey, modelName, cancellationToken);
        if (textResult.IsFailure)
            return Result<TResponse>.Failure(textResult.Error!);

        try
        {
            var cleanedJson = CleanJsonFences(textResult.Value);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            if (parsed == null)
                return Result<TResponse>.Failure("AI returned empty or null JSON.");

            return Result<TResponse>.Success(parsed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize JSON from Claude response: {Response}", textResult.Value);
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
        var apiKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:AnthropicApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<string>.Failure("Anthropic Claude API Key is not configured. Please configure it in Settings.");
        }

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "claude-3-5-sonnet-20241022";

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
                max_tokens = 4096,
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
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };

    public AiProviderType ProviderType => AiProviderType.Gemini;

    public GeminiProvider(HttpClient httpClient, IConfiguration config, ILogger<GeminiProvider> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
    }

    public async Task<Result<TResponse>> GenerateStructuredJsonAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var textResult = await GenerateTextAsync(systemPrompt + "\nIMPORTANT: Return ONLY raw JSON without markdown code fences.", userPrompt, customApiKey, modelName, cancellationToken);
        if (textResult.IsFailure)
            return Result<TResponse>.Failure(textResult.Error!);

        try
        {
            var cleanedJson = CleanJsonFences(textResult.Value);
            var parsed = JsonSerializer.Deserialize<TResponse>(cleanedJson, JsonOptions);
            if (parsed == null)
                return Result<TResponse>.Failure("AI returned empty or null JSON.");

            return Result<TResponse>.Success(parsed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize JSON from Gemini response: {Response}", textResult.Value);
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
        var apiKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:GeminiApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<string>.Failure("Google Gemini API Key is not configured. Please configure it in Settings.");
        }

        var model = !string.IsNullOrWhiteSpace(modelName) ? modelName : "gemini-2.0-flash";
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            var body = new
            {
                system_instruction = new { parts = new[] { new { text = systemPrompt } } },
                contents = new[] { new { parts = new[] { new { text = userPrompt } } } },
                generationConfig = new
                {
                    temperature = 0.2,
                    maxOutputTokens = 4096
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return Result<string>.Failure($"Gemini API error ({response.StatusCode}): {responseContent}");
            }

            var node = JsonNode.Parse(responseContent);
            var content = node?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.ToString();
            return !string.IsNullOrEmpty(content) ? Result<string>.Success(content) : Result<string>.Failure("Empty content returned from Gemini.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini generation error");
            return Result<string>.Failure($"Gemini request failed: {ex.Message}");
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

public class AiServiceFactory : IAiServiceFactory
{
    private readonly IEnumerable<IAiProvider> _providers;
    private readonly IConfiguration _config;

    public AiServiceFactory(IEnumerable<IAiProvider> providers, IConfiguration config)
    {
        _providers = providers;
        _config = config;
    }

    public IAiProvider GetProvider(AiProviderType providerType)
    {
        var provider = _providers.FirstOrDefault(p => p.ProviderType == providerType);
        return provider ?? throw new InvalidOperationException($"AI Provider '{providerType}' is not registered.");
    }

    public IAiProvider GetDefaultProvider()
    {
        var defaultSetting = _config["AiSettings:DefaultProvider"] ?? "Gemini";
        var parsedType = Enum.TryParse<AiProviderType>(defaultSetting, true, out var prov) ? prov : AiProviderType.Gemini;
        return GetProvider(parsedType);
    }
}
