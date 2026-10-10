# Feature Specification: Aksh — Agentic Copilot & Harness Orchestrator

**Status:** ACCEPTED (ADR-006 Rev 6) | **Date:** 2026-10-10
**Companions:** `docs/adr/ADR-006-aksh-agent-harness-copilot-orchestrator.html` (decision record, brand, detailed design) • `docs/plan/aksh-agent-harness-copilot-orchestrator.md` (build plan) • `docs/bugfixes/copilot-pipeline-auto-apply-stall-and-extension-harness-spike.md` (root cause + execution strategy)

---

## 1. Overview

**Problem:** The job-application pipeline is imperative and click-driven: fixed steps, one-shot AI calls with no run memory, no replanning, no conversational goal handling — and (per the connected spike) it stages packages but never drives a browser to apply. As ATS adapters multiply, the click-path is the bottleneck and there is no Neo-like agent holding a goal end to end.

**Solution:** **Aksh** (**A**utonomous **K**nowledge-driven **S**creening **H**arness) — one conversational agent that plans, executes, and supervises the full copilot pipeline (scrape → tailor → cover letter → screening answers → queue → supervised apply) on **Microsoft Agent Framework 1.24.0 HarnessAgent**, with tools as thin adapters over existing MediatR handlers and execution primarily through the extension run-loop in the candidate's own browser.

## 2. Business Goal

Give candidates a single "apply for me" entry point that feels fully automatic while keeping account-ban risk near zero and per-application AI cost around $0.01 — differentiating Vedha AI from one-shot tailoring tools and matching Neo-class agent expectations without their unattended-submission risk.

## 3. User Stories

- As a candidate, I want to say "apply to this LinkedIn posting" so that resume tailoring, answers, and form-filling happen without me driving each step.
- As a candidate, I want to see the plan and every draft before anything submits, so that I stay in control.
- As a candidate, I want validation errors on Workday-style wizards fixed automatically, so that I only step in when truly needed.
- As a candidate, I want to see what each application cost in AI spend, so that usage never surprises me.
- As a candidate, I want my LinkedIn account never banned by automation, so that supervised submission stays the default on high-risk portals.

## 4. Acceptance Criteria

1. A chat goal produces a visible, editable todo plan before any tool runs.
2. All package artifacts (resume, cover letter, answers) pass the ATS truth gate; violations fail closed to master content with an audit entry.
3. `launch_apply` cannot execute without a live, single-use approval bound to exact tool + arguments.
4. Extension run-loop fills real portals with per-field receipts; unfixable fields escalate with highlight (no silent staging).
5. Per-session token ledger reports spend; budget breach pauses the run.
6. Full suite (55 pre-existing + new) green; no existing pipeline behavior modified, only called.
7. LinkedIn execution is supervised-only (L2) permanently; L3 auto-submit is opt-in per low-risk portal under the pacing governor.

## 5. Functional Requirements

- **FR-1 Sessions:** open/list/stream chat sessions per user; SSE events (`plan-delta`, `todo-update`, `tool-start/end`, `draft`, `approval-request`, `progress`, `error`, `done`).
- **FR-2 Planning:** TodoProvider-backed plan in plan mode; candidate can edit/reorder before execution.
- **FR-3 Tools (all delegating):** `scrape_job`, `recall_memory`, `tailor_resume`, `draft_cover_letter`, `answer_screening`, `check_truth` (blocking, local), `prepare_package`, `launch_apply` (approval-gated). No shell/file/network tools server-side.
- **FR-4 Approvals:** Review Gateway integration; approvals single-use, expire, and bind tool+args (FIDES-style binding even though FIDES is .NET-absent).
- **FR-5 Execution:** extension-first observe→fill→validate→fix loop (spike §4B); headless worker (Patchright default, Camoufox alternate) as fallback only.
- **FR-6 Memory:** L0 deterministic → L1 Postgres rows → L2 Flash-Lite summaries (receipts, not transcripts) → L3 hash-pinned embeddings; hash-and-reuse extended to JD schemas, field mappings, company answers.
- **FR-7 Audit:** todos + tool receipts + approvals + ledger replayable via `GET /api/aksh/sessions/{id}/audit`.
- **FR-8 Autonomy setting:** per-user/per-portal `Supervised` (default) vs `SupervisedAuto` (opt-in); `RequiresManualReview` derived from it, not hardcoded.

## 6. Non-Functional Requirements

- **Performance:** first plan preview streams in seconds; tool fan-out (tailor ∥ cover ∥ answers) parallelized; extension fill paced by governor, not model latency.
- **Security:** Layer-2 deterministic injection controls (data/instruction segregation, quarantine parse, allowlist, truth gate, side-effect gating, per-UserId isolation); PII never in logs; RFC-7807 errors with `reasonCode`s, never fake-success copy.
- **Scalability:** stateless WebApi (session state in Postgres); worker engines container-local; per-user memory scoping prevents cross-talk.
- **Reliability:** same-provider retry → cost-ordered cross-provider failover; worker offline/auth-wall/budget/governor all explicit terminal states with resume.
- **Accessibility:** chat + review UI keyboard-operable; approval diffs readable; status copy plain-language.
- **Maintainability:** MAF confined to `Infrastructure/Aksh`; Domain dependency-free; skills as versioned files.
- **Cost:** ≈$0.01/application (Flash-Lite routing, thinking budget 0, hash reuse, Batch consolidation offline, caching only past break-even).

## 7. Architecture

- **Affected layers:** Domain (3 new entities), Application (`Features/Aksh` contracts), Infrastructure (`Aksh/` MAF wiring — sole MAF consumer), WebApi (`AkshController` + SSE), extension (`content.js` run-session loop), worker (`stealth_browser_session`).
- **New components:** `AkshChatClientAdapter`, `HarnessAgentFactory`, `AkshTools` catalog, `AkshPrompts`/skill files, per-user file-memory store (Phase 2), token ledger writer, pacing governor, extension state machine.
- **Dependencies:** `Microsoft.Agents.AI` + `Harness` 1.24.0, `Microsoft.Extensions.AI` 10.10.0 (all resolved; native net10.0 targets); `patchright`/`camoufox` (worker).
- **Data flow:** chat → session → plan → tools (existing handlers) → truth gate → queue → approval → extension/worker executor → tracker sync; ledger + audit persisted throughout.

## 8. API Changes

- `POST /api/aksh/sessions` → `{ sessionId, status, planPreview }`
- `POST /api/aksh/sessions/{id}/messages` (SSE stream)
- `GET /api/aksh/sessions?status=active`
- `POST /api/aksh/approvals/{id}/decision` (consumes approval, resumes run)
- `GET /api/aksh/sessions/{id}/audit`
- Auth: existing JWT, all routes `UserId`-scoped. Errors: problem-details + `reasonCode` (`worker_offline`, `auth_wall`, `budget_breach`, `governor_cap`, `approval_expired`). No breaking changes to existing endpoints.

## 9. Database Changes

- **New (additive migration):** `AkshSessions`, `AkshMessages` (receipts/refs, not transcripts), `AkshApprovals`; `CandidateProfile.AutonomyLevel` + pacing counters (from spike §4A).
- **Indexes:** `(UserId, Status, CreatedAtUtc)` on sessions; `(SessionId)` on messages/approvals.
- **Migration strategy:** additive only; rollback = `Aksh:Enabled=false` (no existing table altered).

## 10. UI Changes

- SPA "Ask Aksh" panel (chat, plan editor, draft diffs, approval cards with edited-answers support, spend readout, audit view) reusing the Aksh SVG mark at 24–32px.
- Extension sidepanel chat + run status; in-page escalation highlights; existing abort control covers runs.
- Validation: approval requires explicit confirm; destructive/irreversible actions always gated; all copy states honest (no fake "staged").

## 11. Edge Cases

Worker offline; LinkedIn auth wall; scraper blocked (re-plan to pasted JD); unfixable validation (escalate); budget/governor breach (pause with reason); concurrent sessions; stale plan (JD/profile changed mid-run → re-plan); model 404 (existing fallback chain); EEO/consent fields (never guessed); simultaneous headless+extension on one account (forbidden by design); expired approvals.

## 12. Risks

FIDES absent on .NET (Layer-2-only, re-check per MAF bump); MAAI001 experimental surface (token caps provider-side); portal DOM drift (versioned descriptors, escalate-don't-guess); L3 ban surface (opt-in, governor-bound, LinkedIn L2-only); label conservatism (approval UX must explain why).

## 13. Future Extensions

Multi-application campaigns ("apply to these 5"); interview-prep agent on tailored resume; offer/negotiation coach; employer-side (recruiter) harness reuse; FIDES adoption when it lands on .NET; Batch-nightly memory consolidation.

---

## Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-10-10 | Principal Engineer | v1.0 | Aksh feature specification created (covers ADR-006 Rev 1–6 + spike v1.0–v1.3 + Phase 0 shipped) | Dedicated spec was missing — orchestrator spec only carried changelog rows; constitution requires a full spec per feature | `docs/specs/`, `docs/adr/`, `docs/plan/`, `docs/bugfixes/` |
| 2026-10-10 | Principal Engineer | v1.4 | Gemini native function-calling bridge implemented in `AkshChatClientAdapter` and `GeminiFunctionCallingClient`; typed CLR args extraction with `JsonDocument`; `role: "user"` normalization for `functionResponse`; `AkshFunctionCallingTests` suite added; 91/91 unit tests green; frontend verified (`npm run build` green). | Enable true Microsoft Agent Framework ReAct loop with structured tool calling; fix model chat-past-tools flaw. | `AkshChatClientAdapter.cs`, `GeminiFunctionCallingClient.cs`, `AkshFunctionCallingTests.cs`, `DependencyInjection.cs`, `AskAkshPage.tsx`, `docs/adr/`, `docs/architecture/` |
| 2026-10-10 | Principal Engineer | v1.5 | Phase 3 remainder shipped: orchestrator finalize-state bug fixed (pre-overwrite capture + pure `ResolveEffectiveReviewMode`); `AkshPacingGovernor` service (daily cap + concurrent-run cap, `Aksh:MaxConcurrentRuns`); worker fully humanized (all fills via `human_type`, jittered waits, stealth scrape path, ATS read-back receipts); extension harness state machine (OBSERVE→…→REVIEW/SUBMIT/DONE + ESCALATED/ABORTED) with MutationObserver-settled VERIFY and run receipts; 97/97 tests green. | Close the audited Phase 3 gaps without changing existing pipeline semantics; every gate fails closed with honest receipts. | `JobApplicationOrchestrator.cs`, `AkshPacingGovernor.cs`, `AkshCommands.cs`, `main.py`, `content.js`, `appsettings.json`, `infra/.env.example`, `tests/` |
| 2026-10-10 | Principal Engineer | v1.6 | Benign-empty contract: `STOP` + zero parts + no safety signal is normal Gemini behavior, not an error — text path and function bridge return empty success, thought-flagged parts never surface as narration, adapter states a fact instead of the false-alarm apology; blocks still fail honestly. Worker ATS path classifies page shape first (login wall → `AuthenticationRequired`; zero fields → listing-not-form guidance). 119/119 tests. | Live reports: empty-STOP false alarm in Aksh chat; Naukri listing URL dying late at "Submit control absent" with no actionable guidance. | `AiProviders.cs`, `GeminiFunctionCallingClient.cs`, `AkshChatClientAdapter.cs`, `main.py`, `GeminiParsingTests.cs`, `GeminiFunctionCallingTests.cs` |
| 2026-10-10 | Principal Engineer | v1.7 | Goal hardening: atomic approval consume + content binding + legacy recall deletion + single-writer ledger + UsageLogs budget + turn lock + fail-closed LLM errors + SSRF centralization + truth signal + tool-loop retry + extension fail-closed + 138/138 e2e + frontend SSE/spend/approval/hash. 156/156 unit tests. | Audit Criticals + goal majors, verified in sequence with evidence before synthesis. | `AkshCommands.cs`, `AkshBinding.cs`, `AkshAgentRunner.cs`, `AkshChatClientAdapter.cs`, `TokenLedger.cs`, `UrlSafety*.cs`, `JobScraperService.cs`, `main.py`, `content.js`, `AskAkshPage.tsx`, `tests/` |
