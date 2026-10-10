using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Infrastructure.WebScraping;
using System.Net;
using Xunit;

namespace ResumeTailor.UnitTests;

public class JobScraperTests
{
    private readonly JobScraperService _scraper;

    public JobScraperTests()
    {
        var client = new HttpClient();
        var logger = NullLogger<JobScraperService>.Instance;
        _scraper = new JobScraperService(client, logger);
    }

    [Theory]
    [InlineData("https://boards.greenhouse.io/stripe/jobs/12345")]
    [InlineData("https://jobs.lever.co/netflix/67890")]
    [InlineData("https://jobs.ashbyhq.com/openai/abcd")]
    public async Task ScrapeAsync_InvalidOrUnreachableDomain_ShouldReturnMeaningfulError(string testUrl)
    {
        // Act
        var result = await _scraper.ScrapeAsync(testUrl);

        // Assert - Should handle network failure or 404 gracefully without crashing
        if (result.IsFailure)
        {
            result.Error.Should().NotBeNullOrWhiteSpace();
        }
    }

    [Fact]
    public async Task ScrapeAsync_GreenhousePage_ShouldExtractJobDetails()
    {
        const string html = """
            <html>
              <body>
                <header>Navigation</header>
                <div class="logo-container">Acme Corp</div>
                <h1 class="app-title">Senior Backend Engineer</h1>
                <main id="content">
                  <p>Build reliable distributed systems for our customers.</p>
                  <p>Requirements include C#, SQL, and cloud experience.</p>
                </main>
              </body>
            </html>
            """;
        using var httpClient = new HttpClient(new StaticResponseHandler(html));
        var scraper = new JobScraperService(httpClient, NullLogger<JobScraperService>.Instance);

        var result = await scraper.ScrapeAsync("https://boards.greenhouse.io/acme/jobs/123");

        result.IsSuccess.Should().BeTrue();
        result.Value.Source.Should().Be(JobSource.Greenhouse);
        result.Value.Company.Should().Be("Acme Corp");
        result.Value.Title.Should().Be("Senior Backend Engineer");
        result.Value.CleanedText.Should().Contain("distributed systems");
        result.Value.CleanedText.Should().NotContain("Navigation");
    }

    [Fact]
    public async Task ScrapeAsync_LinkedInAuthwallPage_ShouldDetectAuthwallAndReturnFailure()
    {
        const string authwallHtml = """
            <html>
              <head>
                <title>LinkedIn Login, Sign in | LinkedIn</title>
              </head>
              <body>
                <h1>Sign in</h1>
                <button>Sign in with Apple</button>
                <button>Sign in with a passkey</button>
                <input name="session_key" />
              </body>
            </html>
            """;
        using var httpClient = new HttpClient(new StaticResponseHandler(authwallHtml));
        var scraper = new JobScraperService(httpClient, NullLogger<JobScraperService>.Instance);

        var result = await scraper.ScrapeAsync("https://www.linkedin.com/jobs/view/12345678");

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("LinkedIn authentication barrier detected");
    }

    [Fact]
    public async Task ScrapeAsync_LinkedInGuestJobDetails_ShouldExtractJobInfo()
    {
        const string guestJobHtml = """
            <html>
              <head>
                <title>Software Engineer at Eurofins — Bengaluru, Karnataka, India | LinkedIn Jobs</title>
              </head>
              <body>
                <h1 class="top-card-layout__title">Software Engineer</h1>
                <div class="topcard__flavor">Eurofins</div>
                <div class="show-more-less-html__markup">
                  <p>1-4 years of experience with developing end-to-end web applications using Microsoft stack of technologies (.NET, C#, WebAPI, SQL).</p>
                </div>
              </body>
            </html>
            """;
        using var httpClient = new HttpClient(new StaticResponseHandler(guestJobHtml));
        var scraper = new JobScraperService(httpClient, NullLogger<JobScraperService>.Instance);

        var result = await scraper.ScrapeAsync("https://www.linkedin.com/jobs/search-results/?currentJobId=4471195758&keywords=.NET");

        result.IsSuccess.Should().BeTrue();
        result.Value.Source.Should().Be(JobSource.LinkedIn);
        result.Value.Company.Should().Be("Eurofins");
        result.Value.Title.Should().Be("Software Engineer");
        result.Value.CleanedText.Should().Contain("Microsoft stack of technologies (.NET, C#, WebAPI, SQL)");
    }

    [Fact]
    public async Task ScrapeAsync_WithCrawl4AiSuccess_ShouldReturnCrawl4AiMarkdownAndExtractedMetadata()
    {
        // Arrange
        const string mockMarkdown = """
            # Staff AI Infrastructure Engineer
            **Company:** Anthropic
            **Location:** San Francisco, CA

            ## About the Role
            We are looking for a Staff AI Infrastructure Engineer to build scalable GPU orchestration platforms.
            Requirements:
            - 8+ years distributed systems experience
            - Deep expertise in Kubernetes, PyTorch, C#, and Go.
            """;
        var mockCrawlResult = ResumeTailor.Domain.Common.Result<ResumeTailor.Application.Common.Interfaces.Crawl4AiResultDto>.Success(
            new ResumeTailor.Application.Common.Interfaces.Crawl4AiResultDto(true, mockMarkdown, "Staff AI Infrastructure Engineer at Anthropic — San Francisco", null));

        var mockCrawl4Ai = new Moq.Mock<ResumeTailor.Application.Common.Interfaces.ICrawl4AiService>();
        mockCrawl4Ai
            .Setup(c => c.CrawlAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCrawlResult);

        var scraper = new JobScraperService(new HttpClient(), NullLogger<JobScraperService>.Instance, mockCrawl4Ai.Object);

        // Act
        var result = await scraper.ScrapeAsync("https://www.linkedin.com/jobs/view/9876543210/");

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Source.Should().Be(JobSource.LinkedIn);
        result.Value.Title.Should().Be("Staff AI Infrastructure Engineer");
        result.Value.Company.Should().Be("Anthropic");
        result.Value.CleanedText.Should().Contain("GPU orchestration platforms");
    }

    [Fact]
    public async Task ScrapeAsync_WithCrawl4AiFailure_ShouldGracefullyFallbackToNativeScraper()
    {
        // Arrange
        const string fallbackHtml = """
            <html>
              <body>
                <header>Nav</header>
                <div class="logo-container">Acme Corp</div>
                <h1 class="app-title">Senior Platform Engineer</h1>
                <main id="content">
                  <p>Full stack platform engineering with C# and PostgreSQL.</p>
                </main>
              </body>
            </html>
            """;
        using var httpClient = new HttpClient(new StaticResponseHandler(fallbackHtml));

        var mockCrawl4Ai = new Moq.Mock<ResumeTailor.Application.Common.Interfaces.ICrawl4AiService>();
        mockCrawl4Ai
            .Setup(c => c.CrawlAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<CancellationToken>()))
            .ReturnsAsync(ResumeTailor.Domain.Common.Result<ResumeTailor.Application.Common.Interfaces.Crawl4AiResultDto>.Failure("Crawl4AI connection refused."));

        var scraper = new JobScraperService(httpClient, NullLogger<JobScraperService>.Instance, mockCrawl4Ai.Object);

        // Act
        var result = await scraper.ScrapeAsync("https://boards.greenhouse.io/acme/jobs/456");

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Source.Should().Be(JobSource.Greenhouse);
        result.Value.Title.Should().Be("Senior Platform Engineer");
        result.Value.Company.Should().Be("Acme Corp");
        result.Value.CleanedText.Should().Contain("platform engineering with C# and PostgreSQL");
    }

    [Fact]
    public async Task ScrapeAsync_WhenCrawlTitleIsCompanyMotto_UsesRoleHeadingInstead()
    {
        const string mockMarkdown = """
            # Stripe
            Financial infrastructure for the internet

            ## Software Engineer, Payments
            ## About the role
            Build billing systems used by millions of businesses. You will design APIs, mentor engineers, and ship reliable payment products.
            """;
        var mockCrawlResult = ResumeTailor.Domain.Common.Result<ResumeTailor.Application.Common.Interfaces.Crawl4AiResultDto>.Success(
            new ResumeTailor.Application.Common.Interfaces.Crawl4AiResultDto(
                true,
                mockMarkdown,
                "Stripe | Financial infrastructure for the internet",
                null));

        var mockCrawl4Ai = new Moq.Mock<ResumeTailor.Application.Common.Interfaces.ICrawl4AiService>();
        mockCrawl4Ai
            .Setup(c => c.CrawlAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCrawlResult);

        var scraper = new JobScraperService(new HttpClient(), NullLogger<JobScraperService>.Instance, mockCrawl4Ai.Object);

        var result = await scraper.ScrapeAsync("https://www.linkedin.com/jobs/view/123456789/");

        result.IsSuccess.Should().BeTrue();
        result.Value.Title.Should().Be("Software Engineer, Payments");
        result.Value.Company.Should().Be("Stripe");
        result.Value.Title.Should().NotContain("Financial infrastructure");
    }

    [Fact]
    public async Task ScrapeAsync_CompanyCareerPage_ShouldNotUseHeroMottoAsRole()
    {
        const string html = """
            <html>
              <head>
                <title>Acme | We help teams ship faster</title>
              </head>
              <body>
                <h1>Acme — We help teams ship faster</h1>
                <h2>Senior Backend Engineer</h2>
                <main>
                  <p>Design APIs and mentor engineers on the platform team. Requirements include C# and PostgreSQL experience across production services.</p>
                </main>
              </body>
            </html>
            """;
        using var httpClient = new HttpClient(new StaticResponseHandler(html));
        var scraper = new JobScraperService(httpClient, NullLogger<JobScraperService>.Instance);

        var result = await scraper.ScrapeAsync("https://www.example.com/jobs/senior-backend-engineer");

        result.IsSuccess.Should().BeTrue();
        result.Value.Source.Should().Be(JobSource.CompanyCareers);
        result.Value.Title.Should().Be("Senior Backend Engineer");
        result.Value.Company.Should().Be("Acme");
    }

    [Fact]
    public async Task Crawl4AiService_HandlesV094Response_ShouldExtractMarkdownAndTitle()
    {
        // Arrange
        const string responseJson = """
            {
              "success": true,
              "results": [
                {
                  "url": "https://www.linkedin.com/jobs/view/123",
                  "success": true,
                  "markdown": {
                    "raw_markdown": "# Senior Cloud Architect\nAmazon Web Services\n\nBuild world-class serverless solutions.",
                    "markdown_with_citations": "# Senior Cloud Architect\nAmazon Web Services\n\nBuild world-class serverless solutions."
                  },
                  "metadata": {
                    "title": "Senior Cloud Architect at AWS — Seattle, WA"
                  }
                }
              ]
            }
            """;

        using var httpClient = new HttpClient(new StaticResponseHandler(responseJson));
        var options = Microsoft.Extensions.Options.Options.Create(new Crawl4AiSettings
        {
            BaseUrl = "http://localhost:11235",
            Enabled = true,
            ApiToken = "test_token",
            TimeoutSeconds = 5
        });

        var service = new Crawl4AiService(httpClient, options, NullLogger<Crawl4AiService>.Instance);

        // Act
        var result = await service.CrawlAsync("https://www.linkedin.com/jobs/view/123");

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Title.Should().Be("Senior Cloud Architect at AWS — Seattle, WA");
        result.Value.Markdown.Should().Contain("Senior Cloud Architect");
        result.Value.Markdown.Should().Contain("world-class serverless solutions");
    }

    private sealed class StaticResponseHandler : HttpMessageHandler
    {
        private readonly string _content;

        public StaticResponseHandler(string content)
        {
            _content = content;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_content)
            });
        }
    }
}
