# Handoff Report: MV3 Background Service Worker & Side Panel Behavior (Milestone 1 / Subtask M1-2)

- **Agent**: Explorer M1-2 (`explorer_m1_2`)
- **Mission**: Investigate and design code-level modifications for `extension/manifest.json` and new file `extension/background.js` (MV3 background service worker, permissions, `chrome.sidePanel.setPanelBehavior`, lifecycle listeners, and action click fallback).
- **Handoff Type**: Hard (Investigation & Technical Specification Complete)
- **Target Working Directory**: `A:\AIProjects\Resumebuilder\.agents\teamwork\explorer_m1_2`

---

## 1. Observation

### 1.1 Manifest Permissions & Service Worker Absence
- **File**: `extension/manifest.json` (lines 6–17, 23–31):
  ```json
  6:   "permissions": [
  7:     "activeTab",
  8:     "scripting",
  9:     "storage",
  10:    "sidePanel"
  11:  ],
  ...
  15:  "side_panel": {
  16:    "default_path": "popup.html"
  17:  },
  ...
  23:  "action": {
  24:    "default_popup": "popup.html",
  25:    "default_title": "Vedha AI Copilot",
  26:    "default_icon": {
  27:      "16": "vedha-logo.png",
  28:      "48": "vedha-logo.png",
  29:      "128": "vedha-logo.png"
  30:    }
  31:  },
  ```
- **Observations**:
  1. `manifest.json` does **not** declare `"background"`. There is no service worker registered.
  2. `permissions` contains `"activeTab"`, `"scripting"`, `"storage"`, `"sidePanel"`, but is missing `"tabs"`. The `"tabs"` permission is required for persistent side panels to access tab properties (`tab.url`, `tab.title`, `tab.id`) across tab switching events (`chrome.tabs.onActivated`, `chrome.tabs.onUpdated`) without requiring explicit user interaction on every tab.
  3. `"action"` declares `"default_popup": "popup.html"`.

### 1.2 The Chrome MV3 Conflict: `openPanelOnActionClick` vs `default_popup`
- In Chrome MV3, `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` directs Chrome to open the native side panel when the toolbar action icon is clicked.
- **Chrome Platform Rule**: If `"default_popup"` is declared in `manifest.json`, clicking the toolbar action icon opens the small dropdown popup instead of the side panel. Furthermore, `chrome.action.onClicked` does not fire if the action has a default popup.
- To enable seamless 1-click side panel launch directly from the toolbar icon (and to enable `chrome.action.onClicked` fallback on unsupported platforms), `"default_popup": "popup.html"` must be removed from `manifest.json`. The `side_panel` declaration `"side_panel": { "default_path": "popup.html" }` already designates `popup.html` as the persistent side panel view.

### 1.3 Service Worker Lifecycle & Action Click Fallback Requirements
- Chrome MV3 service workers terminate when idle and spin up on demand.
- Event listeners (`chrome.runtime.onInstalled`, `chrome.runtime.onStartup`, `chrome.action.onClicked`, `chrome.runtime.onMessage`) must be registered synchronously at the top level of the service worker script.
- Chrome 116+ natively supports `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
- Chrome 114–115 introduced `chrome.sidePanel.open({ windowId })`, but did not have `setPanelBehavior`.
- In browser environments where `setPanelBehavior` is unsupported or disabled:
  1. If `"default_popup"` is omitted from `manifest.json`, Chrome fires `chrome.action.onClicked`.
  2. The service worker can handle `chrome.action.onClicked` to invoke `chrome.sidePanel.open({ windowId: tab.windowId })`.
  3. If the side panel API is unavailable altogether, the handler can dispatch `PIN_INPAGE_DOCK` to the active tab, dynamically injecting `content.js` via `chrome.scripting.executeScript` if the tab is not yet initialized.

---

## 2. Logic Chain

1. **Manifest Service Worker Registration**:
   - MV3 requires `background.service_worker` to be defined in `manifest.json`.
   - Adding `"background": { "service_worker": "background.js", "type": "module" }` registers the background script as an ES module service worker, enabling modern ES modules, scoped execution, and top-level await capabilities.

2. **Permission Scope Completeness**:
   - The extension needs:
     - `"sidePanel"`: for native side panel APIs (`setPanelBehavior`, `open`, `setOptions`).
     - `"activeTab"`: for focused tab interaction.
     - `"scripting"`: for fallback dynamic content script injection (`chrome.scripting.executeScript`).
     - `"storage"`: for offline candidate profile data and preferences.
     - `"tabs"`: for querying and monitoring tabs (`chrome.tabs.onActivated`, `chrome.tabs.onUpdated`, `chrome.tabs.sendMessage`).
   - Adding `"tabs"` completes the required permissions set.

3. **Action Click Routing**:
   - Removing `"default_popup": "popup.html"` from `manifest.json` allows `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` to execute cleanly without dropdown popup interception.
   - For backwards compatibility and edge cases where `setPanelBehavior` is unavailable, omitting `default_popup` enables `chrome.action.onClicked` to fire.

4. **Background Architecture & Resilience**:
   - `configureSidePanelBehavior()` is executed during:
     a) `chrome.runtime.onInstalled` (initial install, extension updates, browser updates).
     b) `chrome.runtime.onStartup` (browser profile startup).
     c) Immediate top-level script evaluation (every service worker spin-up/wakeup).
   - `handleActionClick(tab)` provides a 2-tier fallback:
     - Tier 1: `chrome.sidePanel.open({ windowId: tab.windowId })` for Chrome 114–115.
     - Tier 2: In-page dock elevation (`PIN_INPAGE_DOCK`) with dynamic script injection (`chrome.scripting.executeScript`) if content script is absent.
   - `chrome.runtime.onMessage` listener handles extension health check pings (`PING_BACKGROUND`) and programmatic side panel open requests (`OPEN_SIDE_PANEL`).
   - Dynamic `chrome.action.setPopup({ popup: "" })` is called defensively to ensure no cached popup remains active in the browser session.

---

## 3. Caveats

1. **Browser Version Differences**:
   - `chrome.sidePanel.setPanelBehavior` requires Chrome 116+. The fallback mechanism in `handleActionClick` ensures functionality on Chrome 114–115 (programmatic `sidePanel.open`) and browsers without side panel support (in-page dock pinning).
2. **Popup Viewport Adaptation**:
   - Because `default_path` in `side_panel` is `popup.html`, `popup.html` and `popup.js` must handle responsive sidebar dimensions (assigned to Explorer M1-3).
3. **Mock Test Environments**:
   - In Node.js / VM test harnesses (e.g. `tests/e2e/harness_env.js`), optional chaining (`chrome?.runtime?.onInstalled`) prevents crashes if certain browser APIs are only partially mocked.

---

## 4. Conclusion & Concrete Implementation Blueprint

### 4.1 Modifications for `extension/manifest.json`

#### Exact Line-by-Line Changes:
1. In `"permissions"` (line 6): add `"tabs"`.
2. Add `"background"` declaration specifying `"service_worker": "background.js"` and `"type": "module"`.
3. In `"action"`: remove `"default_popup": "popup.html"`.

#### Complete Proposed `extension/manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Vedha AI — The AI Career Operating System",
  "version": "1.0.0",
  "description": "Instantly capture job descriptions and auto-fill career portals with verified profile data via Vedha AI.",
  "permissions": [
    "activeTab",
    "scripting",
    "sidePanel",
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "*://*/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "popup.html"
  },
  "icons": {
    "16": "vedha-logo.png",
    "48": "vedha-logo.png",
    "128": "vedha-logo.png"
  },
  "action": {
    "default_title": "Vedha AI Copilot",
    "default_icon": {
      "16": "vedha-logo.png",
      "48": "vedha-logo.png",
      "128": "vedha-logo.png"
    }
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.linkedin.com/*",
        "*://*.greenhouse.io/*",
        "*://*.lever.co/*",
        "*://*.ashbyhq.com/*",
        "*://*.workday.com/*",
        "*://*.myworkdayjobs.com/*",
        "*://*.wellfound.com/*",
        "*://*.indeed.com/*",
        "*://*/*"
      ],
      "js": ["content.js"]
    }
  ]
}
```

---

### 4.2 Complete Code for `extension/background.js` (New File)

```javascript
/**
 * Vedha AI — Background Service Worker (Manifest V3)
 * 
 * Responsibilities:
 * 1. Native Chrome Side Panel behavior (openPanelOnActionClick: true)
 * 2. Service worker lifecycle management (onInstalled, onStartup, top-level boot)
 * 3. Graceful fallback on chrome.action.onClicked for legacy or unsupported browsers
 * 4. Runtime message coordination (ping health check, side panel programmatic open)
 */

/**
 * Configures the Chrome Side Panel behavior so clicking the extension's toolbar icon
 * directly opens the persistent Side Panel instead of a dropdown popup.
 *
 * @returns {Promise<boolean>} True if setPanelBehavior succeeded, false otherwise.
 */
export async function configureSidePanelBehavior() {
  try {
    if (chrome?.sidePanel && typeof chrome.sidePanel.setPanelBehavior === "function") {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      console.log("[Vedha SW] Successfully configured side panel behavior: openPanelOnActionClick = true");
      return true;
    } else {
      console.warn("[Vedha SW] chrome.sidePanel.setPanelBehavior is not available in this browser environment.");
      return false;
    }
  } catch (error) {
    console.error("[Vedha SW] Failed to set side panel behavior:", error);
    return false;
  }
}

/**
 * Fallback action handler when openPanelOnActionClick or setPanelBehavior is unsupported.
 * Attempts to programmatically open the side panel, or falls back to in-page dock pinning.
 *
 * @param {chrome.tabs.Tab} tab The active browser tab when the action was clicked.
 */
export async function handleActionClick(tab) {
  console.log("[Vedha SW] Action clicked (fallback handler) for tab:", tab?.id);
  try {
    // Strategy 1: Attempt programmatic chrome.sidePanel.open (supported in Chrome 114+ window/tab scope)
    if (chrome?.sidePanel && typeof chrome.sidePanel.open === "function") {
      const windowId = tab?.windowId;
      const target = windowId ? { windowId } : (tab?.id ? { tabId: tab.id } : {});
      await chrome.sidePanel.open(target);
      console.log("[Vedha SW] Successfully opened side panel via chrome.sidePanel.open.");
      return;
    }

    // Strategy 2: If sidePanel API is missing, fallback to in-page dock pinning on active tab
    if (tab?.id && chrome?.tabs?.sendMessage) {
      chrome.tabs.sendMessage(tab.id, { action: "PIN_INPAGE_DOCK" }, (response) => {
        if (chrome?.runtime?.lastError) {
          console.warn(
            "[Vedha SW] PIN_INPAGE_DOCK messaging failed, attempting content script injection fallback:",
            chrome.runtime.lastError.message
          );
          // If content script was not yet injected into this tab, dynamically inject it
          if (chrome?.scripting && typeof chrome.scripting.executeScript === "function") {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"]
            }).then(() => {
              // Wait briefly for content script initialization, then re-send pin message
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: "PIN_INPAGE_DOCK" });
              }, 300);
            }).catch((err) => {
              console.error("[Vedha SW] Dynamic script injection fallback failed:", err);
            });
          }
        } else {
          console.log("[Vedha SW] In-page dock pinned on screen fallback response:", response);
        }
      });
    }
  } catch (error) {
    console.error("[Vedha SW] Error in action click fallback handler:", error);
  }
}

// ==========================================
// Service Worker Lifecycle Event Listeners
// ==========================================

// 1. Extension Installed or Updated
if (chrome?.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log(
      `[Vedha SW] Extension installed/updated (reason: ${details.reason}, version: ${chrome?.runtime?.getManifest?.()?.version || "1.0.0"})`
    );
    await configureSidePanelBehavior();
  });
}

// 2. Browser Profile Startup
if (chrome?.runtime?.onStartup) {
  chrome.runtime.onStartup.addListener(async () => {
    console.log("[Vedha SW] Browser started, configuring side panel behavior.");
    await configureSidePanelBehavior();
  });
}

// 3. Toolbar Action Click Fallback Listener
// Synchronously registered at top level as required by Chrome MV3.
// When openPanelOnActionClick is active, Chrome intercepts clicks and does not fire this event.
// In older browser versions where setPanelBehavior is unsupported, this listener catches the click.
if (chrome?.action?.onClicked) {
  chrome.action.onClicked.addListener(handleActionClick);
}

// 4. Runtime Message Listener for Extension Coordination
if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;

    if (message.action === "PING_BACKGROUND") {
      sendResponse({ alive: true, version: chrome?.runtime?.getManifest?.()?.version || "1.0.0" });
      return true;
    }

    if (message.action === "OPEN_SIDE_PANEL") {
      const windowId = message.windowId || sender.tab?.windowId;
      if (chrome?.sidePanel && typeof chrome.sidePanel.open === "function") {
        chrome.sidePanel.open(windowId ? { windowId } : {})
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async response
      } else {
        sendResponse({ success: false, error: "chrome.sidePanel.open unsupported" });
        return false;
      }
    }

    if (message.action === "CONFIGURE_SIDE_PANEL") {
      configureSidePanelBehavior()
        .then((success) => sendResponse({ success }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    return false;
  });
}

// ==========================================
// Immediate Top-Level Initialization
// ==========================================
// Execute side panel configuration on initial script evaluation / worker wakeup
configureSidePanelBehavior();

// Clear any lingering default popup if action API is available
if (chrome?.action && typeof chrome.action.setPopup === "function") {
  chrome.action.setPopup({ popup: "" }).catch(() => {});
}

// Expose introspection handle for automated test harnesses
if (typeof globalThis !== "undefined") {
  globalThis.__VEDHA_BACKGROUND__ = {
    configureSidePanelBehavior,
    handleActionClick,
    version: "1.0.0"
  };
}
```

---

## 5. Verification Method

1. **Manifest Validation**:
   - Inspect `extension/manifest.json`.
   - Confirm `"background"`: `{ "service_worker": "background.js", "type": "module" }`.
   - Confirm `"permissions"` contains `["activeTab", "scripting", "sidePanel", "storage", "tabs"]`.
   - Confirm `"action"` does not contain `"default_popup"`.
   - Confirm `"side_panel"` contains `"default_path": "popup.html"`.

2. **Automated Test Harness Execution**:
   - Once the implementer writes `extension/background.js` and updates `extension/manifest.json`, execute:
     `& "C:\Program Files\nodejs\node.exe" tests/e2e/runner.js`
   - Specifically verify Tier 1 test F3 (Side Panel Manifest & Background Registration):
     - `readExtensionManifest().background.service_worker === "background.js"`
     - `readExtensionManifest().background.type === "module"`
     - `readExtensionManifest().permissions.includes("tabs")`
     - `readExtensionManifest().permissions.includes("sidePanel")`
     - `loadExtensionBackground(env)` runs without error and invokes `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.

3. **Runtime Chrome Behavior**:
   - Load the unpacked extension in Chrome 116+ (`chrome://extensions`).
   - Click the extension icon in the Chrome toolbar.
   - Verify that the native Chrome Side Panel opens on the right side of the browser window without displaying a popup dropdown.
