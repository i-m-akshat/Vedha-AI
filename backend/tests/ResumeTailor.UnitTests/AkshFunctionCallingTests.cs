using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Infrastructure.Aksh;
using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// Unit tests for Gemini native function calling bridge (ADR-006):
/// - Translates MEAI ChatOptions.Tools to Gemini functionDeclarations
/// - Deserializes Gemini functionCall into FunctionCallContent
/// - Normalizes multi-turn functionResponse role to "user"
/// - Integrates seamlessly with AkshChatClientAdapter
/// </summary>
public class AkshFunctionCallingTests
{
    private readonly Mock<IEncryptionService> _encryptionMock;
    private readonly IConfiguration _config;
    private readonly Mock<ILogger<GeminiFunctionCallingClient>> _loggerMock;

    public AkshFunctionCallingTests()
    {
        _encryptionMock = new Mock<IEncryptionService>();
        _encryptionMock.Setup(e => e.Decrypt(It.IsAny<string>())).Returns<string>(s => s);

        var configValues = new Dictionary<string, string?>
        {
            ["AiSettings:GeminiApiKey"] = "fake-gemini-test-key",
            ["AiSettings:DefaultModel"] = "gemini-flash-lite-latest",
        };
        _config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();
        _loggerMock = new Mock<ILogger<GeminiFunctionCallingClient>>();
    }

    private (GeminiFunctionCallingClient client, List<string> capturedRequests) CreateClient(
        HttpStatusCode statusCode,
        string responseJson)
    {
        var capturedRequests = new List<string>();
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) =>
            {
                if (req.Content != null)
                {
                    capturedRequests.Add(req.Content.ReadAsStringAsync().GetAwaiter().GetResult());
                }
            })
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = statusCode,
                Content = new StringContent(responseJson, Encoding.UTF8, "application/json")
            });

        var httpClient = new HttpClient(handlerMock.Object);
        var factoryMock = new Mock<IHttpClientFactory>();
        factoryMock.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(httpClient);

        var client = new GeminiFunctionCallingClient(
            factoryMock.Object,
            _config,
            _encryptionMock.Object,
            _loggerMock.Object);

        return (client, capturedRequests);
    }

    [Fact]
    public async Task GeminiClient_ParsesFunctionCall_IntoFunctionCallContent()
    {
        var geminiResponse = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "functionCall": {
                      "name": "scrape_job",
                      "args": {
                        "url": "https://example.com/job/456"
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
        """;

        var (client, capturedRequests) = CreateClient(HttpStatusCode.OK, geminiResponse);

        var tool = AIFunctionFactory.Create(
            (Func<string, Task<string>>)((url) => Task.FromResult("ok")),
            "scrape_job",
            "Scrapes a job posting");

        var options = new ChatOptions
        {
            Tools = new[] { tool }
        };

        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, "Scrape https://example.com/job/456")
        };

        var result = await client.GenerateWithToolsAsync(messages, options);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Role.Should().Be(ChatRole.Assistant);
        result.Value.Contents.Should().ContainSingle();

        var call = result.Value.Contents[0].Should().BeOfType<FunctionCallContent>().Subject;
        call.Name.Should().Be("scrape_job");
        call.Arguments.Should().ContainKey("url");
        call.Arguments!["url"].Should().Be("https://example.com/job/456");

        // Verify request payload contained tool declaration
        capturedRequests.Should().NotBeEmpty();
        capturedRequests[0].Should().Contain("scrape_job");
        capturedRequests[0].Should().Contain("functionDeclarations");
    }

    [Fact]
    public async Task GeminiClient_ParsesText_WhenNoFunctionCalled()
    {
        var geminiResponse = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "I have reviewed your application and plan."
                  }
                ]
              }
            }
          ]
        }
        """;

        var (client, _) = CreateClient(HttpStatusCode.OK, geminiResponse);

        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, "Hello Aksh")
        };

        var result = await client.GenerateWithToolsAsync(messages, new ChatOptions());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Contents.Should().ContainSingle();
        var text = result.Value.Contents[0].Should().BeOfType<TextContent>().Subject;
        text.Text.Should().Be("I have reviewed your application and plan.");
    }

    [Fact]
    public async Task GeminiClient_SerializesFunctionResponse_WithRoleUser()
    {
        var geminiResponse = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "Job details received: Software Engineer at Acme."
                  }
                ]
              }
            }
          ]
        }
        """;

        var (client, capturedRequests) = CreateClient(HttpStatusCode.OK, geminiResponse);

        var toolCallId = "call_1234567890ab";
        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, "Scrape https://example.com/job/1"),
            new(ChatRole.Assistant, new[] { new FunctionCallContent(toolCallId, "scrape_job", new Dictionary<string, object?> { ["url"] = "https://example.com/job/1" }) }),
            new(ChatRole.Tool, new[] { new FunctionResultContent(toolCallId, "{\"company\":\"Acme\",\"title\":\"Software Engineer\"}") })
        };

        var result = await client.GenerateWithToolsAsync(messages, null);

        result.IsSuccess.Should().BeTrue();

        // Verify the outgoing payload formatted the functionResponse turn as role: "user"
        capturedRequests.Should().NotBeEmpty();
        capturedRequests[0].Should().Contain("\"role\":\"user\"");
        capturedRequests[0].Should().Contain("functionResponse");
        capturedRequests[0].Should().Contain("scrape_job");
    }

    [Fact]
    public async Task Adapter_RoutesToFunctionClient_WhenToolsProvided()
    {
        var geminiResponse = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "functionCall": {
                      "name": "prepare_package",
                      "args": {
                        "jobUrl": "https://example.com/jobs/dev"
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
        """;

        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(geminiResponse, Encoding.UTF8, "application/json")
            });

        var httpClient = new HttpClient(handlerMock.Object);
        var factoryMock = new Mock<IHttpClientFactory>();
        factoryMock.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(httpClient);

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(_config);
        services.AddSingleton<IEncryptionService>(_encryptionMock.Object);
        services.AddSingleton(factoryMock.Object);
        services.AddTransient<GeminiFunctionCallingClient>();

        var providerMock = new Mock<IAiProvider>();
        var aiFactoryMock = new Mock<IAiServiceFactory>();
        aiFactoryMock.Setup(f => f.GetDefaultProvider()).Returns(providerMock.Object);
        aiFactoryMock.Setup(f => f.GetProvider(AiProviderType.Gemini)).Returns(providerMock.Object);
        services.AddSingleton(aiFactoryMock.Object);

        using var serviceProvider = services.BuildServiceProvider();

        var adapter = new AkshChatClientAdapter(serviceProvider.GetRequiredService<IServiceScopeFactory>())
            .WithCredentials(AiProviderType.Gemini, "key", "gemini-flash-lite-latest");

        var tool = AIFunctionFactory.Create(
            (Func<string, Task<string>>)((jobUrl) => Task.FromResult("prepared")),
            "prepare_package",
            "Prepares application package");

        var options = new ChatOptions { Tools = new[] { tool } };
        var response = await adapter.GetResponseAsync(new[] { new ChatMessage(ChatRole.User, "prepare package") }, options);

        response.Should().NotBeNull();
        response.Messages.Should().ContainSingle();
        var call = response.Messages[0].Contents[0].Should().BeOfType<FunctionCallContent>().Subject;
        call.Name.Should().Be("prepare_package");

        // Native function calling ran; raw text IAiProvider was NOT called
        providerMock.Verify(
            p => p.GenerateTextAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
