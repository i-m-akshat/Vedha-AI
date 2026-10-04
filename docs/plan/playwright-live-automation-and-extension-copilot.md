# Implementation Plan: Real Playwright Browser Automation & Desktop Extension Copilot

## 1. Overview
Eliminate simulated C# pipeline logs. Equip the system with:
1. **Desktop Extension Copilot**: Full LinkedIn Easy Apply modal automation with human typing cadence, question grounding, resume upload, and Review Gateway HUD overlay.
2. **Playwright Agent Service**: FastAPI HTTP + NATS worker in `workers/playwright-agent/main.py` executing genuine browser automation with Playwright.
3. **C# Orchestrator & Providers**: `JobApplicationProviders.cs` and `JobApplicationOrchestrator.cs` wired to call the Playwright Agent or guide to Extension Copilot, strictly enforcing truthful states.
4. **Frontend Orchestrator UI**: Clear execution guidance for LinkedIn (Extension Copilot vs Playwright Agent), direct link to open the posting, and manual/automated confirmation controls.

---

## 2. Files to Modify & Create

### A. Chrome Extension
- `extension/content.js`: Add `autoApplyLinkedInEasyApply` function with multi-step modal loop (Contact -> Resume -> Screening questions -> Review -> Submit), Review Gateway HUD overlay, and completion callback.
- `extension/popup.js`: Add "Auto-Apply on LinkedIn / ATS" button handler, live execution step display, and queue item sync.
- `extension/popup.html`: Add Auto-Apply action button and status progress indicator.

### B. Python Playwright Agent
- `workers/playwright-agent/requirements.txt`: Add `fastapi`, `uvicorn`.
- `workers/playwright-agent/main.py`:
  - Add FastAPI HTTP app alongside NATS JetStream listener.
  - Implement `apply_job` endpoint supporting LinkedIn Easy Apply (with `li_at` cookie) and ATS portals (Greenhouse, Lever, Ashby, Workday).
  - Implement `scrape_job` endpoint for dynamic SPA job descriptions.
  - Add genuine submission confirmation check and truthful error reporting.

### C. C# Backend
- `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationProviders.cs`:
  - Update `LinkedInCopilotProvider` to check for Playwright Agent availability or provide explicit instructions to use the Extension Copilot; never pretend it was submitted without live confirmation.
  - Update `GreenhouseProvider`, `LeverProvider`, `AshbyProvider`, `WorkdayProvider`, and `GenericBrowserProvider` to dispatch HTTP requests to the Playwright Worker service (`http://vedha-worker:8000/api/playwright/apply` or `http://localhost:8000/api/playwright/apply`), stream real browser step logs, and return authentic results.
- `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationOrchestrator.cs`:
  - Ensure status only transitions to `Submitted` when verified by the browser engine.

### D. Frontend
- `frontend/src/pages/OrchestratorQueuePage.tsx`:
  - Add "Open Job & Apply via Extension Copilot" button with direct URL link for LinkedIn postings.
  - Clarify the status of items paused at Review Gateway with clear action items.

---

## 3. Verification & Testing Strategy
1. **Unit Tests**: Ensure all existing backend unit tests pass (`dotnet test`).
2. **Backend Build**: Verify `dotnet build` succeeds with zero errors.
3. **Frontend Build**: Verify `npm run build` succeeds with zero errors.
4. **Container Rebuild & Health**: Verify backend, frontend, and worker containers run cleanly.
5. **Live Verification**:
   - Verify Extension scripts syntax and popup interface.
   - Verify Playwright worker API responds to `/health` and accepts `/api/playwright/apply`.
   - Verify LinkedIn Easy Apply detects when authentication is missing and does not falsely claim submission.

---

## 4. Changelog
- **2026-10-04**: Created plan for real browser automation and desktop extension copilot.
