# Audit: Aksh Harness, Dispatch & Execution Plane — 2026-10-10

**Classification:** Research / Investigation (post-Phase-4 evaluation)
**Method:** Three parallel code audits (backend / execution-plane / frontend+tests) + principal verification of every Critical against source. READ-ONLY — no code changed.
**Verdict:** Architecture is sound (claim-ticket atomicity, review gateway, honest receipt vocabulary). But **6 Criticals** need fixing before any real-user auto-apply, and the Tier-1 e2e suite is red on harness/mock drift.

## Remediation status (2026-10-10, end of day)

ALL 6 Criticals + the goal-relevant majors are FIXED and verified:
- C1 atomic consume + retryable failure + validate-before-mutate (AkshCommands) + 4 tests
- C2 single-writer ledger (AkshAgentRunner + TokenLedger) + test; budget over UsageLogs
- C3 legacy recall deleted (AkshTools, HarnessAgentFactory, DI) + no-userId-parameter guard test
- C4 persona deleted → unknown-safe defaults; numeric/essay fallbacks removed (extension + worker) + F11/P5/S4 contract tests
- C5 legal/EEO/consent never auto-answered (explicit-attestation tri-state only) + equality matchers
- C6 terminals verify-or-don't-claim (HUD probe, L3 probes, Easy Apply tail, DONE settled scan) + evidence receipts
- M2 content-bound approvals (AkshBinding hash + args_superseded + dedupe) + 4 tests
- G1 per-session turn lock (DB claim + 5-min lease + release) + test
- M9 fail-closed LLM errors (AkshModelException, no silent fallback, runner catch + release) + test
- M11 SSRF centralized (Domain UrlSafety + DNS guard + scraper/crawler/session/worker enforcement) + 22 tests
- M5 truth-failure signal (forced review + log line) + 2 tests
- UNEXPECTED_TOOL_CALL single-retry (research-backed) + 4 tests
- E2E: 138/138 green (innerText guard, parentLbl scope, shape alignment, mock click/timeout/prototype, F11/P5/S4 rewrite, Step-3 describedby, 3b attribution, whole-number exclusion, fail-closed tail, PING, outline, priority flip)
- Frontend: SSE parser (multiline/CRLF/reader release), ledger/plan/status events, live spend, approval generation guards + reasonCode display + expiry disable, abort bubble honesty, hash jobUrl round-trip
- Suites: 156/156 unit (.NET), 138/138 e2e (JS), frontend build green, worker py_compile green

REMAINING (documented follow-ups, not goal-blockers): M4 structural Layer-2 channels, M6 validator breadth (titles/dates/skills), M8 usageMetadata parsing, D4 ledger-failure surfacing, F1 model allow-list cleanup, worker L2 LinkedIn read-back + L4 cleanup + L5 receipt fields, B4 stacking observer debounce, J manifest least-privilege, K1 ban-safety copy + double-fire click removal, K2 worker captcha detection, frontend Markdown sentinel hardening + link policy, E2E Tier-2+ already green (included above).

**Corrections to raw audit findings (verified by principal):**
- The audit claimed "no lease sweeper exists" — WRONG. `ExpiredClaimSweeperService` shipped in Phase 4 Step 2 (`Infrastructure/Orchestrator/ExpiredClaimSweeperService.cs`, 2 tests). Residual kernel kept as M3 (no explicit stale-lease reject on receipt; currently covered by token-mismatch 409 after sweep+reclaim).
- E2E `F.FF.FFFFFF` failures are PRE-EXISTING (baseline stash-run identical, only log prefix differs).

---

## Critical (fix before real users)

| # | File:line | Issue | Fix direction |
|---|-----------|-------|---------------|
| C1 | `Application/Features/Aksh/AkshCommands.cs:92-102` → `:201-208` | Concurrent double-decide → double submission (TOCTOU, no concurrency token). Two POSTs both pass Pending check, both dispatch. | Atomic consume: `UPDATE … WHERE Status IN (Pending, Approved-unconsumed)`; 0 rows → `approval_not_pending`. |
| C2 | `Infrastructure/Aksh/AkshAgentRunner.cs:322-325` + `Infrastructure/Aksh/TokenLedger.cs:54-55` | Chat-turn tokens counted ~2× (runner AND ledger both `+=`). Budget fires early, spend overstated. | Single writer (remove runner increment or add `updateSessionTotals:false`); reconcile existing sessions. |
| C3 | `Infrastructure/Aksh/AkshTools.cs:53-69` + `HarnessAgentFactory.cs:21` | Legacy `CreateRecallMemory` takes model-supplied `userId` — cross-user read primitive if that agent serves a turn. | Delete overload (or test-only `#if`); test asserting no AIFunction accepts `userId`. |
| C4 | `extension/content.js:43-86` | `DEFAULT_CANDIDATE_PROFILE` ("Alex Rivera" + phone/zip/salary/EEO) backfills ANY user's blanks. Cross-user PII contamination. | Delete persona; fail closed on missing identity (escalate, never synthesize). Same for `"4"`/`"5"` numeric + essay fallbacks. |
| C5 | `extension/content.js:1464-1488,2236-2243` + `1513-1579,2254-2293` | Auto-checks legal/consent checkboxes; auto-Yes on work-auth/relocate/checks/age/degree. Bot attests legal facts. | Never auto-check certify/consent; only sponsorship from stored boolean; everything else escalates; exclude legal/EEO from AI remediation. |
| C6 | `extension/content.js:912-933,2967-2981,2707,3110-3116` | Four fake-success paths: HUD self-attest PUT `Submitted` with no verification; L3 submit returns `submitted:true` on click+sleep; Easy Apply fall-through `success:true`; loop-exhausted `success = filledCount>0`. | Gate terminal claims on verification probe (badge/text/URL); `success` only with settled-clean scan + unresolved/escalated counts in receipt. |

## Major (next)

| # | File:line | Issue | Fix direction |
|---|-----------|-------|---------------|
| M1 | `AkshCommands.cs:131-179` | Approval mutated to `Approved` BEFORE tool/args/queue validation (fail-open state). | Validate first; mutate only before atomic consume. |
| M2 | `AkshTools.cs:386` + `AkshCommands.cs:194-198` | Approval binds only `(queueItemId, headed)` — no resume/answers hash; package can mutate post-approval. | Bind `generatedResumeId + answersHash + company/role + rowVersion`; reject mismatch (`args_superseded`). Exact `headed` match (drop wildcard `:501-502`). |
| M3 | `AkshCommands.cs:200-221` | Consume-before-execute bricks approval on transient failure (no retry; governor path correctly doesn't consume). | Revert to `Approved`-unconsumed on `IsFailure` with error, or `Failed_Retryable`. |
| M4 | `AkshAgentRunner.cs:269-275,360-391` | No structural Layer-2 gate: JD/receipts concatenated into one user prompt; only prose defense. | Separate channels (policy vs data blocks with delimiters) + deterministic post-LLM validator rejecting injected tool calls. |
| M5 | `OrchestratorCommands.cs:525-533` | Truth failure silently falls back to master copies; package proceeds as success, no signal. | Propagate `truth_failed` to logs + DTO warning + force review; optionally block `launch_apply` until `check_truth` passes (also wire the plan step, currently auto-marked done `AkshAgentRunner.cs:233-234`). |
| M6 | `AtsScoringEngine.cs:31-103` | Truth validator checks companies/institutions/certs/metric-highlights only — titles, dates, skills, invented roles pass. | Extend invariants (title/date/skill containment, highlight-count bounds). |
| M7 | `AkshAgentRunner.cs:69-80` | Budget gate sums session totals (misses old sessions, double-counts per C2), check-then-act races. | Sum `UsageLogs` by day+user; per-user turn lock; alert, don't just pause. |
| M8 | `TokenLedger.cs:31-47`, `GeminiFunctionCallingClient.cs:186-240` | Real `usageMetadata` never parsed; callers pass `model:null`; non-LLM work mints tokens. | Parse usageMetadata; store Provider/Model/IsEstimated; 0 tokens for zero-token gates. |
| M9 | `AkshChatClientAdapter.cs:103-106,58-78` | Provider failure returns apology as *successful* ChatResponse; tool-path failure degrades to text path silently. | Fail closed: typed failure → `error` SSE + session Paused; `error:function_calling_unavailable`, never modality fallback. |
| M10 | `AkshAgentRunner.cs:100-101,347-348` | No per-session turn lock: concurrent turns duplicate packages, clobber status/TodoJson. | Per-session semaphore or RowVersion retry → 409 `turn_in_progress`; re-check status before final write. |
| M11 | `AkshTools.cs:114` vs `AkshAgentRunner.cs:117`, `JobScraperService.cs:31-42` | SSRF: auto-scrape bypasses `IsBlockedHost`; scraper has no guard; DNS-rebinding bypasses string matching. | Centralized async SSRF guard in `JobScraperService` (IP blocks + DNS-resolve + redirect revalidation); validate JobUrl at session creation. |
| M12 | `content.js:3636,3655,3659`, `popup.js:674-700` | Hardcoded "88%/85%" ATS scores + synthetic pills on backend failure. Fabricated signal. | Fail closed: error/unavailable, never numeric. |
| M13 | `content.js:1942-2064` + `WeakMap` identity keys | Retry budget on one path only; resets on DOM re-mount. | Central `attemptFor(el)` on ALL fill entries; key on field fingerprint, not node identity. |
| M14 | `content.js:3086-3097` | Fingerprint-unchanged still increments stepIndex (comment says don't). Masks stuck as progress. | Don't increment; return `ESCALATED/stuck` with fingerprints. |
| M15 | `content.js:1664-1669,2922,3011,3062` | No read-back verification in extension (worker has it `main.py:631-646`); healed counts inflate receipts. | Re-read values post-fill/remediation; count retained only. |
| M16 | `content.js:2294,2340,2262`, `selectDropdownOption:311-371` | First-option/fuzzy-`includes()` fallbacks file arbitrary answers (incl. legal fields). | Exact match or documented aliases only; else escalate. |
| M17 | `main.py:384-390` | `li_at` cookie as plaintext profile/NATS payload; server-IP cookie auth is itself a ban signal. | Deprecate cookie path (extension-first); secret-store + redaction + consent if retained. |
| M18 | `content.js:1125,1914` | Direct Gemini API key in storage, used from content script on arbitrary origins. | Route all grounding server-side. |
| M19 | `dispatch.js` + `content.js:2803` | No cross-tab mutual exclusion; abort only targets active tab; cancel checked at loop-top only, never pre-submit. | Single-flight on `runId` in all entries; storage-broadcast abort; re-check before Next/Review/Submit; fetch-failure = pause, not proceed. |
| M20 | `dispatch.js:202,256,278` | Receipt failures silently dropped ("lease bounds the loss") → filled form, empty tracker. | Bounded retry + persistent outbox drained by alarm; every receipt carries filled/escalated/evidence. |
| M21 | `dispatch.js:238-260` | Run-state transitions (REVIEW/SUBMIT/ESCALATED) skipped (no stepName) — tracker blind between claim and terminal. | Forward typed transitions with runId/claimToken/counts. |
| M22 | `main.py:862-875` | NATS handler forces `copilot_mode=False`, maps pauses to `worker.failed`, acks on error. | Propagate mode; distinct paused/HITL states; nack/redeliver on exception (`HitlSession` currently dead code). |
| M23 | hardcoded `localhost:5000/3000` (dispatch/background/content/popup) | Prod-breaking; auth sync never runs off-dev. | Provisioned `VEDHA_API_BASE`/`WEBAPP_ORIGIN`; distinct connection-error UI. |
| M24 | `background.js:274` `setInterval` in MV3 SW | Suspended workers kill it; auth sync silently stops. | Alarms + onStartup re-sync (as dispatch does). |
| M25 | `manifest.json` `*://*/*` host + content matches | Filler injected into every site incl. banking/SSO. | Restrict to ATS/LinkedIn hosts + `activeTab` grants; drop wildcard. |
| M26 | "biometric/human-like" claims vs `isTrusted===false` synthetics | Overstates ban safety; double-fire click bug (`clickElementNaturally` + `target.click()`). | Reword to best-effort pacing; remove double-fire; disclose LinkedIn ToS risk; enforce pacing counters. |
| M27 | `AskAkshPage.tsx:222,256-259` + `aksh.ts:39-43` | Stale approval gate can overwrite current session (no generation guard). | `approvalReqSeq` + session check; cancel in-flight `getQueueItem`. |
| M28 | `AskAkshPage.tsx:201-232` | Post-decision gate handling can't distinguish rejected/expired/governor-blocked. | Always re-fetch gate; render `reasonCode`; disable Approve past `expiresAtUtc` with countdown. |
| M29 | `api/aksh.ts:77-106` | SSE parser corrupts multi-line data, ignores `\r\n`, leaks reader on abort. | Accumulate+join lines; preserve event type; `cancel()+releaseLock()` on abort. |
| M30 | `AskAkshPage.tsx` + `aksh.ts:12-15` | `ledger/plan/status/session` SSE events ignored → stale spend/plan; `budget_breach` never updates badge. | Handle all event types; live ledger totals; breach → pause CTA. |
| M31 | Spend = stale session totals × hardcoded pricing | AC5 not met end-to-end. | Ledger-driven live totals + `as of` + pricing from config. |
| M32 | `App.tsx:58-61` + `OrchestratorQueuePage.tsx:42-48` | `?jobUrl=` deep link dead under hash routing (comment claims pass-through — false). | Parse/preserve query in hash; round-trip test. |
| M33 | No tests: exact args binding (AC3), ledger/breach-mid-run (AC5), truth gate (AC2), LinkedIn-override (AC7) | Highest-risk claims unverified. | Add the four tests (args-mismatch, ledger-sum+breach, truth-fail-closed, SupervisedAuto+LinkedIn→review). |

## Minor / Info (tracked, not blocking)

- Expired approvals surfaced as live SSE (`AkshAgentRunner.cs:327-343` lacks expiry filter); `deciding` boolean not keyed to approval id; abort leaves empty assistant bubble; Markdown renderer safe-but-brittle sentinels; model allow-list drift (`gemini-3.8/3.6-flash`) + output-cap disagreement (8192 vs 16384); ledger failures swallowed + hardcoded `success:true`; broad swallows in todo/answer/log paths (add warn logs); key in URL query (`GeminiFunctionCallingClient.cs:56` → use header); unbounded receipt log ingestion (cap 50×2k); pacing cap counts created-not-submitted (`AkshPacingGovernor.cs:43-44`); no per-session turn-rate caps; `main.py` human_type appends w/o clear, LinkedIn fills unverified, scrape SSRF guard missing, double browser.close, headed-degrade not in receipt; stacking observer feedback loop; popup badge only toolbar-level; E1 token sprawl architecture (short-lived/audience-scoped tokens as follow-up).

## E2E Tier-1 status (verified pre-existing)

`.............F.FF.FFFFFF` + crash at `content.js:985` (`pl.innerText.trim()` — mock lacks `innerText`; 61 uses in prod). Assertion shape drift (`element/message` vs `inputElement/errorMessage`), missing `#connectionDot`, time-comms mocks (5ms caps, broken `tabs.sendMessage` delegation). Fix order: `innerText` fallback + polyfill → assertion shape → `jobUrl` hash → SSE events → approval guards → backend arg/LinkedIn/ledger tests → re-run Tier-1–4.

## Recommended fix order (ROI)

1. C4 delete persona + C5 legal/EEO gates (data integrity / legal exposure)
2. C1 atomic consume + C3 delete legacy recall (double-spend / IDOR)
3. C2 single-writer ledger + M7 UsageLogs budget (cost correctness)
4. C6 verify-or-don't-claim terminals + M12 score fallback removal (honesty)
5. M11 SSRF guard + M4 Layer-2 structure (security)
6. M9 fail-closed LLM errors + M10 turn lock (reliability)
7. M2 content-bound approvals + M3 retryable consume (correctness)
8. M5/M6 truth gate signal + validator breadth (hallucination)
9. E2E harness repair (innerText → shapes → mocks) to close AC4/AC6
10. Frontend: E1 hash jobUrl, M27-M31 approval/SSE/spend, then M33 tests

---

## Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-10-10 | Principal Engineer | v1.0 | Post-Phase-4 formal audit: 6 Critical + 33 Major/Minor verified against source; 2 raw findings corrected (sweeper exists; e2e red is pre-existing) | User directive: senior + AI-engineer evaluation with observed issues listed | `docs/bugfixes/aksh-harness-audit-2026-10-10.md` |
