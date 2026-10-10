# Bug Fix Plan + Spike: Copilot Pipeline Does Not Auto-Apply — Ban-Safe Full Automation & Extension Harness Loop

**Classification:** Bug Fix (root cause) + Spike (full-auto design, ban safety, extension observe→fill→validate→fix harness)
**Date:** 2026-10-10 | **Status:** SPIKE COMPLETE — awaiting approval, no code changed
**Companion:** `docs/adr/ADR-006-aksh-agent-harness-copilot-orchestrator.html` (Aksh)

---

## 1. Problem Statement

The copilot pipeline prepares the application package (tailored resume, cover letter, screening answers) but **never drives a browser to the job and applies**. Queue items land in `PausedForUserReview` / "staged" and stop. The user expectation (Neo-agent-like): say "apply to this job" → the system fills the Workday/LinkedIn/Greenhouse form, fixes validation errors, and submits.

---

## 2. Root Cause (verified in code, three layers)

### Layer 1 — The stall is by design, not a crash (primary cause)
- `PrepareApplicationPackageCommand` hardcodes `RequiresManualReview = true` (`OrchestratorCommands.cs`).
- `JobApplicationOrchestrator.RunPipelineAsync` computes `effectiveCopilotReviewMode = copilotMode || RequiresManualReview` → **always true on first run**.
- Every provider (`Greenhouse`, `Lever`, `Ashby`, `LinkedInCopilot`, `Naukri`, `Workday`, `GenericBrowserProvider` in `JobApplicationProviders.cs`) takes the `if (copilotReviewMode)` branch and returns `PausedForUserReview = true` with **log lines only** ("pre-filled", "attached") — zero browser interaction, zero field writes. The "pipeline" is a staging simulation by default.

### Layer 2 — The headless fallback silently degrades
- With `copilotMode=false` on an already-paused item, providers POST to the Playwright worker (`http://vedha-worker:8000`, fallback `http://localhost:8000`, 30s timeout). Any failure (worker offline, timeout) returns `null` → caught/swallowed → falls through to "staged for review". The user sees success-flavored logs; nothing moved.
- Even when the worker is reachable, LinkedIn without an `li_at` session cookie returns `AuthenticationRequired` (`main.py` auth-wall branch) — headless Chromium has no logged-in user. And the worker's launch config is minimally stealthy (`--disable-blink-features=AutomationControlled`, static UA/viewport, fixed `wait_for_timeout` sleeps, instant `.fill()` calls) — exactly the machine-precision signature detectors flag.

### Layer 3 — No closed loop anywhere
- Worker fills once and clicks Next/Submit; there is **no re-observation** of validation errors post-fill, no per-field retry, no step state machine for multi-step wizards (Workday).
- The extension (`content.js`) *does* have the seed of the right loop — `findActiveValidationErrors` (HTML5 + aria-invalid + portal error badges for LinkedIn/Workday/Greenhouse/Lever), self-healing remediation, AI re-query for rejected values, pre/post-Next checks — but it runs **one-shot per button click** with no run session, no retry budget, no pacing governor, and no backend-tracked state. So Workday-class wizards defeat it.

---

## 3. Spike Finding: How to Be Fully Automatic Without Getting Banned

Researched current (2026) platform detection: LinkedIn et al. read **behavior, not volume** — timing precision, session shape, action mix, TLS/browser fingerprint (`navigator.webdriver`, headless plugin/WebGL gaps), IP reputation/geography, and DOM-injection signatures. Consequences for our architecture:

| Execution venue | Fingerprint | Session | Verdict |
|---|---|---|---|
| Headless Playwright on server/datacenter (current worker) | Flagged: `webdriver=true`, datacenter IP, machine-precision timing | No real login (cookie injection = impossible-travel risk) | **Highest ban risk. Demote to fallback.** |
| Extension in the candidate's own logged-in browser | Genuine: real TLS, real residential IP, real fingerprint, real session | User is genuinely logged in | **Lowest risk. Promote to primary executor.** |

**Core recommendation — invert the execution model:** the extension becomes the primary apply executor (real user, real browser, real session); the headless worker becomes the fallback for portals where the user isn't logged in. This is the industry "hybrid" pattern, and it flips our current design exactly backwards.

**Tiered autonomy (no unattended LinkedIn submission — ever):**
- **L2 Supervised (LinkedIn/Easy Apply):** agent fills everything, fixes validation, pauses at final Submit; the candidate's own click is a genuine human gesture → near-zero ban surface. This *feels* fully automatic (one click total).
- **L3 Supervised-auto (Greenhouse/Lever/Ashby/Workday via extension):** agent fills + validates + submits after per-application approval, under a pacing governor (non-linear delays, per-day caps, session windows, business hours).
- **Forbidden:** L4 unattended headless submission on LinkedIn/Naukri (account-loss risk; appeals rarely succeed).

**Pacing governor (new, mandatory):** jittered inter-field delays (not fixed sleeps), per-day application caps, max session length with cooldowns, business-hours windows, per-portal action ledger persisted on the queue item. A governor violation pauses the run — same as a validation failure.

---

## 4. Proposed Fix + Extension Harness Design

### 4A. Backend: make auto-apply reachable (small, surgical)
1. Add per-user/per-portal autonomy setting (`AutonomyLevel`: Supervised / SupervisedAuto) on `CandidateProfile`; default Supervised.
2. `PrepareApplicationPackageCommand`: set `RequiresManualReview = (autonomy == Supervised)` instead of hardcoded `true`.
3. Providers: replace the log-only `copilotReviewMode` branch with **dispatch-to-extension-run** (primary) → worker (fallback) → paused (last resort), each leg honestly logged. Never report "pre-filled" without a fill receipt.
4. Worker hardening (fallback path only): human-like typing (char-by-char with jitter), non-linear waits, post-action re-observation;Bubble `AuthenticationRequired`/`Failed` distinctly — no silent "staged".

### 4B. Extension harness: observe → fill → validate → fix loop (the main build)
Promote `content.js`'s one-shot self-heal into a **harness-managed run session** synced to a backend `AkshSession`:

```text
OBSERVE → PLAN → FILL → VERIFY → (errors? FIX → VERIFY … ≤N) → STEP → … → REVIEW → SUBMIT
   │                                                                │
   └─ MutationObserver re-scan ─────────────────────────────────────┘
```

- **OBSERVE:** snapshot *field descriptors* (label/type/options/required/validation state) — never raw PII to logs; descriptor-only payloads to backend.
- **PLAN:** backend Aksh tool maps values (profile → memory → AI grounding, existing engines reused).
- **FILL:** human-like input — focus, char-by-char typing with jitter, blur, `input`/`change` events (extends existing `setNativeValue`/`simulatePointerInteraction`); custom dropdowns (Workday-style, non-native) via open→search→select→verify.
- **VERIFY:** `findActiveValidationErrors` re-scan + `MutationObserver` for async badges; file-upload widgets verified by widget state, not just input value.
- **FIX:** deterministic normalizers first (phone digits, option-text canonicalization, required checkboxes), AI re-query for semantic rejects (existing `queryGeminiForValidationError`), per-field retry budget (e.g. 3) then **escalate to user** with the field highlighted — never infinite loops, never guessing on EEO/consent fields.
- **STEP:** explicit wizard state machine (Workday multi-step: Next → wait → re-observe → repeat; progress detection, not fixed sleeps).
- **REVIEW/SUBMIT:** L2 pauses with a summary diff; L3 submits post-approval under governor. Every transition streams to SignalR and persists on the queue item log (audit).

### 4C. Files affected
- `backend/.../Application/Features/Orchestrator/OrchestratorCommands.cs` — autonomy-aware `RequiresManualReview`
- `backend/.../Domain/Entities/CandidateProfile.cs` (+ migration) — `AutonomyLevel`, pacing counters
- `backend/.../Infrastructure/Orchestrator/JobApplicationProviders.cs` — dispatch-to-extension branches, honest receipts
- `backend/.../Infrastructure/Orchestrator/JobApplicationOrchestrator.cs` — run-mode resolution
- `workers/playwright-agent/main.py` — human-like input, re-observation loop, distinct failure statuses
- `extension/content.js` — run-session state machine, MutationObserver verify, retry budgets, governor client
- `extension/popup.js` + backend `AkshController` (ADR-006) — run start/pause/approve, progress stream
- `docs/adr/ADR-006-*` — record extension-harness decision on approval

---

## 5. Regression Risks
- Changing the default run path could surprise users expecting pause-first → mitigated: default stays Supervised (L2); L3 is opt-in per portal.
- Extension loop bugs could hammer portals → mitigated: retry budgets + governor + per-run kill switch (`abortAgentBtn` exists).
- Honest receipts change queue-item copy ("staged" → explicit worker-offline/failed states) → frontend status text must handle new states.

## 6. Test Strategy
- Unit: autonomy resolution matrix, retry-budget exhaustion → escalation, governor cap enforcement, trust-label mapping (untrusted JD never drives submit).
- Integration: worker offline → explicit `Failed`, not fake "staged"; extension run against local fixture wizard (multi-step + validation errors) → all-green receipt.
- E2E (existing tiers): queue lifecycle tests extended with L2 happy path; manual ban-safety checklist per portal before enabling L3.

## 7. Verification Steps
1. Queue item with Supervised autonomy ends `PausedForUserReview` **with a fill receipt** from the extension (fields written + validation clean), not log-only staging.
2. Worker offline produces explicit failure copy; no "successfully staged" message without action.
3. Workday-style fixture: injected validation error → observed → fixed → re-verified within budget; unfixable field → user escalation with highlight.
4. Governor: cap exceeded → run pauses with reason logged; audit trail shows every transition.

## 8. Tooling Verdict: Crawl4AI, Free Stack & Anti-Ban (verified 2026-10-10)

### 8.1 Keep current Crawl4AI — for scraping only, with hygiene fixes
- **What we run:** `unclecode/crawl4ai` Docker sidecar (`:latest`), called with a v0.9.4-schema payload (`enable_stealth: true`, overlay/consent removal). Upstream is at **v0.9.4 (2026-09-23)** with undetected-browser adapter, 3-tier anti-bot detection (vendor patterns → generic indicators → structural checks), cheapest-first proxy escalation chain, fallback fetch, and Shadow DOM flattening.
- **Verdict: YES for JD scraping, NO for applying.** Crawl4AI is a request/response crawl API — it cannot hold a logged-in user session (LinkedIn auth wall), cannot run an interactive multi-step wizard loop (Workday), and since v0.9.0 the Docker server treats the request body as an **untrusted boundary** (rejects `js_code`, cookies, proxies, custom headers over the network). Driving it as a form-filling agent is architecturally impossible; keep it exactly where it is (`scrape_job`).
- **Hygiene (do now, near-zero cost):** pin image `unclecode/crawl4ai:0.9.4` instead of `:latest` (reproducibility); v0.9.3/0.9.4 closed SSRF + env-var-leak advisories — if the running image predates them, rotate `SECRET_KEY`/LLM keys after upgrading; keep `CRAWL4AI_API_TOKEN` auth on (already configured); add `max_retries` + cheapest-first proxy chain (direct → existing `RESIDENTIAL_PROXY_URL`) so blocks escalate instead of failing.

### 8.2 Free stealth stack for the fallback worker (headless apply path)
| Tool | Cost/license | Role in our design | Verdict |
|---|---|---|---|
| **Patchright** (Playwright fork, CDP-leak patches, `channel=chrome`) | Free, Apache-2.0, drop-in import swap, actively maintained | Default engine for `workers/playwright-agent` browser launch (replaces bare Playwright + fixed sleeps) | **✅ ADOPTED (2026-10-10) — default fallback engine** |
| **Camoufox** (Firefox fork, C-level fingerprint spoofing) | Free, MPL-2.0 | Alternate engine for targets that flag Chromium shapes (some Cloudflare Enterprise / DataDome zones) | **✅ ADOPTED (2026-10-10) — alternate engine behind `WORKER_STEALTH_ENGINE` flag** |
| **nodriver** (direct-CDP, strongest live-target scores) | Free, **AGPL-3.0**, non-Playwright API | Would need worker rewrite + license review | **Reject for now** (flag license + rewrite cost) |
| **playwright-stealth plugin** | Free, unmaintained ~18 months, cannot fix protocol-level leaks | — | **Explicitly do not adopt** |
| **curl_cffi** (TLS impersonation, HTTP-only) | Free | Could back the AngleSharp static-fetch tier, not form fill | Optional, low priority |

**Adoption notes (agreed 2026-10-10):** worker selects engine via `WORKER_STEALTH_ENGINE=patchright|camoufox` (default `patchright`); both are pip-installable (`patchright`, `camoufox`) with Playwright-compatible APIs so `main.py` keeps its structure — Patchright is a one-import swap (`patchright.async_api`), Camoufox drives via its Playwright Firefox driver. Both ride the existing `RESIDENTIAL_PROXY_URL` when set. Neither changes the extension-first strategy: stealth engines only harden the **fallback** path.

### 8.3 Anti-ban posture (what's free vs what money buys)
- **Free and mandatory:** extension-first execution (real user/session/IP/fingerprint — $0); pacing governor + tiered autonomy ($0); Patchright/Camoufox ($0); per-day caps, session windows, business hours ($0); CAPTCHAs escalate to the user via the existing `detectCaptchaOrChallenge` banner — **never auto-solved**.
- **The one thing code can't replace:** residential IPs for server-side fallback traffic. Free proxy lists are datacenter/flagged pools — worse than nothing (burned-IP reputation + geo-mismatch). **Anti-recommendation: no free-proxy integration.** Keep fallback-worker usage minimal, route it through `RESIDENTIAL_PROXY_URL` when configured, and prefer the extension path wherever the user is logged in.
- **Consistency rule (from research):** one session owner per account — never run headless worker + extension against the same LinkedIn account simultaneously (competing fingerprints/IPs read as "two humans, one a bot").

## 9. Changelog

| Date | Version | Change | Why |
|---|---|---|---|
| 2026-10-10 | v1.0 | Spike: root cause of auto-apply stall + ban-safe full-auto design + extension harness loop | Pipeline stages but never applies; need Neo-like automation without account bans |
| 2026-10-10 | v1.1 | Tooling verdict: keep Crawl4AI for scraping (pin 0.9.4), Patchright/Camoufox for fallback worker, extension-first anti-ban posture | Decide free stack; reject stealth plugin/nodriver; no free proxies |
| 2026-10-10 | v1.2 | **ADOPTED:** Patchright (default) + Camoufox (flag-gated alternate) as fallback-worker stealth engines | User decision; one-import swap, existing proxy reuse, extension-first unchanged |
| 2026-10-10 | v1.3 | **IMPLEMENTED (Phase 0):** worker stealth swap (`stealth_browser_session`, `WORKER_STEALTH_ENGINE`, jitter + `human_type`); .NET Aksh spike (`Infrastructure/Aksh`, 3 tests green, 58/58 suite) | Build + py_compile green; remaining 11 fixed-sleep/instant-fill sites queued for full humanization pass |
| 2026-10-10 | v1.4 | **IMPLEMENTED (Phases 1–2 backend):** Aksh entities + seed compat, runner/SSE controller, 7-tool catalog, single-use bound approvals with approve-with-edits, autonomy-aware review, governor, ledger; 66/66 tests | Agent backend properly working; extension run loop + SPA approvals UI remain as the defined stopping point |
| 2026-10-10 | v1.5 | **FIXED agent ignoring instructions:** deterministic URL pre-pass + intent-routed prepare/approval execution + tool→todo sync; plan↔catalog aligned; `Aksh:Model` override; 80/80 tests | Agent greeted in loops pasting pasted URLs and "continue" — execution is now rule-driven, narration model-side |
| 2026-10-10 | v1.6 | **Naukri finalize + extension bounds:** worker dispatch with honest offline/failure states; `headed` end-to-end; per-field retry budget (3) + amber escalation + pacing jitter; MCP remote-plane adopted | Authorize staged forever on Naukri; checkbox dead; unbounded retries; user-proposed MCP direction agreed with scope correction |
| 2026-10-10 | v1.7 | **Genuine tool calling + routing + honest empty-response:** MEAI→Gemini functionDeclarations mapping (mocked-HTTP round-trip proof), explicit per-turn sessions, mandatory workflow instructions, chat output cap, thought-part-tolerant parsing with finish/block reasons, hash-routed SPA, XSS-safe Markdown; 87/87 tests | External critique verified on adapter/tools/session; empty turns were thinking-part parse failures; plan docs reconciled against tree truth |
| 2026-10-10 | v1.8 | **Phase 3 remainder closed:** orchestrator finalize-state root cause fixed (status overwritten before the paused-check; captured pre-overwrite + pure resolver, matrix-tested); governor extracted to `AkshPacingGovernor` service (daily + new concurrent-run caps); EF `array.Contains` translation crash fixed via explicit status disjunction; worker/extension humanization finished; 97/97 tests | Audit-driven closure in proper sequence (reproduce → root-cause → fix → verify → docs); no pipeline semantics changed, only called |
| 2026-10-10 | v1.9 | **Phase 4 shipped — auto-apply stall root cause closed:** copilot runs now dispatch (`DispatchedToExtension`) instead of staging; extension claims (atomic ticket PK) and executes in the candidate's browser with receipts; lease sweeper + tracker cancel; `ABORT_AGENT`/`ABORT_AGENT_LOOP` mismatch fixed; 115/115 tests | The Layer-1 stall ("staging simulation by default") is removed by construction, not by copy changes — unclaimed runs wait honestly, claimed runs report honestly |
| 2026-10-10 | v2.0 | **Two live bugs fixed:** (1) Aksh empty-STOP false alarm — `STOP` + zero parts + no block is normal Gemini behavior (nothing to narrate), not an error; text path + function bridge now return empty success, thought parts skipped, adapter states a fact instead of the apology. (2) Naukri listing-page dead end — worker ATS path now classifies page shape first (login wall → `AuthenticationRequired` + extension guidance; zero form fields → listing-not-form guidance) instead of dying late at "Submit control absent". 119/119 tests | Both were honest-failure paths with wrong granularity: Bug 1 mistook benign for broken; Bug 2 detected the failure too late to be actionable |
| 2026-10-10 | v2.1 | **Goal hardening batch:** atomic approval consume (TOCTOU gone, retryable execution failure, validate-before-mutate) + content-bound approvals (package hash, args_superseded) + legacy recall deleted + single-writer ledger + UsageLogs budget + per-session turn lock + fail-closed LLM errors (typed failure, no silent text fallback, runner catch + lock release) + centralized SSRF guard (Domain + DNS + worker + session front door) + truth-failure signal (forced review + log) + UNEXPECTED_TOOL_CALL single-retry + extension fail-closed completion (persona/legal/terminals/evidence) + e2e 138/138 green + frontend SSE/spend/approval/hash fixes. 156/156 unit tests | User goal: pristine working app — Aksh tool loop robust, auto-apply honest end to end |
