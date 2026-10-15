# Implementation Plan: Aesthetic Minimalist Redesign & Conversational Hardening

## Overview
Execute a holistic UI/UX elevation to remove "AI Slop" artifacts and establish an editorial, minimalist aesthetic across the entire Vedha AI web platform, while fixing the backend dispatch error that caused `AkshModelException` on simple greeting messages like `"HI"`.

## Affected Files
### Backend (Conversational Robustness & Model Compatibility)
- `backend/src/ResumeTailor.Infrastructure/Aksh/AkshChatClientAdapter.cs`
- `backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs`
- `backend/src/ResumeTailor.Infrastructure/Aksh/AkshAgentRunner.cs`
- `backend/tests/ResumeTailor.UnitTests/AkshFunctionCallingTests.cs`

### Frontend (UI/UX Aesthetic Transformation)
- `frontend/src/index.css`
- `frontend/tailwind.config.js`
- `frontend/src/components/ui/index.tsx`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/pages/AskAkshPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`

### Architecture & Documentation
- `docs/specs/aesthetic-minimalist-redesign.md`
- `docs/plan/aesthetic-minimalist-redesign.md`
- `docs/architecture/lld.html`
- `docs/architecture/hld.html`

## Step-by-Step Execution Plan

### Phase 1: Backend Conversational Robustness & Gemini Alignment
1. **`AkshChatClientAdapter.cs`**:
   - Always route Gemini requests through `GeminiFunctionCallingClient.GenerateWithToolsAsync`, whether tools are declared or empty. When tools are empty, it executes a clean conversational text turn with complete multi-turn history.
   - Retain fallback to `IAiProvider.GenerateTextAsync` with structured logging on failure.
2. **`AiProviders.cs`**:
   - Remove `thinkingConfig = new { thinkingBudget = 0 }` in `CreateGenerationConfig`, which triggered HTTP 400 Bad Request on standard Gemini 2.x and Flash models.
3. **`AkshAgentRunner.cs`**:
   - Surface the exact inner reason code or message if the model fails, instead of cloaking errors in generic text.
4. **Unit Tests**:
   - Add unit test verifying that `AkshChatClientAdapter` routes conversational turns without tools seamlessly to `GeminiFunctionCallingClient`.

### Phase 2: Design System Core (`index.css` & `tailwind.config.js`)
1. **`frontend/src/index.css`**:
   - Refine design tokens for Dark Mode and Light Mode.
   - Eliminate noisy neon gradients and pulsing pseudo-holographic styling.
   - Introduce subtle matte surfaces (`studio-surface`), hairline borders (`hairline-border`), and smooth micro-interaction primitives.
2. **`frontend/tailwind.config.js`**:
   - Tune color palettes (slate, zinc, obsidian), refined letter-spacing, and subtle box shadows.

### Phase 3: Component Library Modernization (`components/ui/index.tsx`)
1. **`Card`**:
   - Clean, tactile borders (`border-zinc-200/90 dark:border-white/[0.06]`), soft elevation on hover, remove sci-fi brackets.
2. **`Button`**:
   - High-contrast Stark Mono styling (`bg-white text-zinc-950` in dark mode, `bg-zinc-900 text-white` in light mode), tactile `active:scale-[0.98]`.
3. **`Badge`**:
   - Understated, legible status pills with refined border contrasts.
4. **`Input` & `Textarea`**:
   - Crisp border transitions with subtle focus rings.

### Phase 4: App Shell & Navigation (`AppLayout.tsx`)
1. **Header**:
   - Streamline brand presentation, single minimal active application pill, smooth theme switcher.
2. **Sidebar**:
   - Minimalist navigation items with active indicators and clean typography.
   - Clean system status indicator.

### Phase 5: Ask Aksh Conversational Workspace (`AskAkshPage.tsx`)
1. **Header & Sessions**:
   - Minimalist header with status indicator and session selector.
2. **Message Bubbles**:
   - User message: refined dark slate bubble with clean typography.
   - Assistant message: borderless or subtle-border markdown layout with effortless readability.
3. **Loading Indicator**:
   - Calm, aesthetic loading status using `/assets/loading.gif` with subtle backdrop blur.
4. **Composer**:
   - Floating command bar with clean border and tactile send button.

### Phase 6: Verification & Synchronization
1. Run backend unit tests (`dotnet test`).
2. Run frontend build (`npm run build`).
3. Update architecture documents (`docs/architecture/lld.html` and `docs/architecture/hld.html`).
4. Commit and push to git repository.

## Changelog
- **2026-10-15**: Initial implementation plan authored for aesthetic minimalist overhaul and conversational turn bug fix.
- **2026-10-15 (Night)**: Theme Toggling Execution & Visual Reference Architecture Implementation:
  - Phase 7 Added: Decoupled theme toggling from hardcoded black `#09090b` stylesheets in `AppLayout.tsx`, `index.html`, and `index.css`.
  - Phase 8 Added: Implemented 6-pastel card grid (`card-pastel-mint`, `card-pastel-sky`, `card-pastel-lavender`, `card-pastel-peach`, `card-pastel-butter`, `card-pastel-rose`), spotlight verified profile card, and segmented pill tab controls across `DashboardPage.tsx` and `AppLayout.tsx`.
  - Verification: Clean build on `npm run build` (Vite 6.4.3, 1769 modules) and 207/207 backend unit tests passed.
- **2026-10-15 (Late Night - Autumn App Pattern & Decision Engine Architecture)**:
  - Phase 9 Added: Autumn App by Tamo Dedicated Vector Suite (`AutumnVectors.tsx` with 9 handcrafted SVGs: Hero scenic artwork, Maple Leaves, Umbrella, Walking Steps, Scarf Branch, Candidate Avatar, Pumpkin, Bench, Dog).
  - Phase 10 Added: 3-Zone Dashboard Layout in `DashboardPage.tsx` with terracotta squircle notification bell, pill search bar, Autumn Day scenic card with terracotta banner, 4 floating pastel squircle tools, 4-card Day Schedule with vector cards, and Jack Candidate Profile with October Targets & Career Planning squircle cards.
  - Phase 11 Added: Deep Engineering Exploration on Jev & Free Competitors (Laya, Kev, Outlines by Dottxt, Zen Engine) for agent routing and zero-cost decision making.
  - Verification: Frontend compiled cleanly via `npm run build` (1770 modules, 0 errors, 9.79s).

