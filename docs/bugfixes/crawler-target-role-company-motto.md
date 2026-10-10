# Bug Fix: Crawler stored the company motto as the target role

## Classification
Bug Fix

## Root Cause
Crawl4AI returns the document `<title>` and the first markdown heading. On company career pages those strings are branding, for example `Stripe | Financial infrastructure for the internet` or `Acme — We help teams ship faster`.

`JobScraperService` treated every delimiter split as `role - company`. When the separator was a pipe, an en dash, or a motto phrase, the whole branding string stayed in `Title`. `JobDescriptionCommandHandler` then copied that string onto `JobDescription.TargetRole`, overwriting the job title the posting actually contained.

## Proposed Fix
`JobPostingTitleParser` classifies each title segment as a job title, a company name, a location, noise (`LinkedIn`, `Careers`), or a motto. A segment is a role only when it contains a role signal such as Engineer, Manager, or Director. Motto sentences are never saved as the role. When the page title is branding, the parser reads later markdown or HTML headings (`Software Engineer, Payments`) and labeled lines (`Job Title:`).

The same refinement runs for the AngleSharp fallback so a hero `<h1>` cannot become the target role either.

## Files affected
- `backend/src/ResumeTailor.Infrastructure/WebScraping/JobPostingTitleParser.cs`
- `backend/src/ResumeTailor.Infrastructure/WebScraping/JobScraperService.cs`
- `backend/tests/ResumeTailor.UnitTests/JobPostingTitleParserTests.cs`
- `backend/tests/ResumeTailor.UnitTests/JobScraperTests.cs`

## Regression Risks
A short, unusual title with no role word (for example a pure internal code) can be left empty so the later AI schema extraction supplies it. Hyphenated titles such as `Senior Software Engineer - Platform` stay intact because the suffix is not treated as a company.

## Test Strategy
Unit tests cover `Role at Company — Location`, `Role | Company | LinkedIn`, company-motto page titles, and hyphenated role suffixes. Scraper tests cover a Crawl4AI markdown fixture and a static company career page.

## Verification Steps
`dotnet test backend/tests/ResumeTailor.UnitTests/ResumeTailor.UnitTests.csproj --filter "FullyQualifiedName~JobScraperTests|FullyQualifiedName~JobPostingTitleParserTests"`

## Changelog
### 2026-10-10T13:10:00Z
- **Changes Made**: Added role-versus-motto classification and wired it into both Crawl4AI and AngleSharp title resolution.
- **Rationale**: Issue #12. The crawler filled Target Role with the company name and its motto.
- **Impacted Components**: Web scraping infrastructure, job description ingestion.
