# Feature Specification: Aesthetic Minimalist Redesign & Conversational Robustness

## 1. Overview
Vedha AI was initially designed with high-density kinetic sci-fi HUD elements ("AI Slop" visual tropes including neon holographic gradients, faux corner brackets, pulsing glow boxes, and heavy saturated purples). While functional, this aesthetic clutters user focus, decreases readability, and feels like generic AI generator boilerplate rather than a high-end, studio-grade career copilot.

This specification defines the total visual and experiential overhaul of Vedha AI into a **world-class, minimalist, editorial design system**, alongside the resolution of the conversational mid-turn exception on greeting messages.

## 2. Business Goal
To position Vedha AI and the Ask Aksh career copilot as a premium, distraction-free, professional product comparable to Linear, Stripe, Apple, and Raycast. The design will elevate credibility with hiring executives, candidates, and enterprise partners while maintaining lightning-fast performance and effortless readability.

## 3. Scope
- **Color Architecture**: Transition from noisy neon indigo/purple/cyan gradients to an obsidian/deep slate dark foundation (`#09090b`, `#121214`, `#18181b`) and alabaster light foundation (`#fafafa`, `#ffffff`) with ultra-fine whisper borders (`border-white/[0.06]`), monochrome typography, and refined emerald/amber status accents.
- **Component System (`frontend/src/components/ui/index.tsx`)**:
  - Replace sci-fi corner brackets with clean, tactile card geometry.
  - Remove gaudy glow effects and pseudo-holographic styling.
  - Refactor buttons, inputs, badges, and modals to adhere to a clean 8px baseline grid with subtle active micro-interactions (`active:scale-[0.98]`).
- **Application Shell (`AppLayout.tsx`)**:
  - Editorial header: clean brand presentation, single minimal metric pill, smooth theme switcher.
  - Minimalist sidebar: subtle active selection states, clean iconography, unified spacing.
- **Ask Aksh AI Chat (`AskAkshPage.tsx`)**:
  - Sleek conversation canvas with crisp typography, copy actions, and clean message bubbles.
  - Seamless integration of the custom loading animation (`/assets/loading.gif`) in an elegant, calm status banner.
  - Minimalist suggestion chips and floating prompt composer.
- **Backend Conversational Robustness (`AkshChatClientAdapter.cs`, `GeminiFunctionCallingClient.cs`, `AkshAgentRunner.cs`)**:
  - Unify Gemini dispatch so that conversational turns (like `"HI"`) execute via `GeminiFunctionCallingClient` without tool overhead, preventing 400 Bad Request caused by obsolete `thinkingBudget` fields.
  - Transparent error reporting instead of masked generic failure messages.

## 4. User Stories
- **As a candidate**, I want a calm, elegant, and distraction-free interface so that I can focus on tailoring my resume and managing applications without feeling overwhelmed by glowing AI noise.
- **As a user chatting with Aksh**, I want natural greetings and questions to respond instantly without encountering a "model failed mid-turn" error.
- **As a power user**, I want clean typography and instant visual feedback with smooth micro-interactions that feel responsive and tactile.

## 5. Acceptance Criteria
1. No garish neon glow boxes or fake sci-fi HUD brackets remain in the core UI.
2. The UI looks polished, balanced, and editorial in both Dark Mode (`#09090b` obsidian) and Light Mode.
3. Chatting `"HI"` or other natural greetings in Ask Aksh resolves cleanly without crashing or throwing `AkshModelException`.
4. Custom loading GIF (`/assets/loading.gif`) appears gracefully during active model streaming without layout shift.
5. All buttons and interactive elements have tactile hover, active, and focus states.
6. Frontend builds cleanly (`npm run build`) without TypeScript or Tailwind errors.
7. Backend tests pass without regression.

## 6. Architecture & Data Flow
```
User Greeting "HI"
      │
      ▼
AkshAgentRunner (isGreetingOrGeneral = true)
      │
      ▼
HarnessAgentFactory (toolsForTurn = Empty)
      │
      ▼
AkshChatClientAdapter.GetResponseAsync
      │
      ├─► GeminiFunctionCallingClient.GenerateWithToolsAsync (declarations = 0)
      │         │
      │         ▼
      │   Google Generative Language API (Clean Payload, No Broken thinkingBudget)
      │         │
      │         ▼
      │   Assistant Response Parsed & Streamed via SSE
      │
      ▼
Frontend: AskAkshPage
      │
      ▼
Minimalist Editorial Chat Bubble + Smooth Loading Indicator
```

## 7. Changelog
- **2026-10-15**: Initial specification for the Aesthetic Minimalist Redesign and Aksh conversational dispatch hardening.
- **2026-10-15 (Night)**: Theme Toggling Root Cause Resolution & 3-Reference Visual Design Integration:
  - **Theme Toggling**: Resolved defect where hardcoded `#09090b` and `#ededed` backgrounds on `AppLayout.tsx`, `index.html`, and `index.css` prevented light mode from displaying when the theme toggle was activated. Implemented pre-hydration theme injection script in `index.html` to eliminate FOUC, coordinated `applyThemeToDom` across both `documentElement` and `document.body` in `useAuthStore.ts`.
  - **Multi-Reference Design System Integration**: Extracted visual DNA from the user's 3 design references:
    - *Reference 1 ("High Conversion Landing Page Design Ideas")*: 6-grid pastel-tinted cards (Mint, Sky Blue, Lavender, Peach, Buttercup, Rose), dual-icon squircle headers, and micro-metric status pills.
    - *Reference 2 ("autumn app by tamo")*: Warm aesthetic canvas, personalized hero greeting banner ("Welcome back, Alex 👋"), and verified candidate profile spotlight card with avatar, role pill, and rapid metric counters.
    - *Reference 3 ("Premium Flowbase_co LIVE! Landing")*: Segmented pill controls (`All Applications` / `Queue` / `Interviews`), dark translucent search pill, rounded-full high-contrast action CTAs, and refined activity table.
  - **Impacted Layers**: `frontend/index.html`, `frontend/src/index.css`, `frontend/src/stores/useAuthStore.ts`, `frontend/src/components/layout/AppLayout.tsx`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/AskAkshPage.tsx`, `frontend/src/pages/AuthPages.tsx`.
- **2026-10-15 (Late Night - Autumn App by Tamo & Decision Engine Architecture)**:
  - **Autumn App by Tamo Exact Visual Implementation**:
    - Created dedicated vector illustration suite in [`frontend/src/components/icons/AutumnVectors.tsx`](file:///A:/AIProjects/Resumebuilder/frontend/src/components/icons/AutumnVectors.tsx) matching the warm earth tone palette (`#D9704F` terracotta, `#EFA84B` golden foliage, `#5B9279` sage, `#FCE1D4` peach, `#FDF4ED` cream).
    - Re-architected [`DashboardPage.tsx`](file:///A:/AIProjects/Resumebuilder/frontend/src/pages/DashboardPage.tsx) into the exact 3-zone layout:
      1. Top Bar: Terracotta squircle bell notification button with white alert dot + wide pill search bar + autumn sprint tag.
      2. Hero Showcase Card: Scenic autumn day illustration (`AutumnHeroVector`) with trees, path, walking shoes, companion dog on leash + terracotta `#D9704F` banner with "Autumn Career Sprint" and 3-dots action menu.
      3. 4 Floating Pastel Squircles: Sage Green (Resume Tailor), Soft Peach (Cover Letter AI), Mint Cyan (Auto-Dispatch Queue), Warm Sand (Interview Drills).
      4. "Day Schedule" Section: 4 vector squircle cards (Resume Tailoring 09:00 AM, Cover Letter AI 11:30 AM, Auto-Dispatch 02:15 PM, Mock Interview 04:45 PM).
      5. Right Column (Jack / Candidate Profile Card): Pure white rounded card (`rounded-[32px]`) with `AutumnAvatarVector` portrait, name, role, terracotta pill button (`Active Profile`), "October Targets" (Google $174k-$240k, Stripe $320k-$380k, Airbnb $215k-$290k with autumn badges and "View" pills), and "Career Planning" squircle thumbnails (`AutumnDogVector`, `AutumnUmbrellaVector`, `AutumnBenchVector`).
  - **App Layout Navigation**:
    - Refined [`AppLayout.tsx`](file:///A:/AIProjects/Resumebuilder/frontend/src/components/layout/AppLayout.tsx) with terracotta `#D9704F` active state pills and top action button.
  - **Decision Engine Technical Exploration**:
    - Evaluated TypeSafe AI's **Jev** (non-autoregressive discriminative decision model) versus free open-source alternatives: **Laya** (ConvAI Innovations, ModernBERT-based), **Kev** (0.8B/1.5B Qwen pointer model), **Outlines by Dottxt** (FSM/Grammar-guided logit masking for 0-hallucination agent tool/route selection), and **Zen Engine** (sub-millisecond Rust JSON decision tables).
  - **Impacted Layers**: `frontend/src/components/icons/AutumnVectors.tsx`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/layout/AppLayout.tsx`, `docs/architecture/lld.html`.

