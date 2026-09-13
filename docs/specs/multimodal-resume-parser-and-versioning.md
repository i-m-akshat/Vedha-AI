# Feature Specification: Multimodal AI Resume Parser & Version History Governance

## Overview
Candidates frequently upload PDF resumes that originate from design tools (Canva, Figma), scanned documents, or complex multi-column layouts. Traditional ASCII/token text extractors (e.g. PdfPig) often fail on these files by returning empty text or jumbled tokens across columns. This feature sends the original uploaded document directly to the configured AI provider (via Google Gemini 2.0 Flash / OpenAI Vision / Claude) for every supported upload.

Additionally, this specification formalizes the **Version History & Revert** architecture for the Candidate Master Resume.

---

## Business Goal
- **100% Upload Success Rate**: Eliminate user onboarding friction caused by "PDF contains no selectable text" errors.
- **Flawless Multi-Column OCR**: Preserve visual reading order, complex tables, sidebars, and graphical headers.
- **Candidate Data Safety**: Allow candidates to iterate on their Master Resume and revert to any historical snapshot without data loss.

---

## User Stories
1. **As a candidate with a designer/scanned PDF resume**, I want the platform to automatically parse my experience, skills, and education even if my PDF lacks selectable text, so that I don't have to re-type my resume manually.
2. **As a candidate making edits over time**, I want to view my past resume versions with change descriptions and revert back to any previous version if I dislike recent changes.

---

## Functional Requirements
1. **AI Document Parsing Pipeline**:
   - Read the uploaded PDF, DOCX, Markdown, or TXT file into memory and send its original bytes to the configured AI document parser.
   - Do not use local text extraction or construct a partial backend-generated schema when AI parsing fails; return the AI error to the caller.
2. **Multimodal Gemini Integration**:
   - Stream base64 PDF bytes via Google Gemini's `inline_data` / `application/pdf` API.
   - Extract a strictly typed `ResumeSchema` JSON payload matching personal info, experience, education, skills, and certifications.
3. **Version History & Immutable Snapshots**:
   - Whenever the Master Resume is created, updated, or reverted, capture a timestamped `ResumeVersion` snapshot.
   - Maintain an append-only audit trail (`VersionNumber`, `ChangeDescription`, `StructuredJsonSnapshot`, `CreatedAtUtc`).
4. **Revert Workflow**:
   - Reverting to Version #N creates a new active version (e.g. Version #N+1) with the target version's JSON snapshot, preserving full non-destructive audit history.

---

## Architecture & Affected Layers
- **Domain Layer**: [`ResumeTailor.Domain.Entities.ResumeVersion`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Domain/Entities/DomainEntities.cs), [`ResumeTailor.Domain.ValueObjects.ResumeSchema`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Domain/ValueObjects/ResumeSchema.cs)
- **Application Layer**: [`IAiProvider`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Common/Interfaces/ApplicationInterfaces.cs) contract with `ParseDocumentBytesAsync<TResponse>`, [`UploadAndParseMasterResumeCommandHandler`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs)
- **Infrastructure Layer**: [`GeminiProvider`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs), [`OpenAiProvider`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs), [`ClaudeProvider`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs), [`ResilientAiProviderDecorator`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs)
- **Presentation Layer**: Swagger/OpenAPI endpoint reflection hardening in [`Program.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.WebApi/Program.cs).

---

## Non-Functional Requirements
- **Performance**: Sub-3-second multimodal visual parsing using Gemini 2.0 Flash.
- **Reliability**: Graceful fallback across AI providers; zero unhandled 500 exceptions on malformed files.
- **Security**: Resume streams are processed in-memory and never leaked to external unauthenticated storage.

---

## Changelog
- **2026-09-12 (v1.0)**: Initial specification for Multimodal AI PDF fallback parser and version governance audit trail.
- **2026-09-12 (v1.1)**: Deferred version snapshot creation exclusively to explicit user "Save Master Resume" actions (preventing intermediate upload pollution). Completed full Light/Dark mode design overhaul across UI primitives, layout, and Master Resume studio.
- **2026-09-12 (v1.2)**: Resolved Swashbuckle SwaggerGeneratorException by encapsulating `IFormFile` in `UploadMasterResumeFormRequest` DTO and hardening `nginx.conf` reverse proxy timeouts and body limits.
- **2026-09-12 (v1.3)**: Changed uploads to direct original-byte AI parsing for all supported formats and removed the local text-parser/schema fallback path.
