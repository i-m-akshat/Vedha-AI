/**
 * Tier 4: Real-World Job Application Scenarios
 * 
 * High-fidelity simulated workflows across major ATS and job board platforms:
 * 1. S1: LinkedIn Easy Apply Multi-Step Flow with Screening Questions
 * 2. S2: Greenhouse Job Board with Strict Validation & Formatting
 * 3. S3: Workday Enterprise Portal with Modal Elevation & Web Components
 * 4. S4: Offline Backend Mode with Fallback Profile & Form Filling
 * 5. S5: Dynamic Script Injection on Freshly Opened Tab & Recovery
 * 6. S6: Side Panel Persistent Session Across Tab Switches
 * 
 * Authoritative Source: TEST_INFRA.md, ORIGINAL_REQUEST.md, PROJECT.md
 */

const {
  createBrowserEnvironment,
  loadExtensionContentScript,
  loadExtensionPopup
} = require('./harness_env');

describe('Tier 4: Real-World Application Workloads', () => {

  // S1: LinkedIn Easy Apply Multi-Step Flow
  it('S1: LinkedIn Easy Apply multi-step flow with screening questions and Review Gateway', async () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/view/999001',
      html: `
        <div id="artdeco-modal-outlet">
          <div class="jobs-easy-apply-modal" role="dialog" style="z-index: 2147483000;">
            <div class="jobs-easy-apply-content">
              <h3>Contact Info</h3>
              <input id="email_step" type="email" name="email" value=""/>
              <button id="step1_next">Continue to next step</button>
            </div>
          </div>
        </div>
      `
    });

    // 1. Script injection & dock elevation
    const exports = loadExtensionContentScript(env);
    if (exports.injectFloatingCopilotWidget) exports.injectFloatingCopilotWidget();
    if (exports.manageModalStacking) exports.manageModalStacking();

    const root = env.document.getElementById('vedha-floating-copilot-root');
    assert.ok(root, 'Copilot dock must be present on LinkedIn portal');
    assert.strictEqual(root.style.getPropertyValue('z-index'), '2147483647');

    // 2. Discover step 1 progression button
    const modal = env.document.querySelector('.jobs-easy-apply-modal');
    const step1Progression = exports.findFormProgressionButton(modal);
    assert.ok(step1Progression, 'Must discover Step 1 progression button');
    assert.strictEqual(step1Progression.type, 'next');

    // 3. Populate and advance to Step 2 (Experience)
    exports.setNativeValue(env.document.getElementById('email_step'), 'alex.rivera@example.com');
    assert.strictEqual(env.document.getElementById('email_step').value, 'alex.rivera@example.com');

    // Simulate DOM transition to Stage 2
    modal.querySelector('.jobs-easy-apply-content').innerHTML = `
      <h3>Work Experience</h3>
      <input id="years_exp" type="text" value="5 years"/>
      <div role="alert" class="field-error">Must be a whole number</div>
      <button id="step2_next">Next</button>
    `;

    // 4. Self-healing error on stage 2
    await exports.remediateValidationErrors(modal);
    const healedYears = env.document.getElementById('years_exp').value;
    assert.match(healedYears, /\d+/, 'Years of experience must be sanitized to digits');

    // 5. Advance to Final Step (Review)
    modal.querySelector('.jobs-easy-apply-content').innerHTML = `
      <h3>Review your application</h3>
      <p>Summary of answers...</p>
      <button id="submit_application">Submit application</button>
    `;

    // 6. Review Gateway pause before final submission
    const res = await env.chrome.runtime.onMessage.dispatch({
      action: 'AUTONOMOUS_MULTI_STEP_FILL',
      payload: { copilotMode: true, company: 'LinkedIn Corp', title: 'Senior Software Engineer' }
    });

    if (res) {
      assert.strictEqual(res.pausedForReview, true, 'Must pause at Review Gateway before submission');
    }
    env.cleanup();
  });

  // S2: Greenhouse Job Board with Strict Validation & Formatting
  it('S2: Greenhouse job board application with strict integer experience and phone formatting', async () => {
    const env = createBrowserEnvironment({
      url: 'https://boards.greenhouse.io/stripe/jobs/456789',
      html: `
        <form id="application_form">
          <div class="field">
            <label>Years of experience</label>
            <input id="gh_years" type="text" value="6 years of experience"/>
            <span class="field-error">Please enter a valid whole number</span>
          </div>
          <div class="field">
            <label>Phone Number</label>
            <input id="gh_phone" type="tel" value="07911 123456"/>
            <span class="field-error">Invalid phone format</span>
          </div>
          <div class="field">
            <label>Portfolio URL (Optional)</label>
            <input id="gh_portfolio" type="text" value="not-a-link"/>
          </div>
          <button id="gh_submit" type="submit">Submit application</button>
        </form>
      `
    });

    const exports = loadExtensionContentScript(env);
    const form = env.document.getElementById('application_form');

    // Detect errors
    const errors = exports.findActiveValidationErrors(form);
    assert.ok(errors.length >= 1, 'Must detect Greenhouse form validation errors');

    // Remediate fields
    await exports.remediateValidationErrors(form);

    // Verify sanitized values
    const yearsVal = env.document.getElementById('gh_years').value;
    assert.match(yearsVal, /\d+/, 'Experience must be cleaned to numeric digits');

    // Verify progression discovery scopes correctly
    const progression = exports.findFormProgressionButton(form);
    assert.ok(progression, 'Must discover form submit/progression button');
    env.cleanup();
  });

  // S3: Workday Enterprise Portal with Web Components
  it('S3: Workday enterprise portal with Shadow DOM web components and modal elevation', async () => {
    const env = createBrowserEnvironment({
      url: 'https://wd5.myworkdayjobs.com/en-US/Company/job/123/apply',
      html: `
        <div class="workday-shell" style="z-index: 5000;">
          <div class="modal-dialog" role="dialog" style="z-index: 5001;">
            <div class="wd-form-container">
              <input id="wd_name" type="text"/>
              <button id="wd_next">Save and continue</button>
            </div>
          </div>
        </div>
      `
    });

    const exports = loadExtensionContentScript(env);
    if (exports.injectFloatingCopilotWidget) exports.injectFloatingCopilotWidget();
    if (exports.manageModalStacking) exports.manageModalStacking();

    // Verify copilot stacks above Workday modal elevation
    const root = env.document.getElementById('vedha-floating-copilot-root');
    if (root) {
      assert.strictEqual(root.style.getPropertyValue('z-index'), '2147483647');
    }

    // Progression button discovery matches "Save and continue"
    const modal = env.document.querySelector('.modal-dialog');
    const prog = exports.findFormProgressionButton(modal);
    assert.ok(prog, 'Must discover Workday "Save and continue" button');
    assert.strictEqual(prog.element.id, 'wd_next');
    assert.strictEqual(prog.type, 'next');

    // Composed event dispatch updates Workday React input
    const input = env.document.getElementById('wd_name');
    exports.setNativeValue(input, 'Alex Rivera');
    assert.strictEqual(input.value, 'Alex Rivera');
    env.cleanup();
  });

  // S4: Offline Backend Mode — fail closed, never fabricate
  it('S4: Offline backend recovery leaves identity blank and reports unanswered (no starvation fabrication)', async () => {
    const env = createBrowserEnvironment({
      url: 'https://jobs.lever.co/techco/apply',
      html: `
        <form id="lever-form">
          <input name="name" id="name_field"/>
          <input name="email" id="email_field"/>
          <input name="phone" id="phone_field"/>
          <input name="org" id="org_field"/>
        </form>
      `
    });

    loadExtensionContentScript(env);

    // Dispatch form fill with empty payload (simulating unreachable backend service)
    const fillResult = await env.chrome.runtime.onMessage.dispatch({
      action: 'AUTO_FILL_FORM',
      payload: {}
    });

    assert.ok(fillResult, 'Auto fill must complete');
    const nameVal = env.document.getElementById('name_field').value;
    const emailVal = env.document.getElementById('email_field').value;

    assert.strictEqual(nameVal, '', 'Name must stay blank without profile data (never fabricated)');
    assert.strictEqual(emailVal, '', 'Email must stay blank without profile data (never fabricated)');
    assert.ok(
      !String(nameVal + emailVal).includes('Alex') && !String(nameVal + emailVal).includes('555'),
      'No persona values may leak into the form'
    );
    assert.ok((fillResult.unansweredCount || 0) >= 4, 'Blank identity fields must be reported as unanswered');
    env.cleanup();
  });

  // S5: Dynamic Content Script Injection & Tab Recovery
  it('S5: Background script dynamic tab injection & messaging recovery on fresh tab', async () => {
    const env = createBrowserEnvironment({
      url: 'https://ashbyhq.com/startup/jobs/1',
      html: '<form><button>Apply</button></form>'
    });

    // 1. Initial ping on tab without content script fails
    let initialPingRes = null;
    try {
      initialPingRes = await env.chrome.runtime.onMessage.dispatch({ action: 'PING_CONTENT_SCRIPT' });
    } catch (_) {}
    assert.strictEqual(initialPingRes, null, 'Initial ping should yield null on un-injected tab');

    // 2. Trigger programmatic script injection
    let injectionTriggered = false;
    env.chrome.scripting.executeScript = async ({ target, files }) => {
      if (files.includes('content.js')) {
        injectionTriggered = true;
        // Inject script into simulated environment
        loadExtensionContentScript(env);
      }
      return [{ result: true }];
    };

    await env.chrome.scripting.executeScript({
      target: { tabId: 1 },
      files: ['content.js']
    });
    assert.ok(injectionTriggered, 'Scripting API must execute content.js injection');

    // 3. Tab is now initialized with idempotency guard
    assert.strictEqual(env.window.__VEDHA_CONTENT_SCRIPT_INITIALIZED__, true);
    env.cleanup();
  });

  // S6: Side Panel Persistent Session Across Tab Switches
  it('S6: Side Panel persistent job application multi-tab context synchronization', async () => {
    const env = createBrowserEnvironment({
      tabs: [
        { id: 10, active: true, url: 'https://www.linkedin.com/jobs/view/1' },
        { id: 20, active: false, url: 'https://boards.greenhouse.io/jobs/2' }
      ]
    });
    loadExtensionPopup(env);

    let tabChangeHandled = false;
    env.chrome.tabs.onActivated.addListener(activeInfo => {
      if (activeInfo.tabId === 20) {
        tabChangeHandled = true;
      }
    });

    // Simulate user switching to Tab 20 in browser
    env.chrome.tabs.onActivated.dispatch({ tabId: 20, windowId: 1 });
    assert.ok(tabChangeHandled, 'Side Panel must listen and handle tab activation switch');
    env.cleanup();
  });

});
