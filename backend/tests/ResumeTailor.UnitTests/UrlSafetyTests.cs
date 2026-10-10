using System.Net;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using ResumeTailor.Domain.Common;
using ResumeTailor.Infrastructure.WebScraping;
using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// SSRF guard: literal blocks, DNS-rebinding defense posture, and fetch-point
/// enforcement. All assertions are offline-deterministic (no real DNS for
/// allowed-host proofs; localhost resolves locally everywhere).
/// </summary>
public class UrlSafetyTests
{
    [Theory]
    [InlineData("localhost")]
    [InlineData("127.0.0.1")]
    [InlineData("0.0.0.0")]
    [InlineData("169.254.169.254")]
    [InlineData("169.254.10.20")]
    [InlineData("metadata.google.internal")]
    [InlineData("metadata.goog")]
    [InlineData("instance-data")]
    [InlineData("100.100.100.200")]
    [InlineData("::1")]
    [InlineData("[::1]")]
    [InlineData("")]
    public void BlockedHosts_AreRejected(string host)
    {
        UrlSafety.IsBlockedHost(host).Should().BeTrue();
    }

    [Theory]
    [InlineData("10.1.2.3")] // RFC-1918 allowed by design (intranet portals)
    [InlineData("192.168.1.1")]
    [InlineData("172.16.0.9")]
    [InlineData("8.8.8.8")]
    [InlineData("example.com")]
    [InlineData("boards.greenhouse.io")]
    public void LegitimateHosts_AreAllowed_ByLiteralRules(string host)
    {
        UrlSafety.IsBlockedHost(host).Should().BeFalse();
    }

    [Fact]
    public async Task Guard_RefusesLoopback_WithoutNetwork()
    {
        var (allowed, reason) = await Infrastructure.Security.UrlSafetyGuard.IsUrlAllowedAsync(
            "http://localhost:9000/minio/bucket/resume.pdf");

        allowed.Should().BeFalse();
        reason.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Guard_RefusesNonHttpScheme()
    {
        var (allowed, _) = await Infrastructure.Security.UrlSafetyGuard.IsUrlAllowedAsync(
            "file:///etc/passwd");

        allowed.Should().BeFalse();
    }

    [Fact]
    public async Task Scraper_RefusesBlockedHost_BeforeFetching()
    {
        var scraper = new JobScraperService(
            new HttpClient(), Mock.Of<ILogger<JobScraperService>>(), null);

        var result = await scraper.ScrapeAsync("http://169.254.169.254/latest/meta-data/");

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not allowed");
    }
}
