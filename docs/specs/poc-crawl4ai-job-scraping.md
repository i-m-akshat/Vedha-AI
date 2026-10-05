# Feature Specification: Proof of Concept — Crawl4AI Job Scraping Microservice

## Overview
This feature specification defines the Proof of Concept (POC) for integrating **[Crawl4AI](https://github.com/unclecode/crawl4AI)** as a dedicated anti-bot web crawling and markdown extraction microservice (`vedha-crawler`) into the Vedha AI (ResuMate) architecture. Crawl4AI runs an asynchronous Playwright engine equipped with automated stealth heuristics, dynamic JavaScript execution hooks, and intelligent noise-filtering semantic Markdown transformation. It addresses the recurring limitation where Single Page Applications (SPAs) and anti-bot protected career portals (LinkedIn `/jobs/view/...`, Naukri.com, Workday, Greenhouse, Lever) block plain HTTP requests (`403 Forbidden`, `429 Too Many Requests`, guest login walls) or truncate job descriptions behind unexpanded accordions, causing missing ATS keywords and generic resume tailoring (**BUG-4082**).

## Business Goal
1. **100% Ingestion Reliability**: Eliminate candidate friction by reliably extracting complete, un-truncated job postings directly from pasted LinkedIn, Naukri, and modern SPA URLs.
2. **Deterministic, Authentic ATS Fit Scores**: Supply complete requirements, skills, and qualifications to the `IAtsScoringEngine` so candidates receive accurate 90%+ match evaluations without heuristic fallback modes.
3. **Zero Software Licensing Cost**: Leverage Crawl4AI's open-source Apache 2.0 license to run unlimited self-hosted crawls without third-party API fees or per-page credits.

## User Stories
- **As a candidate**, when I paste a LinkedIn or Naukri job posting link into the Studio, I want the full job requirements and role description to be extracted automatically, so that I don't have to manually copy and paste hundreds of words.
- **As a candidate**, I want my ATS score analysis to reflect real keyword matches extracted from the actual job posting, so that my tailored resume passes applicant tracking systems.
- **As a system engineer**, I want the scraper pipeline to degrade gracefully to local extraction if the crawler container is temporarily offline, ensuring 100% platform availability.

## Acceptance Criteria
- [ ] **AC-1 (Container Service Orchestration)**: The `vedha-crawler` container runs on port `11235` within `infra_vedha-network`. Windows localhost proxy (`infra/localhost_proxy.py`) transparently forwards `127.0.0.1:11235` to the WSL2 virtual IP.
- [ ] **AC-2 (Playwright Stealth & Unrolling)**: Automated JavaScript hooks unroll accordion text (e.g. clicking LinkedIn's "Show more" `.show-more-less-html__button--more` and Naukri's `.styles_jhc__read-more-btn`), capturing 100% of body text.
- [ ] **AC-3 (Clean Markdown Output)**: Webpage noise (headers, footers, cookie banners, navigation menus, ads) is stripped away, outputting clean, token-efficient Markdown.
- [ ] **AC-4 (Backend Gateway Integration)**: When `Crawl4AiSettings:Enabled` is `true`, `JobScraperService` calls `http://crawler:11235/crawl`.
- [ ] **AC-5 (Resilient Baseline Fallback)**: If Crawl4AI times out (> 15s), returns HTTP error, or is offline, `JobScraperService` seamlessly executes the existing AngleSharp / `HttpClient` / Workday API logic without throwing unhandled exceptions to the user.

## Functional Requirements
- **FR-1**: Dispatch asynchronous crawl requests from `JobScraperService` to the Crawl4AI microservice passing `urls`, `enable_stealth=true`, and auto-expansion JavaScript hooks.
- **FR-2**: Parse incoming Crawl4AI responses extracting `markdown`, `title`, and metadata.
- **FR-3**: Deduce `company` and clean `jobTitle` from Crawl4AI metadata and title delimiters (e.g., `"Role at Company — Location"`).
- **FR-4**: Supply extracted markdown directly to `IAtsScoringEngine` and `JobDescription` domain entity.
- **FR-5**: Support runtime disable toggle (`Crawl4AiSettings:Enabled = false`) via configuration without requiring code rebuilds.

## Non-functional Requirements
- **Performance**: P95 crawl latency must be `< 3.5 seconds` for public job postings.
- **Security**: Container runs within private Docker bridge network (`infra_vedha-network`). API authentication enforced via bearer token (`CRAWL4AI_API_TOKEN`).
- **Scalability**: Docker resource limits bounded to 2GB RAM and 1.5 CPUs; Crawl4AI Janitor process actively reaps idle Chromium processes.
- **Reliability**: Dual-engine redundancy: primary Crawl4AI engine with automatic fallback to native AngleSharp/HttpClient scraper.
- **Maintainability**: Clean dependency injection through `ICrawl4AiService` decoupled from domain business logic.

## Architecture
```
                               Candidate Pastes URL
                                        │
                                        ▼
                    +───────────────────────────────────────+
                    | .NET WebApi (JobScraperService)      |
                    +───────────────────┬───────────────────+
                                        │
                             ┌──────────┴──────────┐
             (Crawl4AI Enabled)                    (Fallback / Failure)
                             │                                      │
                             ▼                                      ▼
          +─────────────────────────────────────+        +────────────────────+
          | vedha-crawler (:11235)              |        | Existing AngleSharp|
          | - Playwright Stealth                |        | / Direct HTTP      |
          | - Auto "Show more" expansion        |        +────────────────────+
          | - Noise-free Markdown generation    |
          +──────────────────┬──────────────────+
                             │
                             ▼
          +─────────────────────────────────────+
          | IAtsScoringEngine & Gemini Pipeline |
          | - 100% requirements captured         |
          | - Real 90%+ ATS Score (No fallback)  |
          +─────────────────────────────────────+
```

## API Changes
No public breaking API changes. Internal contracts added:
- **`ICrawl4AiService`**:
  ```csharp
  public record Crawl4AiResultDto(bool Success, string Markdown, string? Title, string? ErrorMessage);
  public interface ICrawl4AiService
  {
      Task<Result<Crawl4AiResultDto>> CrawlAsync(string url, CancellationToken cancellationToken = default);
  }
  ```
- **Crawl4AI REST Payload (`POST http://crawler:11235/crawl`)**:
  ```json
  {
    "urls": ["https://www.linkedin.com/jobs/view/..."],
    "browser_config": {
      "type": "BrowserConfig",
      "params": { 
        "headless": true, 
        "enable_stealth": true,
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      }
    },
    "crawler_config": {
      "type": "CrawlerRunConfig",
      "params": {
        "delay_before_return_html": 4.0,
        "remove_overlay_elements": true,
        "remove_consent_popups": true
      }
    }
  }
  ```

## Database Changes
None. The resulting Markdown is saved directly to the existing `JobDescription.RawDescription` and `JobDescription.SanitizedText` columns in PostgreSQL.

## UI Changes
1. **Target Job URL Scrape**: The existing Orchestrator and Studio input fields (`Target Job URL`) function identically, but benefit from 100% complete text population and zero truncated text.
2. **Master Resume Upload UX**: Added real-time animated loading state in `MasterResumePage.tsx` during resume upload and multimodal AI extraction, with progressive step feedback and a disabled dropzone to prevent duplicate submissions.

## Edge Cases
1. **Hard Authwall (Private/Closed Postings)**: If a job posting requires a logged-in user account, Crawl4AI detects an auth wall or minimal text; system falls back to notifying candidate to use the Chrome Extension or paste raw text.
2. **Container Cold Start / Crash**: If `vedha-crawler` is starting up or temporarily offline, `JobScraperService` catches the connection exception and falls back to AngleSharp in `< 50ms`.
3. **Huge Webpages (> 2MB)**: Crawl4AI strips non-content elements and returns trimmed markdown, preventing out-of-memory errors on large pages.
4. **Client-Side SPA Hydration Delays (Naukri/Next.js)**: Configured 4.0s delay (`delay_before_return_html: 4.0`) so asynchronous client-side API fetches and Next.js DOM hydration complete before taking snapshot.

## Risks
1. **Resource Consumption**: Headless Chromium instances consume memory.
   - *Mitigation*: Limit container memory to 2GB in `docker-compose.yml`; Crawl4AI includes an integrated Janitor process that terminates idle Chromium processes automatically.
2. **IP Reputation / Cloud WAF**: Cloud IPs may occasionally get challenge pages from Akamai.
   - *Mitigation*: Support residential proxy URL configuration in `CrawlerRunConfig` and maintain the Chrome Extension as the client-side ground truth.

## Future Extensions
1. **Structured Pydantic Extraction**: Pass a Pydantic schema to Crawl4AI to extract skills, certifications, and years of experience directly during the initial browser pass.
2. **Deep Company Culture Crawling**: Enable multi-page crawling of hiring company `About Us` and `Engineering Blog` pages to enrich cover letters and interview prep.

---

## Changelog
- **2026-10-06 03:08:00 IST**: Full Feature Specification updated to adhere strictly to all mandatory sections of `AGENTS.md` and `GEMINI.md`.
- **2026-10-06 03:32:00 IST**: Updated payload contract to Crawl4AI v0.9.4 `@params` deserializer standard with `delay_before_return_html: 4.0` for SPA hydration (Naukri/Next.js). Added Resume Upload visual loading requirements.
- **2026-10-06 03:55:00 IST**: Fixed ATS scoring and keyword extraction gap where under-specified Gemini prompts omitted technical arrays (`mustHaveSkills`, `keywords`), causing an artificial 33% ATS score cap. Added explicit schema prompt constraints, deterministic boundary-safe regex taxonomy fallback (`EnsureKeywordsPopulated`), and database backfill for existing parsed jobs and scorecards.
- **2026-10-06 04:02:00 IST**: Added targeted AI keyword extraction fallback strictly when initial extraction and taxonomy return zero keywords (`ExtractKeywordsFallbackWithAiAsync`). Implemented futuristic minimalistic aesthetic UI/UX overhaul featuring Three.js neural constellation background canvas (`FuturisticCanvas3D`), 3D holographic cards, cybernetic telemetry headers, and glowing radial SVG ATS score gauge.



