# Implementation Plan: Backend-to-Extension Dispatch (Phase 4)

**Status:** PROPOSED (awaiting approval — major change) | **Date:** 2026-10-10
**Companions:** `docs/specs/extension-dispatch.md` • `docs/bugfixes/copilot-pipeline-auto-apply-stall-and-extension-harness-spike.md`

---

## 1. Scope & Execution Overview

- **Step 1 — Backend claim/receipt core:** enum value + claim fields + migration + index; `ClaimExtensionRun` / `PostExtensionReceipt` handlers; 2 endpoints; provider copilot-branch flip behind `Dispatch:Enabled` flag (default on for extension-installed path, staged copy preserved when off).
- **Step 2 — Lease sweeper:** Hangfire recurring job releasing expired claims; cancel-safety.
- **Step 3 — Extension poller:** `manifest` `alarms` permission + `extension/dispatch.js` (poll → claim → tab run → receipts); `ABORT_AGENT`/`ABORT_AGENT_LOOP` normalization; popup dispatched badge.
- **Step 4 — SPA copy:** tracker `DispatchedToExtension` state + cancel; no new subscriptions.
- **Step 5 — Verification:** unit/integration/E2E per §7; docs/ADR/architecture sync.

## 2. Step-by-Step Task Breakdown

### Step 1 — Backend core
1. `Enums.cs`: `DispatchedToExtension = 7` (append only).
2. `DomainEntities.cs`: `ApplicationQueueItem.ClaimedAtUtc`, `ClaimToken`; `ApplicationDbContext`: config + `(UserId, Status)` index; EF migration (additive).
3. `Application/Features/Orchestrator/`: `ClaimExtensionRunQuery` (atomic: single `UPDATE … WHERE Status == DispatchedToExtension AND UserId`, EF concurrency token check, returns package or null → 204), `PostExtensionReceiptCommand` (append logs, terminal-state machine, idempotent).
4. `OrchestratorAndProfileControllers.cs`: `GET extension/runs/next`, `POST extension/runs/{id}/receipt` (JWT, `UserId`-scoped, reasonCode errors).
5. `JobApplicationProviders.cs`: copilot branches set `DispatchedToExtension` + honest log ("dispatched to your browser extension — open the posting to run it") when `Dispatch:Enabled`; else legacy staged copy. `Naukri` keeps honest-failure semantics.
6. `appsettings.json` + `infra/.env.example`: `Dispatch__Enabled=true`.

### Step 2 — Lease sweeper
7. `ExpiredClaimSweeper`: Hangfire recurring (every 5 min) — release claims with `ClaimedAtUtc < now-10m` back to `DispatchedToExtension` (clear token, log line); never touch `Cancelled`/`Submitted`.
8. Register in `Program.cs` alongside existing recurring jobs.

### Step 3 — Extension poller
9. `manifest.json`: add `"alarms"` permission.
10. New `extension/dispatch.js`: alarm loop (60s) → `GET runs/next` (JWT from existing storage keys, base URL constant extracted — first step toward de-hardcoding `localhost:5000`) → on package: open/focus `jobUrl` tab → `AUTONOMOUS_MULTI_STEP_FILL` with run payload (existing `vedhaRun` id = claim token for receipt correlation) → forward `AGENT_STEP_UPDATE` as step receipts → terminal result as terminal receipt. No-claim → silent. 401 → back off until login (no logout, no token clear).
11. Normalize abort action name (`ABORT_AGENT_LOOP` everywhere; popup updated).
12. Popup: dispatched badge when a claim is live (alarm state in `chrome.storage.session`).

### Step 4 — SPA copy
13. `OrchestratorQueuePage.tsx`: `DispatchedToExtension` → "Waiting for browser extension…" + guidance + Cancel (existing `PUT status` path).

### Step 5 — Verification & docs
14. Add `docs/adr/ADR-007-extension-dispatch-pull-model.html` (why pull over SignalR push) + touch `docs/architecture/*.html` dispatch flow.
15. Changelog rows in spec/plan/bugfix docs.

## 3. Files to Create

- `backend/src/ResumeTailor.Application/Features/Orchestrator/ExtensionDispatchCommands.cs` (claim + receipt handlers + DTOs)
- `backend/src/ResumeTailor.Infrastructure/Orchestrator/ExpiredClaimSweeper.cs`
- `extension/dispatch.js`
- `docs/adr/ADR-007-extension-dispatch-pull-model.html`
- `backend/tests/ResumeTailor.UnitTests/ExtensionDispatchTests.cs`

## 4. Files to Modify

- `backend/src/ResumeTailor.Domain/Enums/Enums.cs` (+1 value)
- `backend/src/ResumeTailor.Domain/Entities/DomainEntities.cs` (+2 fields)
- `backend/src/ResumeTailor.Infrastructure/Persistence/ApplicationDbContext.cs` (config + index + migration)
- `backend/src/ResumeTailor.Application/Features/Orchestrator/OrchestratorCommands.cs` (if status-update guard needs dispatch-awareness)
- `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationProviders.cs` (copilot branches)
- `backend/src/ResumeTailor.WebApi/Controllers/OrchestratorAndProfileControllers.cs` (+2 endpoints)
- `backend/src/ResumeTailor.WebApi/Program.cs` (sweeper registration)
- `backend/src/ResumeTailor.WebApi/appsettings.json`, `infra/.env.example` (flag)
- `extension/manifest.json`, `extension/background.js`, `extension/popup.js`, `extension/content.js` (payload in/out only — harness untouched)
- `frontend/src/pages/OrchestratorQueuePage.tsx` (status copy)

## 5. Database Migrations / API / Config

- One additive EF migration (fields + index). Rollback: `Dispatch:Enabled=false` restores staged copy; no down-migration needed to disable.
- Two new additive endpoints; zero existing contract changes.

## 6. Testing Strategy

- Unit: claim atomicity (two claims, one item → exactly one package); lease-expiry math; terminal-receipt idempotency; cancel-blocks-claim; `Dispatch:Enabled=false` preserves legacy copy.
- Integration (SQLite): full dispatch → claim → step receipts → terminal → queue/session states; sweeper releases stale claim; cross-user IDOR (user B cannot claim/receipt user A's run; 404-uniform).
- E2E/manual: extension poller against local API (claim → fill fixture wizard → receipts visible in tracker); kill-switch mid-run → `ABORTED` receipt; laptop-closed simulation (kill worker → 10-min redispatch).
- Existing suite must stay green; new file `ExtensionDispatchTests.cs`.

## 7. Deployment Considerations

- Backend: additive migration + Hangfire job (existing Hangfire infra). Worker image unchanged. Extension: version bump + `alarms` permission (re-install consent prompt on update — note in release notes).
- Rollout: `Dispatch:Enabled=true` default (new status only reachable via copilot path); any incident → flag off, runs fall back to staged copy.

## 8. Rollback Strategy

- Flag off (`Dispatch:Enabled=false`); sweeper deregistered without touching pipeline; migration additive (no down-migration needed to disable); extension old version keeps working (poller inert without dispatched items).

---

## Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-10-10 | Principal Engineer | v1.0 | Phase 4 implementation plan created (5 steps: backend core → sweeper → poller → SPA → verify) | Major change (architecture + public API) requires approved plan before code per constitution | `docs/plan/`, `docs/specs/` (Phase 4) |
| 2026-10-10 | Principal Engineer | v1.1 | Phase 4 implemented as approved: EF tracking-conflict race fixed (Add inside try + attached-only cleanup); sweeper as BackgroundService (plan said Hangfire — none exists in tree); 115/115 tests; backend/frontend/extension/worker gates green | Race reproduced via shared-scope test before fixing; deviations documented, nothing silently substituted | `ExtensionDispatchCommands.cs`, `ExpiredClaimSweeperService.cs`, `ExtensionDispatchTests.cs`, `extension/dispatch.js` |
