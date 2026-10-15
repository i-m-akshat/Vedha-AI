# Bug Fix Plan & Root Cause Analysis: Cross-Page Hardcoded Dark Surfaces & Contrast Decoupling

## 1. Problem Statement & User Observation
When switching the application to Light Mode via the global theme toggle, the root container appropriately adopted the warm cream/alabaster canvas (`#FAF8F5`). However, six key pages across the platform retained solid jet-black and charcoal card surfaces (`#111216`, `#16181f`, `#121215`), causing severe aesthetic dissonance:
1. **Resume Tailor Studio (`TailorStudioPage.tsx`)**: Header card, target role card, ATS match score gauge, and bullet diff panels were rendered in pitch-black `#111216` with low-contrast or hardcoded white text (`text-white`), rendering headings such as "Resume Enhancements & Changes" unstyled or jarring.
2. **Resume Result Studio (`ResultStudioPage.tsx`)**: Master candidate profile summary column, ATS Scorecard, Matched Keywords, Recruiter AI Feedback, Cover Letter Modal, and Interview Coach modal cards were all hardcoded dark.
3. **Auto-Apply Queue (`OrchestratorQueuePage.tsx`)**: Header card, candidate pre-filled details, application controls, supported job platforms, and recent applications table had hardcoded dark backgrounds (`#111216` and `#16181f`).
4. **Ask Aksh AI Chat (`AskAkshPage.tsx`)**: Right-hand "Review Gate" card was hardcoded to `bg-[#121215]` with white text.
5. **Job Application Tracker (`TrackerPage.tsx`)**: Top header card was hardcoded to `bg-[#111216] border border-[#23252b]`, clashing sharply with the light Kanban columns.
6. **Resume History & Versions (`HistoryPage.tsx`)**: Header card, every version card, and the empty state card were hardcoded to `bg-[#111216]`.
7. **Authentication Pages (`AuthPages.tsx`)**: Value proposition cards, interactive 3D matrix card, and feature highlight cards had un-prefixed `#16181f` dark styling.

---

## 2. Root Cause Analysis
During earlier iterations of the UI, individual developers styled components using static Tailwind arbitrary value classes:
```tsx
// Anti-pattern: Hardcoded dark background without dual-mode responsive prefix
<div className="p-6 rounded-2xl bg-[#111216] border border-[#23252b] text-white">
```
Because Tailwind CSS relies on class-based dark mode (`<html class="dark">`), classes without the `dark:` prefix are treated as base (Light Mode) styles. Consequently:
- In **Dark Mode**: The base `#111216` happened to look acceptable because the background was dark.
- In **Light Mode**: The page background transitioned to cream `#FAF8F5`, but the cards remained jet-black with white text.

---

## 3. Architecture Solution & Pattern Implementation
All hardcoded background classes were refactored to responsive tokens following the Autumn design system:

| Role | Previous Class | Responsive Refactored Class |
|---|---|---|
| **Primary Cards** | `bg-[#111216] border-[#23252b]` | `bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm` |
| **Nested Sub-Cards / Inputs** | `bg-[#16181f] border-[#2a2d36]` | `bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06]` |
| **Primary Headings** | `text-white` | `text-zinc-900 dark:text-white` |
| **Subtitles / Labels** | `text-[#8e929b]` | `text-zinc-500 dark:text-zinc-400` |
| **Body / Answers** | `text-[#c4c7d0]` | `text-zinc-700 dark:text-zinc-300` |
| **Primary Action Buttons** | `bg-indigo-600 hover:bg-indigo-500` | `bg-[#D9704F] hover:bg-[#C85F3E] text-white shadow-sm` |
| **Table Dividers** | `border-[#23252b] divide-[#1c1e26]` | `border-black/[0.06] dark:border-white/[0.08] divide-black/[0.04] dark:divide-white/[0.06]` |

---

## 4. Files Affected
- `frontend/src/pages/TailorStudioPage.tsx`
- `frontend/src/pages/ResultStudioPage.tsx`
- `frontend/src/pages/OrchestratorQueuePage.tsx`
- `frontend/src/pages/AskAkshPage.tsx`
- `frontend/src/pages/TrackerPage.tsx`
- `frontend/src/pages/HistoryPage.tsx`
- `frontend/src/pages/AuthPages.tsx`

---

## 5. Verification & Testing
1. **Grep Audit**: Scanned all `frontend/src/pages/*.tsx` for raw instances of `#111216`, `#16181f`, `#121215`. Verified 100% of remaining instances are strictly prefixed by `dark:`.
2. **TypeScript Compilation**: Ran `tsc` type-checking via `npm run build` — 0 errors found.
3. **Vite Production Bundler**: Built clean production bundle in 16.48s (1,770 modules transformed).
