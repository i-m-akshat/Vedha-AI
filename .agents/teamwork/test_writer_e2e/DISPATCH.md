## 2026-10-06T10:28:41Z
You are the E2E Test Writer (teamwork_preview_test_writer).
Your dedicated working directory is: A:\AIProjects\Resumebuilder\.agents\teamwork\test_writer_e2e
Read the authoritative user request at: A:\AIProjects\Resumebuilder\.agents\teamwork\ORIGINAL_REQUEST.md
Read the E2E test infra design at: A:\AIProjects\Resumebuilder\.agents\teamwork\TEST_INFRA.md
Read the master project scope at: A:\AIProjects\Resumebuilder\.agents\teamwork\PROJECT.md
Also review the engineering constitutions at AGENTS.md and GEMINI.md.

YOUR MISSION:
Design and build the complete, independent opaque-box E2E test suite in `tests/e2e/` for the Vedha AI Chrome Extension.
Do NOT modify code in `extension/` or `backend/`. Your exclusive write ownership is `tests/e2e/` and publishing `TEST_READY.md`.

REQUIREMENTS & COVERAGE MATRIX (from TEST_INFRA.md):
You must create executable, standalone Node.js test suites executable via `node tests/e2e/runner.js`:
1. `tests/e2e/runner.js`:
   - Harness that executes all tiers, measures pass/fail counts, logs detailed failure traces, and exits with code 0 if all pass or code 1 if any fail. Supports `--tier=<N>` flag.
2. `tests/e2e/tier1_features.test.js` (≥60 test cases, 5 for each feature F1 to F12):
   - F1: Floating dock injection, top z-index (2147483647), styling, isolation, position clamping.
   - F2: Pin on screen persistence in sessionStorage, non-collapse during form focus/blur, fallback creation on PIN_INPAGE_DOCK message.
   - F3: Side panel manifest declaration, background service worker registration, responsive dimensions, tab switching sync.
   - F4: Universal error detection, aria-describedby association, scoped component matching, HTML5 validity.badInput raw string preservation, role="alert" detection without restrictive word filtering.
   - F5: Integer sanitization without context loss, phone formatting (E.164 / 10-digit / UK prefix), salary regex parsing avoiding concatenation of parenthetical figures, radio and checkbox proper state selection, select prototype resolution.
   - F6: React 16–19 _valueTracker reset and state synchronization, composed event dispatch (focus, InputEvent, input, change, blur) with bubbles: true and composed: true.
   - F7: Distinguishing empty optional fields vs errors, visual review indicators on unresolvable fields, clearing invalid optional inputs.
   - F8: Progression button discovery strictly inside active modal/container, zero search outside modal, prioritizing next over submit on early stages, multi-label matching (Save & continue, proceed).
   - F9: Per-field attempt counter Map, step fingerprint verification across stage transitions, returning pausedForReview: true instead of false-positive success.
   - F10: Review Gateway pause on final stage, Review HUD rendering, confirmation action triggering actual portal submission.
   - F11: Default candidate profile fallback covering legal authorization, visa status, postal code, relocation, EEO fields.
   - F12: Script injection idempotency guard window.__VEDHA_CONTENT_SCRIPT_INITIALIZED__, messaging ping/pong health check, dynamic executeScript fallback.
3. `tests/e2e/tier2_boundaries.test.js` (≥60 test cases, 5 per feature F1 to F12):
   - Boundary values, extreme inputs, empty inputs, non-standard DOM layouts, foreign currencies, zero values, long strings, unicode characters, edge case selectors.
4. `tests/e2e/tier3_pairwise.test.js` (≥12 test cases):
   - Pairwise interactions (e.g. F1+F8: Dock interaction while modal steps advance; F4+F5: Corrupted salary error detection and sanitization; F5+F6: Phone healing triggering React synthetic state; F8+F10: Button progression advancing to Review Gateway pause; F11+F12: Offline tab injection using fallback profile).
5. `tests/e2e/tier4_realworld.test.js` (≥6 realistic application scenarios):
   - S1: LinkedIn Easy Apply multi-step flow with screening questions.
   - S2: Greenhouse job board application with strict integer experience and phone formatting.
   - S3: Workday enterprise portal with Shadow DOM web components and modal elevation.
   - S4: Offline backend recovery using default candidate profile.
   - S5: Dynamic content script injection on freshly opened tab.
   - S6: Side Panel persistent session across tab switches.

COORDINATION ARTIFACTS:
- Publish `TEST_READY.md` at `A:\AIProjects\Resumebuilder\.agents\teamwork\TEST_READY.md` following the template in PROJECT.md / TEST_INFRA.md.
- Run `node tests/e2e/runner.js` to verify syntax and test execution. (Initial runs may fail or pass depending on extension's current state — document the baseline pass/fail counts).
- Write `handoff.md` in `A:\AIProjects\Resumebuilder\.agents\teamwork\test_writer_e2e\handoff.md`.
- Send a completion message back to the orchestrator.
