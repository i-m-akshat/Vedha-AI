/**
 * Open extension issues #4 and #5.
 * Unpinned copilot yields to dialogs. Popup stays usable off job pages.
 */

const {
  createBrowserEnvironment,
  loadExtensionContentScript,
  loadExtensionPopup,
  readExtensionManifest
} = require('./harness_env');

function dockNodes(root) {
  const shadow = root && root.shadowRoot;
  const q = (id) => (shadow && shadow.querySelector ? shadow.querySelector('#' + id) : null);
  return {
    card: q('vedha-copilot-dock'),
    pill: q('vedha-copilot-pill')
  };
}

describe('Open extension issues #4 and #5', () => {
  it('unpinned dock collapses under a dialog and restores after the dialog closes', () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/view/42',
      html: '<div id="page"></div>'
    });
    const exports = loadExtensionContentScript(env);
    const root = env.document.getElementById('vedha-floating-copilot-root');
    assert.ok(root, 'Dock root must inject on a LinkedIn job');
    const { card, pill } = dockNodes(root);
    assert.ok(card && pill, 'Dock card and pill must exist');

    card.style.display = 'flex';
    card.dataset.vedhaExpanded = 'true';
    pill.style.display = 'none';

    const modal = env.document.createElement('div');
    modal.id = 'apply-modal';
    modal.className = 'jobs-easy-apply-modal';
    modal.setAttribute('role', 'dialog');
    env.document.body.appendChild(modal);

    exports.manageModalStacking();
    assert.strictEqual(root.style.getPropertyValue('z-index'), '2147482000');
    assert.strictEqual(card.style.display, 'none');
    assert.strictEqual(pill.style.display, 'flex');

    const modalZ = parseInt(
      env.document.getElementById('apply-modal').style.getPropertyValue('z-index'),
      10
    );
    assert.strictEqual(modalZ, 2147483100);

    env.document.getElementById('apply-modal').remove();
    exports.manageModalStacking();
    assert.strictEqual(root.style.getPropertyValue('z-index'), '2147483647');
    assert.strictEqual(card.style.display, 'flex');
    assert.strictEqual(pill.style.display, 'none');
    env.cleanup();
  });

  it('pinned dock stays expanded above dialogs', () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/view/42',
      html: '<div role="dialog" class="artdeco-modal" id="dlg">Discard?</div>'
    });
    env.window.sessionStorage.setItem('vedha_dock_pinned', 'true');
    const exports = loadExtensionContentScript(env);
    exports.manageModalStacking();
    const root = env.document.getElementById('vedha-floating-copilot-root');
    const { card, pill } = dockNodes(root);
    assert.strictEqual(root.style.getPropertyValue('z-index'), '2147483647');
    assert.strictEqual(card.style.display, 'flex');
    assert.strictEqual(pill.style.display, 'none');
    env.cleanup();
  });

  it('later dialogs stack above earlier dialogs', () => {
    const env = createBrowserEnvironment({
      url: 'https://www.linkedin.com/jobs/view/42',
      html: `
        <div role="dialog" id="primary" class="artdeco-modal">Apply</div>
        <div role="dialog" id="secondary" class="artdeco-modal">Discard application?</div>
      `
    });
    const exports = loadExtensionContentScript(env);
    exports.manageModalStacking();
    const primary = parseInt(env.document.getElementById('primary').style.getPropertyValue('z-index'), 10);
    const secondary = parseInt(env.document.getElementById('secondary').style.getPropertyValue('z-index'), 10);
    assert.strictEqual(primary, 2147483100);
    assert.strictEqual(secondary, 2147483200);
    env.cleanup();
  });

  it('toolbar action opens popup.html', () => {
    const manifest = readExtensionManifest();
    assert.strictEqual(manifest.action.default_popup, 'popup.html');
  });

  it('google.com popup shows Universal Careers Mode with tools enabled', () => {
    const env = createBrowserEnvironment({ url: 'https://www.google.com/' });
    loadExtensionPopup(env);
    const title = env.document.getElementById('jobTitle');
    assert.strictEqual(title.textContent, 'Universal Careers Mode');
    const ats = env.document.getElementById('runAtsAnalysisBtn');
    const draft = env.document.getElementById('generateCoverLetterBtn');
    assert.strictEqual(Boolean(ats.disabled), false);
    assert.strictEqual(Boolean(draft.disabled), false);
    const tabs = env.document.querySelectorAll('.tab-btn');
    assert.ok(tabs.length >= 4, 'Dashboard tabs must be present');
    env.cleanup();
  });

  it('cached profile does not invent notice period or visa status', async () => {
    const env = createBrowserEnvironment({ url: 'https://www.google.com/' });
    env.window.fetch = async () => {
      throw new Error('backend down');
    };
    await env.chrome.storage.local.set({
      vedha_token: 'cached-token',
      cachedUser: { fullName: 'Ada Lovelace', email: 'ada@vedha.ai' },
      candidateProfile: {
        phoneNumber: '555-0100',
        noticePeriodDays: null,
        expectedSalary: '',
        requiresVisaSponsorship: null
      }
    });
    loadExtensionPopup(env);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const copilot = env.document.getElementById('view-copilot');
    const login = env.document.getElementById('view-login');
    assert.notStrictEqual(copilot.style.display, 'none');
    assert.strictEqual(login.style.display, 'none');
    const list = env.document.getElementById('profileList').textContent;
    assert.ok(list.includes('Not Specified'));
    assert.ok(!list.includes('30 Days'));
    assert.ok(!list.includes('Authorized to work'));
    assert.ok(list.includes('555-0100'));
    env.cleanup();
  });

  it('pipeline prefilledAnswers hydrate into screening question resolution', () => {
    const env = createBrowserEnvironment({ url: 'https://www.linkedin.com/jobs/view/42' });
    const exports = loadExtensionContentScript(env);
    const payload = {
      prefilledAnswers: [
        {
          questionText: 'Why do you want to work at Acme?',
          answerText: 'I have 8 years building scalable distributed .NET systems.',
          confidenceScore: 0.99,
          source: 'AI Grounding'
        },
        {
          QuestionText: 'What is your primary cloud platform?',
          AnswerText: 'AWS and GCP',
          ConfidenceScore: 1.0,
          Source: 'Memory'
        }
      ]
    };

    const res1 = exports.resolveScreeningAnswer('Why do you want to work at Acme?', payload);
    assert.ok(res1, 'Should resolve prefilled answer');
    assert.strictEqual(res1.answerText, 'I have 8 years building scalable distributed .NET systems.');
    assert.strictEqual(res1.confidence, 0.99);

    const res2 = exports.resolveScreeningAnswer('What is your primary cloud platform?', payload);
    assert.ok(res2, 'Should resolve PascalCase QuestionText/AnswerText prefilled answer');
    assert.strictEqual(res2.answerText, 'AWS and GCP');
    assert.strictEqual(res2.confidence, 1.0);

    env.cleanup();
  });

  it('pipeline coverLetter hydrates into cover letter question resolution', () => {
    const env = createBrowserEnvironment({ url: 'https://boards.greenhouse.io/acme/jobs/42' });
    const exports = loadExtensionContentScript(env);
    const payload = {
      coverLetter: 'Dear Hiring Manager,\nI am thrilled to apply for the Principal Engineer role...'
    };

    const res = exports.resolveScreeningAnswer('Please attach or paste your Cover Letter', payload);
    assert.ok(res, 'Should resolve cover letter answer');
    assert.strictEqual(res.answerText, 'Dear Hiring Manager,\nI am thrilled to apply for the Principal Engineer role...');
    assert.strictEqual(res.confidence, 0.98);
    assert.strictEqual(res.source, 'coverletter');

    env.cleanup();
  });
});
