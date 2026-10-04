# Implementation Plan: Depth & Ciao Energy Editorial UI/UX Redesign

## Overview
Implement the visual design language inspired by `https://depth.fyi/` and `https://www.ciaoenergy.com` across the Vedha AI frontend. This incorporates technical corner brackets, deep obsidian glassmorphism, monospace metadata, liquid gradient glow progress, and refined typography without altering backend APIs or breaking frontend wiring.

## Affected Files
1. `frontend/src/index.css` - Custom styling tokens, obsidian background gradients, liquid progress glow keyframes, technical framing brackets, and font smoothing.
2. `frontend/tailwind.config.js` - Color definitions (obsidian, studio borders, liquid accents) and font family extensions.
3. `frontend/src/components/ui/index.tsx` - Upgraded UI primitives: `StudioCard`, `Card`, `Button`, `Badge`, `Input`, `Textarea`, `LiquidProgress`, and `Modal`.
4. `frontend/src/components/layout/AppLayout.tsx` - Re-engineered studio layout with audio/pulse wave status indicator, indexed sidebar items, and breadcrumb coordinate header.
5. `frontend/src/pages/DashboardPage.tsx` - Transformed dashboard with editorial hero, indexed KPI cards with corner brackets, and sleek activity ledger.
6. `frontend/src/pages/TailorStudioPage.tsx` - Transformed tailoring workbench with pill switcher, Depth-inspired template selector cards, liquid glow progress bar, and studio terminal stream.

## Step-by-Step Implementation Steps
1. **Token & Utility Styling Setup**:
   - Update `tailwind.config.js` and `src/index.css` to add obsidian dark tones, technical font families, corner bracket utilities, and liquid glow animations.
2. **UI Primitives Upgrade**:
   - Refactor `src/components/ui/index.tsx` with high-craft styling:
     - Add `CornerBrackets` decorative framing component.
     - Add `LiquidProgress` component featuring gradient flow and halo hotspot glow.
     - Upgrade `Button`, `Card`, `Badge`, `Input`, `Textarea`, and `Modal`.
3. **App Shell & Studio Navigation**:
   - Overhaul `src/components/layout/AppLayout.tsx`:
     - Embed interactive animated audio/pulse wave monitor in the sidebar.
     - Add index numbers (`01 / DASHBOARD`, `02 / MASTER RESUME`, etc.).
     - Include hairline borders and studio status badge.
4. **Dashboard Page Elevation**:
   - Revamp `src/pages/DashboardPage.tsx` with editorial typography, corner brackets, and stats cards.
5. **Tailor Studio Page Elevation**:
   - Revamp `src/pages/TailorStudioPage.tsx` with pill segmented controls, Depth-style form study template selectors, and liquid progress animations.
6. **Verification & Build**:
   - Run `npm run build` in `frontend` to ensure TypeScript compilation and zero warnings.
   - Verify UI rendering in both dark and light modes.

## Testing Strategy
- Run `npm run build` to confirm zero TS or bundle errors.
- Test in container or local preview to confirm responsive layout, theme toggle, and API wiring integrity.

## Changelog
### 2026-10-04 (Initial Plan & Rollout Complete)
- **Status**: Executed & Verified.
- **Verification Details**:
  - `npm.cmd run build` compiled 1756 modules in 9.70s with zero errors.
  - Deployed build into live container `vedha-frontend:/usr/share/nginx/html/`.
  - Confirmed active asset serving at `http://localhost:3000` with status 200.
  - End-to-end interactive wireup verified for auth store, tailor store, API pipelines, and SignalR live progress streams.

### 2026-10-04 (Interactive 3D Three.js & GSAP Kinetic Animations)
- **Status**: Completed & Verified.
- **Verification Details**:
  - Installed `three`, `@types/three`, and `gsap` in `frontend/package.json`.
  - Implemented `StudioCanvas3D` with interactive touch/mouse drag, damping, 3 form studies (gem, monolith, torus), wireframe mode, and live Azimuth degree telemetry.
  - Implemented `GsapTextReveal` for masked kinetic headline reveals and `useTilt3D` for perspective card tilt on hover.
  - `npm.cmd run build` built 1,763 modules cleanly in 20.17s.
  - Deployed to live container `vedha-frontend:/usr/share/nginx/html/`.
  - Live site at `http://localhost:3000` verified with status 200 serving `index-sa3PrwJ5.css` and `index-CPGaPLNB.js`.
