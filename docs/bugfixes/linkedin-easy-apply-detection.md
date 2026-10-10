# Bug Fix: LinkedIn Easy Apply button and modal were not detected

## Classification
Bug Fix

## Root Cause
Auto-Apply failed with `Could not find 'Easy Apply' button or open application modal` for three independent reasons:

1. **Chat false positives.** A class substring check for `msg` treats normal form copy (`artdeco-inline-feedback__message`, `form-group__message`, `msg-warning`) as LinkedIn messaging and skips the open Easy Apply dialog.
2. **Split-view timing and the wrong button.** On `/jobs/search/?currentJobId=...` the details pane arrives after the first scan. The locator also accepted any `jobs-apply-button`, including result-list rows and external `Apply` buttons, and it missed labels split by whitespace (`Easy\nApply`).
3. **Click sequence.** A bare `element.click()` does not move the pointer through `pointerover` → `pointerdown` → `mousedown` → `pointerup` → `mouseup` before the click LinkedIn's handlers observe.

An already-open modal was also easy to miss when the only match was a generic outlet node rather than an Easy Apply container.

## Proposed Fix
- `isMsgOrChatElement` matches only messaging containers (`aside.msg-overlay-container`, `#msg-overlay`, conversation bubbles) and the Messaging aria label.
- `findEasyApplyButton` requires an Easy Apply label or `data-view-name`, ignores the search results list, prefers the details pane, and collapses whitespace before matching.
- `waitForEasyApplySurface` polls for at least 2.5 seconds and returns an already-open modal immediately.
- `clickElementNaturally` dispatches the pointer and mouse sequence at the control's center, then one native click.
- Explicit modal selectors include `.jobs-easy-apply-modal`, the Easy Apply form, `#jobs-apply-header`, and Easy Apply `data-view-name` / `data-test-modal-id` markers.

## Files affected
- `extension/content.js`
- `tests/e2e/easy_apply_detection.test.js`
- `tests/e2e/harness_env.js`
- `tests/e2e/runner.js`

## Regression Risks
External `Apply` buttons are no longer clicked. Those jobs still return the existing company-site message from `detectExternalApplyButton`. Jobs whose Easy Apply control has neither the words "Easy Apply" nor an easy-apply view name will not be clicked.

## Test Strategy
Harness tests cover form-message versus chat classification, split-view versus results-list buttons, direct `/jobs/view` pages, delayed mounting, rejection of a plain Apply button, and the pointer event order.

## Verification Steps
`node --check extension/content.js`

`node tests/e2e/runner.js`

## Changelog
### 2026-10-10T13:10:00Z
- **Changes Made**: Tightened chat detection, added details-pane polling, and sent a full pointer sequence before click.
- **Rationale**: Issue #3. Auto-Apply could not find the Easy Apply button or attach to a modal the user had already opened.
- **Impacted Components**: Chrome extension content script.
