using System.Text.RegularExpressions;
using AngleSharp;
using AngleSharp.Dom;
using AngleSharp.Html.Dom;
using AngleSharp.Html.Parser;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Infrastructure.WebScraping;

public class JobScraperService : IJobScraperService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<JobScraperService> _logger;

    public JobScraperService(HttpClient httpClient, ILogger<JobScraperService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<Result<(string CleanedText, string? Company, string? Title, JobSource Source)>> ScrapeAsync(string url, CancellationToken cancellationToken = default)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return Result<(string, string?, string?, JobSource)>.Failure("Invalid URL format.");
        }

        try
        {
            var source = DetectJobSource(uri);

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            request.Headers.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
            request.Headers.Add("Accept-Language", "en-US,en;q=0.9");

            var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return Result<(string, string?, string?, JobSource)>.Failure($"Failed to fetch job page. HTTP Status: {response.StatusCode}. If the job board requires authentication (e.g. LinkedIn private post), please paste the job description text directly.");
            }

            var html = await response.Content.ReadAsStringAsync(cancellationToken);
            var parser = new HtmlParser();
            var document = await parser.ParseDocumentAsync(html, cancellationToken);

            // Remove non-content elements
            var junkSelectors = new[]
            {
                "script", "style", "nav", "header", "footer", "noscript", "svg", "iframe",
                ".nav", ".navbar", ".footer", ".header", "#header", "#footer", ".cookie-banner",
                ".advertisement", ".ad-banner", ".sidebar", ".menu", ".modal", ".social-share"
            };

            foreach (var selector in junkSelectors)
            {
                var elements = document.QuerySelectorAll(selector);
                foreach (var el in elements)
                {
                    el.Remove();
                }
            }

            string? detectedCompany = null;
            string? detectedTitle = null;
            string extractedText = string.Empty;

            // Target-specific extractor logic
            switch (source)
            {
                case JobSource.Greenhouse:
                    detectedTitle = document.QuerySelector(".app-title, h1.job-title, .job-title")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector(".company-name, .logo-container")?.TextContent?.Trim();
                    var ghContent = document.QuerySelector("#content, .content, #main");
                    extractedText = ghContent != null ? CleanElementText(ghContent) : CleanElementText(document.Body);
                    break;

                case JobSource.Lever:
                    detectedTitle = document.QuerySelector(".posting-headline h2, h2")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector(".main-header-logo")?.GetAttribute("alt") ?? document.QuerySelector(".main-header .title")?.TextContent?.Trim();
                    var leverContent = document.QuerySelector(".content, .posting-sections, .section-wrapper");
                    extractedText = leverContent != null ? CleanElementText(leverContent) : CleanElementText(document.Body);
                    break;

                case JobSource.Ashby:
                    detectedTitle = document.QuerySelector("h1, [data-qa='job-title']")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector("[data-qa='company-name']")?.TextContent?.Trim();
                    var ashbyContent = document.QuerySelector("main, [data-qa='job-description'], .job-description");
                    extractedText = ashbyContent != null ? CleanElementText(ashbyContent) : CleanElementText(document.Body);
                    break;

                case JobSource.LinkedIn:
                    detectedTitle = document.QuerySelector(".top-card-layout__title, h1.topcard__title, .job-details-jobs-unified-top-card__job-title")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector(".topcard__flavor, .topcard__flavor--black-link, .job-details-jobs-unified-top-card__company-name")?.TextContent?.Trim();
                    var liContent = document.QuerySelector(".show-more-less-html__markup, .description__text, .jobs-description__content");
                    extractedText = liContent != null ? CleanElementText(liContent) : CleanElementText(document.Body);
                    break;

                case JobSource.Indeed:
                    detectedTitle = document.QuerySelector("h1.jobsearch-JobInfoHeader-title, .jobsearch-JobInfoHeader-title")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector("[data-company-name='true'], .jobsearch-CompanyInfoContainer")?.TextContent?.Trim();
                    var indeedContent = document.QuerySelector("#jobDescriptionText, .jobsearch-jobDescriptionText");
                    extractedText = indeedContent != null ? CleanElementText(indeedContent) : CleanElementText(document.Body);
                    break;

                default:
                    // Generic corporate careers / readability fallback
                    detectedTitle = document.QuerySelector("h1")?.TextContent?.Trim();
                    var mainContent = document.QuerySelector("main, article, #job-description, .job-description, #job-details, .job-details, #content") ?? document.Body;
                    extractedText = CleanElementText(mainContent);
                    break;
            }

            if (string.IsNullOrWhiteSpace(extractedText) || extractedText.Length < 50)
            {
                extractedText = CleanElementText(document.Body);
            }

            if (string.IsNullOrWhiteSpace(extractedText))
            {
                return Result<(string, string?, string?, JobSource)>.Failure("Unable to extract text from the provided URL. Please paste the job description directly.");
            }

            return Result<(string, string?, string?, JobSource)>.Success((extractedText, detectedCompany, detectedTitle, source));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping job url: {Url}", url);
            return Result<(string, string?, string?, JobSource)>.Failure($"Scraping failed: {ex.Message}");
        }
    }

    private static JobSource DetectJobSource(Uri uri)
    {
        var host = uri.Host.ToLowerInvariant();
        if (host.Contains("linkedin.com")) return JobSource.LinkedIn;
        if (host.Contains("greenhouse.io")) return JobSource.Greenhouse;
        if (host.Contains("lever.co")) return JobSource.Lever;
        if (host.Contains("workday.com") || host.Contains("myworkdayjobs.com")) return JobSource.Workday;
        if (host.Contains("ashbyhq.com")) return JobSource.Ashby;
        if (host.Contains("wellfound.com") || host.Contains("angel.co")) return JobSource.Wellfound;
        if (host.Contains("indeed.com")) return JobSource.Indeed;
        return JobSource.CompanyCareers;
    }

    private static string CleanElementText(IElement? element)
    {
        if (element == null) return string.Empty;
        var text = element.TextContent;
        // Normalize whitespace and remove duplicate empty lines
        text = Regex.Replace(text, @"[ \t]+", " ");
        text = Regex.Replace(text, @"\n\s*\n+", "\n\n");
        return text.Trim();
    }
}
