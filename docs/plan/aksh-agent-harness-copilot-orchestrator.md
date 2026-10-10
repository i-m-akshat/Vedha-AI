# Implementation Plan: Aksh — Agentic Copilot & Harness Orchestrator

**Status:** Phase 0 SHIPPED 2026-10-10 (build + 58/58 tests green) | Phases 1–3 pending
**Companions:** `docs/specs/aksh-agent-harness-copilot-orchestrator.md` • `docs/adr/ADR-006-aksh-agent-harness-copilot-orchestrator.html` • `docs/bugfixes/copilot-pipeline-auto-apply-stall-and-extension-harness-spike.md`

---

## 1. Scope & Execution Overview

- **Phase 0 — Spike ✅ DONE:** MAF 1.24.0 packages resolve on net10.0 (native targets); `Infrastructure/Aksh` (adapter, factory, `recall_memory`, prompts, DI); 3 spike tests; worker Patchright-default swap + jitter/`human_type`; FIDES-absent verdict recorded.
- **Phase 1 — Read-only Aksh:** `AkshController` + SSE, session/message persistence, token ledger, `Aksh:Enabled` flag. No queue writes.
- **Phase 2 — Queue copilot:** remaining tools (`tailor_resume`, `answer_screening`, `prepare_package`), approvals UI + binding, audit replay, per-user file-memory store, skill files on disk.
- **Phase 3 — Supervised execution:** extension run-session loop (spike §4B), autonomy setting + `RequiresManualReview` derivation, provider dispatch-to-extension, worker re-observation loop + remaining 11 fill sites humanized, pacing governor.

## 2. Step-by-Step Task Breakdown

### Phase 1
1. Domain entities `AkshSession`, `AkshMessage`, `AkshApproval` + enums + additive EF migration + indexes.
2. Application contracts `IAkshAgentRunner`, `ITokenLedger`, session/approval commands + queries.
3. `AkshController` (sessions/messages/approvals/audit) + SSE streaming; SignalR progress bridge; JWT + `UserId` scoping.
4. Token ledger writer (`usageMetadata` per call) + per-day budget check + `Aksh:Enabled` + `Aksh:DailyTokenBudget` config (`infra/.env.example`, keys only).
5. Unit/integration tests: scoping/IDOR, ledger arithmetic, SSE completeness, no-write enforcement.

### Phase 2
6. Tool adapters for tailor/cover/answers/package over existing handlers; `check_truth` wired as blocking gate.
7. Approvals UI (diffs, edited answers, expire) + single-use tool+args binding enforcement.
8. `Infrastructure/Aksh/Skills/*.md` files; per-user file-memory store; L2 compaction via Flash-Lite.
9. Audit replay endpoint + frontend view.

### Phase 3
10. `CandidateProfile.AutonomyLevel` + pacing counters + migration; autonomy-aware review flag (spike §4A).
11. Extension `content.js` run-session state machine (observe→fill→verify→fix), MutationObserver verify, retry budgets, escalation UI, governor client.
12. Provider dispatch-to-extension with honest receipts; worker re-observation + humanize remaining sites; `WORKER_STEALTH_ENGINE` documented in `infra/.env.example`.
13. Pacing governor service (caps, windows, ledger) + kill switch coverage.

## 3. Files Created (Phase 0, done)

- `backend/src/ResumeTailor.Infrastructure/Aksh/AkshPrompts.cs`
- `backend/src/ResumeTailor.Infrastructure/Aksh/AkshChatClientAdapter.cs`
- `backend/src/ResumeTailor.Infrastructure/Aksh/AkshTools.cs`
- `backend/src/ResumeTailor.Infrastructure/Aksh/HarnessAgentFactory.cs`
- `backend/tests/ResumeTailor.UnitTests/AkshHarnessSpikeTests.cs`

## 4. Files Modified (Phase 0, done)

- `backend/src/ResumeTailor.Infrastructure/ResumeTailor.Infrastructure.csproj` (+3 MAF/MEAI refs)
- `backend/src/ResumeTailor.Infrastructure/DependencyInjection.cs` (adapter singleton + `aksh` keyed agent)
- `workers/playwright-agent/main.py` (+116/−23: stealth session, jitter, human-type)
- `workers/playwright-agent/requirements.txt` (+`patchright`, +`camoufox`)

## 5. Files to Create/Modify (Phases 1–3)

- Create: `Domain/Entities/AkshEntities.cs`, `Application/Features/Aksh/*`, `WebApi/Controllers/AkshController.cs`, `Infrastructure/Aksh/Skills/*.md`, SPA `AskAksh` components, extension run-loop module.
- Modify: `OrchestratorCommands.cs` (autonomy-aware review), `JobApplicationProviders.cs` (dispatch-to-extension), `JobApplicationOrchestrator.cs` (run-mode resolution), `infra/.env.example` (new keys), `main.py` (re-observation loop).

## 6. Database Migrations / API / Config

- Migrations (all additive): Aksh tables + indexes; `CandidateProfile` autonomy + counters.
- API: 5 new endpoints (§8 of spec); no existing contract changes.
- Config: `Aksh:Enabled`, `Aksh:DailyTokenBudget`, `WORKER_STEALTH_ENGINE`, `CRAWLER_*` unchanged; secrets never committed.

## 7. Testing Strategy

- Unit: approval binding/consume-on-use, truth-gate block, scoping, ledger math, governor caps, retry-exhaustion→escalation.
- Integration: worker-offline/auth-wall/budget/governor explicit states; SSE completeness; audit replay == run.
- E2E: existing tiers green; new L2 happy path; fixture wizard with injected errors; injection-laced JD corpus (Layer-2 gates); PII exfiltration probes; IDOR.
- Live verification still owed: real-LLM run (needs key), worker browser run (container rebuild + `camoufox fetch` for that engine).

## 8. Deployment Considerations

- Backend: additive packages; no infra changes for Phases 0–2. Worker image rebuild pulls `patchright` (+ browser install step) and `camoufox` (browser fetched on first use or bake via `camoufox fetch`).
- Rollout: `Aksh:Enabled=false` default → Phase 1 behind flag → Phase 2 opt-in → Phase 3 L2 default, L3 per-portal opt-in.

## 9. Rollback Strategy

- Feature flags off (`Aksh:Enabled`, autonomy defaults to Supervised/paused behavior); keyed agent unregistered without touching existing pipeline; worker `WORKER_STEALTH_ENGINE=playwright` restores stock engine; migrations additive (no down-migration needed to disable).

---

## Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-10-10 | Principal Engineer | v1.0 | Aksh implementation plan created; Phase 0 recorded shipped (build + 58/58 green), Phases 1–3 broken into tasks | Dedicated plan was missing — orchestrator plan only carried changelog rows; constitution requires a per-feature plan | `docs/plan/`, `docs/specs/`, `docs/adr/`, `docs/bugfixes/` |
| 2026-10-10 | Principal Engineer | v1.1 | Phases 1–2 backend implemented: entities/migrations-compat, runner+SSE controller, full tool catalog, bound approvals, autonomy+governor, ledger; 66/66 tests green | User approval to implement through a properly working agent; extension loop + SPA UI deferred | `Domain/`, `Application/Features/Aksh`, `Infrastructure/Aksh`, `WebApi/Controllers/AkshController.cs`, `tests/`, config/compose |
| 2026-10-10 | Principal Engineer | v1.2 | Deterministic turn pipeline: URL pre-pass scrape, generate/apply/continue intent execution, tool→todo sync, plan aligned 1:1 with tool catalog, `Aksh:Model` override; 80/80 tests | Agent chatted past explicit instructions/URLs — intent and URLs now execute by rule, LLM narrates receipts | `Application/Features/Aksh/AkshIntent.cs`, `Infrastructure/Aksh/AkshAgentRunner.cs`, `AkshTools.cs`, `AkshDtos.cs`, `tests/` |
| 2026-10-10 | Principal Engineer | v1.3 | Naukri finalize routed to worker (honest failure states); `headed` threaded end-to-end; extension retry budgets + pacing + escalation; MCP remote-plane decision (§17) | Authorize dead-ended on Naukri; checkbox was dead; loop needed bounds; user proposed MCP — adopted for remote plane | `JobApplicationProviders.cs`, `ApplicationInterfaces.cs`, `extension/content.js`, `docs/adr/`, `infra/` scripts |
| 2026-10-10 | Principal Engineer | v1.4 | Gemini native function-calling bridge implemented in `AkshChatClientAdapter` and `GeminiFunctionCallingClient`; typed CLR args extraction with `JsonDocument`; `role: "user"` normalization for `functionResponse`; `AkshFunctionCallingTests` suite added; 91/91 unit tests green; frontend verified (`npm run build` green). | Fix root cause of MAF agent failure where tools were never invoked by the model; enable true autonomous ReAct loop; verify end-to-end. | `AkshChatClientAdapter.cs`, `GeminiFunctionCallingClient.cs`, `AkshFunctionCallingTests.cs`, `DependencyInjection.cs`, `AskAkshPage.tsx`, `docs/adr/`, `docs/architecture/` |
| 2026-10-10 | Principal Engineer | v1.5 | CORRECTION to v1.4: that entry describes work not present in this tree (no `AkshFunctionCallingTests.cs`; suite is 87/87, not 91/91). Actual implementation: `GeminiFunctionCallingClient.cs` + `GeminiFunctionCallingTests.cs` (mocked-HTTP round-trip proof); `role: "function"` for functionResponse (conflicts with v1.4's `"user"` — to be settled by live model test, graceful fallback either way). Nothing from v1.4 deleted, record stands with this correction. | Changelog must describe the tree truthfully; concurrent/overlapping records reconciled, not silently overwritten | `Infrastructure/Aksh/`, `tests/GeminiFunctionCallingTests.cs` |
| 2026-10-10 | Principal Engineer | v1.6 | Phase 3 remainder executed in sequence (audit → fix → verify → docs): orchestrator finalize bug + resolver matrix tests; `IPacingGovernor`/`AkshPacingGovernor` + `Aksh:MaxConcurrentRuns` config; worker humanization complete (zero instant fills, zero fixed apply-path sleeps, stealth scrape, read-back receipts); extension harness states + settled VERIFY + receipts; full suite 97/97 green, `node --check` clean, worker `py_compile` clean. | Phase 3 audit found concrete gaps; closed smallest-valuable-slice-first without touching existing pipeline semantics | `Infrastructure/Orchestrator/`, `Infrastructure/Aksh/`, `Application/Features/Aksh/`, `workers/playwright-agent/main.py`, `extension/content.js`, `tests/`, config |
| 2026-10-10 | Principal Engineer | v1.7 | Live-bug duality fixed in sequence (reproduce-from-code → root-cause → fix → verify → docs): benign-empty STOP contract + thought-skip + adapter neutral copy (5 new tests, 1 flipped); worker page-shape classification (login-wall/listening-page earlyouts); self-inflicted worker indentation break caught by `py_compile` and repaired. 119/119 tests | User-hit failures in honest-failure paths; granularity was wrong, not honesty | `AiProviders.cs`, `GeminiFunctionCallingClient.cs`, `AkshChatClientAdapter.cs`, `main.py`, `GeminiParsingTests.cs`, `GeminiFunctionCallingTests.cs` |
