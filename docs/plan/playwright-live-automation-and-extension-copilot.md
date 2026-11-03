# Implementation Plan: Real Playwright Browser Automation & Desktop Extension Copilot

## 1. Overview
Eliminate simulated C# pipeline logs. Equip the system with:
1. **Desktop Extension Copilot**: Full LinkedIn Easy Apply modal automation with human typing cadence, question grounding, resume upload, and Review Gateway HUD overlay.
2. **Playwright Agent Service**: FastAPI HTTP + NATS worker in `workers/playwright-agent/main.py` executing genuine browser automation with Playwright and Set-of-Marks (SoM) visual perception grounding.
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
  - Implement `apply_job` endpoint supporting LinkedIn Easy Apply (with `li_at` cookie), Naukri (`naukri.com` apply button, drawer/chatbot, CTC/notice/experience injection), and ATS portals (Greenhouse, Lever, Ashby, Workday).
  - Implement `analyze_screen_with_ai_vision(page, candidate_profile, intent_description, candidate_answers)` using Gemini Vision API (`gemini-2.5-flash` / `gemini-2.0-flash` / `gemini-1.5-flash`) with Set-of-Marks (SoM) visual badge injection.
  - Implement `execute_vision_action(target, decision, resume_pdf_path)` with Tier 0 `mark_id` targeting, Tier 1 CSS selector, Tier 2 element index, and Tier 3 viewport coordinates.
  - Implement `scrape_job` endpoint for dynamic SPA job descriptions.
  - Add genuine submission confirmation check and truthful error reporting.

### C. C# Backend
- `backend/src/ResumeTailor.Infrastructure/Aksh/GeminiFunctionCallingClient.cs`:
  - Implement ordered model fallback sequence: `gemini-2.5-flash` -> `gemini-2.0-flash` -> `gemini-1.5-flash` -> `gemini-flash-lite-latest`.
  - On 404 or unsupported model response, cascade down the sequence automatically.
  - Default model resolution to `gemini-2.5-flash` when unspecified.
- `backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs`:
  - Synchronize Gemini model fallback and resolution.
- `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationProviders.cs`:
  - Update `LinkedInCopilotProvider` and `NaukriProvider` to pass `copilotReviewMode` directly to `_workerClient.TryApplyAsync`, allowing real Playwright execution to stage the form in a browser and pause at Review screen.
  - If Playwright is offline or unreachable, fall back gracefully to staged state and extension guidance.
  - Update `GreenhouseProvider`, `LeverProvider`, `AshbyProvider`, `WorkdayProvider`, and `GenericBrowserProvider` to dispatch with `copilotReviewMode`.
- `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationOrchestrator.cs`:
  - Ensure status only transitions to `Submitted` when verified by the browser engine.

### D. Infrastructure & Environments
- `infra/docker-compose.yml`:
  - Pass `GEMINI_API_KEY` and `GEMINI_MODEL` to `vedha-worker`.
- `infra/.env.example`:
  - Add `GEMINI_MODEL=gemini-2.5-flash`.
- `infra/build_and_start.ps1`:
  - Pass `-e GEMINI_API_KEY` and `-e GEMINI_MODEL` to `vedha-worker`.

### E. Frontend
- `frontend/src/pages/OrchestratorQueuePage.tsx`:
  - Add "Open Job & Apply via Extension Copilot" button with direct URL link for LinkedIn postings.
  - Clarify the status of items paused at Review Gateway with clear action items.

---

## 3. Verification & Testing Strategy
1. **Unit Tests**: Ensure all existing backend unit tests pass (`dotnet test backend/ResumeTailor.sln -nodereuse:false -m:1`).
2. **Backend Build**: Verify `dotnet build` succeeds with zero errors.
3. **Frontend Build**: Verify `npm run build` succeeds with zero errors.
4. **Extension E2E Tests**: Verify all 148 E2E extension tests pass (`node tests/e2e/runner.js`).
5. **Live Verification**:
   - Verify Playwright worker API responds to `/health` and accepts `/api/playwright/apply`.
   - Verify Gemini function calling client correctly cascades through fallback models on 404.
   - Verify Set-of-Marks visual overlay badges render and are cleaned up without leaking into DOM.

---

## 4. Changelog
- **2026-11-03 (Set-of-Marks Visual Grounding & Tier 0 Execution)**: Upgraded `analyze_screen_with_ai_vision` in `workers/playwright-agent/main.py` with Set-of-Marks (SoM) visual badge injection, capturing numbered badges on screenshots for unambiguous visual reasoning by Gemini 2.5 Flash, and wired `execute_vision_action` to target `[data-vedha-mark-id]` directly as Tier 0.
- **2026-10-15 (Extension Fingerprint Recovery)**: Added active step blocker diagnosis, 1000ms transition grace period, missing radio/required field remediation, visual amber glow highlight on blocking fields, and secondary native click fallback in `extension/content.js` to resolve `Step fingerprint unchanged after Next click` stalling.
- **2026-10-15 (Naukri Bot-Manager Stealth & AI Vision Blocker Handling)**: Added `STEALTH_HEADERS`, `navigator.webdriver` removal, `window.chrome` mocking, post-navigation WAF detection, and explicit `action == "cannot_proceed"` blocker handling with extension guidance in `workers/playwright-agent/main.py`.
- **2026-10-15**: Added Multimodal AI Vision Decision Engine to Playwright worker, dedicated Naukri (`naukri.com`) application drawer and chatbot automation flow, C# Orchestrator live copilot dispatch to worker, and Gemini model fallback cascade (`gemini-2.5-flash` -> `gemini-2.0-flash` -> `gemini-1.5-flash` -> `gemini-flash-lite-latest`) in `GeminiFunctionCallingClient.cs`.
- **2026-10-04**: Created plan for real browser automation and desktop extension copilot.
