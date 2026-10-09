# Feature Specification: UI/UX Simplification & Human-Centered Design

## Problem Statement
The previous "Pixel Brutalist Precision / Kinetic Operational Console" design system introduced confusing cyberpunk/futuristic jargon (`// EXT_V2.14_HOOK // ACTIVE`, `WS_BRIDGE`, `DOM_MUTATION_OBSERVER`, `OPERATOR_ID`, `PASSKEY_HASH`, `[MASTER_KILL]`, `DYNAMIC_INJECT`, `FIELD HEURISTICS [ 42/42 SOLVED ]`, `QUANTUM MATCH`). 

This creates severe cognitive overload for end users, candidates, and hiring managers who want an intuitive, frictionless career copilot. Users must not spend unnecessary mental effort deciphering developer or sci-fi terminology.

## Business Goal
Transform the user interface into a clean, modern, accessible, and intuitive enterprise SaaS experience. Every label, button, metric, and workflow must be immediately understandable by any job seeker or business client on first glance, while preserving 100% of the underlying AI tailoring, NATS JetStream, and browser automation capabilities.

## Scope
1. **Human-Friendly Terminology**:
   - Replace raw terminal and futuristic developer jargon across all screens with clear, industry-standard terms.
   - Example mappings:
     - `> OPERATOR_ID` ➔ `Email Address`
     - `> PASSKEY_HASH` ➔ `Password`
     - `[SIGN IN] / [REGISTER]` ➔ `Sign In / Create Account`
     - `[MASTER_KILL]` ➔ `Pause Auto-Apply`
     - `DAILY_CAP: 50/DAY` ➔ `Daily Limit: 50`
     - `MIN_ATS: 88%` ➔ `Minimum Match: 88%`
     - `FORCE_SWEEP` ➔ `Scan for Jobs`
     - `// PIPELINE_STREAM` ➔ `Active Applications`
     - `// STDOUT_INSPECTOR` ➔ `Application Activity Log`
     - `ATS QUANTUM MATCH` ➔ `ATS Match Score`
     - `EXECUTE AUTO-APPLY SEQUENCE` ➔ `Start Application / Submit Application`
     - `// CONTROL RAILS` ➔ `Main Navigation`
2. **Typography & Visual Design Simplification**:
   - Replace dense uppercase monospace headers with clean, elegant typography using `Inter` and `Geist`.
   - Use comfortable, modern rounded surfaces (`rounded-xl`, `rounded-lg`, `rounded-2xl`) with clean subtle borders (`border-zinc-800/80`).
   - Retain dark mode elegance with clear visual hierarchy, soft shadows, and high readability.
   - Keep the 3D visual component on the login page as an ambient, non-intrusive backdrop with clear, focused form controls.
3. **Screens Affected**:
   - Navigation & Shell: `frontend/src/components/layout/AppLayout.tsx`
   - Auth Gateway: `frontend/src/pages/AuthPages.tsx`
   - Dashboard: `frontend/src/pages/DashboardPage.tsx`
   - Tailor Studio: `frontend/src/pages/TailorStudioPage.tsx` (Complete live data binding for target role, ATS score, keywords, and master vs. tailored bullet diff)
   - Orchestrator Queue: `frontend/src/pages/OrchestratorQueuePage.tsx`
   - Result Studio: `frontend/src/pages/ResultStudioPage.tsx`
   - Job Application Tracker: `frontend/src/pages/TrackerPage.tsx`
   - Resume History: `frontend/src/pages/HistoryPage.tsx`
   - Session Verification & Dialogs: `frontend/src/App.tsx`, `frontend/src/components/ui/index.tsx`

## Out of Scope
- Backend API contract modifications (all endpoints remain untouched).
- Database migrations or schema updates.

## User Stories
- **As a job seeker**, I want to see clear, everyday language on buttons and form inputs so that I can apply to jobs without feeling confused.
- **As a user**, I want the Tailor Studio to immediately display my real tailored resume, real job title, match score, and actual before/after bullet improvements rather than static mock examples.
- **As a client**, I want a sleek, premium, modern SaaS design that feels trustworthy, intuitive, and responsive.
- **As an operator**, I want simple controls like "Pause Applications" and "Daily Limit" that are self-explanatory.

## Acceptance Criteria
- [ ] No futuristic or sci-fi developer jargon appears on user-facing buttons, titles, or form fields.
- [ ] Typography uses clean sans-serif (`Inter` / `Geist`) for all primary UI elements across all pages.
- [ ] Tailor Studio binds 100% to live `tailoredResult` or latest history item, displaying real role, company, match score, keywords, and actual bullet diffs.
- [ ] Buttons are clearly styled as clickable action buttons with intuitive verbs.
- [ ] All pages pass TypeScript type checking (`tsc --noEmit`) with 0 errors.
- [ ] Production frontend container builds cleanly and serves the simplified UI on `http://localhost:3000`.

## Changelog
### 2026-10-09T22:50:00+05:30 — Initial Specification
- **Changes**: Defined UI/UX simplification scope, terminology mapping table, and typography standards.
- **Rationale**: User feedback requested removing futuristic and confusing jargon to make the app effortless to use.
- **Impacted Components**: `AppLayout`, `AuthPages`, `DashboardPage`, `TailorStudioPage`, `OrchestratorQueuePage`, `ResultStudioPage`.

### 2026-10-09T23:00:00+05:30 — Live Data Binding & Secondary Pages Simplification
- **Changes**: Added explicit requirements for live backend data binding in `TailorStudioPage` (removing static mock Vercel text, dynamically computing bullet diffs from `masterSchema` and `tailoredSchema`, loading latest history if available). Added UI simplification for `TrackerPage`, `HistoryPage`, and `App.tsx` session verification.
- **Rationale**: User requested both complete UI wiring to backend and complete simplification across the entire application.
- **Impacted Components**: `TailorStudioPage`, `TrackerPage`, `HistoryPage`, `App`, `ui/index`.
