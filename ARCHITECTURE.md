<div align="center">
  <img src="docs/assets/vedha-logo.png" alt="Vedha AI Logo" width="100" style="border-radius: 18px; margin-bottom: 6px;" />
  <h1>Vedha AI — System Architecture</h1>
  <p><strong>Clean Architecture, CQRS, and Multi-Pipeline Engineering Blueprint</strong></p>
</div>

---

## 1. High-Level Architecture Overview

Vedha AI is an enterprise-grade AI Career Operating System designed for AI-driven resume tailoring, ATS optimization, semantic job description parsing, multi-pipeline browser application automation, and career tracking. The system follows Clean Architecture principles with CQRS (Command Query Responsibility Segregation) and Domain-Driven Design (DDD).

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

## 4. Multi-Pipeline Job Application Orchestrator Architecture

```text
                  Paste Job URL
                        │
                        ▼
             Identify Job Source
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
      ▼                 ▼                 ▼
  Pipeline 1        Pipeline 2        Pipeline 3
  LinkedIn           Naukri          External ATS
 (Easy Apply)     (Apply Flow)    (Greenhouse/Lever/
                                   Ashby/Workday/Workable)
      │                 │                 │
      └─────────────────┼─────────────────┘
                        ▼
             Resume Tailoring Engine
                        ▼
         AI Question Answering Engine
       (Grounding on Candidate Profile)
                        ▼
                Application Queue
         [Resume + Cover Letter + Q&A]
                        ▼
        Playwright Automation Engine / Copilot
       (Review Gateway: Staged Before Final Submit)
```

### 4.1 Provider Pipelines (`IJobApplicationProvider`)
- **`GreenhouseProvider`**: Auto-populates personal information, handles multipart ATS resume attachment, and maps screening questions.
- **`LeverProvider`**: Handles Lever application forms, custom URLs, and social profile links.
- **`AshbyProvider`**: Maps Ashby single-page application forms.
- **`LinkedInCopilotProvider`**: Safely steps through LinkedIn Easy Apply wizard, attaches tailored resume PDF, and halts at the final Review Screen for candidate submission.
- **`NaukriProvider`**: Populates CTC, notice period, and key skills for Indian job market applications.
- **`WorkdayProvider`**: Steps through enterprise multi-stage Workday application flows.
- **`GenericBrowserProvider`**: Universal AI-driven DOM heuristic filler for custom company career portals.

### 4.2 Candidate Master Profile & Screening Question Memory
- **Candidate Profile**: Stores Work Authorization status, Visa sponsorship requirement, Notice Period (days), Salary expectations, Relocation/Remote preferences, and a verified **Evidence Base** (key-value achievement snippets).
- **Browser Agent Memory**: Caches answered screening questions hashed by normalized question text per company. When applying to the same company again, past answers are reused instantly with 100% fidelity.
- **AI Question Answering Engine**: Uses Google Gemini (`gemini-2.0-flash`) grounded strictly on Candidate Profile and Master Resume work history to compute exact years of experience, check visa status, and draft concise STAR-format responses.

### 4.3 Review Gateway
- For all external job portals and LinkedIn applications, automation stages the complete package (pre-filled fields + resume attachment) and pauses before the final "Submit" button, giving the candidate complete oversight and eliminating risk.

---

## 5. Security & Guardrails
- **Truth Preservation Guardrail**: Algorithmic validator checks that tailored experience entries do not introduce non-existent companies, universities, or unverified certifications.
- **Encrypted Provider Keys**: User-provided API keys are encrypted at rest using AES-256 before storage.
- **Zero Raw File Storage of Sensitive Data**: Only structured JSON representations are stored in database records; uploaded binary files are processed in-memory streams.

---

## 6. Engineering Innovations & Deep Dive
- For an in-depth breakdown of SOLID principles, Clean Architecture, and GoF patterns applied across this codebase, see [SYSTEM_DESIGN_AND_PATTERNS.md](file:///A:/AIProjects/Resumebuilder/SYSTEM_DESIGN_AND_PATTERNS.md).
- For a deep dive into the 10 hardest engineering challenges solved (mathematical truth preservation, zero-selector DOM mapping, SHA-256 screening memory, and the Copilot Review Gateway), see [INTERESTING_THINGS.md](file:///A:/AIProjects/Resumebuilder/INTERESTING_THINGS.md).

