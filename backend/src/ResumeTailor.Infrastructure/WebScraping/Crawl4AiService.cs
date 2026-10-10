using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;

namespace ResumeTailor.Infrastructure.WebScraping;

public class Crawl4AiSettings
{
    public string BaseUrl { get; set; } = "http://crawler:11235";
    public bool Enabled { get; set; } = true;
    public string ApiToken { get; set; } = "vedha_crawler_token_2026";
    public int TimeoutSeconds { get; set; } = 35;
}

public class Crawl4AiService : ICrawl4AiService
{
    private readonly HttpClient _httpClient;
    private readonly Crawl4AiSettings _settings;
    private readonly ILogger<Crawl4AiService> _logger;

    public Crawl4AiService(
        HttpClient httpClient,
        IOptions<Crawl4AiSettings> settings,
        ILogger<Crawl4AiService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<Result<Crawl4AiResultDto>> CrawlAsync(string url, CancellationToken cancellationToken = default)
    {
        if (!_settings.Enabled)
        {
            return Result<Crawl4AiResultDto>.Failure("Crawl4AI scraper microservice is disabled in configuration.");
        }

        if (string.IsNullOrWhiteSpace(url))
        {
            return Result<Crawl4AiResultDto>.Failure("URL cannot be empty.");
        }

        // The sidecar fetches server-side too: same SSRF enforcement as the
        // native scraper before handing the URL over.
        var (allowed, reason) = await Security.UrlSafetyGuard.IsUrlAllowedAsync(url, _logger, cancellationToken);
        if (!allowed)
        {
            return Result<Crawl4AiResultDto>.Failure(reason ?? "URL is not allowed.");
        }

        try
        {
            var baseEndpoint = _settings.BaseUrl.TrimEnd('/');
            var targetEndpoint = $"{baseEndpoint}/crawl";

            // Construct payload with Crawl4AI v0.9.4 standard schema: @params for BrowserConfig and CrawlerRunConfig
            var payload = new
            {
                urls = new[] { url },
                browser_config = new
                {
                    type = "BrowserConfig",
                    @params = new
                    {
                        headless = true,
                        enable_stealth = true,
                        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
                    }
                },
                crawler_config = new
                {
                    type = "CrawlerRunConfig",
                    @params = new
                    {
                        delay_before_return_html = 4.0,
                        remove_overlay_elements = true,
                        remove_consent_popups = true
                    }
                }
            };

            var jsonContent = JsonSerializer.Serialize(payload);
            using var request = new HttpRequestMessage(HttpMethod.Post, targetEndpoint)
            {
                Content = new StringContent(jsonContent, Encoding.UTF8, "application/json")
            };

            if (!string.IsNullOrWhiteSpace(_settings.ApiToken))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiToken);
            }

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(_settings.TimeoutSeconds));

            _logger.LogInformation("Dispatching Crawl4AI job for URL: {Url} to {Endpoint}", url, targetEndpoint);
            var response = await _httpClient.SendAsync(request, cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                var errorText = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Crawl4AI returned HTTP {StatusCode}: {Error}", response.StatusCode, errorText);
                return Result<Crawl4AiResultDto>.Failure($"Crawl4AI failed with status {response.StatusCode}.");
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseJson);
            var root = doc.RootElement;

            string markdown = string.Empty;
            string? title = null;
            bool success = false;

            // Handle array of results or single object format
            if (root.TryGetProperty("results", out var resultsElem) && resultsElem.ValueKind == JsonValueKind.Array && resultsElem.GetArrayLength() > 0)
            {
                var first = resultsElem[0];
                success = first.TryGetProperty("success", out var s) && s.GetBoolean();
                markdown = ExtractMarkdownFromElement(first);
                if (first.TryGetProperty("metadata", out var meta) && meta.TryGetProperty("title", out var t))
                {
                    title = t.GetString();
                }
            }
            else if (root.TryGetProperty("result", out var resultElem) && resultElem.ValueKind == JsonValueKind.Object)
            {
                success = resultElem.TryGetProperty("success", out var s) && s.GetBoolean();
                markdown = ExtractMarkdownFromElement(resultElem);
                if (resultElem.TryGetProperty("metadata", out var meta) && meta.TryGetProperty("title", out var t))
                {
                    title = t.GetString();
                }
            }
            else
            {
                success = root.TryGetProperty("success", out var s) && s.GetBoolean();
                markdown = ExtractMarkdownFromElement(root);
                if (root.TryGetProperty("title", out var t)) title = t.GetString();
            }

            if (!success || string.IsNullOrWhiteSpace(markdown))
            {
                _logger.LogWarning("Crawl4AI returned empty markdown or reported failure for {Url}", url);
                return Result<Crawl4AiResultDto>.Failure("Crawl4AI returned empty or unsuccessful content.");
            }

            if (string.IsNullOrWhiteSpace(title))
            {
                var h1Match = System.Text.RegularExpressions.Regex.Match(markdown, @"^#\s+(.+)$", System.Text.RegularExpressions.RegexOptions.Multiline);
                if (h1Match.Success)
                {
                    title = h1Match.Groups[1].Value.Trim();
                }
            }

            _logger.LogInformation("Successfully scraped {Length} chars of clean Markdown via Crawl4AI for {Url}", markdown.Length, url);
            return Result<Crawl4AiResultDto>.Success(new Crawl4AiResultDto(true, markdown, title, null));
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Crawl4AI request timed out after {Timeout}s for {Url}", _settings.TimeoutSeconds, url);
            return Result<Crawl4AiResultDto>.Failure($"Crawl4AI timed out after {_settings.TimeoutSeconds}s.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Crawl4AI invocation failed for {Url}: {Message}", url, ex.Message);
            return Result<Crawl4AiResultDto>.Failure($"Crawl4AI connection error: {ex.Message}");
        }
    }

    private static string ExtractMarkdownFromElement(JsonElement elem)
    {
        if (elem.TryGetProperty("markdown", out var m))
        {
            if (m.ValueKind == JsonValueKind.String)
            {
                return m.GetString() ?? string.Empty;
            }
            if (m.ValueKind == JsonValueKind.Object)
            {
                if (m.TryGetProperty("raw_markdown", out var raw) && raw.ValueKind == JsonValueKind.String)
                {
                    var str = raw.GetString();
                    if (!string.IsNullOrWhiteSpace(str)) return str;
                }
                if (m.TryGetProperty("markdown_with_citations", out var cit) && cit.ValueKind == JsonValueKind.String)
                {
                    var str = cit.GetString();
                    if (!string.IsNullOrWhiteSpace(str)) return str;
                }
                if (m.TryGetProperty("fit_markdown", out var fit) && fit.ValueKind == JsonValueKind.String)
                {
                    var str = fit.GetString();
                    if (!string.IsNullOrWhiteSpace(str)) return str;
                }
            }
        }
        return string.Empty;
    }
}
