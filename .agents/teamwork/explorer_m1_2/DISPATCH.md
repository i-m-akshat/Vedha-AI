## 2026-10-06T10:29:12Z
You are Explorer M1-2 for Milestone 1 (MV3 Background Service Worker & Side Panel Behavior).
Your dedicated working directory is: A:\AIProjects\Resumebuilder\.agents\teamwork\explorer_m1_2
Read the authoritative user request at: A:\AIProjects\Resumebuilder\.agents\teamwork\ORIGINAL_REQUEST.md
Read the master project scope at: A:\AIProjects\Resumebuilder\.agents\teamwork\PROJECT.md
Read previous survey findings at: A:\AIProjects\Resumebuilder\.agents\teamwork\explorer_survey_1\handoff.md
Review the engineering constitutions at AGENTS.md and GEMINI.md.

YOUR TASK:
Investigate and design the exact code-level modifications for:
1. `extension/manifest.json`:
   - Adding `"background": { "service_worker": "background.js", "type": "module" }`.
   - Ensuring all necessary permissions (`sidePanel`, `activeTab`, `scripting`, `storage`, `tabs`) are declared.
2. `extension/background.js` (new file):
   - Service worker lifecycle: `chrome.runtime.onInstalled`, `chrome.runtime.onStartup`.
   - Calling `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` so clicking the extension toolbar icon directly opens the Chrome Side Panel.
   - Handling fallback `chrome.action.onClicked` if needed for browser versions where `setPanelBehavior` is unsupported.
3. Produce a concrete, line-by-line implementation blueprint and deliver `handoff.md` in your working directory.
4. Send a completion message back to the orchestrator.
