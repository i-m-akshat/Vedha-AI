# ResuMate AI Platform Architecture

## 1. High-Level Architecture Overview

ResuMate AI is an enterprise-grade SaaS platform designed for AI-driven resume tailoring, ATS optimization, semantic job description parsing, and application tracking. The system follows Clean Architecture principles with CQRS (Command Query Responsibility Segregation) and Domain-Driven Design (DDD).

```
                      +-------------------------------------------------------+
                      |                   Client Layer                        |
                      |  - React 19 + TypeScript + Vite SPA                   |
                      |  - Chrome Extension (Manifest V3)                     |
                      +---------------------------+---------------------------+
                                                  | REST API & SignalR WebSockets
                                                  v
                      +-------------------------------------------------------+
                      |              ResumeTailor.WebApi Layer                |
                      |  - Controllers & Endpoints                            |
                      |  - SignalR Hub (TailoringProgressHub)                 |
                      |  - Auth Middleware (JWT & OAuth)                      |
                      |  - Rate Limiting, CORS, Global Error Handler          |
                      +---------------------------+---------------------------+
                                                  | MediatR Pipeline
                                                  v
                      +-------------------------------------------------------+
                      |           ResumeTailor.Application Layer              |
                      |  - CQRS Commands & Queries                            |
                      |  - FluentValidation Pipeline Behaviors                |
                      |  - Domain Event Handlers                              |
                      |  - AI & Document Interfaces                           |
                      +---------------------------+---------------------------+
                                                  |
                     +----------------------------+----------------------------+
                     |                                                         |
                     v                                                         v
+------------------------------------------+             +------------------------------------------+
|       ResumeTailor.Domain Layer          |             |    ResumeTailor.Infrastructure Layer     |
|  - Domain Entities (User, MasterResume,  |             |  - EF Core & PostgreSQL DbContext        |
|    GeneratedResume, JobDescription, etc.)|             |  - Document Parsers (PdfPig, OpenXML, MD)|
|  - Value Objects (ResumeSchema, ATSScore)|             |  - Web Scraper (AngleSharp + Readability)|
|  - Enums, Domain Events & Exceptions     |             |  - AI Multi-Provider (OpenAI/Claude/Gem) |
|  - Repository Interfaces & Specs         |             |  - ATS & Diff Scoring Engines            |
+------------------------------------------+             |  - Export Generators (QuestPDF, Docx, MD)|
                                                         |  - Redis Cache & Hangfire Job Workers    |
                                                         +------------------------------------------+
```

---

## 2. Layer Responsibilities

### 2.1 Domain Layer (`ResumeTailor.Domain`)
- Contains enterprise business rules, core entities, and value objects.
- **Zero dependencies** on database, web frameworks, or third-party SDKs.
- Key Entities: `User`, `MasterResume`, `ResumeVersion`, `GeneratedResume`, `JobDescription`, `AtsAnalysis`, `ApplicationRecord`, `PromptTemplate`, `UsageLog`.
- Key Value Objects: `PersonalInfo`, `WorkExperienceItem`, `ProjectItem`, `EducationItem`, `SkillCategory`, `CertificationItem`, `AchievementItem`, `AtsScoreBreakdown`.

### 2.2 Application Layer (`ResumeTailor.Application`)
- Implements CQRS handlers using MediatR.
- Contains application interfaces (`IAiService`, `IDocumentParser`, `IJobScraperService`, `IAtsScoringEngine`, `IResumeExportService`, `IApplicationDbContext`).
- Pipeline behaviors handle validation (FluentValidation), structured logging, and performance monitoring.

### 2.3 Infrastructure Layer (`ResumeTailor.Infrastructure`)
- **Document Parsers**:
  - `PdfPig`: Text stream extraction, column-unwrapping, font size heuristics for header detection.
  - `DocumentFormat.OpenXml`: Paragraph, bullet, and table extraction for `.docx`.
  - `Markdig`: CommonMark and GitHub Flavored Markdown parsing.
- **Web Scraping Engine**:
  - AngleSharp HTTP client with user-agent spoofing, header management, DOM sanitizer, script/style/nav remover, and job-board-specific schema extractors (LinkedIn, Greenhouse, Lever, Workday, Ashby, Indeed).
- **AI Multi-Provider Engine**:
  - Provider abstraction for OpenAI (`gpt-4o`, `gpt-4o-mini`), Anthropic Claude (`claude-3-5-sonnet`), and Google Gemini (`gemini-2.0-flash`, `gemini-1.5-pro`).
  - Structured JSON schema output enforcement and fallback mechanisms.
- **ATS & Diff Engine**:
  - Strict subset truth verification ("Never Lie" rule).
  - Keyword frequency analysis, TF-IDF / cosine keyword matching, gap classification (Must-Have vs Nice-To-Have), and recruiter feedback generation.
- **Export Engine**:
  - Single-column ATS typography PDF rendering via `QuestPDF`.
  - Native `.docx` generation via `DocumentFormat.OpenXml`.
  - Clean Markdown formatting.
- **Persistence & Caching**:
  - EF Core with PostgreSQL provider, connection pooling, and automatic migrations.
  - Redis cache service with in-memory fallback.

### 2.4 Web API Layer (`ResumeTailor.WebApi`)
- ASP.NET Core 10 Web API.
- SignalR `TailoringProgressHub` for broadcasting live progress steps to the frontend in real time (`Scraping`, `Analyzing`, `Tailoring`, `Scoring`, `Exporting`).
- Global exception handling middleware returning RFC 7807 problem details.
- Rate limiting and JWT authentication with ClaimsPrincipal resolution.

---

## 3. Data Flow: Tailoring Lifecycle

```
[Job URL / Text] ----> [WebScraperService] ----> [Cleaned Text]
                                                       |
[Master Resume]  ----> [DocumentParser]    ----> [Resume JSON]
                                                       |
                                                       v
                                            [AI Multi-Provider]
                                                       |
                     +---------------------------------+---------------------------------+
                     |                                                                   |
                     v                                                                   v
        [Truth-Preserved Tailored Resume]                                      [ATS Gap Analysis & Score]
                     |                                                                   |
                     +---------------------------------+---------------------------------+
                                                       |
                                                       v
                                          [SignalR Live Log Stream]
                                                       |
                                                       v
                                       [Export: ATS PDF / DOCX / MD]
```

---

## 4. Security & Guardrails
- **Truth Preservation Guardrail**: Algorithmic validator checks that tailored experience entries do not introduce non-existent companies, universities, or unverified certifications.
- **Encrypted Provider Keys**: User-provided API keys are encrypted at rest using AES-256 before storage.
- **Zero Raw File Storage of Sensitive Data**: Only structured JSON representations are stored in database records; uploaded binary files are processed in-memory streams.
