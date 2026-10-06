# Feature Specification: AI-Driven Multi-Step Autonomous Form Agent & Modern Extension Redesign

## 1. Overview
This feature transforms the Vedha AI Chrome Extension into a next-generation Career Operating System Copilot inspired by the premier UX standards of **Simplify Jobs (Simplify Copilot)**, **Teal HQ**, and **Raycast / Linear**. 

It introduces:
1. **A Complete Modern Visual Overhaul**: A glassmorphic obsidian interface featuring polished typography, animated micro-steppers, glowing telemetry badges, and live agent thinking indicators.
2. **DOM-Agentic Multi-Step Form Automation**: An autonomous observe-decide-act loop that inspects the live page/modal DOM, pre-fills answers with Gemini AI grounding and biometric anti-ban jitter, intelligently identifies progression buttons ("Next", "Continue", "Save & Proceed", "Review", "Submit"), executes natural clicks, waits for page transitions, and loops across multi-page application portals (Workday, Greenhouse, Lever, Ashby, Indeed, LinkedIn Easy Apply, and custom career portals).
3. **Review Gateway & Anti-Ban Guardrails**: A candidate safety gateway that pauses on the final submission page with a glowing confirmation HUD, error backoff detection, and CAPTCHA/Cloudflare challenge pauses.

---

## 2. Business Goal
Candidates spend hours manually clicking through repetitive 4-to-8 page job portal forms. Traditional autofill extensions fill only the first page and fail when portals use dynamic SPAs, multi-step wizards, or custom Next buttons. By delivering a Simplify-grade autonomous multi-step copilot with human-in-the-loop review, Vedha AI drastically reduces application fatigue while safeguarding candidate accounts against bot detection.

---

## 3. UI References & Inspirations
Drawing from industry benchmarks:
- **Simplify Jobs**: Floating interactive pill, step progress breadcrumbs (`[1. Info] ➔ [2. Experience] ➔ [3. Screening] ➔ [4. Review]`), live status telemetry (`Filling fields...` ➔ `Clicking Next...`), and Review Gateway.
- **Teal HQ**: High-contrast dark theme, crisp typography (Inter/SF Pro Display), glowing emerald/indigo status dots, and instant profile quick-copy cards.
- **Raycast / Linear**: Deep obsidian background (`#09090b`), translucent acrylic glassmorphism (`backdrop-filter: blur(16px)`), micro-borders (`rgba(255, 255, 255, 0.08)`), and keyboard-friendly micro-interactions.

---

## 4. User Stories
- **As a job seeker**, I want to click one button on any career portal and have Vedha AI auto-fill the current form page, click "Next" or "Continue", and proceed through all stages automatically so that I do not have to perform repetitive manual data entry.
- **As a job seeker**, I want the extension to stop and show me a clear Review Screen before hitting the final "Submit" button so that I can inspect everything before my application is submitted.
- **As a candidate**, I want the extension interface to look sleek, modern, and transparent about what the AI is thinking and doing in real-time.

---

## 5. Acceptance Criteria
- [x] **Modern UI/UX**: Extension popup (`popup.html`) and floating content widget (`content.js`) match modern glassmorphic styling with clear tabs, live step visualizer, and agent status telemetry.
- [x] **Autonomous Multi-Step Loop**: Extension handles multi-page application forms across LinkedIn Easy Apply, Greenhouse, Lever, Ashby, Workday, and generic web portals.
- [x] **AI Progression Button Locator**: Intelligent button selector detects "Next", "Save & Continue", "Proceed", "Review Application", and "Submit" even with atypical markup.
- [x] **Error & Validation Back-Off**: If a portal flags a required field or validation error upon clicking Next, the loop pauses, highlights the field in amber, and notifies the user instead of infinitely clicking.
- [x] **Review Gateway**: Final submission screen is halted by default in Copilot Mode, prompting the user for 1-click confirmation.
- [x] **Biometric Jitter**: Typing and clicking utilize natural micro-delays (30-90ms) and bezier cursor movements to prevent anti-bot detection.

---

## 6. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Browser Page [Candidate Application Portal]
        A[Interactive Form DOM] -->|Extract Visible Elements & Action Buttons| B[Semantic DOM Snapshot]
    end

    subgraph Content Script [content.js Autonomous Engine]
        B --> C[Candidate Field Matcher & Gemini Answer Grounder]
        C --> D[Humanized Biometric Keystroke Jitter]
        D --> E[Form Validation & Unanswered Check]
        E --> F[Next / Review / Submit Button Discovery]
        F --> G{Button Type?}
        G -- "Next / Continue" --> H[Click Naturally & Wait for DOM Mutation]
        H -->|Next Page Loaded| A
        G -- "Review / Submit" --> I[Review Gateway: Pause for User Confirmation]
        G -- "Submit (Auto Mode)" --> J[Click Submit & Sync Status]
    end

    subgraph Extension Popup [popup.html / popup.js UI]
        K[Modern UI: Simplify & Raycast Style] -->|Trigger Autonomous Auto-Fill| Content Script
        Content Script -->|Broadcast Live Step & Thoughts| K
    end
```

---

## 7. Edge Cases & Mitigations
1. **Dynamic Client-Side SPAs**: Buttons might not immediately navigate; the runner monitors DOM mutations and spinner elements with exponential backoff (up to 5s).
2. **Honeypot Fields**: Hidden input traps designed to detect bots are strictly filtered out using computed visibility and keyword exclusion.
3. **WAF & Cloudflare Turnstile**: If a challenge appears, the automation halts and displays the Human Verification Gateway banner.
4. **Infinite Loop Protection**: All multi-step runs are bounded by a hard ceiling of 12 steps.

---

## ## Changelog
- **Date & Timestamp**: 2026-10-06T13:22:00+05:30
- **Changes Made**: Initial Feature Specification created for AI-Driven Multi-Step Autonomous Form Agent and Simplify/Teal-inspired Modern Extension UI.
- **Rationale ("Why")**: User requested enhancing the extension look based on similar market-leading extensions and enabling AI auto-fill to autonomously advance through multi-page portals by clicking Next and submitting with a Review Gateway.
- **Impacted Components**: `extension/popup.html`, `extension/popup.js`, `extension/content.js`.

- **Date & Timestamp**: 2026-10-06T14:04:00+05:30
- **Changes Made**: Extended architecture with Intelligent Self-Healing Validation Error Remediation Engine (`findActiveValidationErrors`, `remediateValidationErrors`, `queryGeminiForValidationError`).
- **Rationale ("Why")**: User identified that when forms display validation errors (e.g., numbers only, 10-digit phone, currency symbols, required selections), autofill must detect the error, understand the constraint, modify the value, re-apply it biometrically, and clear the error across Autonomous Fill, Easy Apply, and Single-Page Safe Fill.
- **Impacted Components**: `extension/content.js`, `extension/popup.js`.

- **Date & Timestamp**: 2026-10-06T15:05:00+05:30
- **Changes Made**: Autonomous Auto-Apply, Content Script Injection & Candidate Data Resilience:
  - Eliminated global false-positive "Already Applied" exit condition by scoping check strictly to target job card and modal absence.
  - Implemented top-level modal hierarchy locator `getTopLevelModal(el)` enclosing both inputs and modal footer action buttons.
  - Added programmatic content script injection fallback (`sendMessageToActiveTab`) when tabs are not yet connected.
  - Added comprehensive fallback heuristics for screening questions, required radios, consent checkboxes, and dropdowns.
  - Persisted candidate profile into `chrome.storage.local` with rich default fallback to eliminate empty field starvation.
- **Rationale ("Why")**: User reported that autonomous auto-apply was not working at all due to connection drops, false-positive applied exits, and blank profile data starvation when backend is offline.
- **Impacted Components**: `extension/content.js`, `extension/popup.js`.

