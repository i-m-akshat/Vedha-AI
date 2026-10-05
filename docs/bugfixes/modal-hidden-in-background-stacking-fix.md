# Bug Fix Plan: Application Modal Hidden in Background Stacking Fix

## Root Cause Analysis
1. **Host Site Stacking Contexts**: On career portals like LinkedIn, modals are mounted inside containers such as `#artdeco-modal-outlet`. In complex layouts (e.g., `/jobs/search/?currentJobId=...`), fixed headers (`header.global-nav`), chat drawer containers (`aside.msg-overlay-container`), or multi-pane CSS transforms establish separate CSS stacking contexts. If z-index is set to default (1000 or 1050), any higher fixed element or overlay masks or pushes the modal behind.
2. **Multi-Modal Conflict**: When secondary dialogs open (e.g. "Discard Application?", "Save application?", country dial-code pickers, or custom date/file selectors), if both the primary modal and the secondary modal share the same z-index, the secondary modal is often rendered beneath the primary modal's backdrop overlay, rendering it invisible or unclickable.
3. **Extension Floating Widget Occlusion**: The newly introduced `#vedha-floating-copilot-root` was given a high static z-index (`9999999`) and fixed coordinates (`bottom: 24px; right: 24px;`) without draggability or modal awareness. Because the bottom-right corner of desktop screens is precisely where modal action buttons ("Next", "Review", "Submit") and dismissal/secondary controls reside, the floating dock sat directly on top of modal elements, making them appear hidden or inaccessible.

## Proposed Solution
1. **Autonomous Modal Stacking Engine**:
   - Implement `manageModalStacking()` running on DOM mutations and every 300ms.
   - Detect all visible dialogs (`[role='dialog']`, `[aria-modal='true']`, `.artdeco-modal`, `#artdeco-modal-outlet > div`, `dialog[open]`, `.modal.show`, etc.).
   - Elevate them to a base z-index of `2,147,483,000`, with each subsequent/nested modal receiving `+100` z-index so child dialogs always float above parent dialogs.
   - Ensure `pointer-events: auto !important`, `visibility: visible !important`, and `opacity: 1 !important`.
   - On LinkedIn, explicitly elevate `#artdeco-modal-outlet` and lower `aside.msg-overlay-container` while a modal is open.
2. **Draggable & Adaptive Floating Dock**:
   - Enable pointer dragging on `#vedha-floating-copilot-root` across the viewport, persisting coordinates in `sessionStorage`.
   - Add a subtle drag handle `⋮⋮` with grab cursor.
   - Automatically collapse expanded docks into the compact pill when any modal opens.
   - Set the dock's active z-index to `2,147,482,000` (below the active modal) so modals always have 100% click priority.

## Files Affected
- `extension/content.js`: Main content script handling modal detection, elevation, and draggable floating dock.
- `docs/specs/universal-modal-elevation-and-draggable-dock.md`: Specification.
- `docs/plan/universal-modal-elevation-and-draggable-dock.md`: Implementation plan.
- `context.md`: Architectural records.

## Regression Risks
- **Risk**: Overriding modal z-index could theoretically interfere with browser native dropdowns (e.g. native `<select>`).
  - *Mitigation*: Native `<select>` popups are rendered by the OS/browser chrome outside normal DOM stacking; elevating DOM dialogs will not affect them.
- **Risk**: Dragging could accidentally trigger click toggle on the copilot pill.
  - *Mitigation*: Track pointer travel distance; if the pointer moved > 5 pixels, suppress the click handler.

## Verification Steps
1. Open a job on LinkedIn with Easy Apply.
2. Verify the modal opens in front of all page elements, sticky headers, and chat windows.
3. Click "✕" or "Cancel" to trigger the secondary "Discard application?" confirmation modal.
4. Verify the secondary modal renders in the foreground above the primary modal and can be clicked freely.
5. Verify the Vedha Copilot pill can be dragged anywhere on the screen.
6. Verify the copilot widget auto-collapses and stays below the active modal.
