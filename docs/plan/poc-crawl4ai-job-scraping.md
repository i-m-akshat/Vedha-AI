# Implementation Plan: Proof of Concept — Crawl4AI Job Scraping Microservice

## Step-by-Step Implementation Plan

### 1. Files to Create
- [`backend/src/ResumeTailor.Infrastructure/WebScraping/Crawl4AiService.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/WebScraping/Crawl4AiService.cs):
  - Implements `ICrawl4AiService` calling `http://crawler:11235/crawl`.
  - Configures Playwright stealth mode and automatic JavaScript accordion unrolling snippet.
  - Implements robust error handling and timeout bounds.
- [`docs/specs/poc-crawl4ai-job-scraping.md`](file:///A:/AIProjects/Resumebuilder/docs/specs/poc-crawl4ai-job-scraping.md):
  - Comprehensive feature specification meeting all `AGENTS.md` and `GEMINI.md` standards.
- [`docs/plan/poc-crawl4ai-job-scraping.md`](file:///A:/AIProjects/Resumebuilder/docs/plan/poc-crawl4ai-job-scraping.md):
  - Step-by-step implementation and verification plan.

### 2. Files to Modify
- [`backend/src/ResumeTailor.Application/Common/Interfaces/ApplicationInterfaces.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Common/Interfaces/ApplicationInterfaces.cs):
  - Add `ICrawl4AiService` interface and `Crawl4AiResultDto` record.
- [`backend/src/ResumeTailor.Infrastructure/WebScraping/JobScraperService.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/WebScraping/JobScraperService.cs):
  - Inject optional `ICrawl4AiService? crawl4AiService`.
  - Prioritize Crawl4AI as primary scraping engine for dynamic URLs.
  - Wrap in `try-catch` with automatic fallback to existing AngleSharp / `HttpClient` / Workday API logic.
- [`backend/src/ResumeTailor.Infrastructure/DependencyInjection.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/DependencyInjection.cs):
  - Register `services.Configure<Crawl4AiSettings>(...)` and `services.AddHttpClient<ICrawl4AiService, Crawl4AiService>()`.
- [`backend/src/ResumeTailor.WebApi/appsettings.json`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.WebApi/appsettings.json):
  - Add `Crawl4AiSettings` configuration block.
- [`infra/docker-compose.yml`](file:///A:/AIProjects/Resumebuilder/infra/docker-compose.yml) & [`docker-compose.yml`](file:///A:/AIProjects/Resumebuilder/docker-compose.yml):
  - Add `crawler` service using `unclecode/crawl4ai:latest` on port `11235:11235`.
  - Add `Crawl4AiSettings__*` environment variables to `backend` service.
- [`infra/.env.example`](file:///A:/AIProjects/Resumebuilder/infra/.env.example) & `infra/.env`:
  - Add `CRAWLER_PORT=11235`, `CRAWLER_URL=http://crawler:11235`, and `CRAWL4AI_API_TOKEN=vedha_crawler_token_2026`.
- [`infra/localhost_proxy.py`](file:///A:/AIProjects/Resumebuilder/infra/localhost_proxy.py):
  - Add port `11235` to forwarded port list for transparent Windows localhost access.
- [`infra/build_and_start.ps1`](file:///A:/AIProjects/Resumebuilder/infra/build_and_start.ps1):
  - Add startup verification for `vedha-crawler` container.

### 3. Database Migrations
- **None**: Extracted markdown and parsed metadata map cleanly to the existing `JobDescription` entity schema in PostgreSQL.

### 4. API Changes
- **No breaking public API changes**. Internal contracts and dependency injection updated:
  - `ICrawl4AiService.CrawlAsync(string url, CancellationToken ct)`

### 5. Configuration Changes
- Added `Crawl4AiSettings` to `appsettings.json`:
  ```json
  "Crawl4AiSettings": {
    "BaseUrl": "http://crawler:11235",
    "Enabled": true,
    "ApiToken": "vedha_crawler_token_2026",
    "TimeoutSeconds": 20
  }
  ```

### 6. Testing Strategy
- **Unit Testing**:
  - Run `dotnet test backend/ResumeTailor.sln` to confirm 0 regressions in existing tests (35/35 passing).
  - Verify optional constructor parameter in `JobScraperService` does not break mock unit tests.
- **Build & Compilation**:
  - Run `dotnet build backend/ResumeTailor.sln` ensuring clean compilation.
- **Integration & Fallback Verification**:
  - Verify container status and health check: `curl http://localhost:11235/health`.
  - Verify fallback behavior when crawler service is disabled or unreachable.

### 7. Deployment Considerations
- Pull open-source image `unclecode/crawl4ai:latest` in rootless Podman machine.
- Container memory bounded to 2GB to prevent memory spikes during high-throughput crawling.

### 8. Rollback Strategy
- If Crawl4AI has compatibility issues, toggle `Crawl4AiSettings:Enabled = false` in `appsettings.json` or environment variables. The system immediately reverts to 100% native AngleSharp / `HttpClient` scraping with zero code changes or downtime.

---

## Changelog
- **2026-10-06 03:08:30 IST**: Detailed step-by-step implementation plan updated to strictly follow all required sections of `AGENTS.md` and `GEMINI.md`.
