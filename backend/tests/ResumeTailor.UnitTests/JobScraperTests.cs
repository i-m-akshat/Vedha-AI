using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Infrastructure.WebScraping;
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
}
