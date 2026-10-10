using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;

namespace ResumeTailor.Infrastructure.Aksh;

/// <summary>Measured provider usage for one Gemini call (usageMetadata).</summary>
public sealed record GeminiUsage(string? Model, int PromptTokens, int CompletionTokens);

/// <summary>
/// Native Gemini function-calling bridge (ADR-006 flaw-fix): translates MEAI
/// <see cref="ChatOptions"/> tools into Gemini <c>functionDeclarations</c>,
/// forwards full history (user/model/function parts), and translates returned
/// <c>functionCall</c> parts into <see cref="FunctionCallContent"/> so the MAF
/// harness ReAct loop can actually execute tools. Anything this client cannot
/// express degrades to the text path in <see cref="AkshChatClientAdapter"/>.
/// </summary>
public class GeminiFunctionCallingClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<GeminiFunctionCallingClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public GeminiFunctionCallingClient(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        IEncryptionService encryptionService,
        ILogger<GeminiFunctionCallingClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    /// <summary>
    /// Measured usage of the most recent call (null when the response carried
    /// no usageMetadata). Consumers record actuals OR estimates, never both.
    /// </summary>
    public GeminiUsage? LastUsage { get; private set; }

    public async Task<Result<ChatMessage>> GenerateWithToolsAsync(
        IList<ChatMessage> messages,
        ChatOptions? options,
        string? customApiKey = null,
        string? modelName = null,
        CancellationToken cancellationToken = default)
    {
        var rawKey = !string.IsNullOrWhiteSpace(customApiKey) ? customApiKey : _config["AiSettings:GeminiApiKey"];
        var apiKey = _encryptionService.Decrypt(rawKey) ?? rawKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Result<ChatMessage>.Failure("Google Gemini API Key is not configured.");
        }

        var model = ResolveModelName(modelName);
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        var systemText = options?.Instructions ?? string.Empty;
        var systemExtras = messages
            .Where(m => m.Role == ChatRole.System)
            .SelectMany(m => m.Contents.OfType<TextContent>())
            .Select(t => t.Text);
        var fullSystem = string.Join("\n", new[] { systemText }.Concat(systemExtras)).Trim();

        var contents = new List<object>();
        foreach (var message in messages.Where(m => m.Role != ChatRole.System))
        {
            var parts = new List<object>();
            string? role = message.Role == ChatRole.Assistant ? "model" : "user";

            foreach (var content in message.Contents)
            {
                switch (content)
                {
                    case TextContent text when !string.IsNullOrWhiteSpace(text.Text):
                        parts.Add(new { text = text.Text });
                        break;
                    case FunctionCallContent call:
                        role = "model";
                        // Echo API-issued ids only (see parse site): synthetic
                        // local_* ids are never sent — the key is omitted, not null.
                        var callDict = new Dictionary<string, object?>
                        {
                            ["name"] = call.Name,
                            ["args"] = ToJsonNode(call.Arguments),
                        };
                        if (!string.IsNullOrWhiteSpace(call.CallId)
                            && !call.CallId.StartsWith("local_", StringComparison.Ordinal))
                        {
                            callDict["id"] = call.CallId;
                        }
                        parts.Add(new { functionCall = callDict });
                        break;
                    case FunctionResultContent result:
                        role = "user";
                        var responseDict = new Dictionary<string, object?>
                        {
                            ["name"] = ResolveResultName(messages, result),
                            ["response"] = new { result = ToJsonNode(result.Result) },
                        };
                        if (!string.IsNullOrWhiteSpace(result.CallId)
                            && !result.CallId.StartsWith("local_", StringComparison.Ordinal))
                        {
                            responseDict["id"] = result.CallId;
                        }
                        parts.Add(new { functionResponse = responseDict });
                        break;
                }
            }

            if (parts.Count > 0)
            {
                contents.Add(new { role, parts });
            }
        }

        if (contents.Count == 0)
        {
            return Result<ChatMessage>.Failure("No mappable message content for function-calling request.");
        }

        var declarations = (options?.Tools?.OfType<AIFunction>() ?? Enumerable.Empty<AIFunction>())
            .Where(t => !string.IsNullOrWhiteSpace(t.Name))
            .Select(t => new
            {
                name = t.Name,
                description = Truncate(t.Description ?? t.Name, 500),
                parameters = JsonNode.Parse(t.JsonSchema.GetRawText()),
            })
            .ToList();

        var bodyDict = new Dictionary<string, object?>
        {
            ["system_instruction"] = new { parts = new[] { new { text = fullSystem } } },
            ["contents"] = contents,
            ["generationConfig"] = new
            {
                temperature = options?.Temperature ?? 0.2f,
                maxOutputTokens = 8192,
                // Thinking traces would require echoing thoughtSignatures on the
                // next turn; tool-routing reasoning runs without them by design.
                thinkingConfig = new { thinkingBudget = 0 },
            },
        };

        if (declarations.Count > 0)
        {
            bodyDict["tools"] = new[] { new { functionDeclarations = declarations } };
        }

        var body = bodyDict;

        var httpClient = _httpClientFactory.CreateClient();

        // Fresh usage per call: never let a previous turn's numbers leak in.
        LastUsage = null;

        // Rounds: 0 = initial attempt, 1 = single retry after a tool-loop
        // glitch (UNEXPECTED_TOOL_CALL / MALFORMED_FUNCTION_CALL with empty
        // content — known transient flash-lite behavior). Bounded: never loops.
        for (var round = 0; round < 2; round++)
        {
            HttpResponseMessage? response = null;
            string? responseContent = null;
            for (var attempt = 1; attempt <= 2; attempt++)
            {
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, url);
                    request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
                    response = await httpClient.SendAsync(request, cancellationToken);
                    responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

                    if (response.StatusCode == HttpStatusCode.NotFound && model != "gemini-flash-lite-latest")
                    {
                        model = "gemini-flash-lite-latest";
                        url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
                        continue;
                    }

                    if ((response.StatusCode == HttpStatusCode.ServiceUnavailable || (int)response.StatusCode == 429) && attempt < 2)
                    {
                        await Task.Delay(attempt * 1500, cancellationToken);
                        continue;
                    }

                    break;
                }
                catch (Exception ex) when (attempt < 2 && !cancellationToken.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "Gemini function-calling request failed on attempt {Attempt}; retrying.", attempt);
                    await Task.Delay(attempt * 1000, cancellationToken);
                }
            }

            if (response == null || !response.IsSuccessStatusCode)
            {
                return Result<ChatMessage>.Failure($"Gemini API error ({response?.StatusCode}): {Truncate(responseContent ?? string.Empty, 300)}");
            }

        try
        {
            var node = JsonNode.Parse(responseContent!);
            var firstCandidate = node?["candidates"]?[0];
            var finishReason = firstCandidate?["finishReason"]?.ToString();
            var blockReason = node?["promptFeedback"]?["blockReason"]?.ToString();
            LastUsage = ReadUsage(node, model);
            var parts = firstCandidate?["content"]?["parts"]?.AsArray();
                if (parts == null || parts.Count == 0)
                {
                    // STOP with no parts and no safety signal is benign (terse turn),
                    // not an error: hand the harness an empty assistant message so the
                    // ReAct loop continues off deterministic receipts. Blocks fail.
                    if (string.IsNullOrWhiteSpace(blockReason)
                        && (string.IsNullOrWhiteSpace(finishReason)
                            || string.Equals(finishReason, "STOP", StringComparison.OrdinalIgnoreCase)))
                    {
                        _logger.LogInformation("Gemini function-calling path returned no parts with a benign finish (finishReason={FinishReason}); continuing with empty turn.", finishReason);
                        return Result<ChatMessage>.Success(new ChatMessage(ChatRole.Assistant, new List<AIContent> { new TextContent(string.Empty) }));
                    }

                    if (round == 0 && IsToolLoopGlitch(blockReason, finishReason))
                    {
                        _logger.LogWarning("Gemini function-calling tool-loop glitch (finishReason={FinishReason}); retrying once.", finishReason);
                        await Task.Delay(1500, cancellationToken);
                        continue;
                    }

                    return Result<ChatMessage>.Failure(
                        string.IsNullOrWhiteSpace(blockReason)
                            ? IsToolLoopGlitch(blockReason, finishReason)
                                ? $"Gemini hit a transient tool-loop glitch (finishReason={finishReason ?? "unknown"}) and returned no content, even after retry. Please send your message again."
                                : $"Empty content returned from Gemini (finishReason={finishReason ?? "unknown"})."
                            : $"Gemini blocked the prompt (safety filter: {blockReason}).");
                }

                var contents_out = new List<AIContent>();
                foreach (var part in parts)
                {
                    // Thought-flagged parts are internal reasoning: never surface them
                    // as narration, and never mistake them for an empty turn.
                    if (string.Equals(part?["thought"]?.ToString(), "true", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var text = part?["text"]?.ToString();
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        contents_out.Add(new TextContent(text));
                        continue;
                    }

                var call = part?["functionCall"];
                if (call != null)
                {
                    var name = call["name"]?.ToString() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(name))
                    {
                        continue;
                    }

                    // API-issued ids ride verbatim as our CallId so the matching
                    // functionResponse echoes the exact id (Gemini 3 requirement).
                    // Synthetic ids are prefixed and NEVER echoed: sending an id
                    // the API never issued risks confusing strict models.
                    var apiId = call["id"]?.ToString();
                    var callId = !string.IsNullOrWhiteSpace(apiId)
                        ? apiId!
                        : $"local_{Guid.NewGuid():N}";

                    var args = new Dictionary<string, object?>();
                    if (call["args"] is JsonObject argsObj)
                    {
                        using var rawDoc = JsonDocument.Parse(argsObj.ToJsonString());
                        foreach (var prop in rawDoc.RootElement.EnumerateObject())
                        {
                            args[prop.Name] = prop.Value.ValueKind switch
                            {
                                JsonValueKind.String => prop.Value.GetString(),
                                JsonValueKind.Number when prop.Value.TryGetInt64(out var l) => l,
                                JsonValueKind.Number => prop.Value.GetDouble(),
                                JsonValueKind.True => true,
                                JsonValueKind.False => false,
                                JsonValueKind.Null => null,
                                _ => prop.Value.Clone()
                            };
                        }
                    }

                    contents_out.Add(new FunctionCallContent(callId, name, args));
                }
                }

                if (contents_out.Count == 0)
                {
                    // Thought-only turns collapse to the same benign empty outcome.
                    if (string.IsNullOrWhiteSpace(blockReason)
                        && (string.IsNullOrWhiteSpace(finishReason)
                            || string.Equals(finishReason, "STOP", StringComparison.OrdinalIgnoreCase)))
                    {
                        return Result<ChatMessage>.Success(new ChatMessage(ChatRole.Assistant, new List<AIContent> { new TextContent(string.Empty) }));
                    }

                    if (round == 0 && IsToolLoopGlitch(blockReason, finishReason))
                    {
                        _logger.LogWarning("Gemini function-calling tool-loop glitch with no usable parts (finishReason={FinishReason}); retrying once.", finishReason);
                        await Task.Delay(1500, cancellationToken);
                        continue;
                    }

                    return Result<ChatMessage>.Failure("Gemini returned no usable text or function calls.");
                }

                return Result<ChatMessage>.Success(new ChatMessage(ChatRole.Assistant, contents_out));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse Gemini function-calling response.");
                return Result<ChatMessage>.Failure($"Failed to parse Gemini response: {ex.Message}");
            }
            }

        return Result<ChatMessage>.Failure("Gemini returned no usable text or function calls after retry.");
    }

    private static bool IsToolLoopGlitch(string? blockReason, string? finishReason)
    {
        if (!string.IsNullOrWhiteSpace(blockReason))
            return false;

        return string.Equals(finishReason, "UNEXPECTED_TOOL_CALL", StringComparison.OrdinalIgnoreCase)
            || string.Equals(finishReason, "MALFORMED_FUNCTION_CALL", StringComparison.OrdinalIgnoreCase);
    }

    private static GeminiUsage? ReadUsage(JsonNode? root, string model)
    {
        try
        {
            var meta = root?["usageMetadata"];
            if (meta == null)
            {
                return null;
            }

            static int Count(JsonNode? parent, string name)
                => parent?[name] != null && int.TryParse(parent[name]!.ToString(), out var v) && v >= 0 ? v : 0;

            var prompt = Count(meta, "promptTokenCount");
            var completion = Count(meta, "candidatesTokenCount");
            if (prompt == 0 && completion == 0)
            {
                return null;
            }

            return new GeminiUsage(model, prompt, completion);
        }
        catch
        {
            return null;
        }
    }

    private static string ResolveResultName(IList<ChatMessage> messages, FunctionResultContent result)
    {
        foreach (var message in messages)
        {
            foreach (var content in message.Contents.OfType<FunctionCallContent>())
            {
                if (string.Equals(content.CallId, result.CallId, StringComparison.Ordinal))
                {
                    return content.Name;
                }
            }
        }

        return "unknown_tool";
    }

    private static JsonNode? ToJsonNode(object? value)
    {
        if (value == null)
        {
            return null;
        }

        if (value is JsonNode node)
        {
            return node.DeepClone();
        }

        if (value is JsonElement element)
        {
            return JsonNode.Parse(element.GetRawText());
        }

        return JsonSerializer.SerializeToNode(value, JsonOptions);
    }

    private static string Truncate(string value, int maxLength)
        => string.IsNullOrEmpty(value) || value.Length <= maxLength ? value ?? string.Empty : value[..maxLength];

    private static string ResolveModelName(string? modelName)
    {
        if (string.IsNullOrWhiteSpace(modelName))
        {
            return "gemini-flash-lite-latest";
        }

        var clean = modelName.Trim();
        if (string.Equals(clean, "gemini-2.0-flash", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-1.5-flash", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-3.8-flash", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-3.6-flash", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-2.5-flash-lite", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "flash-lite-latest", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(clean, "gemini-flash-lite", StringComparison.OrdinalIgnoreCase))
        {
            return "gemini-flash-lite-latest";
        }

        return clean;
    }
}
