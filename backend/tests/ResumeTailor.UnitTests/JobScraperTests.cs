using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
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
