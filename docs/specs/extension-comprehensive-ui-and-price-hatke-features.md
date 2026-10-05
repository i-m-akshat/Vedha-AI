# Feature Specification: Comprehensive Extension UI & In-Page Floating Copilot (Price Hatke Style)

## Overview
Transform the Vedha AI Chrome Desktop Extension (Manifest v3) from a single-purpose, LinkedIn-gated popup into a comprehensive, universally accessible AI Career Copilot inspired by modern e-commerce/productivity assistants (like Price Hatke, Buyhatke, and Simplify). The extension displays all core capabilities by default regardless of the active tab, features a premium dark-mode interface, and injects a non-intrusive floating assistant dock onto job and career pages.

## Business Goal
Empower candidates with instantaneous career tooling across any webpage or job portal without requiring navigation to the web dashboard, providing real-time ATS scoring, universal form auto-filling, cover letter drafting, candidate profile quick-copying, and 1-click LinkedIn Easy Apply automation.

## User Stories
- **As a job seeker browsing any webpage**, I want the extension popup to display all features and candidate profile tools immediately without being stuck on a blank loading spinner, so that I can access my career assets anytime.
- **As a candidate on an application portal (LinkedIn, Greenhouse, Lever, Workday, etc.)**, I want an in-page floating copilot widget (similar to Price Hatke / Buyhatke) so that I can trigger auto-fill, check ATS match, or generate a tailored cover letter without constantly toggling extension icons.
- **As a candidate preparing applications**, I want an instant ATS score check and 1-click cover letter generator directly in the extension popup so that I know my alignment and have custom application materials instantly ready.

## Acceptance Criteria
1. **Always-On Default Popup**:
   - Opening `popup.html` immediately renders all modules (no blank loading screen or disabled controls when not on a detected job).
   - Shows connection status to Vedha AI backend (`localhost:5000` / `localhost:3000`), active candidate name, and daily safe apply quota (`0/25`).
2. **Comprehensive Action Suite**:
   - **⚡ LinkedIn Easy Apply Copilot**: Biometric multi-step auto-navigation with Review Gateway pause.
   - **🤖 Universal Safe Biometric Auto-Fill (Anti-Ban)**: Auto-fills text, numbers, radio groups, and dropdowns across any portal, queries Gemini Grounding for screening questions, and highlights unclear items in amber.
   - **🎯 Instant ATS Fit & Keyword Analyzer**: Evaluates candidate skills against the active page's job description, displaying match percentage, matched skills, and missing keywords.
   - **📝 1-Click Tailored Cover Letter Generator**: Generates clean, professional 3-paragraph cover letter with 1-click clipboard copy and text download.
   - **👤 Candidate Profile & Quick Copy Drawer**: Provides 1-click copy buttons for email, phone, city, LinkedIn, GitHub, portfolio, salary, notice period, and sponsorship.
   - **✨ Stage in Vedha Orchestrator**: Direct link to open `http://localhost:3000/orchestrator?jobUrl=...`.
3. **In-Page Floating Assistant Widget (Price Hatke Style)**:
   - Injected into job pages across LinkedIn, Greenhouse, Lever, Ashby, Workday, Indeed, and general career sites.
   - Collapsed state: A sleek, glowing badge (`⚡ Vedha Copilot`) at bottom-right.
   - Expanded state: A floating card containing quick actions (`⚡ Auto-Apply`, `🤖 Safe Fill`, `🎯 ATS Match`, `📝 Cover Letter`, `✨ Studio`, `❌ Minimize`).
4. **Visual Aesthetics & Reliability**:
   - Modern glassmorphic dark UI with glowing accents, tabbed navigation, crisp SVG micro-icons, and responsive status banners.

## Architecture
- **Layers Affected**:
  - `extension/popup.html`: Redesigned layout with tabbed navigation and universal action cards.
  - `extension/popup.js`: Autonomous data synchronization, ATS matching, cover letter generation, and profile quick-copy.
  - `extension/content.js`: Price Hatke-style in-page floating widget injection and inter-module messaging.
  - `backend/`: Supporting endpoints in `OrchestratorAndProfileControllers.cs` for quick-match and quick-cover-letter.

## Changelog
- **2026-10-06T01:45:00+05:30**: Initial specification created based on user requirement for a comprehensive, always-accessible extension with Price Hatke-style in-page copilot and full feature suite visible by default.
