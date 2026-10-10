/**
 * LinkedIn Easy Apply locator regressions (issue #3).
 * Form-validation copy must not be treated as chat, split-view buttons must
 * be found after async render, and an already-open modal must bind immediately.
 */

const { createBrowserEnvironment, loadExtensionContentScript } = require('./harness_env');

describe('Easy Apply detection', () => {
  it('does not treat form validation messages as LinkedIn chat', () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/view/123',
      html: `
        <div class="jobs-easy-apply-modal" role="dialog">
          <p class="artdeco-inline-feedback__message msg-warning">Enter a valid email address</p>
          <form class="jobs-easy-apply-form">
            <input name="email" />
            <button type="button">Next</button>
          </form>
        </div>
        <aside class="msg-overlay-container">
          <div role="dialog" aria-label="Messaging">
            <input name="msg-compose" />
            <button type="button">Send</button>
          </div>
        </aside>
      `
    });
    const api = loadExtensionContentScript(env);
    const feedback = env.document.querySelector('.artdeco-inline-feedback__message');
    const chat = env.document.querySelector('aside.msg-overlay-container');

    assert.strictEqual(api.isMsgOrChatElement(feedback), false, 'form message classes must not be chat');
    assert.strictEqual(api.isMsgOrChatElement(chat), true, 'messaging overlay must still be chat');

    const modal = api.findEasyApplyModal();
    assert.ok(modal, 'open Easy Apply modal must be found');
    assert.ok(modal.classList.contains('jobs-easy-apply-modal'), 'locator must bind the Easy Apply dialog, not chat');
    env.cleanup();
  });

  it('finds the Easy Apply button on a split-view search page and ignores the results list', () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/search/?currentJobId=99',
      html: `
        <div class="scaffold-layout__list jobs-search-results-list">
          <button class="jobs-apply-button" aria-label="Easy Apply to Other Role">Easy Apply</button>
        </div>
        <div class="scaffold-layout__detail jobs-search__job-details">
          <button class="jobs-apply-button" aria-label="Easy Apply to Staff Engineer at Acme">Easy  Apply</button>
        </div>
      `
    });
    const api = loadExtensionContentScript(env);
    const button = api.findEasyApplyButton();

    assert.ok(button, 'Easy Apply button in the job details pane must be found');
    assert.match(button.getAttribute('aria-label'), /Staff Engineer/, 'must be the active job, not a result-list button');
    env.cleanup();
  });

  it('finds an Easy Apply button on a direct job page when the label is split across whitespace', () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/view/555',
      html: `
        <main>
          <div class="jobs-unified-top-card">
            <button class="jobs-apply-button" aria-label="Easy Apply to Backend Engineer at Acme">Easy
Apply</button>
          </div>
        </main>
      `
    });
    const api = loadExtensionContentScript(env);
    const button = api.findEasyApplyButton();
    assert.ok(button, 'direct /jobs/view Easy Apply button must be found');
    assert.match(button.getAttribute('aria-label'), /Backend Engineer/);
    env.cleanup();
  });

  it('does not treat a plain Apply button as Easy Apply', () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/view/777',
      html: `
        <main>
          <button class="jobs-apply-button" aria-label="Apply to Backend Engineer at Acme">Apply</button>
        </main>
      `
    });
    const api = loadExtensionContentScript(env);
    assert.strictEqual(api.findEasyApplyButton(), null);
    env.cleanup();
  });

  it('polls until the split-view Easy Apply button is mounted', async () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/search/?currentJobId=42',
      html: '<div class="jobs-search__job-details" id="details"></div>'
    });
    const api = loadExtensionContentScript(env);
    const pending = api.waitForEasyApplySurface(2500);
    env.window.setTimeout(() => {
      env.document.getElementById('details').innerHTML =
        '<button class="jobs-apply-button" aria-label="Easy Apply to Data Scientist at Acme">Easy Apply</button>';
    }, 30);

    const surface = await pending;
    assert.ok(surface.button, 'polling must observe the button after async render');
    assert.match(surface.button.getAttribute('aria-label'), /Data Scientist/);
    env.cleanup();
  });

  it('dispatches pointer and mouse events before the native click', async () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/view/888',
      html: '<main><button id="apply" class="jobs-apply-button" aria-label="Easy Apply to Role">Easy Apply</button></main>'
    });
    const api = loadExtensionContentScript(env);
    const button = env.document.getElementById('apply');
    const seen = [];
    for (const type of ['pointerover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      button.addEventListener(type, () => seen.push(type));
    }

    await api.clickElementNaturally(button);

    assert.deepStrictEqual(seen, ['pointerover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    env.cleanup();
  });
});
