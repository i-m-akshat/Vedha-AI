# Feature Specification: Real Playwright Browser Automation & Desktop Extension Copilot

## 1. Problem Statement
Previously, the backend orchestrator providers (`JobApplicationProviders.cs`) simulated application submissions by writing mock log messages (e.g. `[LinkedIn Copilot] Application successfully submitted to LinkedIn Easy Apply`) and immediately updating the database status to `Submitted` and the Job Tracker to `Applied`. 

When candidates opened the actual job page on LinkedIn, the job still displayed "Easy Apply", indicating no application was ever submitted. Furthermore:
1. Playwright automation was confined to an offline JetStream worker (`workers/playwright-agent/main.py`) that was never invoked by the Copilot pipeline.
2. LinkedIn requires personal authentication (`li_at` cookie or active browser profile), preventing headless incognito sessions from accessing "Easy Apply".
3. The Chrome Extension (`extension/content.js`) lacked multi-step LinkedIn Easy Apply modal progression.

## 2. Business Goal
Deliver authentic, verifiable end-to-end job application submission across LinkedIn Easy Apply and top enterprise ATS platforms (Greenhouse, Lever, Ashby, Workday, Company Careers). Guarantee 100% truthfulness: never mark an application as `Submitted` unless verified by the live browser DOM or explicitly confirmed by the candidate.

## 3. Architecture & Dual-Engine Strategy

```text
                                 Candidate Action
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        [Desktop Extension Copilot]              [Playwright Engine Service]
      (For LinkedIn Easy Apply / Active Tab)     (For ATS Portals / Autonomous Mode)
                    │                                       │
        • Runs in candidate's authenticated       • Headed/Headless Chromium
          browser tab (session preserved)         • Supports li_at cookie or ATS forms
        • Clicks "Easy Apply"                     • AgentQL / Semantic DOM Form-Filler
        • Traverses multi-step modal:             • Attaches ATS PDF Resume
          - Phone, Email, Location                • Answers screening questions
          - Radio Yes/No & Dropdowns              • Verifies submission DOM element
          - Tailored PDF resume                   • Streams step logs via SignalR
        • Copilot Mode: Pauses at Review HUD                │
        • Submit Mode: Clicks Submit & Confirms             ▼
                    │                            [SignalR Execution Logs]
                    ▼                                       │
            [HTTP API Sync] ────────────────────────────────┘
      /api/orchestrator/queue/{id}/status
                    │
                    ▼
          Truthful Status State Machine:
    Prepared ➔ PausedForUserReview ➔ Submitted
```

### Engine 1: Desktop Extension Copilot (Primary for LinkedIn Easy Apply)
- **Why**: LinkedIn enforces strict anti-bot detection, Cloudflare/Datadome challenges, and session authentication. The candidate is already logged into LinkedIn in their daily Chrome browser.
- **Workflow**:
  1. Candidate navigates to the LinkedIn job posting.
  2. The Extension detects the posting, extracts details, and connects to Vedha AI.
  3. When "Auto-Apply / Fill" is triggered:
     - Locates the "Easy Apply" button (`button.jobs-apply-button`, `button:has-text('Easy Apply')`).
     - Launches the modal dialog (`.jobs-easy-apply-modal`).
     - Steps through each wizard section:
       - **Contact info**: Injects candidate phone, email, country code.
       - **Resume selection**: Uploads or selects the tailored ATS resume.
       - **Screening questions**: Grounded answers from profile knowledge base (years of experience, work authorization, sponsorship, notice period).
       - **Next button navigation**: Advances through steps safely with human-cadence typing and jitter.
     - **Review Gateway**:
       - In Copilot mode, pauses at the final Review step and renders an on-page floating HUD banner:
         `"🎉 Vedha AI Copilot has filled all Easy Apply steps! Please review your answers and click 'Submit application'."`
       - Includes a 1-click button to sync `Submitted` status back to Vedha AI.
       - In Autonomous mode, clicks "Submit application" and waits for `.artdeco-modal` confirmation.
     - Sends an HTTP POST to `/api/orchestrator/queue/{id}/status` marking the queue item as `Submitted` and updates the Job Tracker.

### Engine 2: Playwright Worker Engine (For ATS Portals & Autonomous Pipeline)
- **Why**: Greenhouse, Lever, Ashby, and Workday portals do not require personal social login and can be completely automated via Playwright.
- **Components**:
  - `workers/playwright-agent/main.py`:
    - FastAPI HTTP interface listening on port 8000:
      - `POST /api/playwright/apply`: Executes real Playwright automation for ATS forms and LinkedIn (if cookie provided).
      - `POST /api/playwright/scrape`: Dynamic SPA job scraping with Playwright.
      - `GET /health`: Healthcheck endpoint.
    - Also consumes NATS JetStream `app.resume.generated` for asynchronous autonomous jobs.
  - Multi-Platform DOM Adapters:
    - Greenhouse / Lever / Ashby / Workday form-fillers with file upload and submission confirmation check.
    - LinkedIn Easy Apply automation supporting `li_at` cookie.
- **Truthful Status Contract**:
  - If Playwright cannot apply due to missing authentication on LinkedIn:
    - Returns `AuthenticationRequired`.
    - Logs clear guidance to use the Desktop Extension Copilot or provide `li_at` cookie.
    - Sets queue item status to `PausedForUserReview` (NEVER `Submitted`).

## 4. Truthful State Machine & Anti-Fabrication Rules
1. **Never mock submission**: Providers must never log `Application successfully submitted` unless real submission confirmation was observed in the DOM.
2. **Review Gateway by Default**: When in Copilot mode, the state is `PausedForUserReview`. The user must either confirm in the Review Gateway HUD or click "Mark Submitted" after reviewing on the external site.
3. **Real Verification**: For ATS portals, verify the confirmation URL or DOM element (`Thank you for applying`, `Application submitted`, etc.) before reporting `Submitted`.

## 5. Changelog
- **2026-10-04**: Initial specification for Real Playwright Browser Automation & Desktop Extension Copilot. Eliminated simulated mock submissions, added real LinkedIn Easy Apply modal state machine to Chrome extension, and wired FastAPI HTTP endpoints to the Python Playwright agent.
