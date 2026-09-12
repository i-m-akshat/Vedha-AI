# Feature Specification: Vedha AI — The AI Career Operating System

## 1. Overview
Vedha AI is an enterprise-grade AI Career Operating System. The platform allows job seekers to upload an immutable Master Resume (PDF, DOCX, Markdown), provide a target Job Description via direct text or URL (LinkedIn, Greenhouse, Lever, Workday, Ashby, Indeed, etc.), and automatically generate an ATS-optimized, tailored resume alongside an in-depth ATS gap analysis, recruiter scorecard, interview preparation suite, and multi-pipeline browser automation copilot.

---

## 2. Business Goal & Value Proposition
- **Problem**: Candidates spend hours manually tweaking resumes for every job opening or get rejected by automated Applicant Tracking Systems (ATS) due to missing semantic keywords, poor formatting, or misaligned experience emphasis.
- **Solution**: Automated parsing, semantic JD extraction, deterministic truth-preserving tailoring (zero hallucinated experience), ATS gap analysis, and single-column ATS-safe PDF/DOCX generation in seconds.

---

## 3. User Stories
- **As a job seeker**, I want to upload my master resume once so that I have a single source of truth for all my achievements, skills, and work history.
- **As a job seeker**, I want to paste a Job URL or raw Job Description so that the system automatically extracts requirements, required skills, tools, and seniority level.
- **As a job seeker**, I want a tailored resume that highlights my most relevant experience and rewrites bullet points to match the target role without inventing fake experience.
- **As a candidate**, I want an ATS Scorecard showing matching keywords, missing keywords, recruiter feedback, and a missing skills learning roadmap.
- **As a candidate**, I want to export my tailored resume as a clean, single-column ATS-safe PDF, formatted DOCX, or Markdown.
- **As a user**, I want an integrated Job Application Tracker (Kanban/Table) to manage application statuses from Saved to Applied, Interviewing, Offered, and Rejected.

---

## 4. Acceptance Criteria
1. **Master Resume Invariance**:
   - Master Resume can be uploaded in `.pdf`, `.docx`, or `.md` format.
   - Parsed into strict JSON schema (`PersonalInfo`, `Summary`, `Experience`, `Projects`, `Skills`, `Education`, `Certifications`, `Achievements`).
   - The master resume is stored immutably and never overwritten by tailored versions.
2. **Web Scraper & Job Extraction**:
   - Scrapes public URLs from LinkedIn, Greenhouse, Lever, Workday, Ashby, Indeed, and generic corporate career sites.
   - Strips boilerplate (navigation, scripts, ads, footers) and uses LLM structuring to extract Title, Company, Seniority, Required Skills, Preferred Skills, Tools, Frameworks, and Responsibilities.
3. **Truth-Preserving Tailoring ("Never Lie" Constraint)**:
   - Zero hallucinated companies, projects, degrees, dates, certifications, or fake achievements.
   - Only reorganizes, rephrases, emphasizes relevant skills/bullets, and optimizes ATS keyword placement.
4. **ATS Scorecard & Gap Analysis**:
   - Computes Match Score (0–100%), Matching Keywords badge cloud, Missing Keywords checklist, Recruiter Feedback, Strengths, Weaknesses, and Skill Gap Roadmap.
5. **Multi-Format Export**:
   - Generates single-column ATS-compliant PDF with standardized typography, perfect margins, and no unreadable tables/columns/graphics.
   - Generates structured `.docx` and `.md` files.
6. **Multi-Engine AI Support**:
   - Provider abstraction supporting OpenAI (`gpt-4o`, `gpt-4o-mini`), Anthropic Claude (`claude-3-5-sonnet`), and Google Gemini (`gemini-2.0-flash`, `gemini-1.5-pro`).
7. **Bonus Features**:
   - Resume Version History with rollback and visual diffing.
   - AI Prompt Template Manager (customizable system/user prompts).
   - Cover Letter Generator and Tailored Interview Question & Answer Coach.
   - Job Application Tracker (Kanban / Table view).
   - Chrome Extension (Manifest V3) for 1-click JD capture.

---

## 5. Non-Functional Requirements
- **Performance**: Document parsing in < 2s; Web scraping in < 3s; AI tailoring streamed in real time.
- **Security**: JWT authentication, OAuth support (Google, GitHub), user-isolated data isolation, encrypted API keys storage.
- **Architecture**: Clean Architecture (.NET 10 Web API), CQRS with MediatR, FluentValidation, EF Core, PostgreSQL, Redis caching, Hangfire background tasks, SignalR live log streaming.
- **Frontend UX**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui components, responsive layout, Dark/Light mode support.

---

## 6. Architecture & Data Contracts

### 6.1 Backend Clean Architecture
- **`Domain`**: Entities (`User`, `MasterResume`, `ResumeVersion`, `GeneratedResume`, `JobDescription`, `ApplicationRecord`, `AtsAnalysis`, `PromptTemplate`), Value Objects, Enums, Domain Exceptions.
- **`Application`**: CQRS Commands & Queries, FluentValidation, MediatR Pipeline Behaviors, AI Provider Abstractions, Document Parsing Interfaces.
- **`Infrastructure`**: EF Core PostgreSQL context, Redis Cache, Hangfire Workers, `PdfPig` / `OpenXml` / `Markdig` parsers, `AngleSharp` crawler, `QuestPdf` ATS generator, Multi-LLM provider clients.
- **`WebApi`**: REST Controllers, SignalR `TailoringProgressHub`, Rate Limiting, Serilog structured logging, Swagger / OpenAPI.

### 6.2 Frontend Architecture
- **Vite + React 19 + TypeScript + Tailwind CSS + Zustand + TanStack Query + Framer Motion**:
  - `DashboardPage`: Overview metrics, recent applications, quick actions, ATS trend graphs.
  - `MasterResumePage`: Drag-and-drop parser, section-by-section JSON and form editors.
  - `TailorStudioPage`: Job URL / text input, model selector, real-time live generation terminal with streaming steps.
  - `ResultStudioPage`: 3-Column layout (Left: Master Resume, Center: Tailored Resume with diffs & inline editor, Right: ATS Scorecard & Recruiter Feedback).
  - `TrackerPage`: Kanban board (Saved, Applied, Interviewing, Offered, Rejected) with linked resumes and notes.
  - `AnalyticsPage`: Application velocity, ATS match rate distributions, top missing skills heatmap.
  - `PromptsPage`: Custom prompt editor with template variable placeholders.
  - `SettingsPage`: AI provider API keys, theme settings, profile settings.

---

## 7. Edge Cases & Risk Mitigation
- **Bot-blocked Job URLs (e.g. LinkedIn Auth Wall)**: Fallback gracefully to direct HTML text extraction or alert user to paste raw description text.
- **Malformed Resumes (complex multi-column PDFs)**: Robust multi-pass text extraction with heuristic section segmentation and LLM schema structuring.
- **Hallucination Risk**: Strict JSON schema validation and subset comparison preventing addition of non-master resume entities.

---

## 8. Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-09-12 | Principal Engineer | v1.0.0 | Initial Feature Specification | Foundation baseline for SaaS platform | All |
| 2026-09-12 | Principal Engineer | v1.1.0 | Added `infra/` container orchestration & synchronization policy | Enforces strict centralized infrastructure isolation and security | `infra/`, `.gitignore` |
| 2026-09-12 | Principal Engineer | v1.2.0 | Introduced `IPasswordHasher` and SQLite dev fallback in Clean Architecture | Decouples hashing from Application layer and provides instant local developer onboarding | `ResumeTailor.Application`, `ResumeTailor.Infrastructure` |
| 2026-09-12 | Principal Engineer | v1.3.0 | Added SignalR WebSocket live log streaming endpoint `/hubs/progress` | Real-time candidate feedback during long-running scraping & LLM tasks | `ResumeTailor.WebApi`, `TailoringProgressHub` |
