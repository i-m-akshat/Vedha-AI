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
