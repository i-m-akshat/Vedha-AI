# Feature Specification: Depth & Ciao Energy Editorial UI/UX Redesign

## Problem Statement
The current Vedha AI user interface uses a standard dashboard look with conventional border radii, plain card containers, and basic button styling. While functional, it lacks the high-craft, tactile, studio-grade aesthetic demonstrated in cutting-edge references such as `https://depth.fyi/` (dark studio lighting, technical typography, hairline borders, sculptural pill tabs, monospace coordinate accents) and `https://www.ciaoenergy.com` (technical framing brackets, pulse monitors, liquid gradient progress indicators, micro-caps metadata tags `[ × ... ]`, and editorial typography). The user requested an exact design language transformation inspired by these references without breaking existing UI functionality or wiring.

## Business Goal
Elevate Vedha AI from a generic dashboard to an elite, studio-grade "AI Career Operating System" that feels premium, professional, and visually captivating, increasing user trust, engagement, and satisfaction while maintaining 100% operational reliability.

## Scope
1. **Design System & Typography Tokens**:
   - Palette: Deep obsidian/onyx tones (`#050508`, `#09090c`, `#0e0f14`), translucent glass (`backdrop-blur-xl`), hairline borders (`border-white/[0.08]` to `border-white/[0.14]`).
   - Technical Accents: JetBrains Mono metadata tracking, corner brackets (`┌ ┐ └ ┘`), cross-marker badges (`[ × TRUTH-PRESERVED ]`), and index counters (`01 / TOTAL APPLICATIONS`).
   - Lighting & Atmospheric Effects: Subtle radial specular gradients, liquid progress indicators with glow halos and hotspots.
2. **Component Library Elevation (`src/components/ui/index.tsx`)**:
   - `StudioCard` / `Card` with technical corner brackets and translucent glass layering.
   - `Button` with Depth-inspired pill styling, hairline gradient borders, and smooth tactile states.
   - `Badge` with technical monospace brackets, status dots, and high-contrast styling.
   - `Input` & `Textarea` with monospace technical coordinates and subtle focus halos.
   - `LiquidProgress` component inspired by Ciao Energy's glowing gradient progress bar.
   - `Modal` updated with studio-grade dialog styling.
3. **Application Shell & Navigation (`src/components/layout/AppLayout.tsx`)**:
   - Brand header with animated pulse monitor bars (inspired by Ciao Energy's sound wave indicator).
   - Sidebar with index numbers (`01`, `02`, `03`...), active pill glow, and technical status tags.
   - Studio header with breadcrumb coordinate tags (e.g., `STUDIO // TAILOR [04]`), live AI model indicator, and theme toggler.
4. **Key Feature Views Transformation**:
   - `DashboardPage.tsx`: Hero studio banner, technical KPI cards with corner brackets, and application activity ledger.
   - `TailorStudioPage.tsx`: Studio workbench, segmented pill controls, interactive template edition cards (`01 / CLASSIC ATS`), liquid progress indicator, and live terminal stream.
   - Preservation of all API calls, SignalR notifications, forms, and state management.

## Out of Scope
- Backend API modifications (backend endpoints remain unchanged).
- Database schema changes.

## User Stories
- **As an applicant**, I want the UI to feel like an elite, high-end studio tool so that creating tailored resumes feels precise, modern, and inspiring.
- **As a candidate**, I want all generation progress, ATS feedback, and application workflows to remain fully functional and intuitive during and after the visual overhaul.

## Functional Requirements
1. Every interactive element (buttons, tabs, inputs, dropdowns) must remain wired to its underlying store or API method.
2. The UI must support both Dark mode (primary studio aesthetic) and Light mode gracefully without contrast degradation.
3. Corner brackets, monospace tags, and liquid animations must render cleanly without layout jitter.
4. The SignalR progress updates and tailoring workflow must smoothly drive the glowing liquid progress bar.

## Non-Functional Requirements
- **Performance**: Zero lag or layout shifts; GPU-accelerated CSS transitions; bundle size impact under 25KB.
- **Accessibility**: High contrast ratios on all text elements; keyboard focus outlines with subtle glow.
- **Maintainability**: Clean component abstractions in `src/components/ui` without spaghetti inline styles.

## Edge Cases
- Long job titles or company names in cards must truncate gracefully with ellipsis.
- Small screens and mobile devices must wrap or hide decorative corner brackets to maintain clean spacing.
- Dark/light mode switching must preserve crisp borders and text readability.

## Changelog
### 2026-10-04 (Initial Spec & Implementation Complete)
- **Changes Made**:
  1. Overhauled tokens in `frontend/tailwind.config.js` and `frontend/src/index.css` (JetBrains Mono tech typography, deep obsidian surfaces `#050508`, hairline borders, liquid gradient keyframes, and sound wave pulse animation).
  2. Upgraded component library in `frontend/src/components/ui/index.tsx` (`CornerBrackets`, `LivePulse`, `LiquidProgress`, `Card` with specular highlights, and refined `Button`/`Badge`/`Modal`).
  3. Redesigned application layout in `frontend/src/components/layout/AppLayout.tsx` (studio brand badge, live animated pulse monitor, indexed monospace navigation `01` - `11`, and coordinate breadcrumbs).
  4. Redesigned `DashboardPage.tsx`, `TailorStudioPage.tsx`, `HistoryPage.tsx`, and `TrackerPage.tsx` with editorial typography, technical framing, and Depth-inspired edition cards.
  5. Built and deployed live frontend container verifying zero regressions and complete API/SignalR wireup.
- **Rationale**: User requested an exact design language match to `https://depth.fyi/` and `https://www.ciaoenergy.com` with flawless interactive wireup.
- **Impacted Layers**: Frontend UI components, layouts, typography tokens, and style utilities.

### 2026-10-04 (Interactive 3D Three.js & GSAP Kinetic Animations)
- **Changes Made**:
  1. Installed `three`, `@types/three`, and `gsap` in `frontend/package.json`.
  2. Built `StudioCanvas3D.tsx` featuring real-time WebGL rendering, mouse damping/inertia, Depth-inspired form studies (Gem, Monolith, Torus Knot), wireframe toggle, and live Azimuth degree tracking.
  3. Built `gsap-motions.tsx` providing `GsapTextReveal` (line-masked kinetic typography inspired by Ciao Energy's `data-anim="chars-mask"`), `useTilt3D` (tactile 3D perspective hover physics), and `useGsapStagger`.
  4. Integrated interactive 3D studio viewport into `DashboardPage.tsx` hero banner alongside `GsapTextReveal` headline and tactile 3D tilt metric cards.
  5. Built and deployed live bundle with zero TypeScript warnings.
- **Rationale**: User requested interactive 3D elements and GSAP-based motion design to elevate visual craft and tactile responsiveness.
- **Impacted Layers**: UI components (`StudioCanvas3D`, `gsap-motions`), `DashboardPage.tsx`, and dependencies.
