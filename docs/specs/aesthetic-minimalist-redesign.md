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
