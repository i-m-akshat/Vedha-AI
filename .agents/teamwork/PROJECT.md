# Project: Vedha AI Chrome Extension Comprehensive Audit & Self-Healing Engine

## Architecture
- **Chrome Extension Layer (MV3)**:
  - `extension/manifest.json`: Manifest V3 declarations, permissions (`activeTab`, `scripting`, `storage`, `sidePanel`), `side_panel`, `action`, and new `background` service worker.
  - `extension/background.js`: Service worker managing side panel behavior (`chrome.sidePanel.setPanelBehavior`), toolbar action triggers, and background coordination.
  - `extension/popup.html` & `extension/popup.js`: Unified extension popup and persistent side panel interface with responsive viewport styling and active tab synchronization.
  - `extension/content.js`: Content script injected into job portal tabs providing:
    - Shadow DOM encapsulated floating copilot dock (`#vedha-floating-copilot-root`) elevated to `z-index: 2147483647`.
    - Modal elevation and backdrop stacking management across LinkedIn Easy Apply, Greenhouse, and Workday.
    - Self-healing form validation engine with React 16–19 `_valueTracker` synchronization and portal constraint sanitizers (numeric, phone, salary, radio, checkbox, select).
    - Autonomous multi-step navigation engine with strict modal container scoping, DOM step fingerprint verification, and loop prevention.
    - Interactive Review Gateway pausing before submission and executing portal confirmation.
    - Idempotent script injection guard and resilient offline candidate profile defaults.
- **Backend API & Orchestrator Services**:
  - `backend/src/ResumeTailor.Application/Features/CandidateProfile/CandidateProfileCommands.cs`: Canonical candidate profile contracts.
  - `backend/src/ResumeTailor.Application/Features/Orchestrator/OrchestratorCommands.cs`: Screening question answering and queue status management.

## Code Layout
- `extension/manifest.json`: Extension manifest declarations and permissions.
- `extension/background.js`: New service worker for side panel behavior and lifecycle coordination.
- `extension/popup.html`: Extension popup & side panel markup, responsive styling.
- `extension/popup.js`: Extension popup & side panel logic, tab tracking, dynamic injection fallback.
- `extension/content.js`: In-page floating dock, modal elevation, form validation self-healing, multi-step auto-apply.
- `tests/e2e/`: Independent opaque-box test suites for Chrome extension automation and requirements R1–R4.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1. Floating Dock Elevation & Shadow DOM Isolation | Enforce `z-index: 2147483647 !important`, isolate styles and prevent stacking trap via Shadow DOM, clamp initial coordinates. | M1 | Survey (R1) |
| 2 | F2. Dock Pinning Persistence & Fallback Injection | Preserve `isPinned` state during form interactions, prevent outside-click collapse, fix silent failure in `PIN_INPAGE_DOCK`. | M1 | Survey (R1) |
| 3 | F3. Native Side Panel Lifecycle & Responsive Viewport | Register MV3 background service worker with `setPanelBehavior`, responsive sidebar layout, and active tab listeners (`onActivated`, `onUpdated`). | M1 | Survey (R1) |
| 4 | F4. Universal Constraint & Error Association | Remove `closest("div")` error misattributions, remove restrictive `role="alert"` filtering, preserve raw input on `validity.badInput`. | M2 | Survey (R2) |
| 5 | F5. Deterministic Sanitization & Self-Healing | Integer sanitization, UK/international phone formatting, salary regex corruption fix, radio/checkbox/select prototype fixes. | M2 | Survey (R2) |
| 6 | F6. React/Vue Reactivity & Composed Event Dispatch | Reset React `_valueTracker`, dispatch composed `InputEvent`, `input`, `change`, `blur` with `{ bubbles: true, composed: true }`. | M2 | Survey (R2) |
| 7 | F7. Visual Review Badging & Optional Handling | Differentiate empty optional fields from errors, add visual review indicators to unresolvable fields, gracefully clear invalid optional fields. | M2 | Survey (R2) |
| 8 | F8. Scoped Progression Discovery & Button Priority | Scope progression discovery strictly to active modal container, remove dangerous `document.body` fallback, prioritize next over submit. | M3 | Survey (R3) |
| 9 | F9. Step Fingerprint Verification & Loop Prevention | Track per-field attempt counters (`Map`), verify DOM step transitions via fingerprinting, eliminate false-positive success reporting. | M3 | Survey (R3) |
| 10 | F10. Interactive Review Gateway & Confirmation | Pause reliably before submission, render portal-agnostic Review HUD, and provide executable confirmation triggering portal submission. | M3 | Survey (R3) |
| 11 | F11. Comprehensive Candidate Profile Fallback | Enrich `DEFAULT_CANDIDATE_PROFILE` with work authorization, visa status, postal code, relocation, and EEO voluntary disclosures. | M4 | Survey (R4) |
| 12 | F12. Idempotent Script Injection & Messaging Resilience | Add `window.__VEDHA_CONTENT_SCRIPT_INITIALIZED__` guard, ping/pong health checks, and automatic `executeScript` fallback in popup. | M4 | Survey (R4) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Persistent Dock, Modal Elevation & Side Panel | F1, F2, F3 (`manifest.json`, `background.js`, `popup.html`, `popup.js`, `content.js` dock/stacking) | None | PLANNED |
| M2 | Form Validation Self-Healing & Constraint Enforcement | F4, F5, F6, F7 (`content.js` validation, sanitization, reactivity, indicators) | None | PLANNED |
| M3 | Autonomous Multi-Step Navigation & Review Gateway | F8, F9, F10 (`content.js` button discovery, progression loop, review gateway) | M2 | PLANNED |
| M4 | Candidate Data Resilience & Script Injection | F11, F12 (`content.js` idempotency & defaults, `popup.js` injection & defaults) | None | PLANNED |
| M-Final | Final Verification & Adversarial Hardening | Pass 100% E2E test suite (Tiers 1-4) + Tier 5 Adversarial Coverage Hardening | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### Content Script ↔ Extension Messaging Contract
- Actions:
  - `PIN_INPAGE_DOCK`: `{ success: boolean, pinned: boolean }` (ensures dock is created and pinned).
  - `AUTONOMOUS_MULTI_STEP_FILL`: `{ payload: object }` → `{ success: boolean, pausedForReview?: boolean, filledCount: number, message: string }`.
  - `AGENT_STEP_UPDATE`: `{ step: number, totalSteps: number, stepName: string, title: string, detail: string, progress: number }`.
  - `PING_CONTENT_SCRIPT`: `{ alive: true, version: string }`.

### React/Vue Value Setting Contract
- Target input: `HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement`
- Operation: Reset `_valueTracker` if present, set prototype property, dispatch composed `focus`, `InputEvent`, `input`, `change`, `blur`.

### Progression Button Contract
- Scope: `container` (strictly child of modal outlet or form dialog).
- Return: `{ type: "next" | "review" | "submit", element: HTMLElement } | null`. Never search outside active modal if modal is detected.
