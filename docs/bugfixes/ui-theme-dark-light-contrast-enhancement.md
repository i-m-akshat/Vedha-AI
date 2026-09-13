# Bug Fix & UI Enhancement: Dark/Light Mode Theme & Contrast Unification

## Task Classification
**Bug Fix & Enhancement**

## 1. Overview & Problem Statement
In the Vedha AI frontend web application, container cards and input elements across several core pages (specifically `CandidateProfilePage.tsx` and `OrchestratorQueuePage.tsx`, as well as cards on `DashboardPage.tsx`, `HistoryPage.tsx`, `AnalyticsPage.tsx`, and `SettingsPage.tsx`) were rendering as blinding bright white blocks in Dark Mode and unstyled / low-contrast in Light Mode. Additionally, theme toggling did not cascade cleanly across all sub-components.

## 2. Root Cause Analysis
1. **Invalid Tailwind CSS Class Names**:
   - `CandidateProfilePage.tsx` and `OrchestratorQueuePage.tsx` were authored using pseudo-classes like `dark:bg-dark-800`, `dark:border-dark-700`, `dark:bg-dark-900`, and `dark:border-dark-600`.
   - The string `dark-*` was never declared or extended in `tailwind.config.js` palette (Tailwind uses `zinc`, `slate`, `gray`, `neutral`, `stone`).
   - Because `dark:bg-dark-800` produced no generated CSS rule, the browser fell back to the light default class `bg-white` and `bg-gray-50`, resulting in white boxes in dark mode.
2. **Missing `primary-*` Shade Scale**:
   - In `tailwind.config.js`, `primary` was defined only as a single object `{ DEFAULT: ..., foreground: ... }`.
   - Classes such as `bg-primary-600`, `text-primary-400`, `border-primary-500`, and `bg-primary-50` failed to resolve to valid CSS utility styles.
3. **Hardcoded Dark Palette on Studio & Settings Pages**:
   - Pages such as `DashboardPage.tsx`, `TailorStudioPage.tsx`, `ResultStudioPage.tsx`, `TrackerPage.tsx`, `SettingsPage.tsx`, `HistoryPage.tsx`, `AnalyticsPage.tsx`, and `PromptsPage.tsx` used hardcoded dark styles (e.g. `text-white`, `text-zinc-400`, `bg-zinc-950`, `border-zinc-800`) instead of semantic light/dark adaptive classes (`text-slate-900 dark:text-zinc-100`, `bg-white dark:bg-zinc-900`, `border-slate-200 dark:border-zinc-800`).
4. **Theme Store Hydration & Synchronization**:
   - `useThemeStore` in `useAuthStore.ts` toggled `.dark` on `document.documentElement`, but on certain initial page loads or navigations, the root class needed immediate synchronous mounting alongside `localStorage` hydration.

## 3. Proposed Solution
1. **Extend `tailwind.config.js` Palette**:
   - Configure rich, standard indigo and primary shade extensions (`primary-50` through `primary-950`) or alias `primary` to standard indigo so all components using `primary-*` or `indigo-*` render with pixel-perfect gradients and accents.
   - Support semantic CSS tokens (`background`, `foreground`, `card`, `card-foreground`, `border`, `input`, `ring`).
2. **Refactor `frontend/src/components/ui/index.tsx`**:
   - `Card`: Semantic container with clean borders and surface elevation in both light (`bg-white border-slate-200 shadow-sm text-slate-900`) and dark mode (`dark:bg-zinc-900/80 dark:border-zinc-800 dark:text-zinc-100`).
   - `Input` & `Textarea`: High readability in light mode (`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-indigo-500`) and dark mode (`dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500`).
   - `Badge` & `Modal`: Cohesive contrast, vibrant status chips, backdrop blur, and crisp close icons.
3. **Refactor All Pages**:
   - Update `CandidateProfilePage.tsx` & `OrchestratorQueuePage.tsx` from invalid `dark-*` classes to standard, semantic `dark:bg-zinc-900`, `dark:border-zinc-800`, `dark:bg-zinc-950`, `dark:text-zinc-100`.
   - Update `DashboardPage.tsx`, `TailorStudioPage.tsx`, `ResultStudioPage.tsx`, `TrackerPage.tsx`, `HistoryPage.tsx`, `AnalyticsPage.tsx`, `PromptsPage.tsx`, `SettingsPage.tsx`, `AuthPages.tsx` to support both light and dark themes beautifully.
4. **Harden Theme Synchronization**:
   - Ensure `useThemeStore` initializes `.dark` immediately and keeps `document.documentElement` synchronized on every mount and change.

## 4. Affected Components
- `frontend/tailwind.config.js`
- `frontend/src/index.css`
- `frontend/src/stores/useAuthStore.ts`
- `frontend/src/components/ui/index.tsx`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/pages/CandidateProfilePage.tsx`
- `frontend/src/pages/OrchestratorQueuePage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/TailorStudioPage.tsx`
- `frontend/src/pages/ResultStudioPage.tsx`
- `frontend/src/pages/TrackerPage.tsx`
- `frontend/src/pages/HistoryPage.tsx`
- `frontend/src/pages/AnalyticsPage.tsx`
- `frontend/src/pages/PromptsPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/AuthPages.tsx`

## 5. Risk Assessment & Mitigations
- **Regression Risk**: Low. Styling adjustments are purely presentation layer.
- **Visual Contrast Risk**: All text and background colors are mapped to WCAG AA/AAA compliant contrast ratios in both themes (slate/zinc palette).

## 6. Test & Verification Strategy
1. Run `npm run build` locally in `frontend/` to ensure zero TypeScript or Vite bundle errors.
2. Verify light mode and dark mode rendering across all 11 views.
3. Rebuild frontend container using Podman compose.

## Changelog
- **2026-09-12**: Documented root cause of invalid `dark-*` classes and missing `primary-*` definitions causing white containers in dark mode. Planned comprehensive theme unification across all pages.
- **2026-09-12**: Diagnosed `502 Bad Gateway` caused by `connect() failed (113: Host is unreachable)` when Nginx cached stale backend container IP address (`10.89.0.7`) across container restarts. Updated `infra/nginx.conf` with dedicated `upstream backend_api` block, keepalive connections, and documented container lifecycle synchronization.
- **2026-09-12 (Final Audit)**: Conducted full codebase audit. Fixed the following issues:
  1. **`infra/nginx.conf`**: Added `/swagger/` proxy location block to forward Swagger UI JSON requests to the backend API. Previously, Swagger UI returned `500 Internal Server Error` when fetching `/swagger/v1/swagger.json` because Nginx served static files for that path.
  2. **`backend/src/ResumeTailor.WebApi/Program.cs`**: Removed `|| true` shortcircuit that forced Swagger to run in all environments including production containers. Replaced with controlled `ENABLE_SWAGGER` environment variable flag. Also updated `infra/docker-compose.yml`, `infra/.env`, and `infra/.env.example` to expose and synchronize this new variable.
  3. **`frontend/src/components/layout/AppLayout.tsx`**: Fixed invalid Tailwind class `py-0.2` (not in scale) → `py-0.5`. Replaced brittle `activePage.replace('-', ' ')` (only replaces first hyphen, drops `&` in compound names) with a proper page label lookup map.
  4. **`frontend/src/pages/MasterResumePage.tsx`**: Replaced two `alert()` browser popup calls with inline `inlineError` state + dismissible rose banner. Added `fetchVersions()` call on version modal open so the list is always fresh.
  5. **`frontend/src/pages/ResultStudioPage.tsx`**: Replaced `alert('Download failed.')` with inline `downloadError` state + dismissible banner.
