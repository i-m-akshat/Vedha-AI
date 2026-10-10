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

// ==========================================
// Shared Authentication Sync (Extension <-> Web App)
// ==========================================

const AUTH_STORAGE_KEYS = ["vedha_token", "jwtToken", "token", "candidateProfile", "cachedMasterResume", "cachedUser", "vedha_review_gateway"];
const WEBAPP_ORIGIN = "http://localhost:3000";

/**
 * Syncs auth state from web app localStorage to chrome.storage.local
 * Called periodically and on extension startup
 */
async function syncAuthFromWebApp() {
  const cr = getChrome();
  if (!cr?.storage?.local) return;
  
  try {
    // Query tabs on the web app origin
    const tabs = await cr.tabs.query({ url: `${WEBAPP_ORIGIN}/*` });
    if (tabs.length === 0) return;
    
    // Execute script in the web app tab to read localStorage
    const results = await cr.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (keys) => {
        const data = {};
        for (const key of keys) {
          const val = localStorage.getItem(key);
          if (val) data[key] = val;
        }
        return data;
      },
      args: [AUTH_STORAGE_KEYS]
    });
    
    const webAppData = results?.[0]?.result;
    if (webAppData && Object.keys(webAppData).length > 0) {
      await cr.storage.local.set(webAppData);
      console.log("[Vedha SW] Synced auth from web app:", Object.keys(webAppData));
    }
  } catch (err) {
    // Silently fail - web app might not be open
    console.debug("[Vedha SW] Auth sync from web app skipped:", err?.message || err);
  }
}

/**
 * Syncs auth state from chrome.storage.local to web app localStorage
 * Called when extension storage changes
 */
async function syncAuthToWebApp(changes) {
  const cr = getChrome();
  if (!cr?.storage?.local) return;
  
  const relevantChanges = {};
  for (const key of AUTH_STORAGE_KEYS) {
    if (changes[key] && changes[key].newValue !== undefined) {
      relevantChanges[key] = changes[key].newValue;
    }
  }
  
  if (Object.keys(relevantChanges).length === 0) return;
  
  try {
    const tabs = await cr.tabs.query({ url: `${WEBAPP_ORIGIN}/*` });
    if (tabs.length === 0) return;
    
    await cr.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (data) => {
        for (const [key, value] of Object.entries(data)) {
          if (value === null || value === undefined) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, value);
          }
        }
        // Dispatch storage event for React app to pick up
        window.dispatchEvent(new StorageEvent('storage', { key: 'vedha_token' }));
      },
      args: [relevantChanges]
    });
    
    console.log("[Vedha SW] Synced auth to web app:", Object.keys(relevantChanges));
  } catch (err) {
    console.debug("[Vedha SW] Auth sync to web app skipped:", err?.message || err);
  }
}

// Listen for storage changes in extension and sync to web app
if (cr?.storage?.local?.onChanged) {
  cr.storage.local.onChanged.addListener(syncAuthToWebApp);
}

// Periodic sync from web app (every 30 seconds when web app is open)
setInterval(syncAuthFromWebApp, 30000);

// Sync on extension startup
syncAuthFromWebApp();

// ==========================================
// Phase 4 Extension Dispatch Poller
// ==========================================
// Dynamic import (not static): background.js is also executed in classic-script
// e2e harnesses (vm.runInContext) where static imports are a parse error.
// Dynamic import() parses in both goals; rejection is caught. Chrome loads
// this worker as a module per manifest, so resolution succeeds there.
try {
  if (cr?.alarms?.create) {
    import("./dispatch.js")
      .then((m) => { try { m.startDispatchPoller(); } catch (_) {} })
      .catch(() => {});
  }
} catch (_) { /* harness without module support: poller stays inert */ }

// Expose for testing
if (typeof globalThis !== "undefined") {
  globalThis.__VEDHA_BACKGROUND__ = {
    configureSidePanelBehavior,
    handleActionClick,
    syncAuthFromWebApp,
    syncAuthToWebApp,
    version: "1.0.0"
  };
}
