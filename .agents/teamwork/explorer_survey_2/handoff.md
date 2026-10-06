# Teamwork Explorer 2 Handoff Report: Requirement R2 Survey (Form Validation Self-Healing & Input Constraint Enforcement)

- **Task Classification**: Research / Investigation
- **Target Subsystem**: Vedha AI Chrome Extension (`extension/content.js`, `extension/popup.js`, backend orchestrator Q&A contracts)
- **Author**: Explorer 2 (Survey & Architecture Specialist)
- **Date**: 2026-10-06T10:25:00Z
- **Reference**: `A:\AIProjects\Resumebuilder\.agents\teamwork\ORIGINAL_REQUEST.md` (Requirement R2)

---

## 1. Observation

Direct code observations from `A:\AIProjects\Resumebuilder\extension\content.js`, `A:\AIProjects\Resumebuilder\extension\popup.js`, and `A:\AIProjects\Resumebuilder\backend\src\ResumeTailor.Application\Features\Orchestrator\OrchestratorCommands.cs`.

### 1.1 Existing Architecture & File Distribution for Requirement R2

The entirety of form field discovery, auto-fill, constraint enforcement, DOM event synthesis, error detection, and self-healing currently resides in a single monolithic script:
- `extension/content.js` (3,165 lines, 131,163 bytes):
  - **DOM Event & Biometric Typing**: `setNativeValue` (lines 219–231), `typeLikeHuman` (lines 234–261), `simulatePointerInteraction` (lines 183–217).
  - **Label & Question Extraction**: `getFieldQuestionText` (lines 801–826), `getRadioLabelText` (lines 828–845).
  - **Form Population**: `fillModalInputs` (lines 942–1467).
  - **Validation Error Detection**: `findActiveValidationErrors` (lines 1470–1630).
  - **AI Grounded Error Remediation**: `queryGeminiForValidationError` (lines 1633–1707).
  - **Two-Tier Self-Healing Engine**: `remediateValidationErrors` (lines 1709–1925).
  - **Execution Engines**: `autoFillForm` (lines 1928–2037), `autoApplyLinkedInEasyApply` (lines 2040–2229), `runAutonomousMultiStepFill` (lines 2327–2576).
- `extension/popup.js` (823 lines):
  - Gathers candidate profile, sets up message dispatch (`sendMessageToActiveTab`), displays step telemetry (`updateStepper`, `showAgentTelemetry`), and presents healed count feedback in toast notices (`showStatus`).
- `backend/src/ResumeTailor.Application/Features/Orchestrator/OrchestratorCommands.cs`:
  - `GenerateScreeningAnswersCommand` (lines 153–322) and `MatchCandidateProfileDirectly` (lines 743–882).

---

### 1.2 Constraint Violation & Rejection Detection (`findActiveValidationErrors`)

In `extension/content.js`, lines 1470–1630:
```javascript
1476:    // Strategy A: Check inputs with HTML5 native constraint validation failures or aria-invalid
1477:    const candidates = Array.from(
1478:      container.querySelectorAll("input:not([type='hidden']), textarea, select")
1479:    );
1480:    for (const el of candidates) {
1481:      if (!isFieldActionable(el)) continue;
1482:      let hasError = false;
1483:      let errorMsg = "";
1488:      if (el.validity && !el.validity.valid) {
1489:        hasError = true;
1490:        errorMsg = el.validationMessage || "Invalid field format";
1491:      }
1494:      if (!hasError && (el.getAttribute("aria-invalid") === "true" || el.classList.contains("is-invalid") || el.classList.contains("error"))) {
1495:        hasError = true;
1496:      }
```
And in Strategy B (portal error badge scanning, lines 1539–1614):
```javascript
1539:    const errorBadgeSelectors = [
1540:      ".artdeco-inline-feedback--error",
1541:      "[data-test-form-builder-error]",
1542:      "[data-automation-id='errorWidget']",
1543:      "[data-automation-id='errorMessage']",
1544:      ".fb-dash-form-element__error-field",
1545:      ".fb-dash-form-element__error-text",
1546:      ".jobs-easy-apply-form-section__error",
1547:      ".field-error",
1548:      ".error-message",
1549:      ".input-error",
1550:      ".invalid-feedback",
1551:      ".form-error",
1552:      "[role='alert']",
1553:      ".has-error .help-block",
1554:      ".WLOE"
1555:    ];
1564:        // Skip non-validation alert roles (e.g. general cookie notifications)
1565:        if (
1566:          badge.getAttribute("role") === "alert" &&
1567:          !msg.toLowerCase().includes("error") &&
1568:          !msg.toLowerCase().includes("required") &&
1569:          !msg.toLowerCase().includes("valid") &&
1570:          !msg.toLowerCase().includes("enter") &&
1571:          !msg.toLowerCase().includes("select")
1572:        ) {
1573:          continue;
1574:        }
1588:          const group = badge.closest(".fb-dash-form-element, .jobs-easy-apply-form-section, .form-group, fieldset, [data-test-form-builder-group], div");
1589:          if (group) {
1590:            matchedControl = group.querySelector("input:not([type='hidden']), textarea, select");
1591:            if (!matchedControl) {
1592:              const fs = group.querySelector("fieldset");
1593:              if (fs) matchedControl = fs;
1594:            }
1595:          }
```
**Direct Observations on Error Detection**:
1. **Misalignment via `closest("div")` (Line 1588)**: Because every element on a modern page is inside a `<div>`, if `badge` is inside a dedicated error wrapper (e.g. `<div class="error-wrapper"><span class="field-error">...</span></div>`), `group.querySelector("input")` is `null`. Sibling search (line 1600) inspects siblings of `badge` within that same wrapper, failing to find the input. Conversely, if `badge` is inside a row container containing multiple fields (`<div class="form-row">`), `group.querySelector("input")` returns the *first* input in the row, erroneously assigning an error on the 3rd field (e.g. Phone) to the 1st field (e.g. First Name).
2. **False Dismissal of `role="alert"` (Lines 1565–1574)**: Error notices such as `"Must be a whole number"`, `"10 digits only"`, `"Characters remaining: 0"`, or `"Choose between 1 and 50"` do NOT contain "error", "required", "valid", "enter", or "select". As a result, line 1573 executes `continue`, discarding active portal validation errors.
3. **HTML5 `<input type="number">` Value Sanitization Blindness (Line 1531)**:
   In HTML5, when an invalid string (e.g. `"5 years"`) is typed into `<input type="number">`, the browser clears `el.value` to `""` (`el.validity.badInput === true`). Line 1531 captures `currentValue: (el.value || "").trim()`, which records `""`. The raw text typed is lost.
4. **Radio Inputs vs Fieldsets Misattribution (Lines 1590–1594)**:
   When an error badge appears under a radio group, line 1590 queries `group.querySelector("input")`, returning the first radio button (`HTMLInputElement`), not the `<fieldset>`.

---

### 1.3 Value Sanitization & Healing Logic (`remediateValidationErrors`)

In `extension/content.js`, lines 1709–1925:

#### Numeric / Integer Sanitization (Lines 1738–1775):
```javascript
1738:        if (
1739:          errLower.includes("whole number") ||
1740:          errLower.includes("numeric") ||
1741:          errLower.includes("integer") ||
1742:          errLower.includes("number only") ||
1743:          errLower.includes("numbers only") ||
1744:          errLower.includes("digits only") ||
1745:          errLower.includes("invalid number") ||
1746:          (el.validity && el.validity.badInput) ||
1747:          el.type === "number"
1748:        ) {
1750:          const digitMatch = currVal.match(/\d+/);
1751:          if (digitMatch) {
1752:            remediatedVal = digitMatch[0];
...
1764:          if (!remediatedVal) {
1765:            if (qLower.includes("experience") || qLower.includes("years") || qLower.includes("how many")) {
1766:              remediatedVal = String(safePayload.yearsOfExperience || candidateProfile.totalYearsExperience || "4");
...
1772:              remediatedVal = "1";
1773:            }
1774:          }
```
**Observations**:
- **Omission of Question Context in Heuristic Activation**: Lines 1738–1748 do NOT check `qLower` or `el.getAttribute("inputmode") === "numeric"`. On LinkedIn and Ashby, experience fields are often `<input type="text">`. If the portal error message is generic (e.g., `"Please enter a valid value"`), lines 1738–1748 evaluate to `false`. The entire integer sanitizer is bypassed!
- **Zero Value Loop**: If `currVal` was `"0"`, and the portal rejects with `"Must be at least 1"`, line 1750 extracts `"0"`. `remediatedVal` is re-set to `"0"`, triggering the exact same validation error.
- **Decimal Truncation**: `currVal.match(/\d+/)` converts `"3.8"` (e.g. GPA) to `"3"`.

#### Phone Number Formatting (Lines 1777–1792):
```javascript
1778:        else if (
1779:          errLower.includes("phone") ||
1780:          errLower.includes("10 digit") ||
1781:          errLower.includes("valid phone") ||
1782:          el.type === "tel" ||
1783:          qLower.includes("phone") ||
1784:          qLower.includes("mobile")
1785:        ) {
1786:          const rawDigits = (currVal || safePayload.phone || safePayload.phoneNumber || "9876543210").replace(/\D/g, "");
1787:          if (errLower.includes("10") || rawDigits.length >= 10) {
1788:            remediatedVal = rawDigits.slice(-10);
1789:          } else {
1790:            remediatedVal = rawDigits || "9876543210";
1791:          }
1792:        }
```
**Observations**:
- **International Number Truncation**: For an 11-digit UK number (`07123456789`), `rawDigits.slice(-10)` strips the leading `0` to produce `7123456789`, corrupting the phone number.
- **E.164 and Masked Rejections**: If a portal requires an international prefix (`+1...`) or formatted telephone mask (`(555) 349-2810`), sending a flat 10-digit string fails validation.
- **Separate Country Code Unhandled**: In LinkedIn Easy Apply, when country code is selected in a separate dropdown (`United States (+1)`), entering `+1 (555) 349-2810` in the number box triggers validation rejection.

#### Salary / Compensation Amounts (Lines 1795–1808):
```javascript
1795:        else if (
1796:          errLower.includes("amount") ||
1797:          errLower.includes("salary") ||
1798:          qLower.includes("salary") ||
1799:          qLower.includes("ctc") ||
1800:          qLower.includes("compensation")
1801:        ) {
1802:          const cleanNum = currVal.replace(/[^0-9]/g, "");
1803:          if (cleanNum) {
1804:            remediatedVal = cleanNum;
1805:          } else {
1806:            remediatedVal = String(safePayload.expectedSalary || safePayload.currentSalary || "1500000").replace(/\D/g, "");
1807:          }
1808:        }
```
**Observations**:
- **Critical Salary String Concatenation Bug**:
  In `backend/src/ResumeTailor.Application/Features/Orchestrator/OrchestratorCommands.cs` line 870, the backend returns:
  `$"{usdAnnual:N0} USD / year (equivalent to {profile.ExpectedSalary})"`
  e.g.: `"$140,000 USD / year (equivalent to 25 LPA)"`.
  When `currVal.replace(/[^0-9]/g, "")` runs on that string:
  It extracts `140000` AND `25`, concatenating them into `"14000025"` ($14,000,025)!
- **Unit Suffixes**: Does not parse `"140k"` (becomes `"140"`) or `"12 LPA"` (becomes `"12"`).

#### Options, Radios, and Checkboxes (Lines 1832–1877):
```javascript
1833:        else if (el.tagName === "SELECT") {
1834:          const availableOptions = Array.from(el.options).filter(o => o.value && o.text.toLowerCase() !== "select an option");
...
1843:            if (!chosen) chosen = availableOptions[0];
...
1857:        else if (el.tagName === "FIELDSET") {
1858:          const radios = Array.from(el.querySelectorAll("input[type='radio']"));
...
```
And in Tier 3 (Lines 1903–1915):
```javascript
1903:        if (remediatedVal !== null && remediatedVal !== undefined) {
1905:          el.focus();
1906:          setNativeValue(el, "");
1907:          await typeLikeHuman(el, remediatedVal);
...
```
**Observations**:
- **Radio Inputs Treated as Text**:
  If the element found by `findActiveValidationErrors` is `<input type="radio">` (`el.tagName === "INPUT"`), it does NOT match `el.tagName === "FIELDSET"`. It falls through to Tier 2 (Gemini AI). Gemini returns `"Yes"`. Then Tier 3 executes line 1907: `await typeLikeHuman(el, "Yes")` on an `<input type="radio">`! Text typing on a radio input is a no-op; the radio remains unchecked!
- **Checkbox Total Omission**:
  There is zero handler for `<input type="checkbox">` in `remediateValidationErrors`. A mandatory terms/consent checkbox that fails validation falls through to Tier 3 and executes `setNativeValue(el, "")` and `typeLikeHuman(el, "true")`. It never sets `el.checked = true` or dispatches a native click!
- **Select Prototype Crash**:
  If an unselected `<select>` falls through to Tier 3, line 1906 calls `setNativeValue(el, "")`. In `setNativeValue`:
  `const prototype = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;`
  Because `el.tagName === "SELECT"`, `prototype` is `HTMLInputElement.prototype`. Calling `descriptor.set.call(el, "")` throws `TypeError: Illegal invocation: Method HTMLInputElement.value setter called on an object that is not an instance of HTMLInputElement`!

---

### 1.4 DOM Event Dispatching & React 16–19 Reactivity

In `extension/content.js`, lines 219–261:
```javascript
219:  function setNativeValue(element, value) {
220:    if (!element) return;
221:    const isTextarea = element.tagName === "TEXTAREA";
222:    const prototype = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
223:    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
224:    if (descriptor && descriptor.set) {
225:      descriptor.set.call(element, value);
226:    } else {
227:      element.value = value;
228:    }
229:    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
230:    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
231:  }
```
**Direct Observations on Event Dispatching**:
1. **React 16–19 Synthetic Tracker Bypass (`_valueTracker`)**:
   React wraps inputs and monitors property mutations via an internal tracker: `element._valueTracker`. React's tracker stores the last known value. When an `input` event bubbles, React checks `element._valueTracker.getValue() === element.value`. If identical, React drops the event without executing component `onChange` state setters!
   `setNativeValue` does NOT clear or update `element._valueTracker.setValue(...)`.
2. **Missing InputEvent Specification**:
   Modern reactive form engines (Vue 3, Angular 17+, React 18/19, Lit) listen for `InputEvent` with `inputType: "insertText"` and `data: value`. `setNativeValue` dispatches a generic `new Event("input")`.
3. **Shadow DOM Boundary Traversal**:
   While `setNativeValue` sets `{ composed: true }`, events dispatched on checkboxes, radios, and selects in lines 1266, 1327, 1387, 1847, and 1871 dispatch `new Event("change", { bubbles: true })` WITHOUT `composed: true`. These events fail to penetrate Shadow DOM roots used in Workday web components.

---

### 1.5 Loop Prevention & Multi-Step Progression Engines

In `extension/content.js`, lines 2112–2228 (`autoApplyLinkedInEasyApply`) and lines 2379–2575 (`runAutonomousMultiStepFill`):

#### LinkedIn Easy Apply Loop (Lines 2113–2228):
```javascript
2113:    let stepCount = 0;
2114:    while (stepCount < 15) {
2115:      stepCount++;
2116:      modal = findEasyApplyModal();
2117:      if (!modal) break;
2118:      await fillModalInputs(modal, safePayload, false);
...
2190:      if (nextBtn) {
2191:        await clickElementNaturally(nextBtn);
2192:        await sleep(1500);
2195:        const postErrors = findActiveValidationErrors(modal);
2196:        if (postErrors.length > 0) {
2198:          const healed = await remediateValidationErrors(modal, safePayload);
...
2202:          const remainingErrors = findActiveValidationErrors(modal);
2203:          if (remainingErrors.length === 0 || healed > 0) {
2217:              await clickElementNaturally(refreshedNextBtn);
...
2222:        continue;
2223:      }
2225:      break;
2226:    }
2228:    return { success: true, message: "Completed LinkedIn Easy Apply processing." };
```

#### Autonomous Multi-Step Progression Loop (Lines 2379–2575):
```javascript
2383:    while (stepIndex <= maxSteps && !isAutonomousLoopAborted) {
...
2538:        const postClickErrors = findActiveValidationErrors(container);
2539:        if (postClickErrors.length > 0) {
2541:          const postHealed = await remediateValidationErrors(container, safePayload);
...
2545:          const unresolved = findActiveValidationErrors(container);
2546:          if (unresolved.length === 0 || postHealed > 0) {
2551:              await clickElementNaturally(retryProgression.element);
2552:              await sleep(2000);
2553:            }
2554:          } else {
...
2563:        stepIndex++;
2564:        continue;
...
2571:    chrome.runtime?.sendMessage?.({ action: "AGENT_FINISHED" });
2572:    return {
2573:      success: true,
2574:      filledCount: totalFieldsFilled,
2575:      message: `Completed autonomous multi-step cycle.`
2576:    };
```
**Direct Observations on Loops**:
1. **Critical False-Positive Completion**:
   In both engines: if an error cannot be healed or if the portal rejects the healed value, `stepCount` or `stepIndex` increments anyway. After 12 or 15 iterations stuck on Step 1:
   Line 2228 returns: `{ success: true, message: "Completed LinkedIn Easy Apply processing." }`!
   Line 2572 returns: `{ success: true, message: "Completed autonomous multi-step cycle." }`!
   The candidate and popup are informed that the application succeeded, when in reality it was stuck on Step 1 and NEVER SUBMITTED!
2. **Missing Field Attempt Counters**:
   Neither engine maintains a per-field attempt map (`WeakMap` or dictionary of attempts per field ID/name). If a field is repeatedly rejected, the engine executes identical API calls and keystrokes on every loop.
3. **No Step Transition Verification**:
   The engine does not verify whether clicking "Next" actually moved to a new form step (e.g. comparing field snapshots or checking modal title/step text).

---

### 1.6 Visual Review Indicators & Optional Field Handling

In `extension/content.js`, lines 1413–1452:
```javascript
1418:    for (const input of allInputs) {
1419:      if (input.type === "radio" || input.type === "checkbox" || input.type === "file" || input.tagName === "SELECT") continue;
1420:      const val = (input.value || "").trim();
1421:      if (!val) {
1422:        input.style.border = "2px solid #f59e0b";
1423:        input.style.boxShadow = "0 0 8px rgba(245, 158, 11, 0.4)";
1424:        input.style.backgroundColor = "rgba(245, 158, 11, 0.06)";
1425:        input.setAttribute("title", "⚠️ Unclear - Please review and fill this question yourself");
1426:        unansweredElements.push(input);
1427:      }
1428:    }
```
And in line 2514:
```javascript
2514:        if (errors.length > 0) {
2515:          errors[0].inputElement?.scrollIntoView({ behavior: "smooth", block: "center" });
2516:          showSafeFillNotice(totalFieldsFilled, errors.length);
2517:          return {
2518:            success: false,
2519:            error: `Paused: ${errors.length} required field(s) require manual review (${errors[0].errorMessage || "Validation error"}).`
2520:          };
2521:        }
```
**Direct Observations**:
1. **Optional Fields Flagged as Errors**: Any empty field (e.g. `"Twitter URL (optional)"`, `"Referral code"`) is highlighted orange with an "Unclear" warning, confusing candidates.
2. **Unresolvable Fields Lack Visual Review Badging**: If self-healing fails on a field, `remediateValidationErrors` does not apply a visual review styling or persistent indicator; the field retains its raw portal red styling.
3. **Optional Rejection Blocks Progression**: If an optional field has a format violation (e.g., text in an optional number field), line 2517 halts progression. Clearing an invalid optional field would allow portal progression, but the engine does not support this.

---

## 2. Logic Chain

1. **Premise**: Self-healing form validation (Requirement R2) requires three linked capabilities:
   (a) Accurately identifying which field is in violation without false positives or misattributions;
   (b) Sanitizing the rejected input to comply with portal constraints (integer, phone, salary, selection);
   (c) Re-dispatching synthetic DOM events so the hosting framework re-evaluates validity, advancing safely without infinite loops.

2. **Step 1 (Failure in Identification)**:
   - Observation 1.2 shows that `badge.closest("div")` in Strategy B frequently matches the immediate wrapper or an entire row, assigning the badge to the wrong input element.
   - Observation 1.2 shows that `role="alert"` filtering skips any alert that lacks specific words like "error" or "required", dropping valid constraints like "Must be a whole number".
   - *Inference*: The extension often attempts to heal the wrong input or fails to detect active rejections.

3. **Step 2 (Failure in Sanitization & Value Corruption)**:
   - Observation 1.3 shows that `cleanNum = currVal.replace(/[^0-9]/g, "")` on backend compensation strings containing currency and text (`$140,000 USD / year (equivalent to 25 LPA)`) produces `"14000025"` ($14M).
   - Observation 1.3 shows that integer sanitization does not inspect question context (`qLower`), skipping text-type inputs with generic error messages.
   - Observation 1.3 shows that `<input type="radio">` and `<input type="checkbox">` are treated as text fields, attempting `typeLikeHuman` text typing into radio/checkbox elements.
   - Observation 1.3 shows that `<select>` elements passed to `setNativeValue` throw `TypeError: Illegal invocation`.
   - *Inference*: Sanitization logic corrupts salary amounts, crashes on select elements, and fails to heal radio and checkbox constraints.

4. **Step 3 (Failure in Framework Re-validation)**:
   - Observation 1.4 demonstrates that `setNativeValue` does not update or clear React's `_valueTracker`.
   - React's synthetic event dispatcher checks `_valueTracker.getValue() === element.value`. Because `_valueTracker` was not notified of the change, React discards the `input` event.
   - *Inference*: React-based portals (LinkedIn Easy Apply, Greenhouse, Ashby) never register the healed value in their internal component state; the field remains invalid in React's view despite DOM property changes.

5. **Step 4 (Failure in Progression & Infinite Loop Trapping)**:
   - Observation 1.5 proves that when a field remains rejected by the portal, the progression loops increment `stepIndex` or `stepCount` without verifying actual step advance.
   - After exhausting loop iterations (12 to 15), both `runAutonomousMultiStepFill` and `autoApplyLinkedInEasyApply` return `{ success: true }`.
   - *Inference*: The extension enters repetitive clicking cycles and reports a false-positive success to the user when an application was blocked on an early step.

6. **Step 5 (Failure in Visual Review & Optional Field Handling)**:
   - Observation 1.6 shows that empty optional fields are styled as errors, while unhealed required fields are not provided with distinct review indicators.
   - When an optional field contains an invalid value, the runner aborts rather than clearing the field to satisfy portal validation.
   - *Inference*: Candidates receive noisy warnings on valid optional fields and hard progression blocks on optional formatting issues.

---

## 3. Caveats

1. **Live Portal Behavioral Drift**:
   Web portals frequently alter their DOM structure (e.g. LinkedIn deploying A/B variants of Easy Apply or Workday updating UI skins). While HTML5 standard properties (`.validity`, `inputmode`, `aria-invalid`) remain stable, class names require resilient fallback hierarchies.
2. **Browser Security Sandbox Restrictions**:
   Browser extensions running in content script isolated worlds cannot set `event.isTrusted = true`. React and Vue synthetic dispatching must mimic native event sequences (`pointerdown`, `focus`, `keydown`, `InputEvent`, `keyup`, `change`, `blur`) as closely as possible.
3. **No Direct Production Credentials during Survey**:
   This survey was conducted strictly through codebase analysis, git history, and static testing without submitting real candidate applications to live corporate job boards.

---

## 4. Conclusion & Recommended Technical Strategy

### 4.1 Root Cause Summary
Requirement R2 fails in production due to:
1. **Mis-association of Error Badges**: `closest("div")` miscorrelates badges to unrelated inputs in multi-field rows, and `role="alert"` filtering prematurely discards constraint notices.
2. **Dangerous Heuristic Sanitizers**: Regex `replace(/[^0-9]/g, "")` corrupts compensation amounts ($140K -> $14M); numeric heuristics skip text-type inputs with generic error messages.
3. **Element-Type Incompatibilities**: Radio buttons and checkboxes receive text keystroke simulation; `<select>` invokes `HTMLInputElement.prototype` causing a `TypeError`.
4. **React Synthetic Event Suppression**: React 16–19 `_valueTracker` is unreset, causing portals to ignore auto-filled inputs.
5. **False-Positive Loop Termination**: Autonomous runners increment step counters without verifying DOM step changes, reporting successful application when stalled.
6. **Optional Field Conflation**: Optional fields are highlighted as errors, and invalid optional fields block progression rather than being cleared.

---

### 4.2 Recommended Technical Architecture

To make R2 production-grade, the self-healing subsystem should be structured into four cohesive modules:

#### Module A: Universal Constraint & Error Detector (`findActiveValidationErrors`)
- **Precise Input Association**:
  1. Primary: Explicit association via `aria-describedby`, `aria-errormessage`, or `label[for]`.
  2. Secondary: Scoped component container search (`[data-test-form-builder-component]`, `.fb-dash-form-element`, `.form-group`, `fieldset`, `div[role='radiogroup']`). Avoid naked `closest("div")`.
  3. Sibling proximity: If searching siblings, ensure the input and badge share the exact parent component container.
- **Unrestricted Message Evaluation**: Eliminate restrictive word filtering on `role="alert"`. Inspect any visible alert near form controls.
- **HTML5 Raw Value Preservation**: When `validity.badInput` is true on `<input type="number">`, retrieve the rejected string from `el.getAttribute("value")` or recent input telemetry.

#### Module B: Robust Deterministic Sanitizer & Heuristic Engine (`remediateValidationErrors`)
- **Integer / Experience Sanitizer**:
  - Activate whenever `errLower` mentions whole number/integer OR `qLower` contains "experience", "years", "how many", "notice", "days", or `inputmode="numeric"`.
  - Extract the first contiguous numeric token (`/^\s*(\d+)/` or `/\b(\d+)\b/`), round floats if integer-only (`Math.round(parseFloat(...))`), clamp between bounds if specified, and prevent `0` if minimum is 1.
- **Salary / Compensation Sanitizer**:
  - Parse the primary monetary value from strings: e.g. `match(/(?:\$|₹|USD|INR|\b)(\d{1,3}(?:,\d{3})+|\d+)(?:\s*(?:k|thousand|lpa|lac))?/i)`.
  - If `"k"` suffix is present, multiply by 1,000. If `"LPA"` is present, convert to standard annual figure.
  - Never run blind global non-digit stripping on strings containing parenthetical conversions.
- **Phone Number Sanitizer**:
  - Check if a separate Country Code dropdown exists. If yes, provide the 10-digit subscriber number.
  - If the portal requires E.164 (`pattern="^\+..."`), prefix with candidate country code (`+1...`).
  - If a mask is required (`(###) ###-####`), apply standard formatting.
- **Radio & Checkbox Sanitizers**:
  - For `<input type="radio">`: find the target radio in the group matching "Yes" / candidate preference, click it, and dispatch `change` with `composed: true`.
  - For `<input type="checkbox">`: set `el.checked = true`, dispatch `click`, and dispatch `change` with `composed: true`.
- **Select Sanitizer**:
  - Use `HTMLSelectElement.prototype` descriptor.
  - Skip placeholder options with values `""`, `"0"`, `"-1"`, or texts containing "select", "choose".

#### Module C: Biometric Event Dispatcher with React/Vue Reactivity (`setNativeValue`)
- **Prototype Resolution**: Dynamically resolve prototype from `Object.getPrototypeOf(element)` (or explicit `HTMLInputElement`, `HTMLTextAreaElement`, `HTMLSelectElement`).
- **React Tracker Reset**:
  ```javascript
  const tracker = element._valueTracker;
  if (tracker) {
    tracker.setValue(previousValue || "");
  }
  ```
- **Composed Event Suite**: Dispatch `focus`, `InputEvent` (`inputType: "insertText"`), `input`, `change`, and `blur` — all with `{ bubbles: true, composed: true }`.

#### Module D: Loop Prevention & Step Verification Gateway
- **Field-Level Attempt Map**: Track `healingAttempts = new Map()`. If an element fails remediation twice:
  - If optional: clear the field (`value = ""`), allowing progression.
  - If required: mark with visual review indicator (amber border, review tooltip) and cleanly pause.
- **Step Progression Verification**:
  - Before clicking Next, compute DOM fingerprint (set of actionable input IDs/names, or step header text).
  - After clicking Next, verify that the fingerprint changed. If unchanged after 2.5s, progression failed; do NOT increment step counter.
  - If progression fails due to unresolvable errors, return `{ success: false, pausedForReview: true }` instead of `{ success: true }`.

---

## 5. Verification Method

To independently verify the observations, deficiencies, and proposed fixes:

### 5.1 Syntax & Static Analysis
Run Node.js syntax verification on the extension codebase:
```powershell
& "C:\Program Files\nodejs\node.exe" -c extension/content.js
& "C:\Program Files\nodejs\node.exe" -c extension/popup.js
```
*Expected Result*: Zero syntax errors.

### 5.2 Reproduction Test Script for Identified Bugs
Execute the following verification script using Node.js to verify the exact regex corruption, prototype resolution, and value extraction bugs identified in this survey:
```javascript
// Verification harness for R2 deficiencies
const assert = require("assert");

// Bug 1: Salary regex concatenation
const backendSalary = "$140,000 USD / year (equivalent to 25 LPA)";
const currentBugClean = backendSalary.replace(/[^0-9]/g, "");
console.log("Bug 1 Current Clean Result:", currentBugClean);
assert.strictEqual(currentBugClean, "14000025", "Demonstrates $14M bug");

// Proposed fix for Bug 1:
const salaryMatch = backendSalary.match(/\$?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)/);
const fixedClean = salaryMatch ? salaryMatch[1].replace(/,/g, "") : "";
console.log("Bug 1 Fixed Clean Result:", fixedClean);
assert.strictEqual(fixedClean, "140000", "Healed salary matches expected $140,000");

// Bug 2: Phone number UK truncation
const ukPhone = "07123456789";
const bugPhone = ukPhone.replace(/\D/g, "").slice(-10);
console.log("Bug 2 UK Phone Truncation:", bugPhone);
assert.strictEqual(bugPhone, "7123456789", "Demonstrates UK phone corruption");

console.log("All survey reproduction checks verified successfully.");
```

### 5.3 Backend Q&A Contract Verification
Run backend unit tests to ensure API contracts remain intact:
```powershell
dotnet test backend/tests/ResumeTailor.UnitTests/ResumeTailor.UnitTests.csproj
```

### 5.4 Invalidation Conditions
This survey's findings would be invalidated if:
1. `extension/content.js` already contains a field-level attempt tracker and step fingerprint verifier (verified: lines 2112–2575 show no `Map` or DOM fingerprint verification).
2. `remediateValidationErrors` already handles `<input type="radio">` and `<input type="checkbox">` elements (verified: lines 1735–1920 contain no `el.type === "radio"` or `el.type === "checkbox"` handlers).
3. `setNativeValue` resets React's `_valueTracker` (verified: lines 219–231 make no reference to `_valueTracker`).
