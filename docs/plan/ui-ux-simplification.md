# Implementation Plan: UI/UX Simplification & Human-Centered Design

## Overview
Refactor the frontend user interface to replace overly futuristic, sci-fi, and developer-heavy jargon with intuitive, human-centered SaaS terminology, readable sans-serif typography, and modern rounded surfaces across all 6 core views.

## Step-by-Step Implementation

### Step 1: Refactor AppShell & Navigation (`frontend/src/components/layout/AppLayout.tsx`)
- Simplify Top Navigation Bar:
  - Brand: `Vedha AI` • `Career Operating System`.
  - Simple status pill: `Auto-Apply Active (3 jobs in progress)`.
  - Clean metrics: `Applications Sent: 412` • `Avg Match: 95%`.
  - Prominent primary action: `+ New Application`.
- Simplify Sidebar:
  - Friendly navigation items:
    - `Dashboard`
    - `Tailor Resume`
    - `Resume Studio`
    - `Auto-Apply Queue`
    - `Job Tracker`
    - `Master Resume`
    - `Candidate Profile`
    - `Analytics`
    - `Settings`
  - Footer status: `System Status: Operational` • `Latency: 14ms`.

### Step 2: Refactor Auth Gateway (`frontend/src/pages/AuthPages.tsx`)
- Convert to a clean, inviting, modern dual-pane layout:
  - Left pane: Clean value proposition ("Land Your Dream Job with AI", "Tailor resumes in seconds", "Automate job applications", "Boost ATS scores to 95%+"). Elegant ambient 3D visual or subtle graphic.
  - Right pane: Clean form with standard labels:
    - "Sign In to Your Account" / "Create Your Free Account"
    - "Email Address"
    - "Password"
    - "Full Name"
    - "Remember me"
    - Primary button: "Sign In" / "Create Account"
    - Demo Login button: "Try Demo Account (One Click)"
    - Clear tab switcher: "Sign In" | "Sign Up"

### Step 3: Refactor Dashboard (`frontend/src/pages/DashboardPage.tsx`)
- Replace confusing cards with standard executive metrics:
  - `Active Applications` (with live status)
  - `Applications Sent (7 Days)`
  - `Average Match Score`
  - `Interview Rate`
- Refactor controls:
  - `Pause Applications` (toggle instead of `[MASTER_KILL]`)
  - `Daily Limit` (slider / selector)
  - `Minimum Match Score`
  - `Scan for Jobs`
- Replace raw stdout terminal with a clean "Live Activity Feed" showing human-readable updates (e.g., "Tailored resume for Stripe", "Application submitted to Datadog").

### Step 4: Refactor Tailor Studio (`frontend/src/pages/TailorStudioPage.tsx`)
- De-clutter header and terminology:
  - Title: "Tailor Your Resume"
  - Subtitle: "Align your experience with any job description for maximum interview callback rates."
  - ATS Match Score card: "Job Match Score: 96%" with clear progress ring and explanation.
  - Skills breakdown: "Matching Skills" and "Skills to Highlight".
  - Bullet Comparison: "Optimized Resume Highlights" with clear visual diff badges ("Before" and "Optimized").

### Step 5: Refactor Orchestrator Queue (`frontend/src/pages/OrchestratorQueuePage.tsx`)
- Title: "Automated Job Applications"
- Remove `// EXT_V2.14_HOOK // ACTIVE`, `WS_BRIDGE`, `DOM_MUTATION_OBSERVER`.
- Header: Clear input: "Enter Job URL to Apply", "+ Add Custom Screening Answer", "Start Auto-Apply".
- Application Preview:
  - Target Job: Company Name, Role, Location.
  - "Match Score: 97%".
  - Candidate details: Name, Email, Resume Attached.
  - Pre-filled screening questionnaire in clean readable cards.
- Controls:
  - "Review Before Submitting" toggle.
  - "Run in Visible Browser" toggle.
  - Action button: "Submit Application" / "Confirm & Apply".
- Supported ATS list: Greenhouse, LinkedIn, Lever, Workday with clean "Ready" status.
- Applications Table: "Recent Applications" with clean column headers (Date, Job Title, Platform, Match Score, Status).

### Step 6: Refactor Result Studio (`frontend/src/pages/ResultStudioPage.tsx`)
- Title: "Tailored Resume & ATS Report"
- Clean toolbar: "Download PDF", "Download Word", "Generate Cover Letter", "Interview Prep".
- Template switcher: "Classic", "Modern", "Executive", "Technical".
- Clean 3-column layout: Reference Resume, Live Document Preview, and ATS Optimization Analysis.

### Step 7: Refactor Tailor Studio with Live Data Wiring (`frontend/src/pages/TailorStudioPage.tsx`)
- On mount: If `tailoredResult` is empty, check `tailorApi.getHistory()`. If available, fetch the latest tailored resume (`getById`) and populate the store.
- Render dynamic real target role, company, match score, and matching skills from `tailoredResult`.
- Render real bullet point diffs comparing `masterSchema.experience` and `tailoredSchema.experience` with filtering for keywords and metrics.
- For empty state (when user hasn't tailored any resume yet), render a clear, welcoming "Ready to Tailor" onboarding view with instructions and template selection.

### Step 8: Refactor Job Tracker (`frontend/src/pages/TrackerPage.tsx`)
- Remove sci-fi tags (`PIPELINE // 07`, `[ ${applications.length} POSITIONS ACTIVE ]`, `ADD APPLICATION`, `STAGE:`, `SAVE APPLICATION TO PIPELINE`).
- Use clean modern Title Case: `Saved`, `Applied`, `Interviewing`, `Offered`, `Archived`.
- Clean sans-serif typography, rounded cards, and friendly modal labels.

### Step 9: Refactor History & Session Verification (`frontend/src/pages/HistoryPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/ui/index.tsx`)
- `HistoryPage`: Remove `LEDGER // 08`, `[ ${history.length} EDITIONS ARCHIVED ]`, and `{idx} // ARCHIVE`. Clean badge and cards.
- `App.tsx`: Replace `[SYS.VERIFYING_SESSION...]` with clean branded "Vedha AI — Verifying session...".
- `components/ui/index.tsx`: Remove `DIALOG // OVERLAY` from Modal header.

### Step 10: Verify TypeScript & Build Frontend Container
- Run `podman build -t localhost/infra-frontend:latest -f infra/Dockerfile.frontend .`
- Restart `vedha-frontend`.
- Test `http://localhost:3000` to verify clean, responsive, human-friendly UX.

## Changelog
### 2026-10-09T22:50:00+05:30 — Initial Implementation Plan
- **Changes**: Drafted step-by-step refactoring plan for all 6 core frontend components.
- **Rationale**: User request to eliminate futuristic jargon and make UI effortless to navigate.
- **Impacted Components**: Frontend layouts, pages, and container build.

### 2026-10-09T23:00:00+05:30 — Live Data Binding & Secondary Pages Steps
- **Changes**: Added explicit steps for dynamic data binding in `TailorStudioPage`, simplification of `TrackerPage`, `HistoryPage`, and `App.tsx` session loader.
- **Rationale**: Complete full-stack frontend wiring and complete removal of all remaining sci-fi artifacts.
- **Impacted Components**: `TailorStudioPage`, `TrackerPage`, `HistoryPage`, `App`, `ui/index`.
