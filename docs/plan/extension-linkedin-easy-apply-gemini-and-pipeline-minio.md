# Implementation Plan: LinkedIn Easy Apply AI Q&A Auto-Fill, Pipeline Orchestration & MinIO Integration

## 1. Overview
This plan coordinates the changes across the Chrome Extension, Backend WebApi, Infrastructure/Containers, and Documentation to implement intelligent Gemini question answering for LinkedIn Easy Apply, fix the automatic application pipeline, connect MinIO properly, and establish root `context.md`.

## 2. Files to Create & Modify

### Files to Create
- `context.md`: Central knowledge base documenting system architecture, pipelines, configuration, and run guides.
- `docs/specs/extension-linkedin-easy-apply-gemini-and-pipeline-minio.md`: Feature specification.
- `docs/plan/extension-linkedin-easy-apply-gemini-and-pipeline-minio.md`: Implementation plan.

### Files to Modify
- `extension/content.js`:
  - Implement `extractStepQuestions(modal)` to find all unanswered inputs, textareas, selects, and radio fieldsets with their full labels, types, and choices.
  - Implement `queryGeminiForQuestions(questions, profile, company)` calling backend `POST /api/orchestrator/generate-answers` (or fallback extension API key).
  - Enhance `fillModalInputs(modal, payload)` to automatically trigger Gemini question answering when encountering open/custom questions.
  - Add visual feedback on inputs (subtle highlight/badge) indicating Gemini auto-completion.
- `extension/popup.js`:
  - Fix syntax error on line 319 (`else { }`); add error display.
  - Ensure token and profile synchronization handles local storage and backend session smoothly.
- `backend/src/ResumeTailor.Application/Features/Orchestrator/OrchestratorCommands.cs`:
  - Enhance `GenerateScreeningAnswersCommand` and DTOs to support options/choices and field types in the prompt to Gemini for higher accuracy.
- `backend/src/ResumeTailor.WebApi/Controllers/OrchestratorAndProfileControllers.cs`:
  - Update `GenerateAnswersRequest` model to accept options and field types.
- `backend/src/ResumeTailor.Infrastructure/Storage/MinioS3StorageService.cs`:
  - Upgrade using `AWSSDK.S3` (`AmazonS3Client`) with S3 SigV4 authentication, bucket existence validation, and fallback caching.
- `infra/localhost_proxy.py`:
  - Fix port 9000 proxying directly to MinIO port 9000 (remove the old redirection to port 5000).
  - Add ports 8000 (worker) and 9001 (MinIO console).
- `infra/start_services.sh`:
  - Add `vedha-minio` container launch using `cgr.dev/chainguard/minio:latest`.
  - Add `vedha-worker` container launch.
  - Update `vedha-backend` S3 environment variables to point to `minio:9000`.
- `infra/docker-compose.yml`:
  - Update minio service image to `cgr.dev/chainguard/minio:latest`.

## 3. Step-by-Step Implementation Sequence

1. **Step 1: Backend MinIO S3 Integration (`MinioS3StorageService.cs`)**
   - Implement `AmazonS3Client` with `AmazonS3Config` (ForcePathStyle = true).
   - Ensure bucket `vedha-resumes` is auto-created if missing.
   - Retain local cache writing for resilient dual-layer storage.
2. **Step 2: Enhanced Backend Q&A Grounding (`OrchestratorCommands.cs`)**
   - Support rich question prompt items (questions with options, expected field types).
   - Improve Gemini prompt to select from choices for radio/dropdowns and synthesize STAR/truthful text.
3. **Step 3: Chrome Extension Intelligence (`content.js` & `popup.js`)**
   - Fix syntax bug in `popup.js`.
   - Build DOM question extractor in `content.js`: gathers question text, input types, and candidate choices.
   - Dispatch questions to `/api/orchestrator/generate-answers` via fetch or chrome messaging.
   - Inject Gemini answers into textboxes, numbers, textareas, radio buttons, and selects.
   - Provide clear on-screen status updates during Easy Apply modal progression.
4. **Step 4: Infrastructure & Container Orchestration (`start_services.sh`, `localhost_proxy.py`, `docker-compose.yml`)**
   - Configure MinIO with `cgr.dev/chainguard/minio:latest`.
   - Update `localhost_proxy.py` to forward port 9000 to MinIO, and include 8000 and 9001.
   - Update `start_services.sh` to start `vedha-minio` and `vedha-worker`.
5. **Step 5: Central Knowledge Base (`context.md`)**
   - Create comprehensive root `context.md` covering the entire system.
6. **Step 6: Build, Test & Verification**
   - Run `dotnet test` to verify all tests pass.
   - Re-publish backend and worker if needed.
   - Verify MinIO connectivity and extension question filling.

## 4. Verification Strategy
- Verify unit tests pass with 0 errors.
- Test `curl -I http://localhost:9000/vedha-resumes/...` or S3 client upload.
- Verify `POST /api/orchestrator/generate-answers` responds with valid grounded answers.
- Verify extension javascript syntax with no runtime errors.

## 5. Changelog
- **2026-10-05T21:16:00+05:30**: Initial implementation plan drafted.
- **2026-10-05T21:40:00+05:30**: All steps completed: S3 client integrated with AWSSDK.S3, backend QuestionItems support deployed, extension DOM question extractor with Gemini answers implemented, MinIO Chainguard container deployed, Playwright worker container built & verified with NATS, root context.md created, all 30 unit tests passing, all 7 containers running healthy.
- **2026-10-10T18:20:00+05:30**: Replaced attribute-only screening fill with `extractFormQuestions` + `resolveScreeningAnswer`. Confidence below 0.8 escalates. Removed popup defaults of 30 days notice, 140000 salary, and `requiresVisaSponsorship: false`.
- **Why**: LinkedIn Easy Apply steps were skipping employer questions or filing total years, notice, and salary into unrelated prompts.
- **Impacted components**: extension content script, popup payload, e2e tests, LLD, ADR-008.
