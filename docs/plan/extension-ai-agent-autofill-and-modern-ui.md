# Implementation Plan: AI-Driven Multi-Step Autonomous Form Agent & Modern Extension Redesign

## 1. Files to Modify & Create
- `docs/specs/extension-ai-agent-autofill-and-modern-ui.md` (Created)
- `docs/plan/extension-ai-agent-autofill-and-modern-ui.md` (Created)
- `extension/popup.html` (Modify: Modern Simplify/Teal-inspired glassmorphic redesign, live multi-step progress bar, agent telemetry status HUD, autonomous mode toggle)
- `extension/popup.js` (Modify: Multi-step event listener, live step state sync, toggle handler, status animations)
- `extension/content.js` (Modify: Multi-step autonomous progression loop `runAutonomousMultiStepFill`, universal next/submit button discovery engine, Review Gateway elevation, upgraded floating copilot dock)

---

## 2. Step-by-Step Implementation Sequence

### Step 1: Modernize Popup UI (`extension/popup.html`)
- Integrate Simplify Jobs / Teal / Linear aesthetic:
  - Deep obsidian dark background (`#09090b`), translucent cards (`rgba(24, 24, 27, 0.8)`), subtle 1px border (`rgba(255, 255, 255, 0.08)`).
  - Add **Multi-Step Stepper Component**:
    Interactive breadcrumb pills representing `1. Info` ➔ `2. Work History` ➔ `3. Screening` ➔ `4. Review`.
  - Add **Live Agent Telemetry HUD**:
    Status card with pulsing activity dot, active step indicator, action description, and Cancel/Pause controls.
  - Add **Copilot / Review Gateway Switch**:
    Toggle enabling the user to choose between "Review Gateway (Pause Before Submit)" and "Full Auto-Apply".
  - Refine ATS Fit, Cover Letter, and Quick-Copy Profile panels with consistent typography and smooth hover states.

### Step 2: Controller & Telemetry Synchronization (`extension/popup.js`)
- Add communication channel between popup and content script:
  - Send `{ action: "START_AUTONOMOUS_FILL", payload: { copilotMode: true } }`.
  - Receive `{ action: "AGENT_STEP_UPDATE", step: 2, maxSteps: 4, statusText: "...", stepName: "..." }`.
  - Update popup stepper dots (done, active pulse, pending) and live telemetry text dynamically.
  - Implement Stop / Cancel signal handler to abort the loop immediately if requested by the user.

### Step 3: Multi-Step Autonomous Progression Engine (`extension/content.js`)
- Implement `runAutonomousMultiStepFill(payload)`:
  - **Loop Controller**: Max 12 iterations with safety boundary.
  - **Step Execution**:
    1. Fill form inputs using existing `fillModalInputs` (candidate contact + Gemini grounded screening answers).
    2. Check for form validation errors or mandatory unanswered fields.
    3. Evaluate action buttons using `findFormProgressionButton(container)`:
       - **Submit Candidate**: "Submit", "Submit application", "Send application".
       - **Review Candidate**: "Review", "Review your application", "Next: Review".
       - **Next Candidate**: "Next", "Continue", "Save & continue", "Proceed to next step", "Save and proceed".
    4. If Submit:
       - In Copilot Mode: Display glowing **Review Gateway HUD** for 1-click confirmation.
       - In Auto Mode: Click naturally and confirm completion.
    5. If Next / Continue:
       - Naturally click button using `clickElementNaturally`.
       - Wait for DOM mutations or new inputs with exponential backoff (up to 4s).
       - Emit `AGENT_STEP_UPDATE` to popup and update in-page floating widget.
       - Recurse/continue to next step.

### Step 4: Floating In-Page Copilot Dock Upgrade (`extension/content.js`)
- Upgrade the floating dock (`#vedha-copilot-pill` and `#vedha-copilot-dock`):
  - Add compact mini-stepper indicator directly on the in-page dock.
  - Provide live agent telemetry and instant 1-click "Run Multi-Step AutoFill".

---

## 3. Testing Strategy
1. **Visual Testing**: Verify popup layout, tab switching, responsive sizing, and stepper rendering in Chrome Extension context.
2. **LinkedIn Easy Apply Multi-Step Test**: Verify that the autonomous runner advances through all screens and pauses at the final Review screen.
3. **Generic Web Portal Test**: Verify on multi-step forms that "Save & Continue" or "Next" buttons are correctly detected and clicked with natural pointer jitter.
4. **Safety & Guardrails Test**: Verify that CAPTCHA or validation errors pause the automation safely.

---

## 4. Rollback Strategy
If any regression occurs, revert `extension/popup.html`, `extension/popup.js`, and `extension/content.js` to their previous working states via Git.

---

## ## Changelog
- **Date & Timestamp**: 2026-10-06T13:22:30+05:30
- **Changes Made**: Implementation plan defined for Modern UI redesign and AI-driven multi-step next/submit engine.
- **Rationale ("Why")**: Establish clear execution steps and testing protocols before modifying extension source code.
- **Impacted Components**: `extension/popup.html`, `extension/popup.js`, `extension/content.js`.

- **Date & Timestamp**: 2026-10-06T14:04:00+05:30
- **Changes Made**: Executed self-healing validation error recovery: built `findActiveValidationErrors`, deterministic format sanitizers, `queryGeminiForValidationError`, and integrated self-healing loops into `autoFillForm`, `autoApplyLinkedInEasyApply`, and `runAutonomousMultiStepFill`.
- **Rationale ("Why")**: Resolve field rejection loops caused by unparsed validation constraints without requiring manual user intervention.
- **Impacted Components**: `extension/content.js`, `extension/popup.js`.

- **Date & Timestamp**: 2026-10-06T15:05:00+05:30
- **Changes Made**: Executed autonomous auto-apply, content script injection, and data resilience fixes:
  - Scoped already-applied check inside `autoApplyLinkedInEasyApply` strictly to the target job top card when modal is not already open.
  - Added `getTopLevelModal(el)` hierarchy resolver to wrap all modal search strategies into the top-level `.artdeco-modal` container containing both inputs and action buttons.
  - Implemented `sendMessageToActiveTab` in `popup.js` with dynamic programmatic script injection fallback.
  - Integrated deterministic fallback values for experience, salary, notice period, radios, consent checkboxes, and dropdowns.
  - Synchronized `candidateProfile` to `chrome.storage.local` with rich fallback data (`DEFAULT_CANDIDATE_PROFILE`).
- **Rationale ("Why")**: Resolve total auto-apply blockage caused by false-positive global text detection, tab connection drops, and empty profile fields when backend services are offline.
- **Impacted Components**: `extension/content.js`, `extension/popup.js`.

