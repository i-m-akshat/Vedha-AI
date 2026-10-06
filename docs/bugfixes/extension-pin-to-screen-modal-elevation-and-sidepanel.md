# Bug Fix Plan: Extension Stacking Behind Modals & Missing On-Screen Pinning

## 1. Overview & Classification
- **Classification**: Bug Fix
- **Target Subsystems**: 
  - `extension/content.js` (In-page floating copilot dock z-index, anti-occlusion modal stacking, pin-to-screen state).
  - `extension/manifest.json` (Chrome Side Panel API integration).
  - `extension/popup.html` & `extension/popup.js` (1-click "Pin on Screen" & "Open Chrome Side Panel" action buttons).

---

## 2. Root Cause Analysis

### 1. Z-Index Inversion & Forced Auto-Collapse in `manageModalStacking()`
- **Symptom**: Whenever a modal opens (e.g. LinkedIn Easy Apply modal, Greenhouse/Workday dialogs), the extension dock disappears or goes behind the modal. The user had to open the extension in a big tab via Chrome.
- **Root Cause**:
  In `extension/content.js`, `manageModalStacking()` explicitly set:
  ```javascript
  if (dockRoot) {
    dockRoot.style.setProperty("z-index", "2147482000", "important");
  }
  if (dockCard && dockPill && dockCard.style.display === "flex") {
    dockCard.style.display = "none";
    dockPill.style.display = "flex";
  }
  ```
  While application modals were elevated to `z-index: 2147483100` and overlays to `2147483099`.
  Because `2147482000 < 2147483100`, the dock was **rendered behind the modal**, and the script explicitly set `dockCard.style.display = "none"`, forcing the expanded copilot to vanish!

### 2. Lack of Native Chrome Side Panel & Pinning Mechanism
- Standard Chrome popup (`action.default_popup`) automatically closes whenever a user clicks anywhere on the webpage or modal.
- Without `"sidePanel"` permission in `manifest.json`, users had no native way to pin the extension interface alongside their browser window.
- The in-page dock lacked a persistent "Pin on Screen" state that locks it above all dialogs at maximum z-index (`2147483647`).

---

## 3. Proposed Fix & Architectural Changes

### Step 1: Fix Z-Index Stacking & Remove Forced Collapse (`extension/content.js`)
1. Ensure the in-page dock root (`#vedha-floating-copilot-root`) ALWAYS maintains `z-index: 2147483647 !important`, placing it strictly above any modal, backdrop, and overlay.
2. Remove the forced `dockCard.style.display = "none"` in `manageModalStacking()`.
3. Add a persistent **Pin on Screen** toggle (`isPinnedOnScreen` saved to `sessionStorage` or `chrome.storage.local`).
4. When pinned, the dock stays expanded over the page, cannot be auto-hidden, and displays a prominent `📌 Pinned` indicator.

### Step 2: Add Native Chrome Side Panel Support (`extension/manifest.json`)
1. Add `"sidePanel"` to `permissions` array in `manifest.json`.
2. Add `"side_panel": { "default_path": "popup.html" }` to `manifest.json`.
3. This allows users to open the extension as a native Chrome Side Panel that permanently stays open on the right edge of Chrome while interacting with modals on the page.

### Step 3: Add "Pin to Screen" & "Side Panel" Controls (`popup.html` & `popup.js`)
1. Add a **"📌 Pin on Screen"** button in the popup header that immediately opens and pins the in-page dock right over the current page/modal.
2. Add an **"◨ Open Side Panel"** button that invokes `chrome.sidePanel.open({ windowId })`.

---

## 4. Files Affected
- `docs/bugfixes/extension-pin-to-screen-modal-elevation-and-sidepanel.md` (Created)
- `extension/manifest.json` (Modified: add `sidePanel` permission and `side_panel` declaration)
- `extension/content.js` (Modified: elevate dock z-index to `2147483647`, remove auto-collapse, add pin button and state)
- `extension/popup.html` (Modified: add Pin on Screen & Side Panel action buttons in header)
- `extension/popup.js` (Modified: wire Pin on Screen and Side Panel click events)

---

## 5. Verification Steps
1. Open a job portal with a modal (e.g. LinkedIn Easy Apply or Greenhouse modal).
2. Verify that the floating dock stays visible strictly **on top** of the modal dialog (`z-index: 2147483647`).
3. Toggle "Pin on Screen" and verify it stays open even when clicking inside modal form fields.
4. Click "Open Side Panel" and verify native side panel opens alongside the page.

---

## ## Changelog
- **2026-10-06T13:46:00+05:30**: Initial Bug Fix Plan created for extension modal elevation, pin-to-screen mode, and Chrome Side Panel API integration.
