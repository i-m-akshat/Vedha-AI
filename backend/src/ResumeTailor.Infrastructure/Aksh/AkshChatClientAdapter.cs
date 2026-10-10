using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Infrastructure.Aksh;

/// <summary>
/// Bridges Vedha's existing <see cref="IAiProvider"/> stack to
/// <see cref="IChatClient"/> so Microsoft Agent Framework agents can reason over it.
/// Singleton-safe: resolves the scoped AI factory per call. No new model plumbing.
/// Per-user credentials (the Settings keys users set themselves) flow through
/// <see cref="WithCredentials"/> — the adapter never stores keys, only carries the
/// caller's stored values down to the provider, which decrypts them as usual.
/// </summary>
public sealed class AkshChatClientAdapter : IChatClient
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<AkshChatClientAdapter>? _logger;

    public AkshChatClientAdapter(IServiceScopeFactory scopes, ILogger<AkshChatClientAdapter>? logger = null)
    {
        _scopes = scopes;
        _logger = logger;
    }

    private AiProviderType? ProviderType { get; init; }
    private string? CustomApiKey { get; init; }
    private string? ModelName { get; init; }

    /// <summary>
    /// Returns a client bound to the given user's provider, stored API key, and model.
    /// Nulls fall back to global defaults, preserving the no-key-configured behavior.
    /// </summary>
    public AkshChatClientAdapter WithCredentials(AiProviderType? providerType, string? customApiKey, string? modelName)
        => new(_scopes, _logger)
        {
            ProviderType = providerType,
            CustomApiKey = customApiKey,
            ModelName = modelName,
        };

    public object? GetService(Type serviceType, object? serviceKey = null)
        => serviceKey is null && serviceType.IsInstanceOfType(this) ? this : null;

    public async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var list = messages.ToList();

        // Native function calling (Gemini): forward tool declarations so the model
        // can emit FunctionCallContent and the harness ReAct loop executes tools.
        var toolsRequested = options?.Tools?.OfType<AIFunction>().Any() == true
            && (ProviderType is null || ProviderType == AiProviderType.Gemini);
        if (toolsRequested)
        {
            try
            {
                using var toolScope = _scopes.CreateScope();
                var functionClient = toolScope.ServiceProvider.GetRequiredService<GeminiFunctionCallingClient>();
                var toolResult = await functionClient.GenerateWithToolsAsync(
                    list, options, CustomApiKey, ModelName, cancellationToken);
                if (toolResult.IsSuccess && toolResult.Value != null)
                {
                    return new ChatResponse(toolResult.Value);
                }

                _logger?.LogWarning("Gemini function-calling path failed ({Error}); no silent text fallback for tool-bound turns.", toolResult.Error);
                throw new AkshModelException("function_calling_unavailable",
                    toolResult.Error ?? "Function calling failed.");
            }
            catch (AkshModelException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Gemini function-calling path threw on a tool-bound turn.");
                throw new AkshModelException("function_calling_unavailable", ex.Message);
            }
        }

        var system = string.Join("\n", list
            .Where(m => m.Role == ChatRole.System)
            .SelectMany(m => m.Contents.OfType<TextContent>())
            .Select(t => t.Text));
        var userMessage = list.LastOrDefault(m => m.Role == ChatRole.User);
        var userText = userMessage is null
            ? string.Empty
            : string.Join("\n", userMessage.Contents.OfType<TextContent>().Select(t => t.Text));

        using var scope = _scopes.CreateScope();
        var factory = scope.ServiceProvider.GetRequiredService<IAiServiceFactory>();
        var provider = ProviderType.HasValue
            ? factory.GetProvider(ProviderType.Value)
            : factory.GetDefaultProvider();
        var result = await provider.GenerateTextAsync(
            string.IsNullOrWhiteSpace(system) ? AkshPrompts.Core : system,
            userText,
            CustomApiKey,
            ModelName,
            cancellationToken);

        // Fail closed: a provider failure is a harness-visible FAILURE, never
        // chat text. The old apology-as-ChatResponse let the ReAct loop chain
        // grounded tool work onto an ungrounded apology with receipts that
        // looked complete. The runner maps AkshModelException to an error
        // event + parked session + released turn lock.
        if (!result.IsSuccess)
        {
            throw new AkshModelException("model_unavailable", result.Error ?? "AI provider failed.");
        }

        // A benign empty turn (model emitted nothing, no block) is NOT an
        // error: state a fact so the UI never shows an empty bubble.
        var text = string.IsNullOrWhiteSpace(result.Value)
            ? "(The model returned no visible text for this turn — the run state below is current. Send a message to continue.)"
            : result.Value!;
        return new ChatResponse(new ChatMessage(ChatRole.Assistant, text));
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var response = await GetResponseAsync(messages, options, cancellationToken);
        foreach (var message in response.Messages)
        {
            yield return new ChatResponseUpdate(message.Role, message.Contents);
        }
    }

    public void Dispose()
    {
    }
}
