# Implementation Plan: Vedha AI Platform

## 1. Scope & Execution Strategy
Build the complete, production-ready Vedha AI Career Operating System across 5 execution phases:
- **Phase 1: Backend Architecture (.NET 10 Web API + Clean Architecture)**
- **Phase 2: Frontend Client (React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui)**
- **Phase 3: Chrome / Browser Extension (Manifest V3)**
- **Phase 4: Infrastructure (`infra/`), Docker Compose, Testing & Documentation**

### Infrastructure & Environment Standards
- All container configs, Dockerfiles, and compose files reside strictly in `infra/`.
- `infra/.env.example` and `infra/.env` are kept strictly in sync for all configuration variables.
- `infra/.env` is ignored by `.gitignore` and never committed to version control.

---

## 2. Step-by-Step Task Breakdown

### Phase 1: Backend (.NET 10 Web API, Clean Architecture, CQRS)
1. **Solution Structure & Dependencies**:
   - Create solution `ResumeTailor.sln` with projects:
     - `src/ResumeTailor.Domain`
     - `src/ResumeTailor.Application`
     - `src/ResumeTailor.Infrastructure`
     - `src/ResumeTailor.WebApi`
     - `tests/ResumeTailor.UnitTests`
     - `tests/ResumeTailor.IntegrationTests`
   - Install packages: MediatR, FluentValidation, EF Core (PostgreSQL & SQLite for local), PdfPig, DocumentFormat.OpenXml, Markdig, AngleSharp, QuestPDF, Microsoft.AspNetCore.Authentication.JwtBearer, Swashbuckle.AspNetCore, Serilog, SignalR.
2. **Domain Layer**:
   - Entities: `User`, `MasterResume`, `ResumeVersion`, `GeneratedResume`, `JobDescription`, `AtsAnalysis`, `ApplicationRecord`, `PromptTemplate`, `UsageLog`.
   - Value Objects: `PersonalInfo`, `WorkExperienceItem`, `ProjectItem`, `EducationItem`, `SkillCategory`, `CertificationItem`, `AchievementItem`, `AtsScoreBreakdown`.
   - Enums: `ApplicationStatus`, `JobSource`, `AiProviderType`, `ResumeFormat`, `TemplateStyle`.
3. **Application Layer**:
   - CQRS Commands & Queries for Auth, Master Resumes, Job Scraping/Parsing, Tailoring, ATS Analysis, Applications Tracker, Tools (Cover Letter, Interview Prep, Skill Roadmap), Prompts, and Analytics.
   - Validation pipeline behaviors using FluentValidation.
4. **Infrastructure Layer**:
   - `PdfDocumentParser`: Multi-page text and structural section extraction using PdfPig.
   - `DocxDocumentParser`: OpenXML paragraph and table text extraction.
   - `MarkdownDocumentParser`: AST extraction using Markdig.
   - `JobScraperService`: AngleSharp HTML sanitization and readability engine for LinkedIn, Greenhouse, Lever, Workday, Ashby, Indeed.
   - `AiServiceFactory` & Multi-Provider Engine (OpenAI, Claude, Gemini) with fallback, dynamic token rendering, and structured JSON parsing.
   - `AtsScoringEngine`: Semantic keyword frequency, match score algorithm, gap analysis, and recruiter advice generator.
   - `ExportServices`: `QuestPdfResumeGenerator` (pixel-perfect ATS PDF), `OpenXmlDocxGenerator`, and `MarkdownResumeGenerator`.
   - `ApplicationDbContext`: EF Core models, configurations, and automated migrations.
5. **Web API & Real-time Layer**:
   - Controllers for all REST endpoints with Swagger OpenAPI schema.
   - `TailoringProgressHub` (SignalR) to broadcast live progress logs (`Scraping`, `Structuring JD`, `Analyzing Gaps`, `Tailoring Resume`, `Generating ATS Report`).
   - Global exception handling middleware, CORS, rate limiting, and JWT authentication.

---

### Phase 2: Frontend (React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui)
1. **Frontend Project Setup**:
   - Initialize Vite React TypeScript project in `frontend/`.
   - Configure Tailwind CSS, Lucide icons, Framer Motion, TanStack Query, Zustand, Axios, and Radix UI / custom components.
2. **State Management & API Client**:
   - API client with JWT interceptor and automatic token refresh.
   - Zustand stores: `useAuthStore`, `useResumeStore`, `useTailorStudioStore`, `useTrackerStore`, `useThemeStore`.
   - SignalR client hook for real-time progress logging.
3. **UI Components & Pages**:
   - **Dashboard Page**: Metrics cards, ATS match distribution, recent applications, quick actions.
   - **Master Resume Page**: Drag-and-drop file uploader (PDF/DOCX/MD), section-by-section JSON and form editors.
   - **Tailor Studio Page**: Dual input (Job URL or raw text), AI model & template selector, live generation progress terminal with real-time log steps.
   - **3-Column Result Studio**:
     - *Left*: Master Resume (Original reference).
     - *Center*: Tailored Resume preview with diff highlights, template switcher (Classic, Modern, Executive, Tech), inline editor, and download buttons (PDF, DOCX, MD).
     - *Right*: In-depth ATS Scorecard (Match Score gauge, matching/missing keywords cloud, recruiter feedback, missing skills roadmap, Cover Letter generator modal, Interview Prep coach modal).
   - **Job Application Tracker**: Kanban board & table view with drag-and-drop status flow (`Saved`, `Applied`, `Interviewing`, `Offered`, `Rejected`), linked resumes, and interview dates.
   - **History Page**: Version history of all generated resumes with instant diffing and rollback.
   - **Analytics Page**: Application velocity, ATS match trends, skill demand chart.
   - **Settings & AI Prompts Page**: API key management, custom prompt editor with live variable placeholders.

---

### Phase 3: Chrome / Browser Extension (Manifest V3)
1. Chrome Extension in `extension/`:
   - `manifest.json`: Manifest V3 configuration with permissions for `activeTab`, `storage`, and host permissions.
   - `content.ts`: Target-specific DOM parsers for LinkedIn, Greenhouse, Lever, Workday, Ashby, Indeed, and generic job boards.
   - `popup.html` / `popup.js`: Modern UI showing extracted Job Title, Company, Description with a 1-click "Send to Vedha AI Studio" button and in-page auto-fill.
   - `background.ts`: API communication bridge.

---

### Phase 4: Containerization, Testing & Deployment Readiness
1. `docker-compose.yml` for multi-container orchestration (`backend`, `frontend`, `postgres`, `redis`).
2. Unit and Integration tests for backend parsers, AI providers, and ATS scoring engine.
3. Complete `README.md` with setup guides, API documentation, and architecture diagrams.

---

## 3. Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-09-12 | Principal Engineer | v1.0.0 | Initial Implementation Plan | Foundation execution roadmap | All |
| 2026-09-12 | Principal Engineer | v1.1.0 | Added `infra/` folder configuration & synchronization protocol | Enforces strict centralized infrastructure isolation | `infra/`, `.gitignore` |
| 2026-09-12 | Principal Engineer | v1.2.0 | Suppressed NuGet Audit warnings during local development via `Directory.Build.props` | Prevents package audit warnings from failing clean builds in .NET 10 | `Directory.Build.props` |
| 2026-09-12 | Principal Engineer | v1.3.0 | Added SignalR live log streaming & `TailoringProgressHub` | Enables live execution feed in UI terminal | `ResumeTailor.WebApi`, `TailoringProgressNotifier` |
