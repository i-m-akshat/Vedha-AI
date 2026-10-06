# Bug Fix Plan: Autonomous Auto-Apply, Content Script Injection & Data Resilience

## 1. Overview & Classification
- **Classification**: Bug Fix
- **Target Subsystem**: 
  - `extension/content.js`: Modal container scoping, applied badge false-positive detection, screening question heuristic fallbacks, checkbox consent auto-selection, dropdown & radio comprehensive rule coverage, resilient Easy Apply modal launch.
  - `extension/popup.js`: Injection fallback for `chrome.tabs.sendMessage`, active tab resolution in popup/sidepanel/tab views, candidate profile persistence into `chrome.storage.local`, rich default profile fallback.
  - `docs/specs/extension-ai-agent-autofill-and-modern-ui.md` & `docs/plan/extension-ai-agent-autofill-and-modern-ui.md`: Synchronize specs with autonomous resilience improvements.

---

## 2. Root Cause Analysis

### 1. Global Page Text False-Positive ("You applied on")
- **Symptom**: Clicking Auto-Apply on LinkedIn immediately returned `{ success: true, message: "Already applied on LinkedIn for this position!" }` without opening or filling anything.
- **Root Cause**: `autoApplyLinkedInEasyApply` performed `document.body.innerText.includes("You applied on")`. On LinkedIn's job search page, if ANY job card in the search results list on the left had a small "You applied on [date]" tag, `document.body.innerText` matched, aborting the application loop instantly.
- **Fix**: Check applied state ONLY on the specific top-card apply button of the active job, and NEVER abort if the application modal is already open.

### 2. Candidate Data Starvation (`candidateProfile` never saved in `chrome.storage.local`)
- **Symptom**: When `content.js` or in-page dock read `chrome.storage.local.get(["candidateProfile"])`, it was `undefined`.
- **Root Cause**: `popup.js` fetched the profile into in-memory `cachedProfile` but never executed `chrome.storage.local.set({ candidateProfile })`.
- **Fix**: Persist `candidateProfile` to `chrome.storage.local` upon load and provide a full default candidate profile fallback when the backend on port 5000 is offline.

### 3. Missing Content Script Connection Fallback
- **Symptom**: When clicking Auto-Fill or Autonomous Apply from popup, error: *"Could not establish connection. Receiving end does not exist"* or *"Form elements not found or page reloaded"*.
- **Root Cause**: If the user loaded or updated the extension without refreshing pre-existing tabs, Chrome does not auto-inject content scripts.
- **Fix**: Implement `sendMessageToActiveTab` with programmatic `chrome.scripting.executeScript` injection fallback and automatic message retry.

### 4. Zero-Fill Screening Questions when Backend/Gemini Offline
- **Symptom**: Forms failed with required field validation errors because screening questions were skipped.
- **Root Cause**: If `geminiAnswers` was empty, questions like *"How many years of experience do you have with X?"*, required radio buttons, and required `<select>` dropdowns were left blank.
- **Fix**: Add deterministic rule-based fallbacks: years of experience default to candidate experience integer, notice period to candidate notice period, salary to candidate salary, required radio and select options to `"Yes"` or first valid option, and required consent checkboxes to checked.

### 5. Progression Button Scope Leakage
- **Symptom**: Clicking Next in autonomous mode sometimes targeted page-level search pagination buttons instead of the modal footer.
- **Root Cause**: `findFormProgressionButton` searched `document.body` without constraining search to the active modal dialog.
- **Fix**: Bound progression button discovery strictly to the active modal container and its footer actionbar.

---

## 3. Files Affected
- `extension/content.js`
- `extension/popup.js`
- `docs/bugfixes/autonomous-auto-apply-and-data-resilience.md`
- `docs/specs/extension-ai-agent-autofill-and-modern-ui.md`
- `docs/plan/extension-ai-agent-autofill-and-modern-ui.md`

---

## 4. Verification Steps
1. Verify `chrome.tabs.sendMessage` retries with programmatic injection when content script is not loaded.
2. Verify candidate profile is saved to `chrome.storage.local` and available in `content.js`.
3. Verify LinkedIn Easy Apply does not falsely report already applied when other jobs in search results were applied to.
4. Verify screening questions (experience, notice, salary, radios, dropdowns, checkboxes) are filled even when backend is offline.
5. Verify autonomous loop advances through Next steps in Easy Apply and portal forms.

---

## 5. Implementation Status
- [x] **Modal-First Discovery & Scoped Top-Card Check**: Replaced global `document.body.innerText.includes("You applied on")` check in `autoApplyLinkedInEasyApply` with scoped check inside active job's top card only when modal is not open.
- [x] **Top-Level Modal Hierarchy Scoping**: Added `getTopLevelModal(el)` so that all locator strategies in `findEasyApplyModal` return the top-level `.artdeco-modal` container encapsulating both form content and action bar buttons.
- [x] **Deterministic Screening Fallbacks**: Enhanced `fillModalInputs` to handle experience integer inputs, notice period, expected salary, GPA, degrees, cover letter textareas, consent checkboxes, affirmative radio options ("Yes"), and dropdown option 1 fallbacks.
- [x] **Zero-Data Starvation Defense**: In `popup.js`, persisted `candidateProfile` to `chrome.storage.local`. In `content.js`, merged `DEFAULT_CANDIDATE_PROFILE` in `fillModalInputs`, `autoFillForm`, `autoApplyLinkedInEasyApply`, `runAutonomousMultiStepFill`, and dock handlers.
- [x] **Dynamic Script Injection Fallback**: Implemented `sendMessageToActiveTab` in `popup.js` with programmatic `chrome.scripting.executeScript` injection when open job tabs had stale or missing content script connections.
- [x] **Scoped Progression Discovery**: Constrained `findFormProgressionButton` to modal container during modal fill cycles to prevent matching external page search pagination.

---

## ## Changelog
- **2026-10-06T14:43:00+05:30**: Created Bug Fix Plan for Autonomous Auto-Apply, Content Script Injection & Data Resilience.
- **2026-10-06T15:05:00+05:30**: Implemented all fixes across `extension/popup.js` and `extension/content.js`. Verified JavaScript syntax passes with zero errors via Node.js compiler.
