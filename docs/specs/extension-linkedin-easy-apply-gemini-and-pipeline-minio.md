# Feature Specification: LinkedIn Easy Apply AI Q&A Auto-Fill, Pipeline Orchestration & MinIO Integration

## Problem Statement
Job seekers using the Vedha AI Chrome extension on LinkedIn Easy Apply encounter custom employer screening questions (e.g. years of experience, behavioral questions, work authorizations, salary requirements, radio buttons, dropdowns) that cannot be answered by static rule-based templates. Currently, the extension does not automatically extract questions from the live DOM and query Gemini to supply grounded answers based on the candidate's verified resume and profile. 
Furthermore, the automated background application pipeline (`app.job.ingested` ➔ `app.resume.generated` ➔ Playwright worker execution) was stalled due to an inactive worker container, missing MinIO container runtime, misrouted port forwards in `localhost_proxy.py`, and unauthenticated HTTP storage requests.
Finally, there is no centralized, living `context.md` file tracking the full platform architecture, data flows, and active state for AI pair engineers.

## Business Goal
1. Deliver a 1-click intelligent LinkedIn Easy Apply experience where all custom employer questions (text, number, textarea, radio, dropdown) are dynamically extracted, answered via Gemini with 100% truthful candidate grounding, and typed into form fields with biometric anti-ban jitter.
2. Restore and operationalize the autonomous application pipeline end-to-end so that ingested jobs generate ATS resumes, upload them to MinIO, and execute via Playwright/AgentQL.
3. Connect MinIO object storage natively with official S3 AWS SigV4 authentication (`AWSSDK.S3`), automated bucket initialization, and proper container networking.
4. Establish `context.md` as the authoritative living knowledge base for all future AI agents and engineers working on the repository.

## Scope
1. **Chrome Extension (`extension/content.js`, `extension/popup.js`, `extension/popup.html`)**:
   - Live DOM question extraction for LinkedIn Easy Apply modal dialogs across all multi-step pages.
   - Support for text inputs, numbers, textareas, radio groups, and `<select>` dropdowns.
   - Integration with backend `POST /api/orchestrator/generate-answers` to query Gemini using Master Resume + Candidate Profile + Screening Memories.
   - Fallback direct Gemini inference if the user configures an API key directly in extension storage.
   - Human-like biometric typing simulation and visual indicators showing AI-filled fields.
   - Syntax error fix in `popup.js`.
2. **MinIO Object Storage Integration**:
   - Update `MinioS3StorageService.cs` using `AWSSDK.S3` for standard S3 API compatibility.
   - Auto-create the target bucket (`vedha-resumes`) on initialization.
   - Fix `infra/localhost_proxy.py` to forward port 9000 directly to MinIO (port 9000).
   - Configure `start_services.sh` and `docker-compose.yml` to use `cgr.dev/chainguard/minio:latest`.
3. **Autonomous Application Pipeline**:
   - Ensure `vedha-worker` container is built and orchestrated alongside backend, NATS, and MinIO.
   - Verify NATS JetStream event transitions (`app.job.ingested` ➔ `app.resume.generated` ➔ `app.worker.success` / `app.worker.failed`).
   - Enhance backend `GenerateAnswers` endpoint to accept question choices and field types for precision answers.
4. **Context File (`context.md`)**:
   - Comprehensive living context document in root repository.

## Out of Scope
- Rewriting third-party ATS scrapers outside of LinkedIn/Greenhouse/Lever/Ashby.
- Replacing PostgreSQL or Redis architectures.

## User Stories
- **As a candidate**, I want to click "Auto-Apply" on any LinkedIn Easy Apply modal so that all employer screening questions are automatically answered accurately by Gemini and filled into the textboxes and choices.
- **As a job applicant**, I want my ingested jobs to automatically trigger resume generation and browser application without manual intervention or pipeline stalls.
- **As a DevOps engineer**, I want MinIO running reliably with persistent volumes and standard S3 SDK connectivity.
- **As an AI pair programmer**, I want a comprehensive `context.md` that keeps full architectural context alive across sessions.

## Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Browser ["Chrome Extension (Content & Popup)"]
        DOM[LinkedIn Easy Apply Modal] -->|1. Extract Questions| Extractor[Question & Input Extractor]
        Extractor -->|2. Send Questions| QnAApi[Backend /api/orchestrator/generate-answers]
        QnAApi -->|3. Grounding & Gemini| Gemini[Gemini AI]
        Gemini -->|4. Structured Answers| Extractor
        Extractor -->|5. Human Jitter Type & Select| FormInputs[Form Inputs & Radios]
    end

    subgraph Backend ["ASP.NET Core WebApi & Infra"]
        IngestApi[/api/autonomous/ingest-job] -->|Publish| NATS[(NATS JetStream: app.job.ingested)]
        NATS -->|Consume| RAG[RagResumeGenerator]
        RAG -->|Generate ATS PDF| PDF[PdfPig / QuestPDF]
        PDF -->|S3 Upload (AWSSDK.S3)| MinIO[(MinIO Object Storage :9000)]
        RAG -->|Publish| NATS2[(NATS: app.resume.generated)]
    end

    subgraph Worker ["Playwright Worker Container"]
        NATS2 -->|Consume| PyWorker[Playwright Agent]
        PyWorker -->|Download Resume| MinIO
        PyWorker -->|Browser Automation| ATS[Target Job Portal]
        PyWorker -->|Result| NATS3[(NATS: app.worker.success / failed)]
    end
```

## API Changes
- Enhanced `POST /api/orchestrator/generate-answers`:
  - Request body supports both legacy `List<string> Questions` and rich `List<ScreeningQuestionPromptItem> QuestionItems` with field types and selectable options.
  - Returns `List<ScreeningQuestionAnswerDto>`.

## Edge Cases
- Modal step changes dynamically with conditional questions (e.g. selecting "Yes" reveals another question). Add a MutationObserver or re-scan hook.
- Radio buttons without `<label for>`: resolve text via parent container or sibling nodes.
- MinIO service cold boot: auto-retry with local cache fallback if MinIO is initializing.
- Headless LinkedIn anti-bot detection: extension copilot provides direct fallback in user's real browser session.

## Changelog
- **2026-10-05T21:15:00+05:30**: Initial feature specification created for LinkedIn Easy Apply AI Q&A auto-fill, autonomous pipeline worker orchestration, MinIO S3 SDK integration, and root `context.md`.
- **2026-10-05T21:40:00+05:30**: Verified full end-to-end implementation: Playwright worker container built and running with NATS JetStream connectivity, MinIO S3 native SigV4 upload/download verified, extension AI Q&A with biometric typing verified, and all 7 services healthy.
