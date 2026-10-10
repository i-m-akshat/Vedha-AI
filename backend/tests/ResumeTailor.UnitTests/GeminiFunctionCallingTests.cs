using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Infrastructure.Aksh;
using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// The harness ReAct loop only runs when the model emits FunctionCallContent.
/// These tests prove the Gemini wire mapping both directions without a network key.
/// </summary>
public class GeminiFunctionCallingTests
{
    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Queue<string> _responses;
        public string? LastRequestBody { get; private set; }
        public string? LastRequestUrl { get; private set; }
        public int RequestCount { get; private set; }

        public StubHandler(string json) : this(new[] { json }) { }

        public StubHandler(IEnumerable<string> sequence) => _responses = new Queue<string>(sequence);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            LastRequestUrl = request.RequestUri?.ToString();
            if (request.Content != null)
            {
                LastRequestBody = await request.Content.ReadAsStringAsync(cancellationToken);
            }

            var json = _responses.Count > 1 ? _responses.Dequeue() : _responses.Peek();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }
    }

    private static GeminiFunctionCallingClient CreateClient(StubHandler handler)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AiSettings:GeminiApiKey"] = "test-key" })
            .Build();
        var encryption = new Mock<IEncryptionService>();
        encryption.Setup(e => e.Decrypt(It.IsAny<string?>())).Returns((string?)null);
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient(handler));
        return new GeminiFunctionCallingClient(
            factory.Object, config, encryption.Object, Mock.Of<ILogger<GeminiFunctionCallingClient>>());
    }

    private static AIFunction RecallTool() => AIFunctionFactory.Create(
        (Func<string, string>)((string query) => "answer"),
        "recall_memory",
        "Recall stored screening answers.");

    [Fact]
    public async Task Maps_FunctionCall_Response_To_FunctionCallContent()
    {
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {"name": "recall_memory", "args": {"query": "visa sponsorship"}}}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);
        var options = new ChatOptions
        {
            Instructions = "test",
            Tools = new List<AITool> { RecallTool() },
        };

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "do you sponsor visas?") }, options);

        result.IsSuccess.Should().BeTrue();
        var call = result.Value!.Contents.OfType<FunctionCallContent>().Single();
        call.Name.Should().Be("recall_memory");
        call.Arguments.Should().ContainKey("query");
        handler.LastRequestBody.Should().Contain("functionDeclarations");
        handler.LastRequestBody.Should().Contain("recall_memory");
    }

    [Fact]
    public async Task Maps_Tool_Results_To_FunctionResponse_Parts()
    {
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"text": "Based on memory: No."}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);
        var options = new ChatOptions
        {
            Instructions = "test",
            Tools = new List<AITool> { RecallTool() },
        };
        var history = new List<ChatMessage>
        {
            new(ChatRole.User, "do you sponsor visas?"),
            new(ChatRole.Assistant, [new FunctionCallContent("call_1", "recall_memory",
                new Dictionary<string, object?> { ["query"] = "visa" })]),
            new(ChatRole.Tool, [new FunctionResultContent("call_1", "No")]),
        };

        var result = await client.GenerateWithToolsAsync(history, options);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Text.Should().Contain("Based on memory");
        handler.LastRequestBody.Should().Contain("functionResponse");
        handler.LastRequestBody.Should().Contain("recall_memory");
    }

    [Fact]
    public async Task Text_Only_Response_Returns_TextContent()
    {
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"text": "Hello!"}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Text.Should().Be("Hello!");
    }

    [Fact]
    public async Task BenignEmptyStop_ReturnsEmptyAssistantMessage()
    {
        // Same benign-empty contract as the text path: STOP + no parts + no
        // block keeps the ReAct loop alive instead of failing the turn.
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": []}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Contents.OfType<FunctionCallContent>().Should().BeEmpty();
    }

    [Fact]
    public async Task SafetyBlockedEmpty_FailsHonestly()
    {
        var handler = new StubHandler("""
            {"promptFeedback": {"blockReason": "SAFETY"}, "candidates": [{"finishReason": "SAFETY"}]}
            """);
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("SAFETY");
    }

    [Fact]
    public async Task ThoughtOnlyStop_ReturnsEmptyAssistantMessage()
    {
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"thought": true, "text": "private plan"}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Text.Should().NotContain("private plan");
    }

    [Fact]
    public async Task ToolLoopGlitch_RetriesOnce_ThenSucceeds()
    {
        var handler = new StubHandler(new[]
        {
            """{"candidates": [{"content": {}, "finishReason": "UNEXPECTED_TOOL_CALL"}]}""",
            """{"candidates": [{"content": {"role": "model", "parts": [{"text": "recovered"}]}, "finishReason": "STOP"}]}""",
        });
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Text.Should().Be("recovered");
        handler.RequestCount.Should().Be(2);
    }

    [Fact]
    public async Task ToolLoopGlitch_Twice_FailsWithActionableMessage()
    {
        var handler = new StubHandler(new[]
        {
            """{"candidates": [{"content": {}, "finishReason": "UNEXPECTED_TOOL_CALL"}]}""",
            """{"candidates": [{"content": {}, "finishReason": "UNEXPECTED_TOOL_CALL"}]}""",
        });
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("transient tool-loop glitch");
        handler.RequestCount.Should().Be(2);
    }

    [Fact]
    public async Task UsageMetadata_IsCaptured_ForLedgerActuals()
    {
        var handler = new StubHandler("""
            {"usageMetadata": {"promptTokenCount": 1234, "candidatesTokenCount": 56, "totalTokenCount": 1290},
             "candidates": [{"content": {"role": "model", "parts": [{"text": "Hello!"}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeTrue();
        client.LastUsage.Should().NotBeNull();
        client.LastUsage!.PromptTokens.Should().Be(1234);
        client.LastUsage!.CompletionTokens.Should().Be(56);
    }

    [Fact]
    public async Task MissingUsageMetadata_LeavesUsageNull_ForEstimateFallback()
    {
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"text": "Hello!"}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeTrue();
        client.LastUsage.Should().BeNull();
    }

    [Fact]
    public async Task ApiIssuedCallId_RidesVerbatim_And_EchoesInResponse()
    {
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {"name": "recall_memory", "args": {"query": "visa"}, "id": "api-call-007"}}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);
        var options = new ChatOptions
        {
            Instructions = "test",
            Tools = new List<AITool> { RecallTool() },
        };

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "visa?") }, options);

        result.IsSuccess.Should().BeTrue();
        var call = result.Value!.Contents.OfType<FunctionCallContent>().Single();
        call.CallId.Should().Be("api-call-007");

        // Second turn: history carries the call + result; the emitted
        // functionResponse must echo the exact API id (Gemini 3 mapping rule).
        var handler2 = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"text": "done"}]}, "finishReason": "STOP"}]}
            """);
        var client2 = CreateClient(handler2);
        var history = new List<ChatMessage>
        {
            new(ChatRole.User, "visa?"),
            new(ChatRole.Assistant, [new FunctionCallContent("api-call-007", "recall_memory",
                new Dictionary<string, object?> { ["query"] = "visa" })]),
            new(ChatRole.Tool, [new FunctionResultContent("api-call-007", "No")]),
        };

        var result2 = await client2.GenerateWithToolsAsync(history, options);

        result2.IsSuccess.Should().BeTrue();
        handler2.LastRequestBody.Should().Contain("api-call-007");
    }

    [Fact]
    public async Task DefaultModel_IsCurrentFlagshipFlash()
    {
        // No model configured anywhere: the harness must target the current
        // GA flagship Flash (verified 2026-10-10 as gemini-3.8-flash), never a
        // capacity-gated 2.x model and never lite by silent default.
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"text": "Hello!"}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") },
            new ChatOptions { Instructions = "test" });

        result.IsSuccess.Should().BeTrue();
        handler.LastRequestUrl.Should().Contain("gemini-3.8-flash");
    }

    [Fact]
    public async Task SyntheticCallId_IsNeverEchoed()
    {
        var handler = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {"name": "recall_memory", "args": {}}}]}, "finishReason": "STOP"}]}
            """);
        var client = CreateClient(handler);
        var options = new ChatOptions
        {
            Instructions = "test",
            Tools = new List<AITool> { RecallTool() },
        };

        var result = await client.GenerateWithToolsAsync(
            new List<ChatMessage> { new(ChatRole.User, "hi") }, options);

        result.IsSuccess.Should().BeTrue();
        var call = result.Value!.Contents.OfType<FunctionCallContent>().Single();
        call.CallId.Should().StartWith("local_");

        var handler2 = new StubHandler("""
            {"candidates": [{"content": {"role": "model", "parts": [{"text": "done"}]}, "finishReason": "STOP"}]}
            """);
        var client2 = CreateClient(handler2);
        var history = new List<ChatMessage>
        {
            new(ChatRole.User, "hi"),
            new(ChatRole.Assistant, [new FunctionCallContent(call.CallId, "recall_memory",
                new Dictionary<string, object?>())]),
            new(ChatRole.Tool, [new FunctionResultContent(call.CallId, "x")]),
        };

        var result2 = await client2.GenerateWithToolsAsync(history, options);

        result2.IsSuccess.Should().BeTrue();
        handler2.LastRequestBody.Should().NotContain(call.CallId);
    }
}
