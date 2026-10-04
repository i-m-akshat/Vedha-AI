# Bug Fix Plan: Autonomous SaaS Schema Migration, Event Resiliency, and Routing

## 1. Overview & Classification
- **Classification**: Bug Fix
- **Target Subsystems**: Backend WebApi (`Program.cs`, `AutonomousApplicationsController.cs`), Background Event Consumer (`NatsWorkerEventConsumerHostedService.cs`), and Python Automation Worker (`main.py`).

---

## 2. Identified Bugs & Root Causes

### Bug 1: Unhandled `app.worker.failed` JetStream Event
- **Root Cause**: `workers/playwright-agent/main.py` emits `app.worker.failed` when Playwright encounters a failure, but `NatsWorkerEventConsumerHostedService.cs` only subscribes to `app.job.ingested`, `app.worker.success`, and `app.worker.hitl_required`.
- **Impact**: Any application that fails in the Playwright worker remains in `"applying"` state forever in `ApplicationAudits`, with no error message recorded, and no failure notification sent to the candidate via SignalR.
- **Proposed Fix**: Add a dedicated subscriber in `NatsWorkerEventConsumerHostedService.cs` for `app.worker.failed`. Look up `ApplicationAudit`, update `Status = "failed"`, set `ErrorMessage`, set `AppliedAtUtc = DateTime.UtcNow`, commit to DB, and notify UI via `ITailoringProgressNotifier`.

### Bug 2: Missing `/api/autonomous` Route Alias on `AutonomousApplicationsController`
- **Root Cause**: `AutonomousApplicationsController` only inherits `[Route("api/[controller]")]` from `BaseApiController`, resolving solely to `/api/AutonomousApplications`.
- **Impact**: Specification documents and external integrations expecting `/api/autonomous/*` receive 404 Not Found.
- **Proposed Fix**: Add `[Route("api/autonomous")]` attribute directly on `AutonomousApplicationsController` to provide dual compatibility for both `/api/autonomous/*` and `/api/autonomousapplications/*`.

### Bug 3: Database Schema Auto-Migration for Existing Databases
- **Root Cause**: EF Core's `Database.EnsureCreated()` only executes if the database does not exist. If a user or CI environment already has an existing `vedha.db` (SQLite) or `vedha_db` (PostgreSQL), `EnsureCreated()` is a no-op, skipping table creation for `CareerAchievements`, `ApplicationAudits`, and `IdempotentTransactions`, as well as column additions for `CreditsBalance` and `MasterContextJson`.
- **Impact**: Queries to autonomous features immediately throw runtime relational errors (`no such table`, `table does not exist`, or missing columns).
- **Proposed Fix**: Implement an idempotent raw DDL migration routine in `Program.cs` that verifies and creates missing tables (`CareerAchievements`, `ApplicationAudits`, `IdempotentTransactions`) and missing columns (`CreditsBalance`, `MasterContextJson`, `SalaryCurrency`) for both PostgreSQL and SQLite.

### Bug 4: `UnboundLocalError` in Worker Exception Handler
- **Root Cause**: In `workers/playwright-agent/main.py`, `data` is initialized inside `try: data = json.loads(...)`. If decoding fails, the `except Exception as e:` block attempts to access `data.get(...)`, triggering Python's `UnboundLocalError`. Furthermore, if `execute_playwright_flow` returns `False`, no failure event is published.
- **Impact**: Corrupt NATS payloads cause unhandled worker crashes and prevent publishing `app.worker.failed`.
- **Proposed Fix**: Initialize `data: Dict[str, Any] = {}` prior to the `try` block and explicitly publish `app.worker.failed` if `execute_playwright_flow` returns `False`.

### Bug 5: Unregistered QuestPDF Global License at Startup
- **Root Cause**: `QuestPDF.Settings.License = LicenseType.Community;` was placed in the static constructor of `ResumeExportService.cs`.
- **Impact**: If any non-export service or early thread touches PDF generation before `ResumeExportService` is instantiated, QuestPDF throws an unhandled license exception.
- **Proposed Fix**: Explicitly configure `QuestPDF.Settings.License = LicenseType.Community;` at the very beginning of `Program.cs`.

---

## 3. Files Affected
- `backend/src/ResumeTailor.WebApi/Program.cs`
- `backend/src/ResumeTailor.WebApi/Controllers/AutonomousApplicationsController.cs`
- `backend/src/ResumeTailor.Infrastructure/Messaging/NatsWorkerEventConsumerHostedService.cs`
- `workers/playwright-agent/main.py`
- `docs/specs/autonomous-job-application-saas.md`
- `docs/plan/autonomous-job-application-saas.md`

---

## 4. Regression Risks & Mitigation
- **Risk**: DDL migration statements causing locks or failing on existing constraints.
  - *Mitigation*: Use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` syntax and wrap column additions in isolated `try/catch` blocks.
- **Risk**: NATS consumer message loop blocking.
  - *Mitigation*: Ensure each event handler runs asynchronously, handles errors gracefully, and always acknowledges (`ack()`) the message.

---

## 5. Verification Steps
1. Verify .NET compilation with `dotnet build ResumeTailor.sln`.
2. Run all unit tests (`dotnet test ResumeTailor.sln`).
3. Verify Python syntax check on `workers/playwright-agent/main.py`.
4. Verify Frontend build (`npm run build` in `frontend/`).

---

## Changelog
- **2026-10-04T16:20:00+05:30**: Initial Bug Fix Plan created for schema migration resiliency, NATS worker failure handling, route alias support, and QuestPDF licensing.
