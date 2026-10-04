# Bug Fix Plan: AI Resume Tailoring JSON Truncation & Token Exhaustion

## 1. Overview & Classification
- **Classification**: Bug Fix
- **Target Subsystems**: 
  - `backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs` (`GeminiProvider`, `ClaudeProvider`, `OpenAiProvider`)
  - `backend/src/ResumeTailor.Application/Features/Auth/AuthCommands.cs`
  - `infra/.env` & `infra/.env.example`

---

## 2. Root Cause Analysis

### 1. Hardcoded Token Limit of 4096 (`maxOutputTokens = 4096`)
- **Symptom**: During resume tailoring with a detailed Job Description, the API returned:
  `AI resume tailoring failed: Failed to parse AI output into required schema: Expected end of string, but instead reached end of data. Path: $.skills[4].skills[3] | LineNumber: 0 | BytePositionInLine: 5802.`
- **Root Cause**: In `AiProviders.cs`, `GeminiProvider.GenerateTextAsync` hardcoded `maxOutputTokens = 4096`. 
- **Compounding Factor (Thinking Tokens)**: In Google's reasoning/thinking models (such as `gemini-2.5-flash` and `gemini-3.8-flash`), the model generates internal chain-of-thought tokens (`thoughtsTokenCount`) before generating the output response. These thinking tokens consume a significant portion (1,500–2,500 tokens) of the 4,096 budget. As a consequence, only ~1,500–2,000 tokens remained for the candidate JSON output. At byte 5802 (inside the skills array), the model hit `finishReason: MAX_TOKENS` and abruptly truncated the JSON mid-string.

### 2. Missing `responseMimeType: "application/json"` in `GenerateStructuredJsonAsync`
- In `GeminiProvider`, `GenerateStructuredJsonAsync` simply delegated to `GenerateTextAsync` with a prompt string: `"Return ONLY raw JSON without markdown code fences"`.
- It did not instruct the Gemini engine to use native Structured JSON generation (`responseMimeType: "application/json"`).

### 3. Lack of `finishReason` Inspection & Transient Retries
- When `finishReason == "MAX_TOKENS"`, `GenerateTextAsync` returned success with the truncated partial string, leading to an opaque `JsonException` during deserialization.
- Transient Google API errors (HTTP 503 Service Unavailable or 429 Too Many Requests) failed immediately without automatic retry with backoff.

### 4. Legacy Default Model String in `AuthCommands.cs`
- `AuthCommands.cs` initialized new users with `PreferredModel = "gemini-3.8-flash"`, which was mapped to experimental preview endpoints prone to transient 503s.

---

## 3. Proposed Fix

1. **`GeminiProvider` Enhancements in `AiProviders.cs`**:
   - Implement dedicated `GenerateStructuredJsonAsync` with:
     - `responseMimeType: "application/json"`
     - `maxOutputTokens: 16384` (or configured `AI_MAX_TOKENS`)
     - `thinkingConfig: { thinkingBudget: 0 }` for fast, zero-thinking-overhead structured JSON generation
   - Check `finishReason`: if `"MAX_TOKENS"`, return an explicit, descriptive error rather than letting `JsonSerializer` throw an opaque string termination exception.
   - Add retry loop for transient HTTP 503 / 429 errors (up to 2 retries with exponential backoff).
   - In `ResolveModelName`, map legacy and preview model aliases cleanly to `gemini-2.5-flash`.

2. **Claude & OpenAI Provider Token Adjustments**:
   - In `ClaudeProvider`, increase `max_tokens` from 4096 to 8192.
   - In `OpenAiProvider`, ensure `max_completion_tokens = 16384` or `max_tokens = 8192` with `response_format = new { type = "json_object" }`.

3. **User Default Model Alignment**:
   - Update `AuthCommands.cs` to default `PreferredModel` to `"gemini-2.5-flash"`.
   - Update `infra/.env` and `infra/.env.example` to `AI_MAX_TOKENS=16384`.

---

## 4. Files Affected
- `backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs`
- `backend/src/ResumeTailor.Application/Features/Auth/AuthCommands.cs`
- `infra/.env`
- `infra/.env.example`

---

## 5. Verification Steps
1. Build backend solution cleanly (`dotnet build ResumeTailor.sln`).
2. Run test suite (`dotnet test ResumeTailor.sln`).
3. Rebuild backend container image and restart `vedha-backend`.
4. Verify resume tailoring with a full resume and job description generates valid JSON and passes ATS scoring.

---

## Changelog
- **2026-10-04T18:11:00+05:30**: Initial Bug Fix Plan created for AI resume tailoring JSON truncation and token limit exhaustion.
- **2026-10-04T18:23:00+05:30**: Completed implementation in `AiProviders.cs`, `AuthCommands.cs`, `infra/.env`, and `build_and_start.ps1`. Compiled cleanly (0 errors), passed 28/28 unit tests, rebuilt container image `localhost/infra-backend:latest`, restarted `vedha-backend`, and verified live end-to-end resume tailoring against the user's master resume resulting in a comprehensive tailored resume with an ATS score of 80/100 and zero JSON truncation.
