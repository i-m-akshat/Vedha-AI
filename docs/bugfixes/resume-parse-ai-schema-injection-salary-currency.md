# Bug Fix: Resume Parse Failure — AI Schema Injection + Salary Currency + Auto-Fill

## Task Classification
**Bug Fix + Enhancement**

## 1. Root Cause Analysis

### Bug 1 (Critical): Fallback Schema Dumps Raw Text into Experience Highlights
**File**: `backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs` L150–L157

When AI structured parsing fails (Gemini returns malformed JSON or misinterprets the prompt), the fallback path constructs a bogus `ResumeSchema` that:
- Sets `Summary = "Uploaded resume content"` (generic placeholder)
- Creates one fake `WorkExperienceItem` with `Highlights = rawText.Split('\n').Take(5).ToList()`

This places raw text lines (name, email, phone, LinkedIn URL) into bullet points under a fake "Extracted Position" work experience entry.

**Root cause of AI failure**: The system prompt does NOT give Gemini the **exact JSON output schema structure** with field names, types, and examples. Gemini then guesses the structure and produces something that fails deserialization.

### Bug 2 (Critical): System Prompt Has No JSON Schema Definition
**File**: Same as above, L104–L112

The system prompt says "output a ResumeSchema" but never defines what `ResumeSchema` looks like. Without seeing the exact expected JSON structure, Gemini 2.0 Flash produces variably-structured output that may deserialize into the wrong fields.

### Bug 3 (Enhancement): Salary is string-only, no currency concept
**File**: `backend/src/ResumeTailor.Domain/Entities/CandidateProfile.cs` + frontend `CandidateProfilePage.tsx`

`currentSalary` and `expectedSalary` are free-text strings. There's no structured currency field.
- Indian users fill ₹ amounts in LPA
- When applying to foreign companies, the orchestrator needs to present salary in USD
- Auto-conversion is needed

### Bug 4 (Enhancement): Upload does not auto-fill CandidateProfile
After upload, personal info (name, email, phone, LinkedIn, GitHub) extracted by AI from the resume should pre-fill empty `CandidateProfile` fields to save the user from re-entering data manually.

---

## 2. Proposed Fixes

### Fix 1+2: Provide Explicit JSON Schema in System Prompt
Inject the **complete JSON output structure** with field names and an inline schema example directly in the system prompt. This removes ambiguity and eliminates the fallback path in the happy path.

### Fix 3: Salary Currency Field
- Add `SalaryCurrency` (`string`, default `"INR"`) to `CandidateProfile` entity
- Add `SalaryDisplayCurrency` concept: when orchestrator detects a foreign company, convert INR LPA → USD annually
- Frontend: dropdown `INR | USD | GBP | EUR` next to salary fields

### Fix 4: Auto-Fill CandidateProfile Post-Upload
After successful AI parse:
- Check if `CandidateProfile.PhoneNumber` is empty → fill from `personalInfo.phone`
- Check if `CandidateProfile.LinkedInUrl` is empty → fill from `personalInfo.linkedInUrl`
- Check if `CandidateProfile.GithubUrl` is empty → fill from `personalInfo.gitHubUrl`
- Only fill blank fields — never overwrite existing values

---

## 3. Files Affected

### Backend
- `backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs` — Fix system prompt, fix fallback schema, add auto-fill logic
- `backend/src/ResumeTailor.Domain/Entities/CandidateProfile.cs` — Add `SalaryCurrency` field
- `backend/src/ResumeTailor.Infrastructure/Persistence/ApplicationDbContext.cs` — Verify property is mapped (EF Core picks it up automatically)

### Frontend
- `frontend/src/types/orchestrator.ts` — Add `salaryCurrency` to `CandidateProfileDto`
- `frontend/src/pages/CandidateProfilePage.tsx` — Currency dropdown, conversion tooltip
- `frontend/src/stores/useTailorStore.ts` (or a new store) — No changes needed

---

## 4. Risks
- **Regression**: Prompt change could affect parsing quality — mitigated by highly specific schema injection
- **Currency conversion**: INR LPA → USD requires a fixed exchange rate constant (not live API) — good enough for autofill purposes
- **Auto-fill**: Only fills empty fields, so no risk of overwriting user-entered data

---

## Changelog
- **2026-09-12**: Root cause identified. Fallback schema bug (L150–L157) + missing JSON schema in AI prompt. Salary currency feature + auto-fill from parsed resume planned.
- **2026-09-12 (Implementation & Verification)**:
  1. Updated `MasterResumeCommands.cs` with complete, strict JSON schema definition in the AI system prompt to ensure reliable parsing by Gemini 2.0 Flash / OpenAI / Claude.
  2. Replaced flawed fallback logic (which previously dumped raw text lines into work experience highlights) with `BuildBasicSchemaFromRawText` to safely parse personal details via regex while keeping experience empty for user review.
  3. Added auto-fill of `CandidateProfile` (phone, LinkedIn, GitHub, portfolio, city, country) from parsed resume data when a master resume is uploaded.
  4. Added `SalaryCurrency` (default `INR`) to `CandidateProfile` domain entity, DTOs, and controller requests.
  5. Implemented currency conversion logic in `OrchestratorCommands.cs` converting INR LPA to annual USD whenever foreign/US companies or compensation in USD are detected.
  6. Added currency selector (`₹ INR`, `$ USD`, `£ GBP`, `€ EUR`) with conversion guidance tooltip to `CandidateProfilePage.tsx`.
  7. Added upload feedback banner to `MasterResumePage.tsx`.
  8. Verified frontend compilation with `npx tsc --noEmit` (0 errors). Verified backend build with `dotnet build ResumeTailor.sln` (0 errors, 0 warnings).

