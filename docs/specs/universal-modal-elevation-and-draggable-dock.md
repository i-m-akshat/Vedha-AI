# Feature Specification: Universal Modal Elevation & Draggable Anti-Occlusion Dock

## Overview
When job seekers use career portals (e.g., LinkedIn Easy Apply, Greenhouse, Lever, Ashby, Workday), application modals, secondary confirmation dialogs ("Discard application?", "Save application?"), dropdown pickers, and custom form popups frequently get hidden or trapped behind sticky page headers, floating chat trays, parent stacking contexts, or browser extension overlays. This feature implements an autonomous **Modal Elevation & Stacking Manager** in the extension content script that detects all open modals and forces them to the absolute foreground (`z-index: 2,147,483,000+`), layered hierarchically so that secondary/child dialogs always float above primary dialogs. Additionally, the in-page **Vedha Floating Copilot Dock** is upgraded with full viewport drag-and-drop capability and automatic collapse/z-index demotion whenever a modal is active, ensuring the user can freely interact with any modal without visual obstruction.

## Business Goal
Maximize application completion rates and eliminate user friction caused by modals rendering in the background or being obscured by page elements or copilot widgets. Ensure 100% usability and freedom of interaction across all desktop screen sizes and web platforms.

## User Stories
- **As a candidate**, when an application modal (or secondary confirmation dialog like "Discard?", "Save application?", or dropdown picker) opens, I want it to be brought to the top of all other content on the page, so that I can view and interact with every field and button freely.
- **As a candidate**, I want the Vedha Copilot floating widget to be draggable anywhere on my screen and auto-collapse when a modal opens, so that it never blocks my view or covers form buttons.
- **As a candidate**, if I drag the copilot widget to my preferred screen location, I want it to remember its position for the duration of my session.

## Acceptance Criteria
1. **Universal Modal Elevation**:
   - Any opened modal (`[role="dialog"]`, `[aria-modal="true"]`, `.artdeco-modal`, `#artdeco-modal-outlet > div`, `dialog[open]`, `.modal.show`, etc.) is dynamically assigned a foreground z-index (`2,147,483,000+`) with `pointer-events: auto !important` and `visibility: visible !important`.
   - Secondary / nested modals (e.g., "Discard?", "Save application?", date pickers, dropdowns) are assigned an incremental z-index (`baseZ + index * 100`) so they sit strictly on top of primary modals and backdrops.
2. **Backdrop & Overlay Positioning**:
   - Modal backdrop overlays (`.artdeco-modal-overlay`, `.modal-backdrop`) are styled to sit immediately beneath the active dialog (`modalZ - 1`) but above the base page content.
3. **LinkedIn Chat Overlay De-prioritization**:
   - When an application modal is open on LinkedIn, the messaging tray (`aside.msg-overlay-container`) is constrained to a lower z-index (`1000`) so it cannot trap or obscure modal fields.
4. **Draggable Copilot Widget**:
   - Both the collapsed pill and expanded dock can be clicked and dragged anywhere within the viewport bounds.
   - Drag coordinates are saved to `sessionStorage` and restored on subsequent page loads or navigation within the tab.
   - Distinguishes drags from clicks (clicking without dragging toggles expanded/collapsed state).
5. **Auto-Coexistence / Auto-Minimization**:
   - When a modal opens, an expanded dock automatically collapses into the compact pill and its z-index drops below the modal (`2,147,482,000`), guaranteeing zero modal occlusion.

## Functional Requirements
- **FR-1**: Continuously observe DOM mutations and execute periodic pulses (300ms) to detect any modal dialog becoming active or visible.
- **FR-2**: Apply non-destructive inline styling or dedicated stylesheet rules that override host portal CSS rules hiding modals behind stacking contexts.
- **FR-3**: Support pointer drag events (`pointerdown`, `pointermove`, `pointerup`) with viewport boundary clamping (`0 <= left <= innerWidth - width`, `0 <= top <= innerHeight - height`).
- **FR-4**: Provide tactile visual cues for draggability (grab cursor and drag handle `⋮⋮`).

## Non-functional Requirements
- **Performance**: DOM inspection must be lightweight, throttled, and execute in `< 2ms` per mutation pass without causing layout thrashing.
- **Security**: No external script injection; entirely contained within Manifest v3 content script sandbox.
- **Accessibility**: Native keyboard navigation (Tab, Enter, Escape) and ARIA attributes must remain uninhibited.

## Architecture
```
+--------------------------------------------------------------------------+
| Browser Window Viewport                                                  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Secondary Modal (e.g. "Discard?", Dropdown)   z-index: 2147483200  |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Primary Application Modal (Easy Apply)        z-index: 2147483100  |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Modal Backdrop / Overlay                      z-index: 2147483099  |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Vedha Copilot Dock (Draggable, Auto-minimized)z-index: 2147482000  |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Host Page Navigation, Header, & Chat Window   z-index: <= 1000     |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

## Changelog
- **2026-10-06 01:58:00 IST**: Initial specification created in response to user request for open modals to be forced on top of all page content and freely usable without being hidden in the background.
