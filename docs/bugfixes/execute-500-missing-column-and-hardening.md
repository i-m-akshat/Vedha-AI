# Bug Fix Plan: 500 on "Authorize & Finalize Submit" (Execute Path)

**Classification:** Bug Fix | **Date:** 2026-10-10 | **Status:** FIXED (code) — live verification pending user retry
**Related:** `docs/bugfixes/copilot-pipeline-auto-apply-stall-and-extension-harness-spike.md` (v1.4)

---

## 1. Reproduction

- UI: Auto-Apply Queue → review a `PausedForUserReview` item → check "Show Browser Window" → **Authorize & Finalize Submit**.
- Request: `POST /orchestrator/queue/{id}/execute` `{headed, copilotMode:false}` → **500** with axios default message ("Request failed with status code 500"), surfaced in the "Application Update" banner.
- Server log proof: `Npgsql.PostgresException 42703: column c.AutonomyLevel does not exist` thrown from `OrchestratorHandlers.Handle(ExecuteApplicationQueueItemCommand)` via `JobApplicationOrchestrator` profile load.

## 2. Root Cause

My own Phase-2 change added `CandidateProfile.AutonomyLevel` / `MaxApplicationsPerDay` to the EF model, and the Program seed covered them for **SQLite only** (PRAGMA-guard ALTERs). The **PostgreSQL seed branch never got the matching `ADD COLUMN IF NOT EXISTS` lines**, so every profile query on existing Postgres databases threw `42703`. The seed's catch-all logged a warning and continued, masking the gap until the execute path hit it.

Contributing cause: Npgsql client-side parsing rejects the seed batch when it contains a `DEFAULT '{}'` literal (server-side valid; confirmed via psql), so the whole PG DDL batch — including Aksh tables — silently failed with "Failure to parse near offset … Expected an ASCII digit". The `'{}'` default was removed; EF always writes the value explicitly.

## 3. Why It Happened

New entity columns were added to the model without updating **both** seed branches (PG raw SQL + SQLite guards). No test covers seed-SQL parity for pre-existing databases (EnsureCreated only helps fresh DBs).

## 4. Similar Issues Found & Fixed in the Same Pass

- **Dead "Show Browser Window" checkbox:** all 6 worker call sites hardcoded `headed=false`; `IJobApplicationProvider.ExecuteFlowAsync` had no `headed` parameter at all. Added `bool headed = false` to the interface + all 7 implementations and threaded the orchestrator's value through.
- **Null-deref 500 candidates on AI-shaped JSON:** providers dereference `PersonalInfo`/`Skills` unconditionally; explicit JSON nulls would 500. Added `NormalizeResumeSchema` at the single orchestrator choke point (covers worker client + all providers).
- **Missing worker in this environment:** `podman ps` showed no `vedha-worker`, and `start_services.sh` referenced a nonexistent `localhost/infra-worker` image tag (only stale `infra_worker` existed) — the headless path could never have run here. Build scripts now build the worker image; start paths start it with `WORKER_STEALTH_ENGINE`.
- **Stop scripts** only stopped 4 of 8 containers; **start_services.sh** lacked all Aksh/crawler/AI env parity; `build_and_start.ps1` never built/started the worker. All synced (ps1/bat/sh).

## 5. Proposed Fix (applied)

1. `Program.cs`: PG `ADD COLUMN IF NOT EXISTS` for both profile columns; removed `'{}'` DDL default; SQLite tables + PRAGMA guards (already present, verified).
2. `ApplicationInterfaces.cs` + all providers + orchestrator call: `headed` threaded end to end.
3. `JobApplicationOrchestrator.NormalizeResumeSchema` (public static, tested).
4. Infra scripts synced; `Dockerfile.worker` pre-fetches the Patchright browser.

## 6. Files Affected

- `backend/src/ResumeTailor.WebApi/Program.cs`
- `backend/src/ResumeTailor.Application/Common/Interfaces/ApplicationInterfaces.cs`
- `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationProviders.cs`
- `backend/src/ResumeTailor.Infrastructure/Orchestrator/JobApplicationOrchestrator.cs`
- `infra/build_and_start.ps1`, `infra/build_and_start.bat`, `infra/start_services.sh`, `infra/stop.ps1`, `infra/stop.bat`, `infra/Dockerfile.worker`, `infra/.env` (flags only)

## 7. Regression Risks

- `headed` default `false` preserves existing behavior for all current callers (orchestrator passes its own value; Aksh decide path passes `false` unless approved args say otherwise).
- Seed SQL remains idempotent (`IF NOT EXISTS`); the removed `'{}'` default is compensated by the C# property default.
- Stop scripts now stop more containers — intended; data volumes untouched.

## 8. Test Strategy

- New: `NormalizeResumeSchema_EliminatesNulls_FromAiShapedJson`, `NormalizeResumeSchema_HandlesNullRoot` (69/69 suite green).
- Existing `OrchestratorTests` provider-matching untouched and green.
- Seed parity has no unit coverage by nature (needs a real PG); verified live via `/healthz` boot + `information_schema` column/table checks.

## 9. Verification Steps

1. ✅ Fresh boot: `/health` 200, no `42703` in logs, `AutonomyLevel`/`MaxApplicationsPerDay` present, Aksh tables present.
2. ⏳ User retries Authorize & Finalize Submit in the app and confirms no 500 (watch `podman logs vedha-backend` for `ExecuteApplicationQueueItemCommand`).
3. ⏳ Worker path: after worker image build + `vedha-worker` up, execute with headed=true and confirm browser session dispatch in worker logs.

## 10. Changelog

| Date | Version | Change | Why |
|---|---|---|---|
| 2026-10-10 | v1.0 | 500 root-caused to missing PG columns from the autonomy change; fixed + headed passthrough + null guards + script sync | Authorize-submit crashed; checkbox was dead; worker never ran here |
