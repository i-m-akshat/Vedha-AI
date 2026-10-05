# Implementation Plan: Universal Modal Elevation & Draggable Anti-Occlusion Dock

## Proposed Changes

### Chrome Extension (`extension/content.js`)
1. **Modal Stacking & Elevation Engine**:
   - Implement `manageModalStacking()`:
     - Scans for all open dialogs (`[role='dialog']`, `[aria-modal='true']`, `.artdeco-modal`, `#artdeco-modal-outlet > div`, `dialog[open]`, `.modal.show`, etc.).
     - Excludes minimized docked messaging overlays (`aside.msg-overlay-container`).
     - If dialogs are found:
       - Sorts by document position / hierarchy.
       - Loops through each dialog and assigns progressive z-index: `baseZ = 2147483000 + (index * 100)`.
       - Applies `pointer-events: auto !important`, `visibility: visible !important`, `opacity: 1 !important`.
       - Finds and sets associated backdrop / overlay (`.artdeco-modal-overlay`, `.modal-backdrop`) to `(dialogZ - 1) !important`.
       - On LinkedIn: elevates `#artdeco-modal-outlet` to `2147483000 !important` and constrains `aside.msg-overlay-container` to `z-index: 1000 !important;` so chat windows don't overlap modals.
       - Notifies the floating dock if an active modal is detected.
   - Attach `MutationObserver` on `document.body` + periodic pulse (`setInterval(manageModalStacking, 350)`).
2. **Draggable & Adaptive Floating Copilot Dock**:
   - Add mouse/pointer drag handlers to `#vedha-floating-copilot-root`:
     - Allow grabbing either the pill or dock header.
     - Add visual drag handle `⋮⋮` with grab cursor.
     - Viewport clamping: ensures widget never moves outside visible viewport.
     - Saves coordinates `vedha_dock_x` and `vedha_dock_y` in `sessionStorage` and restores on load.
     - Suppresses click event if movement exceeded 5px (clean drag vs click disambiguation).
   - In `manageModalStacking()`:
     - When any modal is open:
       - Auto-collapse expanded dock to compact pill.
       - Ensure dock z-index is set to `2147482000` (strictly below the active modal's `2147483000`).
     - When all modals close:
       - Restore standard dock z-index `9999999`.

## Verification Strategy
- Syntax validation via `node --check extension/content.js`.
- Test dragging behavior and position persistence.
- Test multi-modal nesting (Easy Apply + Discard confirmation dialog).
- Ensure existing unit tests in `.NET` remain unaffected.

## Rollback Strategy
- Changes are fully self-contained in `extension/content.js`. Revert via `git checkout extension/content.js` if necessary.

## Changelog
- **2026-10-06 01:58:30 IST**: Plan drafted for autonomous modal elevation engine, multi-modal hierarchical stacking, and draggable copilot dock.
