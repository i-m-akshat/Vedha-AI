# Feature Specification: Production Hardening, Security, AI Resilience, Orchestrator Session Management & Copilot Safety

## 1. Overview & Problem Statement

Vedha AI has established foundational capabilities across resume parsing, ATS scoring, multi-provider AI tailoring, and job application orchestration. A thorough engineering audit revealed several critical architectural and operational gaps required for enterprise production readiness:

1. **Security & PII Protection**: Candidate profiles, resumes, and user-provided LLM API keys are stored in plaintext. PII (salary, visa status, contact info) and secrets require AES-256-GCM encryption at rest, along with GDPR-compliant data export and account purging.
2. **AI Multi-Provider Fallback & Metric Invariant Verification**: LLM API calls lack automated fallback on HTTP 429/503. LLM bullet point rephrasing risks quantitative metric inflation (e.g. changing 15% to 85%), requiring deterministic numerical invariant validation.
3. **Orchestrator Session Persistence & CAPTCHA Human Handoff**: Multi-portal applications (LinkedIn, Workday, Naukri) require secure session/cookie persistence so users do not log in on every application run, as well as dynamic CAPTCHA challenge detection and graceful human handoff.
4. **ATS Page Budgeting & Orphan Line Prevention**: QuestPDF currently uses continuous page flow, which can produce awkward 2-line page spills. A strict document budgeting and font/margin auto-scaling engine is required for single-page and dual-page guarantees.
5. **Interactive Inline Result Editing**: Candidates need the ability to manually edit tailored bullet points, summary text, and skills directly in the Result Studio before exporting to PDF/DOCX.
6. **Infrastructure, Concurrency & Database Migrations**:
   - Transition from `EnsureCreated()` to formal EF Core migrations (`MigrateAsync()`).
   - Add ASP.NET Core Health Checks (`/healthz`, `/ready`) for PostgreSQL and Redis.
   - Add Redis SignalR backplane for multi-container horizontal scalability.
   - Implement rate-limiting middleware (Sliding Window) to protect endpoints.
7. **Chrome Extension Bi-Directional Bridge**: Seamless JWT authentication storage and 1-click dispatch from active browser tabs to the backend Orchestrator Queue.

---

## 2. Business Goals

- **Zero-Risk Candidate Safety**: Prevent job platform account bans via authenticated client-side extension copilot execution and the Copilot Review Gateway.
- **Enterprise Security & Compliance**: Achieve SOC2 and GDPR compliance with AES-256-GCM encryption at rest, automated data export, and complete account deletion cascades.
- **High Availability & AI Reliability**: Guarantee 99.9% tailoring success via automated multi-provider fallback (Gemini ➔ Claude ➔ OpenAI) and exponential backoff retry policies.
- **Deterministic Truth Preservation**: Mathematically verify both qualitative entities (companies, schools) and quantitative metrics (percentages, dollar amounts, team sizes) against the Master Resume.
- **Flawless ATS Document Formatting**: Ensure generated PDFs adhere strictly to 1-page or 2-page document budgets with zero orphan lines.

---

## 3. User Stories

1. *As a job seeker*, I want my API keys and personal information (visa status, salary history) encrypted at rest so my confidential career data is secure.
2. *As a job seeker*, I want my tailored resume to retain 100% of my real metrics without LLM exaggeration so that I pass technical interviews and background checks.
3. *As a job seeker*, I want the system to automatically failover to Claude or OpenAI if Google Gemini is rate-limited so my tailoring requests never fail.
4. *As a job seeker*, I want my tailored resume PDF to fit precisely on 1 page without awkward line spills onto page 2.
5. *As a job seeker*, I want to edit tailored bullet points directly in the web UI before downloading the final PDF.
6. *As a job seeker*, I want to click one button in my Chrome browser extension to scrape a job and stage it in the Vedha AI Queue.
7. *As a privacy-conscious user*, I want to export all my stored data or permanently purge my account and resumes in compliance with GDPR.

---

## 4. Acceptance Criteria

- [x] All user API keys (OpenAI, Claude, Gemini) and sensitive profile fields (salary, visa status) stored in the database are encrypted at rest using AES-256-GCM.
- [x] AI service requests automatically fall back to secondary providers when encountering HTTP 429 (Too Many Requests) or HTTP 503 (Service Unavailable).
- [x] `AtsScoringEngine` validates quantitative metric invariants (numbers, percentages, currencies) between Master and Tailored resumes, issuing a validation failure if ungrounded metrics are detected.
- [x] Document export engine implements page budgeting with font and padding auto-scaling to prevent orphan page overflows.
- [x] Result Studio allows inline editing of tailored sections and real-time PDF re-generation.
- [x] Account deletion endpoint permanently cascades and purges user resumes, profiles, memories, and queue items.
- [x] Health checks (`/healthz`) and sliding window rate limiting are configured in WebApi.
- [x] Chrome Extension integrates with backend JWT auth and enables 1-click job dispatch to the Application Queue.

---

## 5. System Architecture & Component Interactions

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CLIENT LAYER                                          │
│  - React 19 SPA (Inline Diff Editor, Review Gateway, Live Terminal)                       │
│  - Chrome Extension (Manifest V3 Client-Side Copilot & 1-Click Queue Dispatch)            │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │ REST API (Bearer JWT) & SignalR WebSockets
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                ResumeTailor.WebApi                                        │
│  - Controllers: Auth, Profile, Orchestrator, Tailoring, Tools, Healthz                    │
│  - Middleware: ExceptionHandling, SlidingWindowRateLimiter, Serilog Context               │
│  - SignalR Hub: TailoringProgressHub (with Redis Backplane support)                       │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │ MediatR Pipeline
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                             ResumeTailor.Application                                      │
│  - Encryption Services Contracts (IEncryptionService)                                     │
│  - Resilient AI Multi-Provider Pipeline (IAiServiceFactory)                               │
│  - Quantitative Metric Invariant Rules (IAtsScoringEngine)                                │
│  - Data Export & Account Cascade Purge Handlers                                           │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                   +--------------------------+--------------------------+
                   │                                                     │
                   ▼                                                     ▼
┌──────────────────────────────────────────────┐ ┌───────────────────────────────────────────┐
│             ResumeTailor.Domain              │ │        ResumeTailor.Infrastructure        │
│  - Entities: User, CandidateProfile,         │ │  - AES-256-GCM Encryption Engine          │
│    ApplicationQueueItem, BrowserSession      │ │  - Resilient Multi-Provider Fallback Chain│
│  - Value Objects: MetricInvariant,           │ │  - QuestPDF Budgeting & Orphan Prevention │
│    ResumeSchema, AtsScore                    │ │  - EF Core PostgreSQL / SQLite            │
│  - Pure Domain Invariants                    │ │  - Redis Cache & Distributed State        │
└──────────────────────────────────────────────┘ └───────────────────────────────────────────┘
```

---

## 6. Detailed Technical Specifications

### 6.1 Security: Field-Level AES-256-GCM Encryption
- **Service**: `IEncryptionService` implemented via `AesGcmEncryptionService` using `System.Security.Cryptography.AesGcm`.
- **Key Derivation**: Application key derived from configuration (`SecuritySettings:DataProtectionKey`) with unique 96-bit nonces (IV) and 128-bit authentication tags per field.
- **Encrypted Fields**:
  - `User.OpenAiApiKeyEncrypted`
  - `User.AnthropicApiKeyEncrypted`
  - `User.GeminiApiKeyEncrypted`
  - `CandidateProfile.CurrentSalaryEncrypted`
  - `CandidateProfile.ExpectedSalaryEncrypted`
  - `BrowserSession.SessionCookiesEncrypted`

### 6.2 AI Resilience: Multi-Provider Fallback & Circuit Breaker
- **Execution Order**:
  1. Primary Provider: Configured preferred provider (e.g., `gemini-2.0-flash`).
  2. If primary returns 429 or 5xx: Log warning to SignalR terminal, switch dynamically to fallback provider (e.g., `claude-3-5-sonnet` or `gpt-4o-mini`).
  3. If all fail: Return structured RFC 7807 error detail with remediation steps.

### 6.3 Enhanced Truth Preservation: Quantitative Metric Invariant Validator
- **Problem**: Preventing LLMs from fabricating higher metrics (e.g. 20% ➔ 80%).
- **Rule**: Extract all numerical tokens, percentages (`%`), and currencies (`$`, `€`, `₹`) from Master Resume experience bullets. Any numerical token in a tailored bullet must either:
  1. Match a verified number in the corresponding Master Resume bullet.
  2. Match a calculated aggregate from verified duration dates.

### 6.4 Document Budgeting & Single-Page ATS Optimizer
- **Engine**: QuestPDF dynamic budgeting.
- **Mechanism**:
  - Automatically calculates text density (bullet count, summary length).
  - Adjusts typography scale (9.0pt - 10.5pt), line height (1.15 - 1.3), and vertical spacing (3pt - 6pt) to ensure clean 1-page or 2-page fit without orphan trailing lines.

### 6.5 Interactive Inline Result Editor
- **Frontend**: Add rich inline editing in `ResultStudioPage.tsx`.
- **Flow**: Candidate modifies bullet points or summary text -> clicks "Re-render PDF" -> calls `POST /api/tailor/{id}/update-and-export` -> instantly updates preview.

### 6.7 Platform Safety & Anti-Ban Architecture (Naukri, LinkedIn, Indeed, Workday)
- **Problem**: Job platforms utilize sophisticated bot-detection mechanisms (request velocity tracking, headless browser TLS/canvas fingerprinting, IP ASN reputation, DOM interaction analytics, hidden honeypots, and mouse trajectory vector analysis). Unchecked headless automation leads to immediate shadow-bans, account suspensions, or CAPTCHA challenges.
- **Comprehensive 10-Pillar Anti-Ban Safeguards**:
  1. **Client-Side Browser Execution via Chrome Extension**:
     - Automation logic executes directly within the user's authentic browser session (residential IP, active cookies, valid TLS/WebGL fingerprints, local hardware audio/canvas characteristics).
     - Bypasses Cloudflare, Akamai, and perimeter bot blockers that instantly flag cloud datacenter IPs (AWS, GCP, DigitalOcean).
  2. **The Copilot Review Gateway (100% Anti-Ban Guarantee)**:
     - Automation stages the entire application package (populating contact fields, CTC, notice period, answering screening questions, attaching tailored PDF resume) and **strictly halts** before the final "Submit" / "Apply" action.
     - The human candidate reviews the pre-filled fields and clicks the final submit button manually, ensuring 100% compliance with platform Terms of Service.
  3. **Honeypot Field Detection & Evasion**:
     - Modern career portals insert invisible trap fields (e.g., `<input name="user_url" style="position:absolute;left:-9999px;opacity:0" tabindex="-1">`) designed exclusively to catch naive bots that query `document.querySelectorAll('input')`.
     - Vedha AI evaluates `offsetParent !== null`, `getComputedStyle(el).visibility !== 'hidden'`, `getComputedStyle(el).display !== 'none'`, `el.getAttribute('aria-hidden') !== 'true'`, and bounds check `el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0` before interacting with any input.
  4. **Biometric Keystroke Jitter & Gaussian Typing Simulation**:
     - Eliminates robotic instant property assignments (`element.value = "..."`).
     - Emits realistic synthetic DOM events (`keydown`, `keypress`, `input`, `change`, `blur`) with randomized human-like typing delays (45ms – 110ms per keystroke).
  5. **Realistic Typo Simulation & Backspace Correction**:
     - Simulates authentic human typing behavior by occasionally making 1–2 minor keyboard slips (adjacent QWERTY key) every 40–60 characters followed by an immediate natural `Backspace` and correction.
  6. **Cubic Bezier Mouse Movement with Micro-Jitter**:
     - Mouse movements follow natural cubic Bezier trajectories with variable acceleration, overshoot, deceleration upon approaching target inputs, and micro-movements mimicking a physical human hand.
  7. **Cognitive Dwell Time & Pre-Fill Reading Simulation**:
     - Humans do not begin typing milliseconds after page load.
     - The copilot simulates a cognitive reading pause (3.0s – 7.5s) proportional to the job description text length before initiating form interaction.
  8. **Non-Deterministic Field Interaction Ordering**:
     - Rather than robotically filling inputs in strict top-to-bottom DOM index order, the agent introduces minor non-deterministic sequencing variations (e.g., uploading the resume attachment first or clicking between contact fields naturally).
  9. **Daily Application Ceilings & Session Pacing**:
     - Configurable daily safety ceiling (e.g. max 20–25 applications per 24 hours per platform).
     - Enforces a minimum 60–90 second cooldown between sequential applications and a mandatory 15-minute "coffee break" after every 5 consecutive applications.
     - Enforces normal daytime working hours (08:00 to 22:00 local timezone) to avoid suspicious 3:00 AM burst patterns.
  10. **Graceful CAPTCHA & Security Challenge Human Handoff**:
      - When Cloudflare Turnstile, Arkose Labs, or phone OTP challenges are detected, the agent transitions to `PausedForCaptcha`, plays a chime/visual alert, and hands control to the candidate to solve it naturally before resuming.

---

## 7. API Changes & Contracts

### 7.1 Data Protection & Account Purge (GDPR)
- **`GET /api/auth/export-data`**: Returns complete JSON archive of candidate master resumes, tailored resumes, and application records.
- **`DELETE /api/auth/delete-account`**: Permanently cascades and purges all user data across relational and cache storage.

### 7.2 Encrypted Keys Contract
- **`PUT /api/auth/keys`**: Encrypts incoming keys with AES-256 before database write; masks keys in `GET /api/auth/me`.

### 7.3 Tailored Resume Modification
- **`PUT /api/tailor/{id}`**: Updates tailored JSON schema and recalculates ATS score diffs.

### 7.4 Health Checks & Rate Limiting
- **`GET /healthz`**: System and dependent services health probe (Postgres, Redis, AI).

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Bot Detection / Account Bans on Naukri & LinkedIn** | High | Never automate direct submission in server-side headless browsers; enforce client-side Chrome Extension copilot mode with mandatory user review step, humanized typing delays, honeypot evasion, and daily application ceilings. |
| **Data Leakage of Candidate PII** | High | Implement AES-256-GCM encryption at rest; provide GDPR account purge and data export endpoints. |
| **AI Provider Quota Exhaustion (429)** | Medium | Implement automatic provider fallback chain with exponential backoff. |
| **LLM Quantitative Metric Inflation** | Medium | Implement numerical invariant token matching in `AtsScoringEngine`. |
| **Orphan Lines & Bad Page Breaks in PDF** | Low | Dynamic page budgeting and typography auto-scaling in QuestPDF. |

---

## 9. Changelog

| Date | Changes Made | Rationale | Impacted Components |
| :--- | :--- | :--- | :--- |
| 2026-09-12 | Initialized Production Hardening & Safety Specification | Address security, PII encryption, AI rate limit resilience, and anti-bot copilot safety identified during comprehensive code review. | Domain, Application, Infrastructure, WebApi, Extension |
| 2026-09-12 | Expanded Specification to Address Architectural Gaps | Added QuestPDF document page budgeting, inline tailored resume editor, session management & CAPTCHA handoff, and healthcheck/rate-limiting middleware. | All Layers, Document Export, Frontend, Orchestrator |
| 2026-09-12 | Added Platform Safety & Anti-Ban Architecture (Naukri, LinkedIn, Workday) | Comprehensive defense blueprint covering residential IP extension execution, biometric delays, daily throttling, and human review gateways to prevent account bans. | Extension, Orchestrator, Infrastructure |
| 2026-09-12 | Enhanced Anti-Ban with 10-Pillar Safeguard Matrix | Added Honeypot evasion, Bezier mouse curves, typo-backspace simulation, cognitive dwell time, non-deterministic sequencing, and session break pacing. | Chrome Extension, DOM Mapper, Orchestrator |
