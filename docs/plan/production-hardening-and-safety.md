# Implementation Plan: Production Hardening, Security, AI Resilience, Orchestrator Session Management & Copilot Safety

## 1. Overview & Objectives

This implementation plan executes the security, resilience, anti-hallucination metric validation, QuestPDF page budgeting, inline editing, session management, and extension bridge specifications defined in `docs/specs/production-hardening-and-safety.md`.

---

## 2. Step-by-Step Implementation Steps

### Phase 1: Security, Encryption & GDPR Compliance
1. **Define Encryption Contract**:
   - Create `IEncryptionService.cs` in `ResumeTailor.Application.Common.Interfaces`.
2. **Implement AES-256-GCM Service**:
   - Create `AesGcmEncryptionService.cs` in `ResumeTailor.Infrastructure.Security`.
   - Implement authenticated encryption with 128-bit authentication tags and cryptographically secure nonces.
3. **Wire Encryption into User & Candidate Profile Handlers**:
   - Update `AuthCommands.cs` and `CandidateProfileCommands.cs` to encrypt/decrypt API keys and sensitive financial/salary data.
4. **Implement GDPR Data Export & Account Cascade Purge**:
   - Add `ExportUserDataQuery` and `DeleteUserAccountCommand` in `AuthCommands.cs`.
   - Add controller actions in `AuthController.cs`.

### Phase 2: Enhanced Truth Preservation (Metric & Quantitative Invariants)
1. **Add Metric Invariant Check in AtsScoringEngine**:
   - Enhance `ValidateTruthPreservation` in `AtsScoringEngine.cs` to extract and verify numbers, dollar values, percentages, and metrics between Master and Tailored experience bullets.
2. **Add Comprehensive Unit Tests**:
   - Create test cases verifying that metric exaggerations (e.g., changing 10% to 50%) are caught and flagged as truth violations.

### Phase 3: AI Multi-Provider Fallback & Resilience
1. **Enhance AI Service Provider & Factory**:
   - Update `AiProviders.cs` to introduce a fallback chain across providers (Gemini ➔ Claude ➔ OpenAI) when HTTP 429 / 503 is returned.
2. **Add Structured Warning Logging**:
   - Ensure fallback events are logged to the console and SignalR terminal notifications.

### Phase 4: Document Budgeting & Single-Page ATS Optimizer
1. **Enhance QuestPDF Document Generation**:
   - Add typography auto-scaling and vertical spacing optimizer in `ResumeExportServices.cs` to guarantee 1-page or 2-page fit without orphan trailing lines.
2. **Add Live Tailored Resume Mutation API**:
   - Add `UpdateTailoredResumeCommand` in `TailoringCommands.cs` and endpoint in `MasterResumeAndJobControllers.cs` to support inline edits.

### Phase 5: Chrome Extension Bi-Directional Bridge & Anti-Ban Safety Engine
1. **Update Extension Popup & Content Script**:
   - Modify `extension/popup.html` and `extension/popup.js` to store backend API base URL and JWT auth token in `chrome.storage.local`.
   - Add direct 1-click **"Send to Vedha AI Orchestrator"** button that calls `POST /api/orchestrator/prepare-package` with scraped job details and opens the Orchestrator Queue in a new tab.
2. **Implement Biometric Delays & Gaussian Typing Simulation**:
   - Update `extension/content.js` with humanized typing jitter (45ms–110ms keystroke delays) and smooth scrolling before interacting with inputs.
3. **Enforce Daily Application Ceilings & Cooldowns**:
   - Add client-side daily application tracker (e.g. max 20–25 applications per 24 hours per platform) and 60–90 second cooldown timers.
4. **Add CAPTCHA Detection & Human Handoff State**:
   - Handle `PausedForCaptcha` status in `JobApplicationOrchestrator.cs` and popup alert.

### Phase 6: Infrastructure, Health Checks & Rate Limiting
1. **Add ASP.NET Core Health Checks**:
   - Map `/healthz` endpoint with database and Redis ping checks in `Program.cs`.
2. **Add Rate Limiting Middleware**:
   - Configure sliding window rate limiting on public endpoints in `Program.cs`.

---

## 3. Files to Create & Modify

### Files to Create:
- [`backend/src/ResumeTailor.Application/Common/Interfaces/IEncryptionService.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Common/Interfaces/IEncryptionService.cs)
- [`backend/src/ResumeTailor.Infrastructure/Security/AesGcmEncryptionService.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Security/AesGcmEncryptionService.cs)
- [`backend/tests/ResumeTailor.UnitTests/EncryptionAndResilienceTests.cs`](file:///A:/AIProjects/Resumebuilder/backend/tests/ResumeTailor.UnitTests/EncryptionAndResilienceTests.cs)

### Files to Modify:
- [`backend/src/ResumeTailor.Infrastructure/DependencyInjection.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/DependencyInjection.cs)
- [`backend/src/ResumeTailor.Infrastructure/AtsEngine/AtsScoringEngine.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/AtsEngine/AtsScoringEngine.cs)
- [`backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs)
- [`backend/src/ResumeTailor.Infrastructure/Export/ResumeExportServices.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Export/ResumeExportServices.cs)
- [`backend/src/ResumeTailor.Application/Features/Auth/AuthCommands.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Features/Auth/AuthCommands.cs)
- [`backend/src/ResumeTailor.WebApi/Controllers/AuthController.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.WebApi/Controllers/AuthController.cs)
- [`backend/src/ResumeTailor.WebApi/Program.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.WebApi/Program.cs)
- [`extension/popup.html`](file:///A:/AIProjects/Resumebuilder/extension/popup.html)
- [`extension/popup.js`](file:///A:/AIProjects/Resumebuilder/extension/popup.js)
- [`extension/content.js`](file:///A:/AIProjects/Resumebuilder/extension/content.js)

---

## 4. Testing & Verification Strategy

1. **Unit Tests**:
   - `AesGcmEncryptionService`: Test string encryption, decryption, round-trip integrity, and wrong-key rejection.
   - `AtsScoringEngine`: Test metric invariant verification with exact matches, allowable derivations, and metric inflation attempts.
   - `AiServiceFactory`: Test fallback invocation on simulated 429 response.
   - `ResumeExportService`: Test document generation with dense vs sparse text budgets.
2. **Build & Test Suite Execution**:
   - Run `dotnet test backend/tests/ResumeTailor.UnitTests/ResumeTailor.UnitTests.csproj`.
3. **Extension Verification**:
   - Validate JSON payloads sent from the Chrome Extension to `/api/orchestrator/prepare-package`.

---

## 5. Rollback Strategy

- All encryption services use standard .NET `System.Security.Cryptography` with clean dependency injection.
- AI fallback logic is purely additive and defaults to existing behavior if fallback is disabled.

---

## 6. Changelog

| Date | Changes Made | Rationale | Impacted Components |
| :--- | :--- | :--- | :--- |
| 2026-09-12 | Created Implementation Plan for Production Hardening & Safety | Establish actionable roadmap to resolve security, AI resilience, metric invariants, and extension integration. | Infrastructure, Application, WebApi, UnitTests, Extension |
| 2026-09-12 | Expanded Implementation Plan with Full Architecture Gaps | Added QuestPDF page budgeting, inline tailored resume editor, session management & CAPTCHA handoff, and healthcheck/rate-limiting middleware. | All Layers, Document Export, Frontend, Orchestrator |
| 2026-09-12 | Added Anti-Ban Biometric Simulation & Cooldown Throttling | Prevent bot detection on Naukri, LinkedIn, and Workday via human typing jitter, smooth scrolling, and application throttling in Chrome extension. | Extension, Orchestrator |
| 2026-09-12 | Expanded to 10-Pillar Anti-Ban Matrix | Incorporated Honeypot evasion, Bezier mouse trajectories, typo-backspace simulation, cognitive dwell time, and work-hours pacing. | Extension, DOM Mapper, Orchestrator |
