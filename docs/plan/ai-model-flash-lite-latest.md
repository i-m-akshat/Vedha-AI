# Implementation Plan: AI Default Model Upgrade to gemini-flash-lite-latest

## 1. Overview & Classification
- **Classification**: Enhancement
- **Target Subsystems**:
  - `backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs`
  - `backend/src/ResumeTailor.Application/Features/Auth/AuthCommands.cs`
  - `backend/src/ResumeTailor.WebApi/Program.cs`
  - `infra/.env` & `infra/.env.example`
  - `infra/docker-compose.yml` & `docker-compose.yml`
  - `infra/build_and_start.ps1`

---

## 2. Rationale ("Why")
The user requested upgrading the default model to `gemini-flash-lite-latest` ("flash lite latest"). 
`gemini-flash-lite-latest` is Google's high-speed, cost-efficient, low-latency Flash-Lite model with:
- Zero thinking token overhead (eliminating reasoning latency).
- Maximum output token limit of 65,536 tokens.
- Native JSON schema support via `responseMimeType: "application/json"`.

**Architectural Consideration**:
Unlike `gemini-2.5-flash`, non-thinking models like `gemini-flash-lite-latest` reject `thinkingConfig` with HTTP 400 `INVALID_ARGUMENT`. The implementation must conditionally apply `thinkingConfig` only when interacting with models that support reasoning.

---

## 3. Implementation Steps
1. Update `AiProviders.cs`:
   - Set `AiSettings.DefaultModel = "gemini-flash-lite-latest"`.
   - Update `ResolveModelName` to support `"flash lite latest"`, `"flash-lite-latest"`, and default to `"gemini-flash-lite-latest"`.
   - Conditionally add `thinkingConfig: { thinkingBudget: 0 }` only if the target model is a reasoning/thinking model (e.g. contains `-2.5-` or `-pro`).
   - Update fallback URLs from `gemini-2.5-flash` to `gemini-flash-lite-latest`.
2. Update `AuthCommands.cs`:
   - Default new users to `PreferredModel = "gemini-flash-lite-latest"`.
3. Update `Program.cs`:
   - Default demo user seed to `PreferredModel = "gemini-flash-lite-latest"`.
4. Update Environment & Orchestration:
   - `infra/.env` and `infra/.env.example`: `DEFAULT_AI_MODEL=gemini-flash-lite-latest`.
   - `infra/docker-compose.yml` and `docker-compose.yml`: `DEFAULT_AI_MODEL:-gemini-flash-lite-latest`.
   - `infra/build_and_start.ps1`: default `$aiModel` to `"gemini-flash-lite-latest"`.
5. Verification:
   - Recompile backend and execute unit tests (28/28).
   - Rebuild container image `localhost/infra-backend:latest` and restart `vedha-backend`.
   - Test live resume tailoring with `gemini-flash-lite-latest`.

---

## Changelog
- **2026-10-04T18:24:30+05:30**: Initial Implementation Plan created for configuring `gemini-flash-lite-latest` as the primary AI model across all application layers.
- **2026-10-04T18:35:00+05:30**: Implementation and live verification completed.
  - Updated `AiProviders.cs`, `AuthCommands.cs`, `Program.cs`, `SettingsPage.tsx`, `AppLayout.tsx`, `TailorStudioPage.tsx`, `docker-compose.yml`, `infra/.env`, `infra/.env.example`, `infra/build_and_start.ps1`, `infra/start_services.sh`, and `infra/localhost_proxy.py`.
  - Added unit tests in `EncryptionAndResilienceTests.cs` (30/30 passed).
  - Rebuilt `localhost/infra-backend:latest` and redeployed `vedha-backend`.
  - Verified live resume tailoring through `POST /api/Tailor/generate` with both `"flash lite latest"` override and system default; generation succeeded in 6.5–7.2 seconds with complete ATS scoring (80), zero truncation, and zero thinkingConfig errors.

