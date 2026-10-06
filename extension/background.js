/**
 * Vedha AI — Background Service Worker (Manifest V3)
 * 
 * Responsibilities:
 * 1. Native Chrome Side Panel behavior (openPanelOnActionClick: true)
 * 2. Service worker lifecycle management (onInstalled, onStartup, top-level boot)
 * 3. Graceful fallback on chrome.action.onClicked for legacy or unsupported browsers
 * 4. Runtime message coordination (ping health check, side panel programmatic open)
 */

function getChrome() {
  if (typeof chrome !== "undefined") return chrome;
  if (typeof globalThis !== "undefined" && globalThis.chrome) return globalThis.chrome;
  return null;
}

/**
 * Configures the Chrome Side Panel behavior so clicking the extension's toolbar icon
 * directly opens the persistent Side Panel instead of a dropdown popup.
 *
 * @returns {Promise<boolean>} True if setPanelBehavior succeeded, false otherwise.
 */
async function configureSidePanelBehavior() {
  const cr = getChrome();
  try {
    if (cr?.sidePanel && typeof cr.sidePanel.setPanelBehavior === "function") {
      await cr.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
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
async function handleActionClick(tab) {
  const cr = getChrome();
  console.log("[Vedha SW] Action clicked (fallback handler) for tab:", tab?.id);
  try {
    // Strategy 1: Attempt programmatic chrome.sidePanel.open (supported in Chrome 114+ window/tab scope)
    if (cr?.sidePanel && typeof cr.sidePanel.open === "function") {
      const windowId = tab?.windowId;
      const target = windowId ? { windowId } : (tab?.id ? { tabId: tab.id } : {});
      await cr.sidePanel.open(target);
      console.log("[Vedha SW] Successfully opened side panel via chrome.sidePanel.open.");
      return;
    }

    // Strategy 2: If sidePanel API is missing, fallback to in-page dock pinning on active tab
    if (tab?.id && cr?.tabs?.sendMessage) {
      cr.tabs.sendMessage(tab.id, { action: "PIN_INPAGE_DOCK" }, (response) => {
        if (cr?.runtime?.lastError) {
          console.warn(
            "[Vedha SW] PIN_INPAGE_DOCK messaging failed, attempting content script injection fallback:",
            cr.runtime.lastError.message
          );
          // If content script was not yet injected into this tab, dynamically inject it
          if (cr?.scripting && typeof cr.scripting.executeScript === "function") {
            cr.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"]
            }).then(() => {
              // Wait briefly for content script initialization, then re-send pin message
              setTimeout(() => {
                cr.tabs.sendMessage(tab.id, { action: "PIN_INPAGE_DOCK" });
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

const cr = getChrome();

// 1. Extension Installed or Updated
if (cr?.runtime?.onInstalled) {
  cr.runtime.onInstalled.addListener(async (details) => {
    console.log(
      `[Vedha SW] Extension installed/updated (reason: ${details?.reason || "unknown"}, version: ${cr?.runtime?.getManifest?.()?.version || "1.0.0"})`
    );
    await configureSidePanelBehavior();
  });
}

// 2. Browser Profile Startup
if (cr?.runtime?.onStartup) {
  cr.runtime.onStartup.addListener(async () => {
    console.log("[Vedha SW] Browser started, configuring side panel behavior.");
    await configureSidePanelBehavior();
  });
}

// 3. Toolbar Action Click Fallback Listener
if (cr?.action?.onClicked) {
  cr.action.onClicked.addListener(handleActionClick);
}

// 4. Runtime Message Listener for Extension Coordination
if (cr?.runtime?.onMessage) {
  cr.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;

    if (message.action === "PING_BACKGROUND") {
      sendResponse({ alive: true, version: cr?.runtime?.getManifest?.()?.version || "1.0.0" });
      return true;
    }

    if (message.action === "OPEN_SIDE_PANEL") {
      const windowId = message.windowId || sender?.tab?.windowId;
      if (cr?.sidePanel && typeof cr.sidePanel.open === "function") {
        cr.sidePanel.open(windowId ? { windowId } : {})
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
        return true;
      } else {
        sendResponse({ success: false, error: "chrome.sidePanel.open unsupported" });
        return false;
      }
    }

    if (message.action === "CONFIGURE_SIDE_PANEL") {
      configureSidePanelBehavior()
        .then((success) => sendResponse({ success }))
        .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
      return true;
    }

    return false;
  });
}

// ==========================================
// Immediate Top-Level Initialization
// ==========================================
configureSidePanelBehavior();

if (cr?.action && typeof cr.action.setPopup === "function") {
  cr.action.setPopup({ popup: "" }).catch(() => {});
}

// Expose handles for Node test runners & global environments
if (typeof globalThis !== "undefined") {
  globalThis.__VEDHA_BACKGROUND__ = {
    configureSidePanelBehavior,
    handleActionClick,
    version: "1.0.0"
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    configureSidePanelBehavior,
    handleActionClick,
    version: "1.0.0"
  };
}
