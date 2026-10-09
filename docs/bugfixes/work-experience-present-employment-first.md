# Bug Fix Plan: Work Experience Chronological Ordering (Present Employment Always First)

**Document ID**: BFP-RESUME-002  
**Author**: Principal Software Engineer  
**Date**: 2026-10-09  
**Status**: Ready for Implementation  
**Classification**: Bug Fix  

---

## 1. Executive Summary & Root Cause Analysis

A user reported that when generating/tailoring a resume, their current/present employment is displaced from the top of the Work Experience list:
> *"while tailoring resume my present employement should alwasy come first in generated resume currently that is not happening for example i have left one compoany in jan2026 from jan 2026 m working in a new company to present then jan2024-jan2026 company is coming first which is not good my present company must come first in work experience"*

### Root Cause 1: Explicit AI Prompt Instruction Overriding Chronology
- **File**: [`backend/src/ResumeTailor.Application/Features/Tailoring/TailorCommands.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Features/Tailoring/TailorCommands.cs#L235)
- **Problematic Code**:
  ```text
  [EXPERIENCE - BULLET SELECTION & METRIC RETENTION - CRITICAL]:
  ...
  - Reorder experience entries so the most JD-relevant role appears FIRST in the list (even if not chronological).
  ```
- **Mechanism**: The system prompt explicitly instructed the LLM to prioritize job description keyword relevance over chronological order. When an older role (e.g. Jan 2024 – Jan 2026) had higher semantic overlap with the target job description than the candidate's new current role (e.g. Jan 2026 – Present), the AI placed the older role first.

### Root Cause 2: Absence of Deterministic Post-Generation Sorting in Handler
- **File**: [`backend/src/ResumeTailor.Application/Features/Tailoring/TailorCommands.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Features/Tailoring/TailorCommands.cs#L316-L358)
- **Mechanism**: When `tailoredSchema` was returned by the LLM (or reverted to `masterSchema` upon truth check failure), the handler directly saved `tailoredSchema.Experience` to the database without any deterministic C# sorting. Even if the LLM followed general guidelines, non-deterministic ordering or re-ranking could place past roles above the current role.

### Root Cause 3: Flawed Reverse-Chronological Sorter in `RagResumeGenerator.cs`
- **File**: [`backend/src/ResumeTailor.Infrastructure/Rag/RagResumeGenerator.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Rag/RagResumeGenerator.cs#L289-L292)
- **Problematic Code**:
  ```csharp
  experienceItems = experienceItems
      .OrderByDescending(x => int.TryParse(x.StartDate, out var s) ? s : 0)
      .ThenByDescending(x => x.IsCurrent)
      .ToList();
  ```
- **Mechanism**:
  1. `OrderByDescending` was sorting by `StartDate` before `IsCurrent`. An older role starting in 2024 would sort ahead of a current role starting in 2022.
  2. `int.TryParse` fails for standard resume date formats like `"Jan 2026"` or `"01/2026"`, returning `0`. An older role with date `"2024"` would produce `2024` and sort above `"Jan 2026"`.

### Root Cause 4: UI Display Relies Solely on Unsorted Array Index
- **Files**: [`frontend/src/pages/ResultStudioPage.tsx`](file:///A:/AIProjects/Resumebuilder/frontend/src/pages/ResultStudioPage.tsx#L408), [`frontend/src/pages/TailorStudioPage.tsx`](file:///A:/AIProjects/Resumebuilder/frontend/src/pages/TailorStudioPage.tsx#L383)
- **Mechanism**: The UI rendered `tailoredSchema.experience` in the exact raw order returned from the backend. Furthermore, `TailorStudioPage.tsx` compared `masterSchema.experience[expIdx]` against `tailoredSchema.experience[expIdx]`. If order drifted, the diff comparison compared bullets from entirely different companies.

---

## 2. Proposed Architecture & Fix Strategy

### 1. Domain-Level Chronological Experience Sorter
Introduce a dedicated, robust `ExperienceChronologyHelper` in `ResumeTailor.Domain.ValueObjects.ResumeSchema`:
- **Current Role Detection**:
  ```csharp
  public static bool IsPresentRole(WorkExperienceItem item) =>
      item.IsCurrent ||
      (!string.IsNullOrWhiteSpace(item.EndDate) && (
          item.EndDate.Contains("present", StringComparison.OrdinalIgnoreCase) ||
          item.EndDate.Contains("current", StringComparison.OrdinalIgnoreCase) ||
          item.EndDate.Contains("now", StringComparison.OrdinalIgnoreCase) ||
          item.EndDate.Contains("ongoing", StringComparison.OrdinalIgnoreCase)));
  ```
- **Multi-Format Date Parser**:
  Parses strings like `"Jan 2026"`, `"January 2026"`, `"01/2026"`, `"2026-01"`, `"2026"`, `"Present"`.
  Extracts 4-digit years (`1950-2099`) and 3-letter month abbreviations as robust fallback.
- **Sorting Hierarchy**:
  1. Primary: Current / Present roles (`IsPresentRole == true`) ALWAYS sort before past roles (`IsPresentRole == false`).
  2. Secondary (within current roles): Sort by `StartDate` descending (most recent current role first).
  3. Tertiary (within past roles): Sort by `EndDate` descending (most recent past role first), tie-broken by `StartDate` descending.
- **Normalization**:
  When `IsPresentRole(exp)` is true, ensure `exp.IsCurrent = true`, and if `exp.EndDate` is empty/null, populate `exp.EndDate = "Present"`.
- **Extension Method**:
  `public void NormalizeAndSortExperience()` directly on `ResumeSchema`.

### 2. Tailor Prompt Strict Mandate
In `backend/src/ResumeTailor.Application/Features/Tailoring/TailorCommands.cs`:
Replace line 235 with strict prompt rules:
```text
[EXPERIENCE - CHRONOLOGY & BULLET SELECTION - CRITICAL]:
- CRITICAL CHRONOLOGICAL ORDERING RULE: The candidate's CURRENT / PRESENT employment (where isCurrent == true or endDate is 'Present' / 'Current') MUST ALWAYS APPEAR FIRST in the experience list.
- All subsequent past employment entries MUST strictly follow reverse-chronological order (most recent past role first, descending by end/start date).
- NEVER place an older past role above the candidate's current or more recent role, regardless of job description relevance.
```

### 3. Application Handler Guarantee
In `TailorCommands.cs`:
- Explicitly call `tailoredSchema.NormalizeAndSortExperience()` and `masterSchema.NormalizeAndSortExperience()` immediately after AI generation and before calculating ATS scores or saving to the database.

### 4. RAG Generator Alignment
In `RagResumeGenerator.cs`:
- Replace flawed `int.TryParse` sorting with `experienceItems = ExperienceChronologyHelper.SortChronologically(experienceItems);`.

### 5. Master Resume Upload & Update Normalization
In `MasterResumeCommands.cs`:
- Call `schema.NormalizeAndSortExperience()` upon resume upload and update so master resumes are also guaranteed to be correctly ordered.

### 6. Frontend Defensive Ordering & Synchronized State
- In `ResultStudioPage.tsx` and `TailorStudioPage.tsx`: Ensure experiences sort current roles first defensively before rendering.
- In `MasterResumePage.tsx`: Auto-set `isCurrent: true` when `endDate` contains `"present"` or `"current"`.

---

## 3. Files Affected

1. [`backend/src/ResumeTailor.Domain/ValueObjects/ResumeSchema.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Domain/ValueObjects/ResumeSchema.cs)
2. [`backend/src/ResumeTailor.Application/Features/Tailoring/TailorCommands.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Features/Tailoring/TailorCommands.cs)
3. [`backend/src/ResumeTailor.Infrastructure/Rag/RagResumeGenerator.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Rag/RagResumeGenerator.cs)
4. [`backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs`](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs)
5. [`backend/tests/ResumeTailor.UnitTests/ExperienceChronologyTests.cs`](file:///A:/AIProjects/Resumebuilder/backend/tests/ResumeTailor.UnitTests/ExperienceChronologyTests.cs) (New unit tests)
6. [`frontend/src/pages/ResultStudioPage.tsx`](file:///A:/AIProjects/Resumebuilder/frontend/src/pages/ResultStudioPage.tsx)
7. [`frontend/src/pages/TailorStudioPage.tsx`](file:///A:/AIProjects/Resumebuilder/frontend/src/pages/TailorStudioPage.tsx)
8. [`frontend/src/pages/MasterResumePage.tsx`](file:///A:/AIProjects/Resumebuilder/frontend/src/pages/MasterResumePage.tsx)

---

## 4. Regression Risks & Mitigation

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Older resumes with missing `isCurrent` flag | Low | Check `EndDate` string for "Present", "Current", "Now", "Ongoing". Auto-set `isCurrent = true`. |
| Unorthodox date formats (e.g., "Winter 2025", "Q2 2024") | Low | Regex fallback extracts 4-digit year and month token, defaulting safely without crashing. |
| ATS Score keyword relevance degradation | None | ATS scoring computes overall keyword match across the entire text; reordering experience does not remove any keywords. |
| Visual diff misalignment in Studio | None | Improved company-matching in `TailorStudioPage.tsx` ensures bullets are compared against the same company regardless of array order. |

---

## 5. Verification Strategy

1. **Unit Tests**:
   - Test current role (`Jan 2026 - Present`) placed first above past role (`Jan 2024 - Jan 2026`).
   - Test role with `isCurrent = true` but empty `endDate` placed first.
   - Test role with `endDate = "Present"` but `isCurrent = false` normalized to true and placed first.
   - Test multiple current roles ordered by most recent start date.
   - Test multiple past roles ordered reverse-chronologically by end date.
   - Test varied date string formats ("Jan 2026", "2024", "01/2026", "2026-01-15").
2. **Build Verification**:
   - `dotnet build backend/ResumeTailor.sln` passes with 0 warnings, 0 errors.
   - `dotnet test backend/ResumeTailor.sln` passes 100%.
3. **Container Deployment**:
   - Build backend container image and restart `vedha-backend`.
