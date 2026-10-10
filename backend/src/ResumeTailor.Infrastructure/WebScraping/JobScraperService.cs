using System.Text.RegularExpressions;
using System.Text;
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
    private const int MaxResponseBytes = 2 * 1024 * 1024;
    private readonly HttpClient _httpClient;
    private readonly ICrawl4AiService? _crawl4AiService;
    private readonly ILogger<JobScraperService> _logger;

    public JobScraperService(
        HttpClient httpClient,
        ILogger<JobScraperService> logger,
        ICrawl4AiService? crawl4AiService = null)
    {
        _httpClient = httpClient;
        _logger = logger;
        _crawl4AiService = crawl4AiService;
    }

    public async Task<Result<(string CleanedText, string? Company, string? Title, JobSource Source)>> ScrapeAsync(string url, CancellationToken cancellationToken = default)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return Result<(string, string?, string?, JobSource)>.Failure("Invalid URL format.");
        }

        if (uri.Scheme is not "http" and not "https" || !string.IsNullOrWhiteSpace(uri.UserInfo))
        {
            return Result<(string, string?, string?, JobSource)>.Failure("Only HTTP(S) job URLs without embedded credentials are supported.");
        }

        // Centralized SSRF enforcement (covers every caller, including the
        // Aksh deterministic auto-scrape that bypasses the tool-level guard):
        // literal blocks + DNS-resolve-and-recheck, fail closed.
        var (allowed, reason) = await Security.UrlSafetyGuard.IsUrlAllowedAsync(url, _logger, cancellationToken);
        if (!allowed)
        {
            return Result<(string, string?, string?, JobSource)>.Failure(reason ?? "URL is not allowed.");
        }

        try
        {
            var source = DetectJobSource(uri);

            // Normalize LinkedIn Search URLs: extract currentJobId to canonical guest view URL
            if (source == JobSource.LinkedIn)
            {
                var match = Regex.Match(url, @"(?:currentJobId=|/jobs/view/)(\d+)", RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    url = $"https://www.linkedin.com/jobs/view/{match.Groups[1].Value}/";
                    _logger.LogInformation("Normalized LinkedIn URL to canonical job view: {Url}", url);
                }
            }

            // Primary Engine: Crawl4AI Headless Chromium with Playwright Stealth & JS accordion unrolling
            if (_crawl4AiService != null)
            {
                try
                {
                    var crawlResult = await _crawl4AiService.CrawlAsync(url, cancellationToken);
                    if (crawlResult.IsSuccess && !string.IsNullOrWhiteSpace(crawlResult.Value.Markdown) && crawlResult.Value.Markdown.Length >= 50)
                    {
                        var cleanedMarkdown = crawlResult.Value.Markdown;
                        // Page <title> on career sites is often "Company | motto".
                        // Keep that string out of Target Role and recover the real heading.
                        var identity = JobPostingTitleParser.Resolve(crawlResult.Value.Title, cleanedMarkdown);

                        _logger.LogInformation("Successfully ingested {Length} chars via Crawl4AI for {Url}", cleanedMarkdown.Length, url);
                        return Result<(string, string?, string?, JobSource)>.Success((cleanedMarkdown, identity.Company, identity.Title, source));
                    }
                }
                catch (Exception crawlEx)
                {
                    _logger.LogWarning(crawlEx, "Crawl4AI failed for {Url}. Falling back to native AngleSharp/HttpClient scraper.", url);
                }
            }

            // Fast-path: Workday public CXS REST API avoids client-side SPA empty rendering
            if (source == JobSource.Workday && uri.Host.Contains("myworkdayjobs.com", StringComparison.OrdinalIgnoreCase))
            {
                var workdayApiData = await TryScrapeWorkdayApiAsync(uri, cancellationToken);
                if (workdayApiData != null && !string.IsNullOrWhiteSpace(workdayApiData.Value.CleanedText))
                {
                    return Result<(string, string?, string?, JobSource)>.Success((workdayApiData.Value.CleanedText, workdayApiData.Value.Company, workdayApiData.Value.Title, JobSource.Workday));
                }
            }

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            request.Headers.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
            request.Headers.Add("Accept-Language", "en-US,en;q=0.9");

            var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return Result<(string, string?, string?, JobSource)>.Failure($"Failed to fetch job page. HTTP Status: {response.StatusCode}. If the job board requires authentication (e.g. LinkedIn private post), please paste the job description text directly.");
            }

            if (response.Content.Headers.ContentLength > MaxResponseBytes)
            {
                return Result<(string, string?, string?, JobSource)>.Failure("The job page is too large to process. Please paste the job description text directly.");
            }

            await using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var contentBuffer = new MemoryStream();
            var buffer = new byte[81920];
            int bytesRead;
            while ((bytesRead = await responseStream.ReadAsync(buffer, cancellationToken)) > 0)
            {
                if (contentBuffer.Length + bytesRead > MaxResponseBytes)
                {
                    return Result<(string, string?, string?, JobSource)>.Failure("The job page is too large to process. Please paste the job description text directly.");
                }

                await contentBuffer.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            }

            var html = Encoding.UTF8.GetString(contentBuffer.ToArray());
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
                    
                    // Fallback to <title> parsing if standard classes are obfuscated (e.g. "Software Engineer at Eurofins — Bengaluru...")
                    if (string.IsNullOrWhiteSpace(detectedTitle) && !string.IsNullOrWhiteSpace(document.Title))
                    {
                        var pageTitle = document.Title.Trim();
                        var atIdx = pageTitle.IndexOf(" at ", StringComparison.OrdinalIgnoreCase);
                        var dashIdx = pageTitle.IndexOf(" — ", StringComparison.OrdinalIgnoreCase);
                        if (atIdx > 0)
                        {
                            detectedTitle = pageTitle.Substring(0, atIdx).Trim();
                            if (string.IsNullOrWhiteSpace(detectedCompany) && dashIdx > atIdx)
                            {
                                detectedCompany = pageTitle.Substring(atIdx + 4, dashIdx - atIdx - 4).Trim();
                            }
                        }
                    }

                    var liContent = document.QuerySelector(".show-more-less-html__markup, .description__text, .jobs-description__content");
                    extractedText = liContent != null ? CleanElementText(liContent) : string.Empty;
                    break;

                case JobSource.Indeed:
                    detectedTitle = document.QuerySelector("h1.jobsearch-JobInfoHeader-title, .jobsearch-JobInfoHeader-title")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector("[data-company-name='true'], .jobsearch-CompanyInfoContainer")?.TextContent?.Trim();
                    var indeedContent = document.QuerySelector("#jobDescriptionText, .jobsearch-jobDescriptionText");
                    extractedText = indeedContent != null ? CleanElementText(indeedContent) : CleanElementText(document.Body);
                    break;

                case JobSource.Workday:
                    detectedTitle = document.QuerySelector("[data-automation-id='jobPostingHeader'], h1")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector("[data-automation-id='companyName'], [data-automation-id='headerCompanyName']")?.TextContent?.Trim();
                    var wdContent = document.QuerySelector("[data-automation-id='jobPostingDescription'], .job-description, main");
                    extractedText = wdContent != null ? CleanElementText(wdContent) : CleanElementText(document.Body);
                    break;

                case JobSource.Wellfound:
                    detectedTitle = document.QuerySelector("h1")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector("h2, [data-test='company-name']")?.TextContent?.Trim();
                    var wfContent = document.QuerySelector("[data-test='JobDescription'], .job-description, main");
                    extractedText = wfContent != null ? CleanElementText(wfContent) : CleanElementText(document.Body);
                    break;

                case JobSource.Naukri:
                    detectedTitle = document.QuerySelector("h1, [class*='styles_jd-header-title']")?.TextContent?.Trim();
                    detectedCompany = document.QuerySelector("[class*='styles_jd-header-comp-name'], .company-name")?.TextContent?.Trim();
                    var nkContent = document.QuerySelector("section.job-desc, [class*='styles_job-desc-container'], .job-desc");
                    extractedText = nkContent != null ? CleanElementText(nkContent) : CleanElementText(document.Body);
                    break;

                default:
                    // Generic corporate careers / readability fallback
                    detectedTitle = document.QuerySelector("h1")?.TextContent?.Trim();
                    var mainContent = document.QuerySelector("main, article, #job-description, .job-description, #job-details, .job-details, #content") ?? document.Body;
                    extractedText = CleanElementText(mainContent);
                    break;
            }

            // Authwall / Login Page Detection (prevents scraping login pages into job descriptions)
            var isAuthWall = (document.Title?.Contains("LinkedIn Login", StringComparison.OrdinalIgnoreCase) == true)
                || (document.Title?.Contains("Sign In", StringComparison.OrdinalIgnoreCase) == true)
                || extractedText.Contains("Sign in with Apple", StringComparison.OrdinalIgnoreCase)
                || extractedText.Contains("Sign in with a passkey", StringComparison.OrdinalIgnoreCase);

            if (isAuthWall || (source == JobSource.LinkedIn && string.IsNullOrWhiteSpace(extractedText)))
            {
                return Result<(string, string?, string?, JobSource)>.Failure(
                    "LinkedIn authentication barrier detected for this URL. LinkedIn requires an active session to view this job posting. Please switch to the 'Paste Job Text' tab in Tailor Studio to paste the job description text directly, or use the Vedha Chrome Extension on your active LinkedIn tab.");
            }

            if (string.IsNullOrWhiteSpace(extractedText) || extractedText.Length < 50)
            {
                extractedText = CleanElementText(document.Body);
            }

            var refined = JobPostingTitleParser.Refine(
                detectedTitle,
                detectedCompany,
                document.Title,
                ExtractHeadingTexts(document),
                extractedText);
            detectedTitle = refined.Title;
            detectedCompany = refined.Company;

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
        if (host.Contains("naukri.com")) return JobSource.Naukri;
        return JobSource.CompanyCareers;
    }

    private async Task<(string CleanedText, string? Company, string? Title)?> TryScrapeWorkdayApiAsync(Uri uri, CancellationToken cancellationToken)
    {
        try
        {
            var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length < 2) return null;

            var hostParts = uri.Host.Split('.');
            var tenant = hostParts[0];

            var careerSiteIndex = segments[0].Contains('-') && segments[0].Length <= 5 ? 1 : 0;
            if (careerSiteIndex >= segments.Length) return null;
            var careerSite = segments[careerSiteIndex];
            var jobId = segments[^1];

            var apiUrl = $"https://{uri.Host}/wday/cxs/{tenant}/{careerSite}/job/{jobId}";
            using var request = new HttpRequestMessage(HttpMethod.Get, apiUrl);
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            request.Headers.Add("Accept", "application/json");

            var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("jobPostingInfo", out var info)) return null;

            var title = info.TryGetProperty("title", out var t) ? t.GetString() : null;
            var company = info.TryGetProperty("company", out var c) ? c.GetString() : tenant;
            var rawDescription = info.TryGetProperty("jobDescription", out var d) ? d.GetString() : null;

            if (string.IsNullOrWhiteSpace(rawDescription)) return null;

            var parser = new HtmlParser();
            var parsedHtml = await parser.ParseDocumentAsync(rawDescription, cancellationToken);
            var cleaned = CleanElementText(parsedHtml.Body);

            return (cleaned, company, title);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Workday CXS API parse attempt was not applicable or failed");
            return null;
        }
    }

    private static IEnumerable<string> ExtractHeadingTexts(IDocument document)
    {
        foreach (var heading in document.QuerySelectorAll("h1, h2, h3"))
        {
            var text = heading.TextContent?.Trim();
            if (!string.IsNullOrWhiteSpace(text)) yield return text;
        }
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
