# Feature Specification: Job Application Orchestrator & Multi-Pipeline Engine

## 1. Overview & Problem Statement
Job seekers currently face high friction when applying across fragmented hiring platforms (LinkedIn Easy Apply, Naukri, Greenhouse, Lever, Ashby, Workday, Workable, SmartRecruiters). Generic automation bots either get banned (due to aggressive unattended LinkedIn activity) or fail on dynamic ATS screening questionnaires.

The **Job Application Orchestrator** solves this by introducing a multi-pipeline architecture that decouples source detection, AI question answering, resume tailoring, and browser execution. It stores candidate data once (work authorization, salary expectations, notice period, tech stack evidence) and equips Playwright browser adapters with an **Application Queue (Prepare -> Review -> Submit)** workflow.

---

## 2. Architecture: Multi-Pipeline Orchestrator

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
           Playwright Automation Engine
  (Headed / Headless with Copilot Review Gateway)
```

---

## 3. Pipeline Definitions

### Pipeline 1: LinkedIn Easy Apply (Copilot Mode)
- **Design Philosophy**: High efficiency with zero account ban risk.
- **Workflow**:
  1. Open LinkedIn job posting via Playwright session.
  2. Detect "Easy Apply" button and launch modal.
  3. Form-filler automatically populates contact, experience, and custom questions using the **AI Question Answering Engine**.
  4. Attaches newly generated ATS-optimized PDF resume.
  5. **Copilot Review Gateway**: Pauses automatically before the final "Submit" button, notifying the user to verify answers and click Submit.

### Pipeline 2: Naukri Apply Pipeline
- **Workflow**:
  1. Analyzes job posting criteria.
  2. Formulates tailored resume and answers notice period, current CTC, and expected CTC questions.
  3. Uploads tailored resume and completes application.

### Pipeline 3: External ATS Adapters (`IJobApplicationProvider`)
- Dedicated DOM and API adapters for top enterprise Applicant Tracking Systems:
  - `GreenhouseProvider`
  - `LeverProvider`
  - `AshbyProvider`
  - `WorkdayProvider`
  - `WorkableProvider`
  - `SmartRecruitersProvider`
  - `BambooHrProvider`
  - `IcimsProvider`
- Executes robust form detection, dropdown selection, file attachment, and dynamic question answering.

---

## 4. External Redirect Handling & Universal ATS Pipeline

When a user provides a job link from an aggregator (LinkedIn external apply, Indeed, Wellfound, Google Jobs) that transfers them to a company career site:

```text
Job Aggregator URL (LinkedIn / Indeed / Naukri)
                     │
                     ▼
       URL Unwinding & Follow-Through
 (Follows HTTP 301/302, JS window.location & "Apply on Company Site" button)
                     │
                     ▼
           Resolved ATS Destination
                     │
      ┌──────────────┴──────────────┐
      ▼                             ▼
Standard ATS Provider        Universal Dynamic Form Filler
(Greenhouse, Lever,          (`GenericAtsProvider`)
 Ashby, Workday, etc.)       (AI DOM Field Heuristic + Q&A)
      │                             │
      └──────────────┬──────────────┘
                     ▼
        Candidate Application Queue
```

1. **Automated URL Unwinding**:
   - The crawler follows multi-hop HTTP redirects, meta refreshes, and tracking links (e.g. `linkedin.com/redir/...`, `bit.ly`, `lever-redirect`) to resolve the canonical destination URL.
   - If the posting contains an "Apply on Company Website" button, Playwright extracts the destination `href` or triggers the click to capture the final application landing page.

2. **Destination ATS Fingerprinting**:
   - Inspects URL domain and DOM signatures:
     - `boards.greenhouse.io` or embedded Greenhouse iframe ➔ `GreenhouseProvider`
     - `jobs.lever.co` ➔ `LeverProvider`
     - `jobs.ashbyhq.com` ➔ `AshbyProvider`
     - `myworkdayjobs.com` / `workday.com` ➔ `WorkdayProvider`
     - Custom corporate career portals ➔ `GenericAtsProvider` (Universal AI Form Filler).

3. **Universal Dynamic Form Filler (`GenericAtsProvider`)**:
   - For bespoke custom career pages:
     - Analyzes DOM input elements (`label`, `aria-label`, `placeholder`, `name`, `id`).
     - Maps standard fields (Name, Email, Phone, Location, Portfolio, LinkedIn, Resume file input).
     - Sends non-standard/custom questions to the **AI Question Answering Engine** (Gemini 2.0 Flash).

4. **Chrome Extension Client-Side Copilot Bridge**:
   - For protected portals (Cloudflare bot verification or mandatory SSO login):
     - The candidate opens the external job tab in their regular browser.
     - The Chrome Extension detects the active ATS form and provides a 1-click **"Auto-Fill Application Package"** button, injecting the tailored resume and answering screening questions in-place.

---

## 5. Primary AI Engine: Google Gemini

The platform uses Google Gemini as its primary intelligence engine with a two-tier configuration:
- **`gemini-2.0-flash` (Default Speed Workhorse)**:
  - Sub-second latency for real-time document parsing, HTML cleaning, ATS keyword gap scoring, and Playwright form question answering.
  - Native structured JSON schema output (`response_mime_type: "application/json"`).
- **`gemini-1.5-pro` / `gemini-2.0-pro` (Deep Synthesis Tier)**:
  - Used for executive resume bullet restructuring using the STAR method, leadership cover letter generation, and mock interview coaching.

---

## 6. Candidate Master Profile Schema
Extended to store all recurring job application questions:
- **Work Authorization & Visa**:
  - Country of citizenship, US / EU / India work authorization, requires visa sponsorship (Yes/No), current visa type.
- **Compensation & Availability**:
  - Expected salary / CTC (currency and range), current salary, notice period (e.g. 15/30/60/90 days), earliest start date.
- **Location Preferences**:
  - Current city/country, willing to relocate (Yes/No), remote preference (Remote only, Hybrid, On-site).
- **Technical & Experience Evidence Base**:
  - Structured evidence mapping (e.g. `Kubernetes` -> "Led cloud migration to EKS at CloudTech, managing 40 nodes").
- **Demographics & Equal Opportunity (Optional)**:
  - Gender, race/ethnicity, veteran status, disability status (for auto-filling voluntary standard US EEO/OFCCP questionnaires).

---

## 7. AI Question Answering Engine
- Analyzes any form question:
  - **Yes/No & Boolean**: Grounds answer in candidate profile; provides evidence if prompt asks for elaboration.
  - **Numeric & Experience**: Computes actual years of experience from Master Resume work history.
  - **Dropdown & Radio Matching**: Computes semantic similarity between form options and candidate profile attributes.
  - **Open-Ended Textareas**: Drafts concise STAR-format responses aligning candidate achievements to the question.

---

## 8. Application Queue & Review Studio
- Instead of blind instant submission:
  1. **Queue Item Generated**: Tailored Resume + Cover Letter + Generated Q&A Answers + Form Field Mappings.
  2. **Review Screen**: Candidate inspects answers, modifies any field if desired.
  3. **Launch Execution**: Click "Execute via Playwright" -> launches headed/headless automation worker with live real-time status.

---

## 9. Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-09-12 | Principal Engineer | v2.0.0 | Multi-Pipeline Job Application Orchestrator Architecture | Transform platform from standalone tailoring into unified application engine with LinkedIn Copilot, Naukri, and External ATS Playwright adapters | `Application/`, `Infrastructure/`, `Domain/`, `frontend/` |
| 2026-09-12 | Principal Engineer | v2.1.0 | Added External Redirect URL Resolver & Universal ATS Form Filler | Seamlessly handles jobs redirecting to external company portals from LinkedIn/Indeed/aggregators | `Infrastructure/WebScraping`, `GenericAtsProvider`, `extension/` |
| 2026-09-12 | Principal Engineer | v2.2.0 | Standardized Google Gemini (2.0 Flash / Pro) as Primary AI Engine | 95% lower operational cost, sub-second latency, 1M+ context window, and native JSON schema validation | `ResumeTailor.Infrastructure/Ai`, `infra/.env` |
| 2026-09-12 | Principal Engineer | v2.3.0 | Implemented Candidate Profile, Screening Memory, Orchestrator & Review Gateway | Full end-to-end multi-pipeline preparation, AI question answering grounding, memory cache, and review gateway | `Domain/`, `Application/`, `Infrastructure/Orchestrator`, `WebApi/`, `frontend/` |
| 2026-09-12 | Principal Engineer | v2.4.0 | Standardized Official "Vedha AI — The AI Career Operating System" Brand & Logo Assets | Integrated official high-resolution logo imagery across web app, browser extension, and documentation suite | `frontend/`, `extension/`, `WebApi/`, `docs/`, `README.md` |
| 2026-09-14 | Principal Engineer | v2.5.0 | Zero-Fallback Architecture & Gemini 3.8 Flash Standardization | Standardized gemini-3.8-flash with resilient 404 fallback, wired SemanticDomFormMapper into GenericBrowserProvider, enabled redirect following, and enriched browser extension autofill with personal profile grounding | `Infrastructure/`, `Application/`, `WebApi/`, `extension/`, `infra/` |
| 2026-10-10 | Principal Engineer | v2.6.0 (proposed) | Aksh agentic copilot proposal (ADR-006) | Conversational HarnessAgent on Microsoft Agent Framework to plan/supervise the copilot pipeline via tool adapters over existing handlers, gated by ATS truth-check and Review Gateway; no pipeline behavior changed until approved | `docs/adr/`, `docs/specs/`, `docs/plan/` |
| 2026-10-10 | Principal Engineer | v2.7.0 (proposed) | Auto-apply stall spike + ban-safe full automation + extension harness loop | Root-caused why pipeline stages but never applies; invert execution to extension-first with observe→fill→validate→fix loop, tiered autonomy, pacing governor | `docs/bugfixes/`, `Application/`, `Infrastructure/Orchestrator`, `workers/`, `extension/` |
| 2026-10-10 | Principal Engineer | v2.7.1 (adopted) | Stealth engines adopted: Patchright (default) + Camoufox (flag-gated) for fallback worker | User decision; free, license-clean (Apache-2.0/MPL-2.0), drop-in; extension-first strategy unchanged | `workers/playwright-agent`, `docs/bugfixes/` |
| 2026-10-10 | Principal Engineer | v2.8.0 (implemented) | Phase 0 Aksh spike + worker stealth swap shipped | MAF 1.24.0 HarnessAgent constructs, recall_memory tool, 58/58 tests; worker Patchright-default with jitter/human-type; FIDES absent on .NET → Layer-2-only | `Infrastructure/Aksh`, `tests/`, `workers/playwright-agent`, `docs/adr/` |
