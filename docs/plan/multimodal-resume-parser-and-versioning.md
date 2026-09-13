# Implementation Plan: Multimodal AI Resume Parser & Swagger Resolution

## Objective
Implement AI document ingestion for uploaded resumes in the AI provider pipeline, use original upload bytes for every supported format in the Master Resume handler, verify version history rollback mechanisms, and ensure Swagger/OpenAPI endpoints build cleanly.

---

## Step-by-Step Execution Plan

### 1. Interface Extension
- Modify [`backend/src/ResumeTailor.Application/Common/Interfaces/ApplicationInterfaces.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Common/Interfaces/ApplicationInterfaces.cs):
  - Add `ParseDocumentBytesAsync<TResponse>(byte[] fileBytes, string mimeType, string systemPrompt, string userPrompt, string? customApiKey = null, string? modelName = null, CancellationToken cancellationToken = default)` to `IAiProvider`.

### 2. Infrastructure AI Provider Implementations
- Modify [`backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs):
  - **GeminiProvider**: Add `inline_data` support passing base64 document bytes to Gemini 2.0 Flash REST API.
  - **OpenAiProvider**: Implement structured multimodal / base64 document ingestion.
  - **ClaudeProvider**: Implement PDF document source payload.
  - **ResilientAiProviderDecorator**: Wrap `ParseDocumentBytesAsync` with circuit-breaker and fallback to next healthy provider.

### 3. Application Command Handler Refactor
- Modify [`backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs):
  - In `UploadAndParseMasterResumeCommandHandler`:
    - Read input stream into memory bytes.
    - Call `aiProvider.ParseDocumentBytesAsync<ResumeSchema>(...)` for every supported upload.
    - Return the AI parsing failure instead of falling back to local text extraction or a partial backend-generated schema.

### 4. Swagger / OpenAPI Endpoint Hardening
- Verify [`backend/src/ResumeTailor.WebApi/Program.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.WebApi/Program.cs):
  - Minimal API health endpoints excluded from schema generation (`.ExcludeFromDescription()`).
  - Swashbuckle schema ID collision handling configured.

### 5. Verification & Testing
- Build the .NET solution.
- Verify that both text-based PDFs and visual/scanned PDFs parse into valid `ResumeSchema`.

---

## Changelog
- **2026-09-12 (v1.0)**: Initial implementation plan for Multimodal AI Resume parsing and Swagger fix.
- **2026-09-12 (v1.1)**: Implemented explicit save versioning trigger in Master Resume command handler and comprehensive light/dark theme synchronization across UI layout and design components.
- **2026-09-12 (v1.2)**: Resolved Swashbuckle SwaggerGeneratorException via `UploadMasterResumeFormRequest` DTO and hardened `nginx.conf` reverse proxy configuration.
- **2026-09-12 (v1.3)**: Updated the plan to make original-byte AI parsing the only upload parsing path and remove backend text-parser fallback behavior.
