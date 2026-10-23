# Implementation Plan: Extension-Led LinkedIn Easy Apply Copilot Automation

**Plan Name:** Extension-Led LinkedIn Easy Apply Copilot Automation  
**Classification:** Enhancement  
**Status:** Approved  
**Date:** 2026-10-23  
**Companion Spec:** `docs/specs/extension-linkedin-easy-apply-copilot.md`  

---

## 1. Overview & Goals

Eliminate the dependency on the isolated server-side Playwright container for LinkedIn Easy Apply. Route all LinkedIn auto-apply jobs directly to the candidate's active browser extension, where the candidate is already authenticated, ensuring zero credential leakage and zero bot/ban flags.

---

## 2. Step-by-Step Implementation Breakdown

### Step 1: Provider Short-Circuit (`LinkedInCopilotProvider.cs`)
* In `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationProviders.cs`:
  * Remove calls to `_workerClient.TryApplyAsync(...)` inside `LinkedInCopilotProvider.ExecuteFlowAsync`.
  * Log clear diagnostics explaining that LinkedIn Easy Apply is client-session gated and staged for the candidate's browser extension.
  * Return `ApplicationAutomationResult` with `Success = true`, `PausedForUserReview = true`, and descriptive message.

### Step 2: Finalize & Dispatch Handling in Orchestrator (`JobApplicationOrchestrator.cs`)
* In `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationOrchestrator.cs`:
  * Update `ShouldDispatchToExtension` and pipeline resolution to allow LinkedIn application packages to be dispatched to the browser extension cleanly.
  * Ensure that if an application was previously staged or paused for review, the extension retains authority to finalize submission in the candidate's browser without triggering a headless worker failure.

### Step 3: Extension Poller & Message Optimization (`dispatch.js` & `background.js`)
* In `extension/dispatch.js` and `extension/background.js`:
  * Ensure `dispatch.js` starts cleanly upon extension load.
  * Support an on-demand trigger message (`TRIGGER_DISPATCH_POLL`) from the popup, side panel, or in-page HUD so users do not have to wait for the 60-second alarm cycle.
  * Ensure the web app and extension auth sync (`syncAuthFromWebApp`) maintains a fresh `jwtToken`.

### Step 4: Extension Content Script Easy Apply Automation (`content.js`)
* In `extension/content.js`:
  * Verify `runAutonomousMultiStepFill` correctly targets LinkedIn Easy Apply modals across both `/jobs/view/` and `/jobs/collections/` URLs.
  * Verify tailored PDF attachment handling and read-back verification.
  * Verify that on reaching the final step, it shows the review summary in Copilot mode, or naturally clicks "Submit application" when authorized.

### Step 5: Frontend Orchestrator Queue UI Polish (`OrchestratorQueuePage.tsx`)
* In `frontend/src/pages/OrchestratorQueuePage.tsx`:
  * Enhance the `DispatchedToExtension` status card with an "Open LinkedIn Job Tab" deep link button so the user can immediately jump to the posting if their tab isn't already focused.

### Step 6: Unit Testing & Verification
* In `backend/tests/ResumeTailor.UnitTests`:
  * Verify provider logic and orchestrator dispatch rules.
  * Run the test suite and confirm all tests pass.

---

## 3. Rollback & Contingency Plan
* If extension dispatch is turned off via configuration (`Dispatch:Enabled = false`), the system gracefully reverts to standard staging copy.
* No destructive database schema migrations are introduced.

---

## 4. Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-23 | Antigravity AI | v1.0 | Initial Implementation Plan for Extension-Led LinkedIn Easy Apply Copilot | Detailed step-by-step tasks for provider short-circuit, orchestrator finalize fix, and extension execution. |
| 2026-10-23 | Antigravity AI | v1.1 | Completed implementation across backend provider, orchestrator, extension background/dispatch, frontend UI, and unit tests | Successfully realized Solution 1: all tests passing, zero-delay dispatch to candidate's authenticated browser session. |
