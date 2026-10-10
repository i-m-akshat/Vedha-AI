# Feature Specification: Backend-to-Extension Dispatch (Phase 4)

**Status:** PROPOSED (awaiting approval — major change: architecture + public API) | **Date:** 2026-10-10
**Companions:** `docs/plan/extension-dispatch.md` (build plan) • `docs/specs/aksh-agent-harness-copilot-orchestrator.md` • `docs/bugfixes/copilot-pipeline-auto-apply-stall-and-extension-harness-spike.md`

---

## 1. Overview

**Problem:** The copilot pipeline still stages but never applies. Every provider's `copilotReviewMode` branch returns `PausedForUserReview` with log-only copy ("pre-filled", "attached") — zero browser interaction. The extension owns a working fill→verify→fix harness (`runAutonomousMultiStepFill`), but nothing connects the two: the backend cannot reach the candidate's browser, and the extension never learns a backend run exists. The audit trail therefore ends at "staged".

**Solution:** Claim-based dispatch. The backend marks a queue item `DispatchedToExtension`; the extension's background worker polls for its user's dispatched runs (JWT-scoped), claims exactly one (atomic status transition), opens/drives the posting tab through the existing harness, and streams receipts back. First claimant wins; stale claims expire and re-dispatch. No persistent connection, no new infrastructure.

## 2. Business Goal

Turn "staged" into genuinely filled applications with per-field receipts while keeping the candidate's own logged-in browser as the sole executor (ban-safe L2 posture from the spike). Every dispatched run is traceable backend-side from dispatch → claim → step receipts → terminal state.

## 3. User Stories

- As a candidate, I want my approved application to actually fill the portal form in my browser, so that "paused for review" means filled-and-verified, not staged.
- As a candidate, I want only one device/tab to execute a run, so that two browsers never fight over the same application.
- As a candidate, I want a stuck run (closed laptop, dead tab) to become retryable on its own, so that nothing wedges silently.
- As a candidate, I want to cancel a dispatched run from the tracker, so that a queued run never fires after I change my mind.
- As a candidate without the extension online, I want the run to wait honestly (not fake success), so that status copy is always truthful.

## 4. Acceptance Criteria

1. Approving `launch_apply` on a Supervised portal produces `DispatchedToExtension`, never log-only "pre-filled" copy.
2. Exactly one extension client can hold a run at a time (atomic claim; second claim gets 409/empty, never the package).
3. Claim expires after 10 minutes without a heartbeat; the item returns to dispatchable state with an audit log entry.
4. Extension posts step receipts (fill counts, validation outcomes, escalations) and exactly one terminal receipt (`Submitted` | `PausedForUserReview` | `Failed`); the queue item and Aksh session reflect it.
5. Cancelling from the tracker while dispatched prevents execution (claim rejected after cancel).
6. Full suite green (existing + new); no existing endpoint contract changed; no existing pipeline behavior modified except the copilot branch's terminal copy (staged → dispatched).
7. Works with zero new infrastructure (no new containers, no SignalR in the extension, no firewall changes).

## 5. Functional Requirements

- **FR-1 Dispatch status:** new additive `PipelineExecutionStatus.DispatchedToExtension = 7`. Provider copilot branches set it and return `PausedForUserReview = true` (review-gateway semantics preserved until the extension reports).
- **FR-2 Claim endpoint:** `GET /api/orchestrator/extension/runs/next` — JWT-required, `UserId`-scoped; atomically transitions one `DispatchedToExtension` item to `RunningAutomation` (claimed) and returns the run package. Empty (204) when none. Second concurrent claim never returns the same item.
- **FR-3 Run package:** `{ runId (queue item id), jobUrl, resolvedDestinationUrl, targetCompany, targetRole, coverLetterText, prefilledAnswers[], headed, autonomyLevel, expiresAtUtc }`. No resume PDF bytes over the wire — the extension already caches profile/resume; PDF attach stays worker-side. (If portal needs upload, extension uses the already-generated artifact via existing download path — out of scope for v1.)
- **FR-4 Receipt endpoint:** `POST /api/orchestrator/extension/runs/{id}/receipt` — `{ state (started|step|paused|submitted|failed|cancelled), filledCount?, escalatedCount?, message?, logs[] }`. Appends to `ExecutionLogsJson`, updates `Status`/session. Terminal receipts are idempotent (repeat POST = same state).
- **FR-5 Heartbeat/lease:** claim carries `ClaimedAtUtc`; receipts double as heartbeats. A sweeper (Hangfire recurring job, 5-min) releases claims older than 10 minutes back to `DispatchedToExtension` with a log line. Cancelled items are never re-dispatched.
- **FR-6 Extension poller:** background service worker `chrome.alarms` poll (60s, `alarms` permission added) → claim → open/focus posting tab → `AUTONOMOUS_MULTI_STEP_FILL` with run payload → forward step events as receipts → terminal receipt → close/finish. Polls only when a JWT exists; backs off on 401 (clears nothing, just waits for login).
- **FR-7 Cancel:** existing `PUT queue/{id}/status` with `Cancelled` works on dispatched items; poller/claim refuses cancelled items; in-flight run checks cancellation before each wizard step (lightweight `GET queue/{id}`) and aborts to `ABORTED` receipt.
- **FR-8 Multi-device safety:** claim is per-user atomic; a second device polling gets 204 while a claim is live.

## 6. Non-Functional Requirements

- **Performance:** poll interval 60s (alarm, not busy-loop); claim query is a single indexed row lookup `(UserId, Status)` — new index required.
- **Security:** all endpoints JWT + `UserId` scoping (IDOR tests); run package contains no secrets (no API keys, no cookies); PII stays in descriptor form in logs; 401/403 never leak item existence (404-uniform).
- **Scalability:** stateless WebApi; sweeper is a single Hangfire recurring job (existing Hangfire infra); extension load is client-side.
- **Reliability:** at-least-once dispatch with idempotent terminal receipts; crash between claim and receipt = lease expiry → redispatch (never stuck, never double-submitted: submit happens only in the extension, guarded by the existing review HUD in L2).
- **Accessibility:** tracker shows dispatched state in plain language ("Waiting for your browser extension… Open the posting to run it") with cancel control.
- **Maintainability:** dispatch logic confined to `Application/Features/Orchestrator` (claim/receipt handlers) + `Infrastructure/Orchestrator` (provider branch flip); extension poller is one new module, harness untouched except payload in/out.
- **Cost:** $0 marginal (no model calls in the dispatch path; polling is plain HTTPS).

## 7. Architecture

- **Affected layers:** Domain (1 enum value + 2 claim fields), Application (claim/receipt commands + queries), Infrastructure (provider branch flip, Hangfire sweeper), WebApi (2 endpoints), extension (`background.js` poller module + manifest `alarms`), SPA (tracker status copy + cancel).
- **New components:** `ClaimExtensionRun` / `PostExtensionReceipt` handlers; `ExtensionRunPackageDto`; `ExpiredClaimSweeper` Hangfire job; `extension/dispatch.js` (poller + claim + receipt client).
- **Dependencies:** none new. `chrome.alarms` (manifest permission string only).
- **Data flow:** approve → `DispatchedToExtension` → poll → atomic claim → tab run (existing harness) → step receipts → terminal receipt → queue/session sync → tracker. Lease expiry → redispatch. Cancel → claim refused / in-flight abort.

## 8. API Changes

- `GET /api/orchestrator/extension/runs/next` → `200 + package` | `204` (none) | `401`. Never returns another user's items.
- `POST /api/orchestrator/extension/runs/{id}/receipt` → `200 { accepted, status }` | `404` (unknown/cancelled/other-user) | `409` (stale claim — item no longer claimed by caller). Body: `{ state, filledCount?, escalatedCount?, message?, logs[]? }`.
- No changes to existing endpoints. Errors: existing problem-details + `reasonCode` (`run_not_found`, `stale_claim`, `run_cancelled`).

## 9. Database Changes

- **Additive:** `PipelineExecutionStatus.DispatchedToExtension = 7` (no reordering of existing values); `ApplicationQueueItem.ClaimedAtUtc (DateTime?)`, `ApplicationQueueItem.ClaimToken (Guid?)` — claim identity for 409 semantics.
- **Index:** `(UserId, Status)` on queue items (claim lookup + tracker filter).
- **Migration strategy:** additive EF migration; rollback = providers revert to staged copy (flag `Dispatch:Enabled=false` keeps old branch).

## 10. UI Changes

- Tracker/queue: `DispatchedToExtension` renders as "Waiting for browser extension" + job-specific guidance + Cancel button (existing cancel path). SPA polls existing queue endpoint (no new subscription).
- Extension popup: "dispatched run available" badge when poller holds a claim; existing abort control covers in-flight runs.
- Related fix (recorded, not scope creep): popup sends `ABORT_AGENT` but content expects `ABORT_AGENT_LOOP` — normalize to one action name in this phase since dispatch relies on abort.

## 11. Edge Cases

No extension installed/online (waits honestly); user opens posting manually mid-dispatch (claim still required — manual fills don't double-run); tab closed mid-run (lease expiry → redispatch); two devices (atomic claim); token expiry mid-run (receipt 401 → run pauses, keeps local state, resumes after login); portal needs file upload (v1: extension reports `failed` with `upload_unsupported` reason rather than faking); L3 auto-submit stays opt-in per portal (dispatch never upgrades autonomy); LinkedIn stays L2 (review HUD mandatory, dispatch cannot bypass).

## 12. Risks

Claim-query hot path under many users → mitigated by `(UserId, Status)` index + 60s poll. MV3 worker killed mid-poll → alarms re-fire; claim lease covers gaps. Stale-claim redispatch causing duplicate fills → fills are idempotent-ish (overwrite same fields); submit remains human-gated in L2. Scope masquerading as dispatch (upload support, cross-device handoff) → explicitly v2, receipt reason codes reserved.

## 13. Future Extensions

Extension-initiated "pull my next run" UX; cross-device handoff (release claim to another device); upload-capable run package via short-lived artifact URLs; dispatch metrics (claim latency, fill success rate) on analytics page.

---

## Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-10-10 | Principal Engineer | v1.0 | Phase 4 feature specification created (claim-based pull dispatch; atomic claim + lease + receipts; no new infra) | Backend stages but never applies; extension harness has no backend link — dispatch is the missing half of Phase 3's promise | `docs/specs/`, `docs/plan/` (Phase 4) |
| 2026-10-10 | Principal Engineer | v1.1 | Phase 4 SHIPPED (Steps 1–5, approved): claim/receipt handlers + 2 endpoints, ticket-PK atomicity, lease sweeper, extension alarms poller + receipts + abort normalization + per-step tracker-cancel check, SPA dispatched copy + cancel; 115/115 tests green (18 new), all builds clean; ADR-007 recorded | Approved plan executed in sequence; two plan deviations recorded in ADR-007 (BackgroundService not Hangfire — no Hangfire server exists in tree; orchestrator-side dispatch predicate — all 7 providers untouched) | `Application/Features/ExtensionDispatch/`, `Infrastructure/Orchestrator/`, `WebApi/Controllers/`, `extension/dispatch.js`, `OrchestratorQueuePage.tsx`, `docs/adr/ADR-007*` |
