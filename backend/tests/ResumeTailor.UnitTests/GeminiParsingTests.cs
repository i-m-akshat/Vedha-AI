using System.Net;
using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Infrastructure.Ai;
using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// Regression: thinking models emit thought parts without text; safety blocks
/// arrive without usable parts. The parser must handle both honestly instead of
/// reporting a generic "empty content" dead end.
/// </summary>
public class GeminiParsingTests : IDisposable
{
    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Queue<string> _responses;
        public int RequestCount { get; private set; }

        public StubHandler(string json) : this(new[] { json }) { }

        public StubHandler(IEnumerable<string> sequence) => _responses = new Queue<string>(sequence);

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            var json = _responses.Count > 1 ? _responses.Dequeue() : _responses.Peek();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            });
        }
    }

    private readonly Mock<IEncryptionService> _encryption = new();

    public GeminiParsingTests()
    {
        _encryption.Setup(e => e.Decrypt(It.IsAny<string?>())).Returns((string?)null);
    }

    private GeminiProvider CreateProvider(string responseJson)
        => CreateProviderWithHandler(new StubHandler(responseJson));

    private GeminiProvider CreateProviderWithHandler(StubHandler handler)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AiSettings:GeminiApiKey"] = "test-key",
                ["AiSettings:MaxTokens"] = "16384",
            })
            .Build();
        var httpClient = new HttpClient(handler);
        return new GeminiProvider(
            httpClient, config, Mock.Of<ILogger<GeminiProvider>>(), _encryption.Object);
    }

    [Fact]
    public async Task GenerateText_SkipsThoughtParts_And_ReturnsAnswerText()
    {
        var provider = CreateProvider("""
            {"candidates": [{"content": {"role": "model", "parts": [{"thought": true, "text": "internal reasoning"}, {"text": "Hello! I scraped the posting."}]}, "finishReason": "STOP"}]}
            """);

        var result = await provider.GenerateTextAsync("system", "hi");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain("Hello! I scraped the posting.");
        result.Value.Should().NotContain("internal reasoning");
    }

    [Fact]
    public async Task GenerateText_ReportsSafetyBlock_Honestly()
    {
        var provider = CreateProvider("""
            {"promptFeedback": {"blockReason": "SAFETY"}, "candidates": [{"finishReason": "SAFETY"}]}
            """);

        var result = await provider.GenerateTextAsync("system", "hi");

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("safety");
    }

    [Fact]
    public async Task GenerateText_BenignEmptyStop_ReturnsEmptySuccess()
    {
        // Regression: STOP with zero parts and no safety signal is a normal
        // Gemini outcome (terse turn), not an error. The harness narrates from
        // deterministic receipts; failing the turn alarmed the candidate.
        var provider = CreateProvider("""
            {"candidates": [{"content": {"role": "model", "parts": []}, "finishReason": "STOP"}]}
            """);

        var result = await provider.GenerateTextAsync("system", "hi");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GenerateText_ThoughtOnlyStop_ReturnsEmptySuccess()
    {
        var provider = CreateProvider("""
            {"candidates": [{"content": {"role": "model", "parts": [{"thought": true, "text": "private plan"}]}, "finishReason": "STOP"}]}
            """);

        var result = await provider.GenerateTextAsync("system", "hi");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GenerateText_ToolLoopGlitch_RetriesOnce_ThenSucceeds()
    {
        // UNEXPECTED_TOOL_CALL with empty content is a known transient
        // flash-lite glitch: one identical retry frequently recovers.
        var handler = new StubHandler(new[]
        {
            """{"candidates": [{"content": {}, "finishReason": "UNEXPECTED_TOOL_CALL"}]}""",
            """{"candidates": [{"content": {"role": "model", "parts": [{"text": "recovered"}]}, "finishReason": "STOP"}]}""",
        });
        var provider = CreateProviderWithHandler(handler);

        var result = await provider.GenerateTextAsync("system", "hi");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("recovered");
        handler.RequestCount.Should().Be(2);
    }

    [Fact]
    public async Task GenerateText_ToolLoopGlitch_Twice_FailsHonestly()
    {
        var handler = new StubHandler(new[]
        {
            """{"candidates": [{"content": {}, "finishReason": "UNEXPECTED_TOOL_CALL"}]}""",
            """{"candidates": [{"content": {}, "finishReason": "MALFORMED_FUNCTION_CALL"}]}""",
        });
        var provider = CreateProviderWithHandler(handler);

        var result = await provider.GenerateTextAsync("system", "hi");

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("transient tool-loop glitch");
        handler.RequestCount.Should().Be(2);
    }

    public void Dispose()
    {
    }
}
