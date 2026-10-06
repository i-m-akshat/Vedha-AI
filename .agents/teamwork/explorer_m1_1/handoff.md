# Handoff Report: Shadow DOM Isolation & Persistent Dock Stacking Blueprint (Milestone 1)

- **Agent**: Explorer M1-1 (`explorer_m1_1`)
- **Mission**: Investigate and design code-level modifications in `extension/content.js` for Shadow DOM encapsulation, host style isolation, event binding preservation, and viewport clamping.
- **Handoff Type**: Hard (Investigation & Blueprint Complete)
- **Target Working Directory**: `A:\AIProjects\Resumebuilder\.agents\teamwork\explorer_m1_1`

---

## 1. Observation

### 1.1 Direct DOM Appending & Lack of Shadow DOM Isolation
In `extension/content.js:2579-2624` and `2993-2996`:
```javascript
2579:  function injectFloatingCopilotWidget() {
2580:    if (document.getElementById("vedha-floating-copilot-root")) return;
...
2600:    const root = document.createElement("div");
2601:    root.id = "vedha-floating-copilot-root";
...
2615:    root.style.cssText = `
2616:      position: fixed;
2617:      ${initialLeft !== null && initialTop !== null ? `left: ${initialLeft}px; top: ${initialTop}px;` : `bottom: 24px; right: 24px;`}
2618:      z-index: 2147483647 !important;
2619:      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
2620:      display: flex;
2621:      flex-direction: column;
2622:      align-items: flex-end;
2623:      gap: 10px;
2624:    `;
...
2993:    root.appendChild(dock);
2994:    root.appendChild(pill);
2995:    document.body.appendChild(root);
2996:  }
```
- The copilot widget `#vedha-floating-copilot-root` mounts directly into `document.body` without Shadow DOM encapsulation.
- No `root.attachShadow({ mode: "open" })` is executed.
- Host page global CSS rules (e.g. `* { box-sizing: content-box; }`, `button { border-radius: 0; text-transform: uppercase; }`) bleed directly into `#vedha-copilot-dock` and `#vedha-copilot-pill`.
- Host page scripts executing `document.querySelectorAll("button")` or `document.querySelectorAll("input, form")` match extension buttons and controls.

### 1.2 External Element Queries Outside the Widget
In `extension/content.js:3034-3036`:
```javascript
3034:    const dockRoot = document.getElementById("vedha-floating-copilot-root");
3035:    const dockCard = document.getElementById("vedha-copilot-dock");
3036:    const dockPill = document.getElementById("vedha-copilot-pill");
```
And in `extension/content.js:3129-3131`:
```javascript
3128:    } else if (request.action === "PIN_INPAGE_DOCK" || request.action === "OPEN_INPAGE_DOCK") {
3129:      const dockCard = document.getElementById("vedha-copilot-dock");
3130:      const dockPill = document.getElementById("vedha-copilot-pill");
3131:      const dockRoot = document.getElementById("vedha-floating-copilot-root");
```
- If `#vedha-copilot-dock` and `#vedha-copilot-pill` are placed inside a Shadow Root, standard `document.getElementById("vedha-copilot-dock")` queries return `null`.
- Neither `manageModalStacking()` nor `chrome.runtime.onMessage` listener currently queries `dockRoot?.shadowRoot`.

### 1.3 Unbounded Initial Coordinate Calculation
In `extension/content.js:2603-2613`:
```javascript
2603:    // Restore saved position from sessionStorage if available and valid
2604:    let initialLeft = null;
2605:    let initialTop = null;
2606:    try {
2607:      const savedX = parseInt(sessionStorage.getItem("vedha_dock_x") || "", 10);
2608:      const savedY = parseInt(sessionStorage.getItem("vedha_dock_y") || "", 10);
2609:      if (!isNaN(savedX) && !isNaN(savedY) && savedX >= 0 && savedY >= 0 && savedX < window.innerWidth && savedY < window.innerHeight) {
2610:        initialLeft = savedX;
2611:        initialTop = savedY;
2612:      }
2613:    } catch (_) {}
```
- When `savedX` is close to `window.innerWidth` (e.g. `savedX = 1300` on a 1366px screen), `savedX < window.innerWidth` evaluates to true, but because dock card width is 320px (`savedX + 320 = 1620 > 1366`), the dock renders partially off-screen.
- When `initialLeft === null`, the widget falls back to `bottom: 24px; right: 24px;`, which causes layout jumps during the first drag operation when switched to `left/top` positioning (`content.js:2761-2764`).

### 1.4 URL Heuristic Gate and Silent Failure on Pin
In `extension/content.js:2583-2598`:
`injectFloatingCopilotWidget()` exits early if the current page is not identified as a job portal (`if (!isJobPortal) return;`).
In `content.js:3128-3146`, when `PIN_INPAGE_DOCK` is received:
`if (dockCard && dockPill)` evaluates to false if the dock was not injected, and the message handler responds with `{ success: true, pinned: true }` without ever mounting the widget.

---

## 2. Logic Chain

1. **Host Isolation Requirement**:
   - Host pages (Workday, Greenhouse, Taleo, Taleo Enterprise) frequently apply aggressive resets: `* { box-sizing: content-box !important; }`, custom button resets, and dynamic theme classes.
   - Encapsulating `#vedha-copilot-dock` and `#vedha-copilot-pill` inside `root.attachShadow({ mode: "open" })` creates a Shadow Boundary that prevents host page selectors from penetrating.
   - Because CSS inheritance still passes inherited typography and color properties across shadow roots, an explicit reset stylesheet inside `<style>` is necessary to define system fonts, `box-sizing: border-box !important`, `button` styles, and color tokens.

2. **Shadow Root Node Resolution**:
   - Because elements inside a Shadow Root are encapsulated in their own DocumentFragment, calling `document.getElementById("vedha-copilot-dock")` from `manageModalStacking()` (line 3035) and `chrome.runtime.onMessage` (line 3129) returns `null`.
   - Modifying those lookups to check `dockRoot?.shadowRoot?.getElementById("vedha-copilot-dock")` or fallback preserves full functionality across both shadow and legacy DOM configurations.

3. **Host Root Positioning & Stacking**:
   - The host element `#vedha-floating-copilot-root` must remain in `document.body` with `position: fixed !important`, `z-index: 2147483647 !important`, and `pointer-events: auto !important`.
   - Setting `all: initial` on `:host` without `!important` ensures that inline styles set on `root` (`left`, `top`, `z-index`) retain priority while shielding internal content.

4. **Viewport Clamping**:
   - Clamping `initialLeft` between `10` and `Math.max(10, window.innerWidth - 340)` guarantees that the 320px dock card never overflows the right edge.
   - Clamping `initialTop` between `10` and `Math.max(10, window.innerHeight - 400)` guarantees that the ~380px dock card never overflows the bottom fold.
   - Defaulting `initialLeft` and `initialTop` to these clamped coordinates avoids coordinate jumps between `bottom/right` and `left/top` during dragging.

5. **Pin Message Fallback Injection**:
   - Adding a `force = false` parameter to `injectFloatingCopilotWidget(force)` allows the popup's `PIN_INPAGE_DOCK` message to force-inject the widget on any tab, guaranteeing that pinning from popup always works.

---

## 3. Caveats

1. **Host Body Transforms**: If a host application applies `transform` or `filter` to `document.body`, standard fixed positioning creates a stacking context relative to `body` rather than the viewport. `manageModalStacking()` safeguards against this by checking modal and parent element stacking.
2. **Shadow Root Mode**: `mode: "open"` is deliberately selected rather than `"closed"`. Closed shadow roots prevent external access to `root.shadowRoot`, which would break external coordination in `manageModalStacking()` and test automation.
3. **Internal Event Bubbling**: Pointer events and click events inside the shadow root bubble up through the shadow tree to `pill` and `dock` listeners. `e.target` retargeting only occurs at the shadow boundary, so event listeners attached to shadow elements receive un-retargeted internal targets.

---

## 4. Conclusion & Concrete Implementation Blueprint

### 4.1 Summary of Changes in `extension/content.js`

1. **`injectFloatingCopilotWidget(force = false)`**:
   - Accepts `force` boolean to bypass URL heuristic when triggered via popup message.
   - Computes clamped initial coordinates:
     `maxInitialX = Math.max(10, window.innerWidth - 340)`
     `maxInitialY = Math.max(10, window.innerHeight - 400)`
   - Sets outer host element `root.style.cssText` with `position: fixed !important`, `z-index: 2147483647 !important`, `left: ${initialLeft}px !important`, `top: ${initialTop}px !important`.
   - Creates `const shadowRoot = root.attachShadow({ mode: "open" });`.
   - Injects comprehensive reset stylesheet `<style>` into `shadowRoot`.
   - Appends `dock` and `pill` to `shadowRoot` (instead of `root`).
   - Appends `root` to `document.body`.
   - Adds window `resize` clamping listener to maintain on-screen visibility.

2. **`manageModalStacking()`**:
   - Queries `dockCard` and `dockPill` via `dockRoot?.shadowRoot?.getElementById(...) || document.getElementById(...)`.
   - Re-appends `dockRoot` to `document.body` if displaced from being the top stacking child.

3. **Message Listener (`chrome.runtime.onMessage`)**:
   - On `PIN_INPAGE_DOCK` / `OPEN_INPAGE_DOCK`, checks if `dockRoot` exists; if not, calls `injectFloatingCopilotWidget(true)`.
   - Resolves `dockCard` and `dockPill` via `dockRoot?.shadowRoot?.getElementById(...) || document.getElementById(...)`.

---

### 4.2 Exact Line-by-Line Code Blueprint

#### Blueprint A: Modify `injectFloatingCopilotWidget` (`extension/content.js:2579-2815`, `2993-2996`)

```javascript
  // 13. In-Page Floating Copilot Dock (Simplify / Price Hatke Style)
  function injectFloatingCopilotWidget(force = false) {
    let root = document.getElementById("vedha-floating-copilot-root");
    if (root) {
      if (!document.body.contains(root)) {
        document.body.appendChild(root);
      }
      return root;
    }

    // Detect if page is a job/career portal or has candidate application forms
    if (!force) {
      const hostname = window.location.hostname.toLowerCase();
      const isJobPortal =
        hostname.includes("linkedin.com") ||
        hostname.includes("greenhouse.io") ||
        hostname.includes("lever.co") ||
        hostname.includes("ashbyhq.com") ||
        hostname.includes("workday.com") ||
        hostname.includes("myworkdayjobs.com") ||
        hostname.includes("indeed.com") ||
        hostname.includes("naukri.com") ||
        hostname.includes("wellfound.com") ||
        window.location.pathname.includes("/jobs/") ||
        window.location.pathname.includes("/careers/") ||
        document.querySelector("form, [data-view-name*='apply'], input[type='email']");

      if (!isJobPortal) return null;
    }

    root = document.createElement("div");
    root.id = "vedha-floating-copilot-root";

    // Viewport clamping: ensures dock (320px width, ~380px height) never renders off-screen
    const maxInitialX = Math.max(10, window.innerWidth - 340);
    const maxInitialY = Math.max(10, window.innerHeight - 400);

    let initialLeft = maxInitialX;
    let initialTop = maxInitialY;

    try {
      const savedX = parseInt(sessionStorage.getItem("vedha_dock_x") || "", 10);
      const savedY = parseInt(sessionStorage.getItem("vedha_dock_y") || "", 10);
      if (!isNaN(savedX) && !isNaN(savedY)) {
        initialLeft = Math.max(10, Math.min(maxInitialX, savedX));
        initialTop = Math.max(10, Math.min(maxInitialY, savedY));
      }
    } catch (_) {}

    // Host root styling: top z-index, fixed positioning, clean layout
    root.style.cssText = `
      position: fixed !important;
      left: ${initialLeft}px !important;
      top: ${initialTop}px !important;
      right: auto !important;
      bottom: auto !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end !important;
      gap: 10px !important;
      pointer-events: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
    `;

    // Attach Shadow DOM for style encapsulation & host isolation
    const shadowRoot = root.attachShadow({ mode: "open" });

    // Comprehensive CSS Reset & Component Styles inside Shadow DOM
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      :host {
        all: initial;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        gap: 10px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        color: #fafafa !important;
        pointer-events: auto !important;
      }

      *, *::before, *::after {
        box-sizing: border-box !important;
        margin: 0;
        padding: 0;
        border: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: inherit;
        line-height: inherit;
        color: inherit;
        text-transform: none;
        letter-spacing: normal;
        word-spacing: normal;
        text-shadow: none;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      button {
        all: unset;
        box-sizing: border-box !important;
        cursor: pointer !important;
        user-select: none !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        line-height: 1.2 !important;
        text-align: center !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: filter 0.15s ease, transform 0.15s ease, background 0.15s ease, border-color 0.15s ease !important;
      }

      button:hover {
        filter: brightness(1.1);
      }

      button:active {
        transform: scale(0.98);
      }

      button:focus-visible {
        outline: 2px solid #6366f1 !important;
        outline-offset: 2px !important;
      }

      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: #18181b;
      }
      ::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #52525b;
      }
    `;
    shadowRoot.appendChild(styleEl);

    let isPinned = false;
    try {
      isPinned = sessionStorage.getItem("vedha_dock_pinned") === "true";
    } catch (_) {}

    // Collapsed Pill with Drag Grip
    const pill = document.createElement("div");
    pill.id = "vedha-copilot-pill";
    pill.style.cssText = `
      background: #09090b;
      color: #fafafa;
      border: 1.5px solid #6366f1;
      border-radius: 9999px;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      padding: 10px 18px;
      display: ${isPinned ? "none" : "flex"};
      align-items: center;
      gap: 9px;
      cursor: grab;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.01em;
      transition: box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      touch-action: none;
    `;
    pill.innerHTML = `
      <span style="font-size: 13px; color: #6366f1; opacity: 0.8; margin-right: -2px; letter-spacing: -2px;">⋮⋮</span>
      <span style="font-size: 16px;">⚡</span>
      <span>Vedha Copilot</span>
      <span style="font-size: 10px; background: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 2px 7px; border-radius: 9999px; font-weight: 600;">Tools Ready</span>
    `;

    pill.onmouseenter = () => {
      pill.style.transform = "scale(1.04)";
      pill.style.boxShadow = "0 15px 35px -5px rgba(99, 102, 241, 0.7)";
    };
    pill.onmouseleave = () => {
      pill.style.transform = "scale(1)";
      pill.style.boxShadow = "0 10px 25px -5px rgba(99, 102, 241, 0.5)";
    };

    // Expanded Floating Dock Card (Always elevated over modals)
    const dock = document.createElement("div");
    dock.id = "vedha-copilot-dock";
    dock.style.cssText = `
      display: ${isPinned ? "flex" : "none"};
      width: 320px;
      background: #09090b;
      color: #fafafa;
      border: 1.5px solid #27272a;
      border-radius: 14px;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.9), 0 0 25px rgba(99, 102, 241, 0.35);
      padding: 14px;
      flex-direction: column;
      gap: 10px;
      user-select: none;
    `;

    const job = extractJobDetails();
    dock.innerHTML = `
      <div id="vedha-dock-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #27272a; padding-bottom: 8px; cursor: grab; touch-action: none;">
        <div style="display: flex; align-items: center; gap: 7px;">
          <span style="font-size: 13px; color: #71717a; letter-spacing: -2px;">⋮⋮</span>
          <span style="font-size: 16px;">⚡</span>
          <span style="font-size: 13px; font-weight: 800; color: #818cf8;">Vedha AI Copilot</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button id="vedha-dock-pin" title="Pin over all screens & modals" style="background: ${isPinned ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.15)'}; border: 1px solid ${isPinned ? '#10b981' : 'rgba(99, 102, 241, 0.3)'}; color: ${isPinned ? '#34d399' : '#a5b4fc'}; font-size: 10px; cursor: pointer; padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px; font-weight: 700;">
            <span id="vedha-pin-icon">📌</span>
            <span id="vedha-pin-label">${isPinned ? 'Pinned' : 'Pin'}</span>
          </button>
          <button id="vedha-dock-close" title="Minimize to pill" style="background: transparent; border: none; color: #71717a; font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 4px;">✕</button>
        </div>
      </div>

      <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 9px 11px;">
        <div style="font-size: 12px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${job.title || "Target Position"}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
          <span style="font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px;">${job.company || "Company"}</span>
          <span style="font-size: 9px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 2px 5px; border-radius: 4px;">${job.source || "Careers"}</span>
        </div>
      </div>

      <div id="vedha-dock-status" style="display: none; font-size: 11px; padding: 8px 10px; border-radius: 6px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); color: #c7d2fe;"></div>

      <div style="display: flex; flex-direction: column; gap: 7px;">
        <button id="vedha-dock-autoadvance" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border: none; padding: 10px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);">
          <span>⚡</span><span>Autonomous Auto-Fill & Next Step</span>
        </button>
        <button id="vedha-dock-easyapply" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: white; border: none; padding: 9px 12px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;">
          <span>💼</span><span>Auto-Apply (LinkedIn Easy Apply)</span>
        </button>
        <button id="vedha-dock-safefill" style="background: linear-gradient(135deg, #059669, #047857); color: white; border: none; padding: 9px 12px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;">
          <span>🤖</span><span>Single-Page Safe Biometric Fill</span>
        </button>
        <button id="vedha-dock-ats" style="background: #18181b; color: #e4e4e7; border: 1px solid #3f3f46; padding: 8px 12px; border-radius: 7px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>🎯</span><span>Check ATS Match Score</span>
        </button>
        <button id="vedha-dock-studio" style="background: #18181b; color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); padding: 8px 12px; border-radius: 7px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>✨</span><span>Open in Vedha Studio ↗</span>
        </button>
      </div>
    `;

    function setDockStatus(msg, isSuccess = false) {
      const s = dock.querySelector("#vedha-dock-status");
      if (!s) return;
      s.style.display = "block";
      s.innerText = msg;
      s.style.background = isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)";
      s.style.borderColor = isSuccess ? "rgba(16, 185, 129, 0.3)" : "rgba(99, 102, 241, 0.3)";
      s.style.color = isSuccess ? "#6ee7b7" : "#c7d2fe";
    }

    // Draggable Implementation (Supports both Pill and Dock Header)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let elemStartX = 0;
    let elemStartY = 0;
    let hasMoved = false;

    function handleDragStart(e) {
      if (e.target.closest("button, a, input, textarea, select, #vedha-dock-close, #vedha-dock-pin")) return;
      isDragging = true;
      hasMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = root.getBoundingClientRect();
      elemStartX = rect.left;
      elemStartY = rect.top;

      // Switch root strictly to left/top positioning for smooth dragging
      root.style.setProperty("left", `${elemStartX}px`, "important");
      root.style.setProperty("top", `${elemStartY}px`, "important");
      root.style.setProperty("right", "auto", "important");
      root.style.setProperty("bottom", "auto", "important");

      window.addEventListener("pointermove", handleDragMove, { passive: true });
      window.addEventListener("pointerup", handleDragEnd);
    }

    function handleDragMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (!hasMoved && Math.hypot(dx, dy) > 5) {
        hasMoved = true;
        root.style.cursor = "grabbing";
        pill.style.cursor = "grabbing";
      }

      if (hasMoved) {
        let newX = elemStartX + dx;
        let newY = elemStartY + dy;

        const w = root.offsetWidth || 320;
        const h = root.offsetHeight || 380;
        newX = Math.max(10, Math.min(window.innerWidth - w - 10, newX));
        newY = Math.max(10, Math.min(window.innerHeight - h - 10, newY));

        root.style.setProperty("left", `${newX}px`, "important");
        root.style.setProperty("top", `${newY}px`, "important");
      }
    }

    function handleDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);

      root.style.cursor = "";
      pill.style.cursor = "grab";

      if (hasMoved) {
        const rect = root.getBoundingClientRect();
        try {
          sessionStorage.setItem("vedha_dock_x", String(Math.round(rect.left)));
          sessionStorage.setItem("vedha_dock_y", String(Math.round(rect.top)));
        } catch (_) {}
      }
    }

    // Dynamic viewport resize listener to prevent dock from being pushed off-screen
    window.addEventListener("resize", () => {
      if (!root || !document.body.contains(root)) return;
      const rect = root.getBoundingClientRect();
      const w = root.offsetWidth || 320;
      const h = root.offsetHeight || 380;
      const clampedX = Math.max(10, Math.min(window.innerWidth - w - 10, rect.left));
      const clampedY = Math.max(10, Math.min(window.innerHeight - h - 10, rect.top));
      if (Math.round(clampedX) !== Math.round(rect.left) || Math.round(clampedY) !== Math.round(rect.top)) {
        root.style.setProperty("left", `${clampedX}px`, "important");
        root.style.setProperty("top", `${clampedY}px`, "important");
      }
    }, { passive: true });

    pill.addEventListener("pointerdown", handleDragStart);
    dock.querySelector("#vedha-dock-header")?.addEventListener("pointerdown", handleDragStart);

    pill.addEventListener("click", (e) => {
      if (hasMoved) {
        hasMoved = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const isVisible = dock.style.display === "flex";
      dock.style.display = isVisible ? "none" : "flex";
      pill.style.display = isVisible ? "flex" : "none";
    });

    dock.querySelector("#vedha-dock-close")?.addEventListener("click", () => {
      dock.style.display = "none";
      pill.style.display = "flex";
      isPinned = false;
      try { sessionStorage.setItem("vedha_dock_pinned", "false"); } catch (_) {}
    });

    dock.querySelector("#vedha-dock-pin")?.addEventListener("click", () => {
      isPinned = !isPinned;
      try { sessionStorage.setItem("vedha_dock_pinned", String(isPinned)); } catch (_) {}
      const pinBtn = dock.querySelector("#vedha-dock-pin");
      const pinLabel = dock.querySelector("#vedha-pin-label");
      if (isPinned) {
        if (pinBtn) {
          pinBtn.style.background = "rgba(16, 185, 129, 0.25)";
          pinBtn.style.borderColor = "#10b981";
          pinBtn.style.color = "#34d399";
        }
        if (pinLabel) pinLabel.innerText = "Pinned";
        setDockStatus("📌 Pinned on screen above all modals!", true);
      } else {
        if (pinBtn) {
          pinBtn.style.background = "rgba(99, 102, 241, 0.15)";
          pinBtn.style.borderColor = "rgba(99, 102, 241, 0.3)";
          pinBtn.style.color = "#a5b4fc";
        }
        if (pinLabel) pinLabel.innerText = "Pin";
        setDockStatus("Unpinned from screen.");
      }
    });

    // ... [existing button action listeners unchanged] ...

    // Append dock and pill to Shadow Root (encapsulated) and root to document body
    shadowRoot.appendChild(dock);
    shadowRoot.appendChild(pill);
    document.body.appendChild(root);
    return root;
  }
```

---

#### Blueprint B: Modify `manageModalStacking` (`extension/content.js:3034-3098`)

```javascript
    const hasActiveModal = openModals.length > 0;
    const dockRoot = document.getElementById("vedha-floating-copilot-root");
    const shadow = dockRoot?.shadowRoot;
    const dockCard = shadow ? shadow.getElementById("vedha-copilot-dock") : document.getElementById("vedha-copilot-dock");
    const dockPill = shadow ? shadow.getElementById("vedha-copilot-pill") : document.getElementById("vedha-copilot-pill");

    if (hasActiveModal) {
      // 1. Elevate LinkedIn's modal outlet container
      const modalOutlet = document.getElementById("artdeco-modal-outlet");
      if (modalOutlet) {
        modalOutlet.style.setProperty("z-index", "2147483000", "important");
        modalOutlet.style.setProperty("position", "relative", "important");
      }

      // 2. Constrain LinkedIn messaging container so chat trays NEVER obscure active modals
      const msgTray = document.querySelector("aside.msg-overlay-container, #msg-overlay");
      if (msgTray) {
        msgTray.style.setProperty("z-index", "1000", "important");
      }

      // 3. Stack modals progressively so secondary dialogs float strictly above primary dialogs
      const baseZ = 2147483100;
      openModals.forEach((modal, index) => {
        const modalZ = baseZ + index * 100;
        modal.style.setProperty("z-index", String(modalZ), "important");
        modal.style.setProperty("pointer-events", "auto", "important");
        modal.style.setProperty("visibility", "visible", "important");
        modal.style.setProperty("opacity", "1", "important");

        let parent = modal.parentElement;
        let depth = 0;
        while (parent && parent !== document.body && depth < 5) {
          const computed = window.getComputedStyle(parent);
          if (computed.overflow === "hidden" && parent.id !== "artdeco-modal-outlet") {
            parent.style.setProperty("overflow", "visible", "important");
          }
          parent = parent.parentElement;
          depth++;
        }

        const overlay =
          modal.closest(".artdeco-modal-overlay, .modal-backdrop, .overlay") ||
          modal.parentElement?.querySelector?.(".artdeco-modal-overlay, .modal-backdrop");
        if (overlay && overlay !== modal) {
          overlay.style.setProperty("z-index", String(modalZ - 1), "important");
          overlay.style.setProperty("pointer-events", "auto", "important");
        }
      });

      // 4. Coordinate with Vedha Copilot Dock:
      // Ensure dock root is ALWAYS elevated ABOVE all modals, overlays, and backdrops (z-index: 2147483647)
      if (dockRoot) {
        dockRoot.style.setProperty("z-index", "2147483647", "important");
        dockRoot.style.setProperty("position", "fixed", "important");
        if (dockRoot.parentElement && dockRoot.parentElement.lastElementChild !== dockRoot) {
          dockRoot.parentElement.appendChild(dockRoot);
        }
      }
      // Never force collapse if the user has pinned it or if it is actively in use
      let isUserPinned = false;
      try { isUserPinned = sessionStorage.getItem("vedha_dock_pinned") === "true"; } catch (_) {}
      if (isUserPinned && dockCard && dockPill) {
        dockCard.style.display = "flex";
        dockPill.style.display = "none";
      }
    } else {
      if (dockRoot) {
        dockRoot.style.setProperty("z-index", "2147483647", "important");
        dockRoot.style.setProperty("position", "fixed", "important");
        if (dockRoot.parentElement && dockRoot.parentElement.lastElementChild !== dockRoot) {
          dockRoot.parentElement.appendChild(dockRoot);
        }
      }
      const msgTray = document.querySelector("aside.msg-overlay-container, #msg-overlay");
      if (msgTray && msgTray.style.zIndex === "1000") {
        msgTray.style.removeProperty("z-index");
      }
    }
```

---

#### Blueprint C: Modify `chrome.runtime.onMessage` listener (`extension/content.js:3128-3147`)

```javascript
    } else if (request.action === "PIN_INPAGE_DOCK" || request.action === "OPEN_INPAGE_DOCK") {
      let dockRoot = document.getElementById("vedha-floating-copilot-root");
      if (!dockRoot) {
        // Force instantiate dock even if page did not match heuristic
        injectFloatingCopilotWidget(true);
        dockRoot = document.getElementById("vedha-floating-copilot-root");
      }
      if (dockRoot) {
        dockRoot.style.setProperty("z-index", "2147483647", "important");
        dockRoot.style.setProperty("position", "fixed", "important");
      }
      const shadow = dockRoot?.shadowRoot;
      const dockCard = shadow ? shadow.getElementById("vedha-copilot-dock") : document.getElementById("vedha-copilot-dock");
      const dockPill = shadow ? shadow.getElementById("vedha-copilot-pill") : document.getElementById("vedha-copilot-pill");
      if (dockCard && dockPill) {
        dockCard.style.display = "flex";
        dockPill.style.display = "none";
        try { sessionStorage.setItem("vedha_dock_pinned", "true"); } catch (_) {}
        const pinBtn = dockCard.querySelector("#vedha-dock-pin");
        const pinLabel = dockCard.querySelector("#vedha-pin-label");
        if (pinBtn) {
          pinBtn.style.background = "rgba(16, 185, 129, 0.25)";
          pinBtn.style.borderColor = "#10b981";
          pinBtn.style.color = "#34d399";
        }
        if (pinLabel) pinLabel.innerText = "Pinned";
      }
      sendResponse({ success: true, pinned: true });
      return true;
```

---

## 5. Verification Method

To independently verify these blueprint recommendations:

1. **Verify Shadow DOM Attachment**:
   - Inspect `#vedha-floating-copilot-root` in browser DevTools or automated test.
   - Assert `Boolean(root.shadowRoot)` is `true` and `root.shadowRoot.mode === "open"`.
   - Assert `root.shadowRoot.contains(dock)` and `root.shadowRoot.contains(pill)`.
   - Assert `document.querySelector("#vedha-copilot-dock") === null` while `root.shadowRoot.querySelector("#vedha-copilot-dock") !== null`.

2. **Verify Reset CSS Application & Isolation**:
   - Apply host rule `body * { box-sizing: content-box !important; }`.
   - Assert `window.getComputedStyle(dock).boxSizing === "border-box"`.
   - Assert host `button` styles do not modify `#vedha-dock-autoadvance` or close buttons.

3. **Verify Viewport Clamping**:
   - In a test window of width 800px and height 600px:
     - Set `sessionStorage.setItem("vedha_dock_x", "1200")` and `sessionStorage.setItem("vedha_dock_y", "900")`.
     - Mount the dock.
     - Assert `parseFloat(root.style.left) <= 800 - 340` (i.e. `<= 460px`).
     - Assert `parseFloat(root.style.top) <= 600 - 400` (i.e. `<= 200px`).
     - Assert `parseFloat(root.style.left) >= 10` and `parseFloat(root.style.top) >= 10`.

4. **Verify Pin Message Trigger on Non-Portal Pages**:
   - Dispatch `{ action: "PIN_INPAGE_DOCK" }` on an arbitrary webpage (e.g. `example.com`).
   - Assert `#vedha-floating-copilot-root` is created in `document.body`.
   - Assert `dockCard.style.display === "flex"`.
   - Assert `sessionStorage.getItem("vedha_dock_pinned") === "true"`.

5. **Verify Modal Elevation Preservation**:
   - Create a simulated modal with `z-index: 2147483100`.
   - Execute `manageModalStacking()`.
   - Assert `root.style.zIndex === "2147483647"` and `dockCard.style.display === "flex"` when pinned.
