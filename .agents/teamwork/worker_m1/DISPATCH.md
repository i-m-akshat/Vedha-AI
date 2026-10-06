## 2026-10-06T10:38:22Z
You are Worker M1 (teamwork_preview_worker).
Your dedicated working directory is: A:\AIProjects\Resumebuilder\.agents\teamwork\worker_m1
Read the authoritative user request at: A:\AIProjects\Resumebuilder\.agents\teamwork\ORIGINAL_REQUEST.md
Read the master project scope at: A:\AIProjects\Resumebuilder\.agents\teamwork\PROJECT.md
Read the detailed blueprints from all three Milestone 1 Explorers:
- Explorer M1-1 (Dock Shadow DOM & Reset CSS): A:\AIProjects\Resumebuilder\.agents\teamwork\explorer_m1_1\handoff.md
- Explorer M1-2 (Background Service Worker & Side Panel): A:\AIProjects\Resumebuilder\.agents\teamwork\explorer_m1_2\handoff.md
- Explorer M1-3 (Side Panel Responsiveness & Tab Sync): A:\AIProjects\Resumebuilder\.agents\teamwork\explorer_m1_3\handoff.md
Also review the engineering constitutions at AGENTS.md and GEMINI.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own exclusively:
- `extension/manifest.json`
- `extension/background.js` (new file)
- `extension/popup.html`
- `extension/popup.js`
- `extension/content.js` (dock injection, shadow DOM, coordinate clamping, modal stacking, and PIN_INPAGE_DOCK handler)
Do NOT touch files in `tests/` or `backend/`.

IMPLEMENTATION TASKS:
1. `extension/manifest.json`:
   - Add `"background": { "service_worker": "background.js", "type": "module" }`.
   - Add `"tabs"` to `"permissions"` alongside `"activeTab"`, `"scripting"`, `"sidePanel"`, `"storage"`.
   - Remove `"default_popup": "popup.html"` from `"action"` (enables `setPanelBehavior` 1-click side panel launch).
2. `extension/background.js`:
   - Create the service worker implementing `configureSidePanelBehavior`, `handleActionClick`, `onInstalled`, `onStartup`, `action.onClicked`, and `runtime.onMessage` (`PING_BACKGROUND`, `OPEN_SIDE_PANEL`).
   - Expose `globalThis.__VEDHA_BACKGROUND__` for automated test suites.
3. `extension/popup.html`:
   - Implement dual-mode responsive layout styling: base popup mode (390px x 620px) and Side Panel responsive mode (`width: 100%; min-height: 100vh; max-height: 100vh; overflow-y: auto;`) via `.sidepanel-mode` and media queries.
4. `extension/popup.js`:
   - Add `detectAndApplyViewMode()` to detect side panel context.
   - Register `chrome.tabs.onActivated` and debounced `chrome.tabs.onUpdated` event listeners to sync active tab ID and re-extract job details when switching tabs in persistent side panel mode.
5. `extension/content.js`:
   - Implement `injectFloatingCopilotWidget(force = false)` with Shadow DOM encapsulation: `const shadowRoot = root.attachShadow({ mode: "open" })`.
   - Add comprehensive reset CSS inside `shadowRoot` (box-sizing: border-box !important, font resets, color resets, button resets).
   - Clamp initial coordinates to `Math.max(10, window.innerWidth - 340)` and `Math.max(10, window.innerHeight - 400)`.
   - Append dock and pill to `shadowRoot`.
   - In `manageModalStacking()`, resolve dockCard and dockPill via `dockRoot?.shadowRoot?.getElementById(...) || document.getElementById(...)`.
   - In `PIN_INPAGE_DOCK` / `OPEN_INPAGE_DOCK` listener, force-call `injectFloatingCopilotWidget(true)` if dockRoot is missing, and resolve elements cleanly via `dockRoot?.shadowRoot || document`.

VERIFICATION:
- Verify JavaScript syntax on all modified/created files:
  `& "C:\Program Files\nodejs\node.exe" -c extension/manifest.json` (or JSON.parse)
  `& "C:\Program Files\nodejs\node.exe" -c extension/background.js`
  `& "C:\Program Files\nodejs\node.exe" -c extension/popup.js`
  `& "C:\Program Files\nodejs\node.exe" -c extension/content.js`
- If `tests/e2e/runner.js` exists, run it to verify Tier 1 feature tests for F1, F2, F3.
- Document all changes and verification output in `handoff.md` in `A:\AIProjects\Resumebuilder\.agents\teamwork\worker_m1\handoff.md`.
- Send a completion message back to the orchestrator.
