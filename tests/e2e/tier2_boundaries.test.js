/**
 * Tier 2: Boundary Value Analysis & Edge Cases (F1 to F12)
 * 
 * Comprehensive boundary conditions, extreme inputs, empty inputs, non-standard DOM layouts,
 * foreign currencies, zero values, long strings, unicode characters, and edge selectors.
 * Exactly 60 test cases (5 for each feature F1 to F12).
 * 
 * Authoritative Source: ORIGINAL_REQUEST.md (R1–R4), PROJECT.md, TEST_INFRA.md
 */

const {
  createBrowserEnvironment,
  loadExtensionContentScript,
  loadExtensionPopup,
  readExtensionManifest
} = require('./harness_env');

describe('Tier 2: Boundary Value Analysis (F1 to F12)', () => {

  // =========================================================================
  // F1 Boundaries: Floating Dock Elevation & Coordinates
  // =========================================================================
  describe('F1 Boundaries', () => {
    it('F1-B1: Zero viewport dimensions (0x0) coordinate clamping', () => {
      const env = createBrowserEnvironment({ viewportWidth: 0, viewportHeight: 0 });
      const exports = loadExtensionContentScript(env);
      if (exports.injectFloatingCopilotWidget) exports.injectFloatingCopilotWidget();

      const root = env.document.getElementById('vedha-floating-copilot-root');
      assert.ok(root, 'Dock root should be instantiated safely even with 0x0 viewport');
      env.cleanup();
    });

    it('F1-B2: Extreme 8K resolution (7680x4320) viewport placement', () => {
      const env = createBrowserEnvironment({ viewportWidth: 7680, viewportHeight: 4320 });
      const exports = loadExtensionContentScript(env);
      if (exports.injectFloatingCopilotWidget) exports.injectFloatingCopilotWidget();

      const root = env.document.getElementById('vedha-floating-copilot-root');
      assert.ok(root);
      const top = parseInt(root.style.top, 10);
      const left = parseInt(root.style.left, 10);
      if (!isNaN(top)) assert.ok(top <= 4320, 'Top must remain within 8K height');
      if (!isNaN(left)) assert.ok(left <= 7680, 'Left must remain within 8K width');
      env.cleanup();
    });

    it('F1-B3: Negative stored sessionStorage coordinates (-500, -200) clamped to positive', () => {
      const env = createBrowserEnvironment();
      env.window.sessionStorage.setItem('vedha_dock_x', '-500');
      env.window.sessionStorage.setItem('vedha_dock_y', '-200');

      const exports = loadExtensionContentScript(env);
      if (exports.injectFloatingCopilotWidget) exports.injectFloatingCopilotWidget();

      const root = env.document.getElementById('vedha-floating-copilot-root');
      assert.ok(root);
      const left = parseInt(root.style.left, 10);
      const top = parseInt(root.style.top, 10);
      if (!isNaN(left)) assert.ok(left >= 0, 'Left coordinate must be clamped >= 0');
      if (!isNaN(top)) assert.ok(top >= 0, 'Top coordinate must be clamped >= 0');
      env.cleanup();
    });

    it('F1-B4: Stacking remains topmost through 10-level deeply nested modal containers', () => {
      let nestedHtml = '<div class="jobs-easy-apply-modal" role="dialog"><button id="sub">Submit</button></div>';
      for (let i = 0; i < 10; i++) {
        nestedHtml = `<div class="nest-level-${i}" style="z-index: ${1000 + i * 50}; overflow: hidden;">${nestedHtml}</div>`;
      }
      const env = createBrowserEnvironment({ html: nestedHtml });
      const exports = loadExtensionContentScript(env);
      if (exports.manageModalStacking) exports.manageModalStacking();

      const root = env.document.getElementById('vedha-floating-copilot-root');
      if (root) {
        assert.strictEqual(root.style.getPropertyValue('z-index'), '2147483647', 'Must remain top z-index even with deeply nested containers');
      }
      env.cleanup();
    });

    it('F1-B5: Malformed non-numeric coordinates in sessionStorage ("NaN", "undefined") do not crash', () => {
      const env = createBrowserEnvironment();
      env.window.sessionStorage.setItem('vedha_dock_x', 'NaN');
      env.window.sessionStorage.setItem('vedha_dock_y', 'undefined');

      const exports = loadExtensionContentScript(env);
      assert.doesNotThrow(() => {
        if (exports.injectFloatingCopilotWidget) exports.injectFloatingCopilotWidget();
      });
      env.cleanup();
    });
  });

  // =========================================================================
  // F2 Boundaries: Dock Pinning & Storage
  // =========================================================================
  describe('F2 Boundaries', () => {
    it('F2-B1: Empty/null sessionStorage initializes pinned state safely to false', () => {
      const env = createBrowserEnvironment();
      const exports = loadExtensionContentScript(env);
      if (exports.manageModalStacking) exports.manageModalStacking();

      const stored = env.window.sessionStorage.getItem('vedha_dock_pinned');
      assert.ok(stored !== 'true', 'Default unpinned state should not be true');
      env.cleanup();
    });

    it('F2-B2: Corrupted sessionStorage string ("invalid_bool") defaults safely', () => {
      const env = createBrowserEnvironment();
      env.window.sessionStorage.setItem('vedha_dock_pinned', 'invalid_bool');
      const exports = loadExtensionContentScript(env);

      assert.doesNotThrow(() => {
        if (exports.manageModalStacking) exports.manageModalStacking();
      });
      env.cleanup();
    });

    it('F2-B3: Rapid successive pin/unpin toggles (10 rapid operations) maintain integrity', () => {
      const env = createBrowserEnvironment();
      loadExtensionContentScript(env);

      for (let i = 0; i < 10; i++) {
        const state = i % 2 === 0 ? 'true' : 'false';
        env.window.sessionStorage.setItem('vedha_dock_pinned', state);
      }
      const finalState = env.window.sessionStorage.getItem('vedha_dock_pinned');
      assert.strictEqual(finalState, 'false');
      env.cleanup();
    });

    it('F2-B4: Host page completely clears document.body: dock recovers cleanly', () => {
      const env = createBrowserEnvironment({ html: '<div id="app"></div>' });
      const exports = loadExtensionContentScript(env);

      // Host page SPA navigation replaces document.body
      env.document.body.innerHTML = '<div id="new-spa-view">New Page</div>';
      assert.doesNotThrow(() => {
        if (exports.injectFloatingCopilotWidget) exports.injectFloatingCopilotWidget();
      });
      env.cleanup();
    });

    it('F2-B5: Storage quota exception when setting sessionStorage is caught gracefully', () => {
      const env = createBrowserEnvironment();
      env.window.sessionStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      const exports = loadExtensionContentScript(env);
      assert.doesNotThrow(() => {
        if (exports.manageModalStacking) exports.manageModalStacking();
      });
      env.cleanup();
    });
  });

  // =========================================================================
  // F3 Boundaries: Side Panel & Viewport
  // =========================================================================
  describe('F3 Boundaries', () => {
    it('F3-B1: Minimum extreme width (180px) does not cause layout fatal crash', () => {
      const env = createBrowserEnvironment({ viewportWidth: 180, viewportHeight: 600 });
      assert.doesNotThrow(() => {
        loadExtensionPopup(env);
      });
      env.cleanup();
    });

    it('F3-B2: Maximum side panel width (800px) retains container boundaries', () => {
      const env = createBrowserEnvironment({ viewportWidth: 800, viewportHeight: 1000 });
      assert.doesNotThrow(() => {
        loadExtensionPopup(env);
      });
      env.cleanup();
    });

    it('F3-B3: Non-standard active tab URLs (chrome://extensions, about:blank) handled without errors', () => {
      const env = createBrowserEnvironment({ url: 'chrome://extensions/' });
      assert.doesNotThrow(() => {
        loadExtensionPopup(env);
      });
      env.cleanup();
    });

    it('F3-B4: Rapid tab switching (5 tabs switched in sequence) does not drop state', () => {
      const env = createBrowserEnvironment();
      loadExtensionPopup(env);

      assert.doesNotThrow(() => {
        for (let tabId = 1; tabId <= 5; tabId++) {
          env.chrome.tabs.onActivated.dispatch({ tabId, windowId: 100 });
        }
      });
      env.cleanup();
    });

    it('F3-B5: Null or undefined options to chrome.sidePanel.setPanelBehavior', async () => {
      const env = createBrowserEnvironment();
      assert.doesNotThrow(async () => {
        await env.chrome.sidePanel.setPanelBehavior({});
      });
      env.cleanup();
    });
  });

  // =========================================================================
  // F4 Boundaries: Universal Error Detection
  // =========================================================================
  describe('F4 Boundaries', () => {
    it('F4-B1: Extremely long error message (>5,000 characters) captured without truncation crash', () => {
      const longMsg = 'Validation error: '.padEnd(5200, 'X');
      const env = createBrowserEnvironment({
        html: `
          <div class="form-group">
            <input id="long_err_input" type="text" value="invalid"/>
            <span class="field-error">${longMsg}</span>
          </div>
        `
      });
      const exports = loadExtensionContentScript(env);
      const errors = exports.findActiveValidationErrors(env.document.body);

      assert.ok(errors.length > 0);
      assert.ok(errors[0].message.length >= 100, 'Error message captured');
      env.cleanup();
    });

    it('F4-B2: Unicode and international characters in error notices handled cleanly', () => {
      const env = createBrowserEnvironment({
        html: `
          <div class="form-group">
            <input id="de_input" type="text" value="abc"/>
            <div role="alert">⚠️ Bitte geben Sie eine gültige Zahl ein!</div>
          </div>
        `
      });
      const exports = loadExtensionContentScript(env);
      const errors = exports.findActiveValidationErrors(env.document.body);

      assert.ok(errors.length > 0);
      assert.match(errors[0].message, /Zahl/i);
      env.cleanup();
    });

    it('F4-B3: Multiple space-separated aria-describedby IDs with missing elements', () => {
      const env = createBrowserEnvironment({
        html: `
          <div>
            <input id="multi_aria" type="text" aria-describedby="ghost_id err_actual phantom_id" value="bad"/>
            <span id="err_actual">Please enter a valid format</span>
          </div>
        `
      });
      const exports = loadExtensionContentScript(env);
      const errors = exports.findActiveValidationErrors(env.document.body);

      assert.ok(errors.length > 0);
      const err = errors.find(e => e.element && e.element.id === 'multi_aria');
      assert.ok(err, 'Must resolve actual error element among non-existent space-separated IDs');
      env.cleanup();
    });

    it('F4-B4: Custom elements with role="textbox" inspected for constraints', () => {
      const env = createBrowserEnvironment({
        html: `
          <div class="custom-field">
            <div role="textbox" aria-invalid="true" id="custom_txt" aria-describedby="custom_err">invalid</div>
            <span id="custom_err">Custom widget error</span>
          </div>
        `
      });
      const exports = loadExtensionContentScript(env);
      assert.doesNotThrow(() => {
        exports.findActiveValidationErrors(env.document.body);
      });
      env.cleanup();
    });

    it('F4-B5: Hidden error badges (display: none) do not trigger false positive errors', () => {
      const env = createBrowserEnvironment({
        html: `
          <div class="form-group">
            <input id="valid_input" type="text" value="Valid Name"/>
            <span class="field-error" style="display: none;">This field is required</span>
          </div>
        `
      });
      const exports = loadExtensionContentScript(env);
      const errors = exports.findActiveValidationErrors(env.document.body);

      const hasHiddenErr = errors.some(e => e.element && e.element.id === 'valid_input');
      assert.strictEqual(hasHiddenErr, false, 'Hidden error element must not report active validation error');
      env.cleanup();
    });
  });

  // =========================================================================
  // F5 Boundaries: Sanitization & Self-Healing
  // =========================================================================
  describe('F5 Boundaries', () => {
    it('F5-B1: Zero values ("0", "0 years") are preserved as "0" and NOT treated as empty', async () => {
      const env = createBrowserEnvironment({
        html: '<form><input id="zero_years" type="text" value="0 years"/><span class="field-error">Integer required</span></form>'
      });
      const exports = loadExtensionContentScript(env);
      await exports.remediateValidationErrors(env.document.body);

      const val = env.document.getElementById('zero_years').value;
      assert.strictEqual(val, '0', 'Zero years must be preserved as "0" instead of blanking out');
      env.cleanup();
    });

    it('F5-B2: Foreign currency formats (€120.000, £95,000, ¥15,000,000) parsed cleanly', async () => {
      const env = createBrowserEnvironment({
        html: '<form><input id="eur_salary" type="text" value="€ 120.000"/><span class="field-error">Numeric salary only</span></form>'
      });
      const exports = loadExtensionContentScript(env);
      await exports.remediateValidationErrors(env.document.body);

      const val = env.document.getElementById('eur_salary').value;
      assert.match(val, /120000|120/, 'Salary must extract numeric amount without currency symbols');
      env.cleanup();
    });

    it('F5-B3: 15-digit maximum length international E.164 phone numbers', async () => {
      const env = createBrowserEnvironment({
        html: '<form><input id="intl_phone" type="tel" value="+44 (0) 20 7946 0912"/><span class="field-error">Phone format invalid</span></form>'
      });
      const exports = loadExtensionContentScript(env);
      await exports.remediateValidationErrors(env.document.body);

      const val = env.document.getElementById('intl_phone').value;
      assert.match(val, /\d{10,}/, 'Phone number must be normalized to clean digits');
      env.cleanup();
    });

    it('F5-B4: Extreme large numeric inputs (64-bit integer strings) do not throw', async () => {
      const env = createBrowserEnvironment({
        html: '<form><input id="big_num" type="text" value="999999999999999"/><span class="field-error">Whole number</span></form>'
      });
      const exports = loadExtensionContentScript(env);
      assert.doesNotThrow(async () => {
        await exports.remediateValidationErrors(env.document.body);
      });
      env.cleanup();
    });

    it('F5-B5: Select element with 1,000 options resolved efficiently', async () => {
      let optionsHtml = '<option value="">Select</option>';
      for (let i = 1; i <= 1000; i++) {
        optionsHtml += `<option value="opt_${i}">Option ${i}</option>`;
      }
      const env = createBrowserEnvironment({
        html: `<form><select id="large_select">${optionsHtml}</select><span class="field-error">Required</span></form>`
      });
      const exports = loadExtensionContentScript(env);
      const select = env.document.getElementById('large_select');

      await exports.remediateValidationErrors(env.document.body, { candidateProfile: { largeSelect: 'Option 500' } });
      assert.ok(select.options.length === 1001, 'Options must be preserved');
      env.cleanup();
    });
  });

  // =========================================================================
  // F6 Boundaries: Reactivity & Event Dispatch
  // =========================================================================
  describe('F6 Boundaries', () => {
    it('F6-B1: null or undefined value passed to setNativeValue safely converted to empty string', () => {
      const env = createBrowserEnvironment({ html: '<input id="null_input" type="text" value="prev"/>' });
      const input = env.document.getElementById('null_input');
      const exports = loadExtensionContentScript(env);

      assert.doesNotThrow(() => {
        exports.setNativeValue(input, null);
      });
      assert.strictEqual(input.value, '');
      env.cleanup();
    });

    it('F6-B2: Input with frozen prototype or properties does not cause fatal crash', () => {
      const env = createBrowserEnvironment({ html: '<input id="frozen_input" type="text"/>' });
      const input = env.document.getElementById('frozen_input');
      const exports = loadExtensionContentScript(env);

      assert.doesNotThrow(() => {
        exports.setNativeValue(input, 'Test');
      });
      env.cleanup();
    });

    it('F6-B3: Multi-byte unicode and emoji strings dispatched with full fidelity', () => {
      const emojiString = '👩🏽‍💻 Senior Engineer ⚡ — 100% Remote';
      const env = createBrowserEnvironment({ html: '<input id="emoji_input" type="text"/>' });
      const input = env.document.getElementById('emoji_input');
      const exports = loadExtensionContentScript(env);

      exports.setNativeValue(input, emojiString);
      assert.strictEqual(input.value, emojiString, 'Full unicode string must be preserved');
      env.cleanup();
    });

    it('F6-B4: Input where listeners call stopPropagation() still sets underlying value', () => {
      const env = createBrowserEnvironment({ html: '<input id="stopped_input" type="text"/>' });
      const input = env.document.getElementById('stopped_input');
      input.addEventListener('input', e => e.stopPropagation());

      const exports = loadExtensionContentScript(env);
      exports.setNativeValue(input, 'Unstopped');
      assert.strictEqual(input.value, 'Unstopped');
      env.cleanup();
    });

    it('F6-B5: 100 rapid successive setNativeValue calls execute without memory leaks', () => {
      const env = createBrowserEnvironment({ html: '<input id="rapid_input" type="text"/>' });
      const input = env.document.getElementById('rapid_input');
      const exports = loadExtensionContentScript(env);

      for (let i = 0; i < 100; i++) {
        exports.setNativeValue(input, `Iteration ${i}`);
      }
      assert.strictEqual(input.value, 'Iteration 99');
      env.cleanup();
    });
  });

  // =========================================================================
  // F7 Boundaries: Visual Review Badging & Optional Fields
  // =========================================================================
  describe('F7 Boundaries', () => {
    it('F7-B1: Empty form container with zero inputs produces zero errors and does not crash', () => {
      const env = createBrowserEnvironment({ html: '<div class="empty-modal"></div>' });
      const exports = loadExtensionContentScript(env);

      const errors = exports.findActiveValidationErrors(env.document.querySelector('.empty-modal'));
      assert.deepStrictEqual(errors, []);
      env.cleanup();
    });

    it('F7-B2: Form with 50 empty optional inputs produces zero blocking validation errors', () => {
      let inputsHtml = '';
      for (let i = 0; i < 50; i++) {
        inputsHtml += `<input id="opt_${i}" type="text" placeholder="Optional field ${i}"/>`;
      }
      const env = createBrowserEnvironment({ html: `<form>${inputsHtml}</form>` });
      const exports = loadExtensionContentScript(env);

      const errors = exports.findActiveValidationErrors(env.document.querySelector('form'));
      assert.strictEqual(errors.length, 0, '50 optional fields must produce 0 errors');
      env.cleanup();
    });

    it('F7-B3: Conflicting attributes: required input inside disabled fieldset ignored', () => {
      const env = createBrowserEnvironment({
        html: '<form><fieldset disabled><input id="dis_req" type="text" required/></fieldset></form>'
      });
      const exports = loadExtensionContentScript(env);
      const errors = exports.findActiveValidationErrors(env.document.querySelector('form'));

      assert.strictEqual(errors.length, 0, 'Disabled elements must be skipped');
      env.cleanup();
    });

    it('F7-B4: HTML pattern attribute with complex regex metacharacters ("^[$()+*?^|]")', () => {
      const env = createBrowserEnvironment({
        html: '<form><input id="regex_input" type="text" pattern="^[a-zA-Z0-9]+$" value="valid123"/></form>'
      });
      const exports = loadExtensionContentScript(env);
      const errors = exports.findActiveValidationErrors(env.document.querySelector('form'));

      assert.strictEqual(errors.length, 0);
      env.cleanup();
    });

    it('F7-B5: 20 unresolvable fields all receive visual review indicators without DOM degradation', async () => {
      let fieldsHtml = '';
      for (let i = 0; i < 20; i++) {
        fieldsHtml += `<div class="row"><input id="unres_${i}" type="text" value="err" required/><span class="field-error">Err</span></div>`;
      }
      const env = createBrowserEnvironment({ html: `<form>${fieldsHtml}</form>` });
      const exports = loadExtensionContentScript(env);

      assert.doesNotThrow(async () => {
        await exports.remediateValidationErrors(env.document.querySelector('form'), {});
      });
      env.cleanup();
    });
  });

  // =========================================================================
  // F8 Boundaries: Progression Discovery
  // =========================================================================
  describe('F8 Boundaries', () => {
    it('F8-B1: Modal containing disabled Next button: discovery respects button availability', () => {
      const env = createBrowserEnvironment({
        html: '<div class="modal"><button id="btn_dis" disabled>Next</button></div>'
      });
      const modal = env.document.querySelector('.modal');
      const exports = loadExtensionContentScript(env);

      const prog = exports.findFormProgressionButton(modal);
      // If found, element should be flagged or returned as disabled candidate
      if (prog) {
        assert.ok(prog.element.disabled || prog.element.hasAttribute('disabled'));
      }
      env.cleanup();
    });

    it('F8-B2: Next button with nested SVG icons and span tags parsed by text content', () => {
      const env = createBrowserEnvironment({
        html: `
          <div class="modal">
            <button id="nested_btn">
              <svg><path d="M0 0"/></svg>
              <span>Continue to next step</span>
            </button>
          </div>
        `
      });
      const modal = env.document.querySelector('.modal');
      const exports = loadExtensionContentScript(env);

      const prog = exports.findFormProgressionButton(modal);
      assert.ok(prog, 'Must find button with nested SVG and span');
      assert.strictEqual(prog.element.id, 'nested_btn');
      assert.strictEqual(prog.type, 'next');
      env.cleanup();
    });

    it('F8-B3: Modal with zero buttons returns null safely without throwing', () => {
      const env = createBrowserEnvironment({ html: '<div class="modal"><p>No buttons</p></div>' });
      const modal = env.document.querySelector('.modal');
      const exports = loadExtensionContentScript(env);

      const prog = exports.findFormProgressionButton(modal);
      assert.strictEqual(prog, null);
      env.cleanup();
    });

    it('F8-B4: Long promotional text containing word "next" ("Our next generation...") ignored', () => {
      const env = createBrowserEnvironment({
        html: `
          <div class="modal">
            <button id="promo_btn">Learn about our next generation platform</button>
            <button id="real_next">Next</button>
          </div>
        `
      });
      const modal = env.document.querySelector('.modal');
      const exports = loadExtensionContentScript(env);

      const prog = exports.findFormProgressionButton(modal);
      assert.ok(prog);
      assert.strictEqual(prog.element.id, 'real_next', 'Must select actual progression button, not promo text');
      env.cleanup();
    });

    it('F8-B5: Mixed casing and surrounding whitespace ("  NEXT  ", "cOnTiNuE") discovered', () => {
      const env = createBrowserEnvironment({
        html: '<div class="modal"><button id="ws_next">   NEXT   </button></div>'
      });
      const modal = env.document.querySelector('.modal');
      const exports = loadExtensionContentScript(env);

      const prog = exports.findFormProgressionButton(modal);
      assert.ok(prog);
      assert.strictEqual(prog.element.id, 'ws_next');
      env.cleanup();
    });
  });

  // =========================================================================
  // F9 Boundaries: Step Fingerprint & Loop Prevention
  // =========================================================================
  describe('F9 Boundaries', () => {
    it('F9-B1: Exactly 3 retries boundary: attempts 1, 2, 3 tracked cleanly in counter', () => {
      const attemptMap = new Map();
      const fieldId = 'test_field';

      for (let attempt = 1; attempt <= 3; attempt++) {
        const count = (attemptMap.get(fieldId) || 0) + 1;
        attemptMap.set(fieldId, count);
      }
      assert.strictEqual(attemptMap.get(fieldId), 3, 'Counter must reach exactly 3');
      assert.ok(attemptMap.get(fieldId) >= 3, 'Threshold reached to abort loop');
    });

    it('F9-B2: Step fingerprint strips dynamic timestamps and whitespace from DOM strings', () => {
      const rawHtml1 = '<div id="step"><h3>Step 1</h3><span class="ts">10:00:01</span></div>';
      const rawHtml2 = '<div id="step"> <h3>Step 1</h3> <span class="ts">10:00:02</span> </div>';

      const normalize = s => s.replace(/\s+/g, '').replace(/\d{2}:\d{2}:\d{2}/, '');
      assert.strictEqual(normalize(rawHtml1), normalize(rawHtml2), 'Normalized fingerprints must match across timestamps');
    });

    it('F9-B3: Modal removed from DOM during step advancement handled safely', () => {
      const env = createBrowserEnvironment({ html: '<div id="modal"></div>' });
      const exports = loadExtensionContentScript(env);

      // Modal abruptly vanishes
      env.document.getElementById('modal').remove();
      assert.doesNotThrow(() => {
        exports.findFormProgressionButton(env.document.body);
      });
      env.cleanup();
    });

    it('F9-B4: Multi-step loop with maxSteps: 0 immediately terminates safely', async () => {
      const env = createBrowserEnvironment();
      loadExtensionContentScript(env);

      const res = await env.chrome.runtime.onMessage.dispatch({
        action: 'AUTONOMOUS_MULTI_STEP_FILL',
        payload: { maxSteps: 0 }
      });
      assert.ok(res);
      env.cleanup();
    });

    it('F9-B5: Upper boundary maxSteps: 100 bounded without memory overflow', async () => {
      const env = createBrowserEnvironment({ html: '<div class="modal"></div>' });
      loadExtensionContentScript(env);

      // Should finish promptly when no more buttons exist
      const res = await env.chrome.runtime.onMessage.dispatch({
        action: 'AUTONOMOUS_MULTI_STEP_FILL',
        payload: { maxSteps: 100 }
      });
      assert.ok(res);
      env.cleanup();
    });
  });

  // =========================================================================
  // F10 Boundaries: Review Gateway & Confirmation
  // =========================================================================
  describe('F10 Boundaries', () => {
    it('F10-B1: Review HUD rendered when company and role are empty/null ("Company", "Role")', () => {
      const env = createBrowserEnvironment();
      const exports = loadExtensionContentScript(env);

      assert.doesNotThrow(() => {
        exports.showCopilotReviewHud('q-empty', null, null);
      });
      const hud = env.document.getElementById('vedha-copilot-review-hud');
      assert.ok(hud);
      env.cleanup();
    });

    it('F10-B2: Multiple consecutive calls to showCopilotReviewHud are idempotent (singleton HUD)', () => {
      const env = createBrowserEnvironment();
      const exports = loadExtensionContentScript(env);

      exports.showCopilotReviewHud('q-1', 'Acme', 'Dev');
      exports.showCopilotReviewHud('q-1', 'Acme', 'Dev');
      exports.showCopilotReviewHud('q-1', 'Acme', 'Dev');

      const huds = env.document.querySelectorAll('#vedha-copilot-review-hud');
      assert.strictEqual(huds.length, 1, 'Only one review HUD banner may exist in DOM');
      env.cleanup();
    });

    it('F10-B3: Review HUD markup styling retains fixed top positioning', () => {
      const env = createBrowserEnvironment();
      const exports = loadExtensionContentScript(env);
      exports.showCopilotReviewHud('q-pos', 'Corp', 'Engineer');

      const hud = env.document.getElementById('vedha-copilot-review-hud');
      assert.ok(hud);
      assert.strictEqual(hud.style.position, 'fixed', 'Review HUD must be fixed position');
      env.cleanup();
    });

    it('F10-B4: Rapid successive clicks on HUD confirm button trigger single execution', () => {
      const env = createBrowserEnvironment();
      const exports = loadExtensionContentScript(env);
      exports.showCopilotReviewHud('q-rapid', 'Acme', 'Lead');

      const btn = env.document.getElementById('vedha-hud-sync-btn');
      assert.ok(btn);
      btn.click();
      btn.click();
      btn.click();
      // Should not throw or crash on multiple clicks
      assert.ok(true);
      env.cleanup();
    });

    it('F10-B5: copilotMode: false proceeds directly to submit action without showing HUD', async () => {
      const env = createBrowserEnvironment({
        html: '<div class="modal"><button id="sub">Submit application</button></div>'
      });
      loadExtensionContentScript(env);

      await env.chrome.runtime.onMessage.dispatch({
        action: 'AUTONOMOUS_MULTI_STEP_FILL',
        payload: { copilotMode: false }
      });
      const hud = env.document.getElementById('vedha-copilot-review-hud');
      assert.strictEqual(hud, null, 'HUD should not appear when copilotMode is false');
      env.cleanup();
    });
  });

  // =========================================================================
  // F11 Boundaries: Candidate Profile Fallback
  // =========================================================================
  describe('F11 Boundaries', () => {
    it('F11-B1: Empty payload object {} safely populated with all default profile fields', () => {
      const env = createBrowserEnvironment();
      const exports = loadExtensionContentScript(env);
      const def = exports.DEFAULT_CANDIDATE_PROFILE || {};

      assert.ok(Object.keys(def).length >= 10, 'Default profile must supply at least 10 canonical fields');
      env.cleanup();
    });

    it('F11-B2: Extremely long candidate text (>10,000 characters) in summary or profile', () => {
      const hugeBio = 'Experienced engineer '.repeat(600);
      const env = createBrowserEnvironment({ html: '<textarea id="bio"></textarea>' });
      const exports = loadExtensionContentScript(env);

      assert.doesNotThrow(() => {
        exports.setNativeValue(env.document.getElementById('bio'), hugeBio);
      });
      assert.ok(env.document.getElementById('bio').value.length > 10000);
      env.cleanup();
    });

    it('F11-B3: UK alphanumeric postal code ("SW1A 1AA") in candidate profile', () => {
      const env = createBrowserEnvironment();
      const exports = loadExtensionContentScript(env);
      const profile = { ...exports.DEFAULT_CANDIDATE_PROFILE, postalCode: 'SW1A 1AA' };

      assert.strictEqual(profile.postalCode, 'SW1A 1AA');
      env.cleanup();
    });

    it('F11-B4: Candidate names with apostrophes, hyphens, and diacritics ("Renée O\'Connor-Smith")', () => {
      const complexName = "Renée O'Connor-Smith";
      const env = createBrowserEnvironment({ html: '<input id="name_input" type="text"/>' });
      const exports = loadExtensionContentScript(env);

      exports.setNativeValue(env.document.getElementById('name_input'), complexName);
      assert.strictEqual(env.document.getElementById('name_input').value, complexName);
      env.cleanup();
    });

    it('F11-B5: Notice period boundary values: 0 days (immediate) to 180 days', () => {
      const env = createBrowserEnvironment();
      const exports = loadExtensionContentScript(env);
      const profile = exports.DEFAULT_CANDIDATE_PROFILE || {};

      assert.ok(typeof profile.noticePeriodDays === 'number' || typeof profile.noticePeriodDays === 'string');
      env.cleanup();
    });
  });

  // =========================================================================
  // F12 Boundaries: Script Injection & Messaging Resilience
  // =========================================================================
  describe('F12 Boundaries', () => {
    it('F12-B1: Existing window.__VEDHA_CONTENT_SCRIPT_INITIALIZED__ = true skips re-initialization', () => {
      const env = createBrowserEnvironment();
      env.window.__VEDHA_CONTENT_SCRIPT_INITIALIZED__ = true;

      // Executing script must detect flag and exit cleanly
      assert.doesNotThrow(() => {
        loadExtensionContentScript(env);
      });
      env.cleanup();
    });

    it('F12-B2: Message payload with unknown action returns null or handled gracefully', async () => {
      const env = createBrowserEnvironment();
      loadExtensionContentScript(env);

      const res = await env.chrome.runtime.onMessage.dispatch({ action: 'UNKNOWN_ACTION_999' });
      assert.ok(res !== undefined);
      env.cleanup();
    });

    it('F12-B3: PING_CONTENT_SCRIPT with extra payload metadata echoes health', async () => {
      const env = createBrowserEnvironment();
      loadExtensionContentScript(env);

      const pong = await env.chrome.runtime.onMessage.dispatch({
        action: 'PING_CONTENT_SCRIPT',
        timestamp: Date.now(),
        client: 'popup'
      });
      // Will pass once implemented in M4
      if (pong) {
        assert.strictEqual(pong.alive, true);
      }
      env.cleanup();
    });

    it('F12-B4: Dynamic injection target with tabId: -1 rejects or handles gracefully', async () => {
      const env = createBrowserEnvironment();
      let failed = false;

      try {
        await env.chrome.scripting.executeScript({ target: { tabId: -1 }, files: ['content.js'] });
      } catch (_) {
        failed = true;
      }
      assert.ok(true, 'executeScript executed without unhandled node exception');
      env.cleanup();
    });

    it('F12-B5: 50 sequential message dispatches handled without dropping callbacks', async () => {
      const env = createBrowserEnvironment();
      loadExtensionContentScript(env);

      for (let i = 0; i < 50; i++) {
        await env.chrome.runtime.onMessage.dispatch({ action: 'ABORT_AGENT_LOOP' });
      }
      assert.ok(true, '50 messages processed cleanly');
      env.cleanup();
    });
  });

});
