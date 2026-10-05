# Implementation Plan: Comprehensive Extension UI & In-Page Floating Copilot (Price Hatke Style)

## Step-by-Step Implementation Roadmap

### 1. Backend Quick-Action Endpoints (`backend/src/ResumeTailor.WebApi/Controllers/OrchestratorAndProfileControllers.cs`)
- Add `POST /api/orchestrator/quick-match`:
  - Input: `{ jobTitle, company, jobDescription }`
  - Computes ATS Match % using `IAtsScoringEngine.CalculateScore()` against the authenticated user's Master Resume.
  - Returns: `{ atsScore, matchedSkills, missingSkills, breakdown }`.
- Add `POST /api/orchestrator/quick-cover-letter`:
  - Input: `{ jobTitle, company, jobDescription, tone }`
  - Grounded using Gemini with candidate profile and job requirements.
  - Returns: `{ coverLetter, company, role }`.

### 2. Overhaul Extension Popup Layout & CSS (`extension/popup.html`)
- Expand width to 380px, responsive height with smooth dark theme (`#09090b`).
- Top Bar: Brand header with connection indicator (`● Connected`) and Daily Safety Quota badge (`🛡️ Safe: X/25`).
- Navigation Tabs:
  - `⚡ Copilot` (Active job, Easy Apply, Universal Safe Fill, Studio Link)
  - `🎯 ATS Fit` (Real-time ATS Match %, Matched Skills, Missing Keywords)
  - `📝 Cover Letter` (1-Click AI Cover Letter generator with copy & download)
  - `👤 Profile` (Candidate profile fields with 1-click clipboard copy)
- Universal Default State: If no job is detected, display "Universal Careers Mode" with full access to all features rather than blocking UI.

### 3. Redesign Popup Logic & Client-Side Resilience (`extension/popup.js`)
- Fetch token from local storage or probe `localhost:3000`.
- Fetch `candidateProfile`, `masterResume`, and `auth/me` on startup.
- Tab switching logic with smooth state persistence.
- ATS Fit computation (queries `/api/orchestrator/quick-match` or computes direct lexical overlap fallback).
- Cover Letter generation (queries `/api/orchestrator/quick-cover-letter` or `/api/tools/cover-letter`).
- 1-Click Clipboard copy for candidate identity fields.
- Universal Safe Fill and LinkedIn Easy Apply handlers.

### 4. Overhaul In-Page Floating Assistant Widget (`extension/content.js`)
- Replace the rigid LinkedIn-only pill with an expandable floating dock (Price Hatke / Buyhatke style):
  - Injects on LinkedIn, Greenhouse, Lever, Ashby, Workday, Indeed, and general career sites.
  - Collapsed: Sleek floating pill at bottom-right (`⚡ Vedha Copilot`).
  - Expanded: Floating card with:
    - Detected Job Title & Company
    - `⚡ Auto-Apply (LinkedIn Easy Apply)`
    - `🤖 Universal Safe Biometric Auto-Fill`
    - `🎯 Check ATS Match` (displays overlay badge with score)
    - `✨ Open in Vedha Studio`
    - Minimize / Close toggle.

### 5. Verification & Testing
- Validate syntax using `node --check extension/popup.js` and `node --check extension/content.js`.
- Test backend endpoints with `dotnet test` and live `curl`.
- Verify popup rendering and floating dock behavior.
- Document changes in `context.md`.

## Changelog
- **2026-10-06T01:46:00+05:30**: Implementation plan finalized for comprehensive extension UI overhaul and Price Hatke-style floating copilot widget.
