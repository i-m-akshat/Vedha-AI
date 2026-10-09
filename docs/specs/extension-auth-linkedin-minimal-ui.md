# Feature Specification: Extension Shared Authentication, LinkedIn Easy Apply Detection & Minimalist Aesthetic UI

## 1. Problem Statement
Users reported three major points of friction:
1. **No Shared Authentication Between App & Extension**: The Chrome extension operates in an isolated silo. If the user is logged into the web app at `localhost:3000`, the extension often fails to retrieve the session, falls back to mock candidate data ("Alex Rivera"), and never prompts the user to log in to access their actual Master Resume and Candidate Profile.
2. **Erratic LinkedIn Progression ("Clicking Next and Next")**: When running autonomous autofill on LinkedIn job pages without the Easy Apply modal open, the script detects general page buttons or search pagination buttons and clicks "Next" indefinitely instead of verifying if the "Easy Apply" button exists on the job post first, clicking it to open the application modal, or pausing if Easy Apply is not available.
3. **Visual Clutter & UI Chaos**: The application and extension suffer from sensory overload—too many busy borders, excessive badges, neon accents, and cockpit-style elements. The application name is **Vedha AI** and already possesses an official logo (`vedha-logo.png`), but generic placeholders (e.g., letter "K" or generic icons) were being rendered instead.

## 2. Business Goal
1. **Frictionless Unified Authentication**: Seamlessly share the authentication state between the web application and the browser extension. If not connected, prompt the user with an in-extension login form and one-click demo access so their verified Master Resume and Profile data are always loaded.
2. **Robust LinkedIn Easy Apply Automation**: Follow a deterministic, user-aligned flow on LinkedIn:
   - If the Easy Apply modal popup is already open ➔ proceed with filling and advancing steps.
   - If not open, check if the "Easy Apply" button is present on the job post ➔ click it, wait for the modal to mount, and proceed.
   - If no Easy Apply button exists on the page (e.g., external application or already applied) ➔ cleanly inform the user and never click unrelated "Next" buttons on the page.
3. **Minimal, Aesthetic, Modern Design**: Redesign both the web app and extension to embody a calm, premium, minimalist aesthetic (inspired by Linear, Vercel, and Raycast) featuring the official `vedha-logo.png`, generous whitespace, refined typography, and zero visual clutter.

## 3. Scope
1. **Shared Authentication Engine**:
   - `frontend/src/stores/useAuthStore.ts` & `frontend/src/pages/AuthPages.tsx`: Broadcast auth tokens via window messaging upon login/token refresh so `content.js` on `localhost:3000` catches and stores it in `chrome.storage.local`.
   - `extension/content.js`: Auto-sync token from `localStorage` whenever `localhost:3000` is visited.
   - `extension/popup.js` & `extension/popup.html`:
     - Validate token with `GET http://localhost:5000/api/auth/me`.
     - If unauthenticated, display an aesthetic, minimal in-popup Login Card (Email, Password, Sign In, 1-Click Demo Login, Open Web App link).
     - Upon login, store token in `chrome.storage.local`, fetch real user profile (`/api/candidateprofile`), user info (`/api/auth/me`), and master resume (`/api/masterresume`).
     - Guard all auto-fill and auto-apply actions: prompt to login instead of using fake "Alex Rivera" data.
2. **LinkedIn Easy Apply Flow Correction**:
   - `extension/content.js`:
     - Fix `getTopLevelModal(el)`: Return `null` when element is not inside a modal, preventing buttons from acting as modal containers.
     - In `runAutonomousMultiStepFill` & `autoApplyLinkedInEasyApply`:
       - Check if Easy Apply modal is currently open. If yes, fill and proceed.
       - If modal is NOT open, find the Easy Apply button in the active job details/top-card. If found, click it naturally and wait for modal to open.
       - If no Easy Apply button exists and modal is not open, halt immediately with an informative message. Strictly prohibit matching page-level pagination or search navigation buttons.
3. **Minimalist Aesthetic Redesign**:
   - Web App (`frontend/`):
     - Replace generic letter placeholders with the official logo (`/vedha-logo.png`).
     - Refine `AppLayout`, `DashboardPage`, `TailorStudioPage`, `AuthPages`, and `TrackerPage` into a calm, elegant, uncluttered dark theme with soft rounded cards (`rounded-xl`), subdued borders (`border-white/[0.06]`), and focused visual hierarchy.
   - Extension (`extension/popup.html`, `extension/popup.js`):
     - Redesign the popup interface into a sleek, minimalist Raycast/Linear-style card.
      - Prominently display official `vedha-logo.png` and "Vedha AI".
      - Clean tabs, uncluttered action buttons, and clear feedback.
4. **Extension Theme Toggler & Single Logo Rules**:
   - Introduce a theme toggler in the extension header (☀️ / 🌙) to seamlessly switch between Dark theme and Light (White) theme.
   - Theme persistence: Selected theme must be saved to `chrome.storage.local.set({ vedha_theme })` and restored on popup launch.
   - Single-logo branding rule:
     - For White/Light theme: Use `vedha-logo.png` **only** (omit text "Vedha AI" next to the logo).
     - For Dark theme: Use `VedhaAI-Dark.png` **only** (omit text "Vedha AI" next to the logo).
   - Complete aesthetic CSS styling: Full CSS custom color properties for both themes (backgrounds, cards, borders, text, inputs, tabs, hover states, scrollbars, and buttons).
5. **Extension AI Orchestrator & Copilot Pipeline**:
   - Revert experimental LinkedIn auto-apply DOM restrictions to ensure broad portal compatibility.
   - Develop comprehensive AI Orchestrator in the extension connected to the backend pipeline:
     - **Copilot Journey & Package Prep**: Live Application Journey Stepper, active telemetry feedback, Review Gateway guardrail, and 1-Click "Queue Full Application Package" (`POST /api/orchestrator/prepare-package`) to stage tailored resume, cover letter, and screening answers directly into the backend queue.
     - **Live AI Match & ATS Gap Analyzer**: Live comparison between target job and active Master Resume (`POST /api/orchestrator/quick-match`), displaying fit percentage, matched core skills, and missing keywords.
     - **1-Click AI Tailored Cover Letter Pipeline**: Tailor cover letters with selectable tone via Gemini AI (`POST /api/orchestrator/quick-cover-letter`), with copy-to-clipboard and text export.

## 4. User Stories
- **As a job seeker**, I want the extension to automatically recognize that I am logged into Vedha AI on my browser, or give me a quick login form right inside the extension, so my real resume and contact details are filled into applications.
- **As a candidate**, I want an AI Orchestrator right inside the browser extension that instantly scores my ATS match against the open job listing and shows missing skills.
- **As a candidate**, I want a 1-click tailored Cover Letter generator powered by Gemini AI that drafts letters grounded in my actual Master Resume.
- **As a user**, I want to queue the open job into my full application pipeline with 1 click, generating a tailored resume package in the background.
- **As a user**, I want a calm, aesthetic, modern minimalist interface that looks premium and feels effortless to use without chaotic visual noise.
- **As a user**, I want to toggle between a clean Light theme and a modern Dark theme in the extension, with the logo dynamically switching between `vedha-logo.png` (light) and `VedhaAI-Dark.png` (dark) without redundant text.

## 5. Acceptance Criteria
- [ ] Extension popup checks auth state; if not logged in, displays a clean login view with email/password and 1-click demo login.
- [ ] Logging into the web app at `localhost:3000` automatically syncs session to extension.
- [ ] Extension loads candidate's actual name, email, and master resume rather than falling back to "Alex Rivera" when logged in.
- [ ] Auto-apply changes reverted to broad compatible automation flow.
- [ ] Theme toggler button in extension header switches between Dark and Light mode.
- [ ] Theme selection persists in `chrome.storage.local` across sessions.
- [ ] For Light (white) theme, `vedha-logo.png` is displayed as the sole logo in the header without accompanying text.
- [ ] For Dark theme, `VedhaAI-Dark.png` is displayed as the sole logo in the header without accompanying text.
- [ ] Extension features AI Match tab calculating real ATS score, keyword match, and skill gaps via `/api/orchestrator/quick-match`.
- [ ] Extension features Cover Letter tab generating tailored letters via `/api/orchestrator/quick-cover-letter`.
- [ ] Extension provides 1-click "Queue Full Application Package" calling `/api/orchestrator/prepare-package`.
- [ ] All elements seamlessly restyle between Dark and Light themes.
- [ ] Zero JavaScript syntax errors or styling regressions.

## 6. Changelog
### 2026-10-09T23:44:00+05:30 — Unified Web App & Extension Single-Logo Sizing & Theme Toggler System
- **Changes**: Enforced single-logo display across BOTH Web App (`AppLayout.tsx`, `AuthPages.tsx`) and Extension (`popup.html`, `popup.js`), completely removing redundant title text. Calibrated proportional sizing for `VedhaAI-Dark.png` (3:1 aspect ratio) and `vedha-logo.png` (1.5:1 aspect ratio). Integrated working Theme Toggler (`Sun` / `Moon`) into both applications.
- **Rationale**: User clarification to strictly render only the logo without title text on both dark and light modes, calibrating for differing aspect ratios and providing seamless theme toggling.
- **Impacted Components**: `frontend/src/components/layout/AppLayout.tsx`, `frontend/src/pages/AuthPages.tsx`, `extension/popup.html`, `extension/popup.js`.

### 2026-10-09T23:35:00+05:30 — Revert Auto-Apply & Implement Proper Extension AI Orchestrator Pipeline
- **Changes**: Reverted the LinkedIn-specific modal forcing change in `content.js` to preserve open portal compatibility; integrated a full-featured AI Orchestrator suite in the extension (`Copilot`, `AI Match`, `Cover Letter`, `Profile`, `Settings`) connected to backend `/api/orchestrator/*` endpoints.
- **Rationale**: User request to revert auto-apply changes while keeping everything else, and build a proper AI orchestrator and copilot pipeline for the extension.
- **Impacted Components**: `extension/content.js`, `extension/popup.html`, `extension/popup.js`.

### 2026-10-09T23:25:00+05:30 — Extension Theme Toggler & Single Logo Rules
- **Changes**: Added requirements for a complete Dark/Light theme switcher with persistence, and enforced single-logo rendering (`vedha-logo.png` for white theme, `VedhaAI-Dark.png` for dark theme) omitting separate brand text.
- **Rationale**: User request to enhance the extension design, provide full theme toggling functionality, and clean up the header by rendering only the official logo without redundant name text.
- **Impacted Components**: `extension/popup.html`, `extension/popup.js`, `extension/VedhaAI-Dark.png`.

### 2026-10-09T23:10:00+05:30 — Initial Specification
- **Changes**: Drafted requirements for shared extension-app authentication, LinkedIn Easy Apply detection fix, and minimalist aesthetic redesign.
- **Rationale**: User feedback identified disconnected extension login, erratic LinkedIn "Next" button clicking, and chaotic visual design.
- **Impacted Components**: `extension/popup.*`, `extension/content.js`, `frontend/src/components/layout/AppLayout.tsx`, `frontend/src/stores/useAuthStore.ts`, `frontend/src/pages/AuthPages.tsx`.
