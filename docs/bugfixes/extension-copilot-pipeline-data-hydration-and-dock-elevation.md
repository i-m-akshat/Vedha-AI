# Bug Fix Plan: Extension Copilot Pipeline Data Hydration & Dock Elevation

**Status:** IN PROGRESS | **Date:** 2026-10-26  
**Classification:** Bug Fix  
**Companions:** `docs/specs/extension-dispatch.md` • `docs/plan/extension-dispatch.md` • `docs/adr/ADR-007-extension-dispatch-pull-model.html` • `docs/adr/ADR-009-dock-yields-to-dialogs.html`

---

## 1. Problem Statement & Root Cause Analysis

### Issue A: Pipeline Prefilled Answers Never Injected by Extension
* **Symptom:** Dispatched runs from the Copilot Pipeline contain pre-generated, grounded screening question answers (`PrefilledAnswers`), but the extension content script fails to match or fill them in job portal forms, falling back to either generic heuristics or redundant on-the-fly network calls.
* **Root Cause:**
  * In `extension/dispatch.js` line 190, the claimed package passes `prefilledAnswers: pkg.prefilledAnswers ?? pkg.PrefilledAnswers ?? []`.
  * In `extension/content.js` line 1573, `resolveScreeningAnswer()` invokes `matchApprovedAnswer(qText, safe.answers || safe.approvedAnswers || bag.approvedAnswers)`.
  * `safe.prefilledAnswers` is never inspected. Furthermore, property name casing variations (`QuestionText`, `AnswerText` vs `questionText`, `answerText`) are not handled defensively.

### Issue B: Tailored Cover Letter Never Populated in Form Fields
* **Symptom:** Even when the Copilot Pipeline generates a tailored cover letter (`CoverLetterText`) and `dispatch.js` forwards `coverLetter`, form textareas designated for cover letters remain blank.
* **Root Cause:**
  * `extension/content.js` `screeningIntent()` does not recognize cover letter fields (`cover letter`, `letter of intent`, `note to the hiring manager`, etc.).
  * `resolveScreeningAnswer()` does not have an intent handler for cover letters that maps `safe.coverLetter || safe.coverLetterText`.
  * In `extension/popup.js`, the primary autofill trigger does not pull or pass the active cover letter from Tab 3 or staged packages.

### Issue C: Unpinned Dock Elevation Does Not Yield to Dialogs (ADR-009 Violation)
* **Symptom:** 6 E2E tests fail in `tests/e2e/runner.js` with `Expected "2147482000", got "2147483647"`.
* **Root Cause:**
  * In `extension/content.js` line 4627, `placeDockRoot(dockRoot, DOCK_Z_FOREGROUND)` is invoked unconditionally during modal open events, ignoring `isUserPinned`.
  * ADR-009 explicitly mandates that an unpinned dock must drop to `DOCK_Z_BELOW_DIALOGS` (`2147482000`) so native application dialogs remain topmost.

---

## 2. Proposed Fix

### 1. `extension/dispatch.js`
* Map both `answers` and `prefilledAnswers` in the run payload:
  ```javascript
  const answersList = pkg.prefilledAnswers ?? pkg.PrefilledAnswers ?? [];
  const payload = {
    ...
    answers: answersList,
    prefilledAnswers: answersList,
    approvedAnswers: answersList,
    coverLetter: norm(pkg.coverLetterText ?? pkg.CoverLetterText),
    coverLetterText: norm(pkg.coverLetterText ?? pkg.CoverLetterText),
    ...
  };
  ```

### 2. `extension/content.js`
* **Answer Matching & Hydration:**
  * In `matchApprovedAnswer(question, answers)`:
    * Defensively read `entry.questionText || entry.question || entry.QuestionText || ""` and `entry.answerText || entry.answer || entry.AnswerText || ""`.
    * Match on exact normalized question OR normalized intent inclusion.
  * In `resolveScreeningAnswer(question, payload)`:
    * Include `safe.prefilledAnswers`:
      `const approved = matchApprovedAnswer(qText, safe.answers || safe.approvedAnswers || safe.prefilledAnswers || bag.approvedAnswers);`
* **Cover Letter Intent & Autofill:**
  * In `screeningIntent()`:
    * Add regex rule: `/\b(cover\s*letter|letter of intent|additional info|note to (the )?hiring manager|message to (the )?recruiter)\b/i.test(n) => "coverLetter"`.
  * In `resolveScreeningAnswer()`:
    * Add handler:
      ```javascript
      if (intent === "coverLetter") {
        const cl = safe.coverLetter || safe.coverLetterText || "";
        return hasGroundedValue(cl) ? groundedAnswer(String(cl).trim(), 0.98, "pipeline-coverletter") : null;
      }
      ```
* **ADR-009 Dock Elevation Compliance:**
  * In `manageModalStacking()` at line 4627:
    ```javascript
    const isUserPinned = readDockPinned();
    placeDockRoot(dockRoot, isUserPinned ? DOCK_Z_FOREGROUND : DOCK_Z_BELOW_DIALOGS);
    ```

### 3. `extension/popup.js`
* Ensure the active cover letter from Tab 3 (`coverLetterText.value`) and any cached package answers are passed into `AUTONOMOUS_MULTI_STEP_FILL` payload when the user clicks "Auto-Fill Application".

---

## 3. Files Affected
* [`extension/dispatch.js`](file:///A:/AIProjects/Resumebuilder/extension/dispatch.js)
* [`extension/content.js`](file:///A:/AIProjects/Resumebuilder/extension/content.js)
* [`extension/popup.js`](file:///A:/AIProjects/Resumebuilder/extension/popup.js)
* [`tests/e2e/runner.js`](file:///A:/AIProjects/Resumebuilder/tests/e2e/runner.js)

---

## 4. Regression Risks & Test Strategy
* **Regression Risks:** Low. Changes are purely additive field fallbacks and alignment with existing specifications (ADR-007, ADR-009).
* **Test Strategy:**
  1. Run complete E2E test suite (`node tests/e2e/runner.js`) to confirm all 154 tests pass (100% pass rate).
  2. Verify .NET unit tests (`dotnet test backend/ResumeTailor.sln`) remain 100% green (208/208).
  3. Validate that prefilled answers and cover letter are correctly hydrated into form inputs during autofill simulation.

---

## 5. Verification Steps
1. Execute unit and E2E test runners.
2. Confirm 0 regressions and 0 test failures.
3. Update architecture documents and changelogs.
