# Implementation Plan: Extension Shared Authentication, LinkedIn Easy Apply Detection & Minimalist Aesthetic UI

## 1. Overview
Implement two-way shared authentication between the web app (`http://localhost:3000`) and the Chrome extension with an in-popup fallback login prompt, fix LinkedIn Easy Apply modal detection and progression to prevent erratic page button clicking, and refine the design of both systems into a calm, minimal, aesthetic experience featuring the official `vedha-logo.png`.

## 2. Step-by-Step Implementation

### Step 1: Web App Auth Broadcast & Extension Auto-Sync
- **File**: `frontend/src/stores/useAuthStore.ts`
  - When login/registration succeeds or tokens are refreshed, post a `VEDHA_AUTH_TOKEN_SYNC` window message with the token.
- **File**: `extension/content.js`
  - Listen for `VEDHA_AUTH_TOKEN_SYNC` messages on `localhost:3000` and immediately persist `vedha_token` to `chrome.storage.local`.
  - On page load on `localhost:3000`, read `localStorage.getItem("vedha_token")` and sync into `chrome.storage.local`.

### Step 2: In-Extension Login & Real Profile Retrieval
- **Files**: `extension/popup.html`, `extension/popup.js`
  - Create a clean "Sign In to Vedha AI" view in `popup.html` displayed when the user is not authenticated:
    - Vedha AI logo (`vedha-logo.png`), heading, brief explanation.
    - Email & Password input fields.
    - "Sign In" primary action button.
    - "Try Demo Account" 1-click button (`demo@vedha.ai` / `Password123!`).
    - "Open Vedha AI Web App" link (`http://localhost:3000`).
  - In `popup.js`:
    - `checkAuthSession()`: Validates token against `http://localhost:5000/api/auth/me`.
    - If valid: hides login view, shows main copilot view, and pulls REAL user details (`/api/auth/me`), REAL candidate profile (`/api/candidateprofile`), and REAL master resume (`/api/masterresume`).
    - If unauthenticated: shows login view and prevents running autofill with mock data.
    - Provide a "Sign Out" / "Switch Account" action.

### Step 3: Fix LinkedIn Easy Apply Modal Detection & Progression
- **File**: `extension/content.js`
  - Fix `getTopLevelModal(el)`: Return `top || null` instead of `top || el`.
  - In `runAutonomousMultiStepFill(payload)` and `autoApplyLinkedInEasyApply(payload)`:
    - If `isLinkedIn`:
      - First, check if `findEasyApplyModal()` is already open.
      - If NOT open, check `findEasyApplyButton()` within the active job details/top-card container.
      - If found, click it naturally and wait for `waitForEasyApplyModal(8000)`.
      - If NOT found and no modal is open:
        - Check if external apply button exists; if so, inform user.
        - Otherwise, halt immediately with message: "Easy Apply button or modal not found for this position. Please open the Easy Apply dialog manually."
        - **CRITICAL**: Never fall back to `document.body` or click generic search pagination / "Next" buttons on the page!

### Step 4: Minimalist Aesthetic Redesign (Web App & Extension)
- **Web App**:
  - `frontend/src/components/layout/AppLayout.tsx`: Use `<img src="/vedha-logo.png" />`, clean minimal navigation, soft borders, refined calm styling.
  - `frontend/src/pages/AuthPages.tsx`: Clean, aesthetic card using official logo, spacious inputs, calm dark palette.
  - `frontend/src/App.tsx`: Clean session verification view with `vedha-logo.png`.

### Step 5: Extension Theme Toggler & Theme-Aware Single Logo System
- **Assets**:
  - Copy `frontend/public/VedhaAI-Dark.png` to `extension/VedhaAI-Dark.png`.
- **File**: `extension/popup.html`
  - Define CSS custom variables for `[data-theme="dark"]` and `[data-theme="light"]`:
    - Variables for `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-input`, `--border-color`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-color`, `--card-shadow`.
  - Header Refactoring:
    - Replace the logo + text combination (`.logo-img` + `.brand-title`) with a single responsive logo element: `<img id="headerLogo" src="VedhaAI-Dark.png" alt="Vedha AI" class="brand-logo" />`.
    - Add Theme Toggle Button: `<button id="themeToggleBtn" class="btn-icon" title="Toggle Theme"><span>🌙</span></button>`.
  - Login View Refactoring:
    - Replace login logo with `<img id="loginLogo" src="VedhaAI-Dark.png" alt="Vedha AI" class="login-logo" />`.
- **File**: `extension/popup.js`
  - Implement `initTheme()` and `toggleTheme()`:
    - Retrieve `vedha_theme` from `chrome.storage.local`.
    - Apply `data-theme` attribute to `document.documentElement` (`light` or `dark`).
    - Dynamically switch `#headerLogo.src` and `#loginLogo.src`:
      - If `light`: `vedha-logo.png`
      - If `dark`: `VedhaAI-Dark.png`
    - Update `#themeToggleBtn` icon (☀️ in dark mode, 🌙 in light mode).
    - Persist choice to `chrome.storage.local.set({ vedha_theme: currentTheme })`.

### Step 6: Extension AI Orchestrator & Copilot Pipeline Suite
- **Revert**:
  - Revert `extension/content.js` auto-apply modal-forcing code to preserve broad multi-portal compatibility.
- **File**: `extension/popup.html`
  - Expand tab navigation: `⚡ Copilot`, `🎯 AI Match`, `📝 Cover Letter`, `👤 Profile`, `⚙️ Settings`.
  - In `tab-copilot`: Add Application Journey Stepper, Live Telemetry Card (radar dot, status detail, progress bar, abort), and 1-Click "Queue Full Application Package" button (`#preparePackageBtn`).
  - In `tab-ats`: Add ATS gauge card (circular score, verdict, recommendation), 3-stat metric grid (Keywords, Hard Skills, Relevance), matching skills pills, missing requirements pills, and "Run Full ATS Alignment Check" action.
  - In `tab-coverletter`: Add tone dropdown (`#coverLetterTone`), Generate button, clean textarea output (`#coverLetterText`), and copy / download actions.
- **File**: `extension/popup.js`
  - Wire up `POST /api/orchestrator/quick-match` for live ATS scoring and skill gaps using detected tab job description and user's Master Resume.
  - Wire up `POST /api/orchestrator/quick-cover-letter` for Gemini AI cover letter tailoring.
  - Wire up `POST /api/orchestrator/prepare-package` for 1-click queuing of the application package into the backend orchestrator queue.
  - Listen for runtime agent events (`AGENT_STEP_UPDATE`, `AGENT_FINISHED`) to update the live Stepper and Telemetry cards during autonomous autofill.

### Step 7: Verification & Syntax Validation
- Verify JS syntax of `popup.js` and `content.js` using Node.js.
- Verify asset loading and theme switching mechanics across all tabs.
- Verify container and web app health.

## 3. Changelog
### 2026-10-10T13:10:00Z — Easy Apply locator: chat false positives, split-view polling, pointer click
- **Changes**: `isMsgOrChatElement` matches only messaging containers. `findEasyApplyButton` requires an Easy Apply label, skips the results list, and polls for 2.5 seconds. `clickElementNaturally` sends pointer and mouse events before one native click. An already-open Easy Apply modal binds immediately.
- **Rationale**: Issue #3. Auto-Apply reported that it could not find the button or the modal the user had opened.
- **Impacted Components**: `extension/content.js`, `tests/e2e/easy_apply_detection.test.js`.

### 2026-10-09T23:44:00+05:30 — Unified Web App & Extension Single-Logo Sizing & Theme Toggler System
- **Changes**: Enforced single-logo display across BOTH Web App (`AppLayout.tsx`, `AuthPages.tsx`) and Extension (`popup.html`, `popup.js`), completely removing redundant title text. Calibrated proportional sizing for `VedhaAI-Dark.png` (3:1 aspect ratio) and `vedha-logo.png` (1.5:1 aspect ratio). Integrated working Theme Toggler (`Sun` / `Moon`) into both applications.
- **Rationale**: User clarification to strictly render only the logo without title text on both dark and light modes, calibrating for differing aspect ratios and providing seamless theme toggling.
- **Impacted Components**: `frontend/src/components/layout/AppLayout.tsx`, `frontend/src/pages/AuthPages.tsx`, `extension/popup.html`, `extension/popup.js`.

### 2026-10-09T23:35:00+05:30 — Revert Auto-Apply & Implement Proper Extension AI Orchestrator Pipeline
- **Changes**: Reverted the LinkedIn-specific modal forcing change in `content.js`; implemented the complete AI Orchestrator & Copilot Pipeline suite in `popup.html` and `popup.js` (`Copilot`, `AI Match`, `Cover Letter`, `Profile`, `Settings`) connecting to `/api/orchestrator/*` endpoints with theme-aware styling.
- **Rationale**: User request to revert auto-apply changes while keeping everything else, and build a proper AI orchestrator and copilot pipeline for the extension.
- **Impacted Components**: `extension/content.js`, `extension/popup.html`, `extension/popup.js`.

### 2026-10-09T23:25:00+05:30 — Extension Theme Toggler & Single Logo Plan
- **Changes**: Added implementation steps for theme switching (light/dark CSS variables), persistence in `chrome.storage.local`, and dynamic single-logo swapping (`vedha-logo.png` vs. `VedhaAI-Dark.png`).
- **Rationale**: User request for extension design enhancement, full theme toggle functionality, and single-logo display rule.
- **Impacted Components**: `extension/popup.html`, `extension/popup.js`, `extension/VedhaAI-Dark.png`.

### 2026-10-09T23:10:00+05:30 — Initial Implementation Plan
- **Changes**: Drafted detailed implementation steps for shared auth, LinkedIn Easy Apply fix, and minimalist redesign.
- **Rationale**: Direct response to user requirements for connected login, precise LinkedIn behavior, and clean aesthetic design.
- **Impacted Components**: `useAuthStore.ts`, `content.js`, `popup.html`, `popup.js`, `AppLayout.tsx`, `AuthPages.tsx`.
