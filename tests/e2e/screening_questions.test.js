/**
 * LinkedIn Easy Apply screening-question extraction and grounded fill.
 * Safe auto-fill must read legend/label question text, answer only from
 * verified profile or resume evidence, and badge low-confidence fields.
 */

const { createBrowserEnvironment, loadExtensionContentScript } = require('./harness_env');

const EASY_APPLY_STEP = `
  <div class="jobs-easy-apply-modal" role="dialog">
    <div class="jobs-easy-apply-form-section">
      <div class="fb-dash-form-element">
        <label for="fn"><span class="artdeco-text-input--label">First Name</span></label>
        <input id="fn" type="text" name="firstName">
      </div>
      <div class="fb-dash-form-element">
        <label for="pg"><span class="artdeco-text-input--label">How many years of experience do you have with PostgreSQL?</span></label>
        <input id="pg" type="number" required>
      </div>
      <div class="fb-dash-form-element">
        <label for="k8s"><span class="artdeco-text-input--label">How many years of experience do you have with Kubernetes?</span></label>
        <input id="k8s" type="number" required>
      </div>
      <fieldset data-test-form-builder-radio-button-form-component="true">
        <legend>
          <span data-test-form-builder-radio-button-form-component__title="">
            <span aria-hidden="true">Are you willing to commute to Bangalore?</span>
          </span>
        </legend>
        <input type="radio" name="commute" id="c-yes" value="Yes">
        <label for="c-yes">Yes</label>
        <input type="radio" name="commute" id="c-no" value="No">
        <label for="c-no">No</label>
      </fieldset>
      <div class="fb-dash-form-element">
        <label for="visa"><span class="fb-dash-form-element__label"><span aria-hidden="true">Do you have a valid B1 visa?</span></span></label>
        <select id="visa" required>
          <option value="">Select an option</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
      <div class="fb-dash-form-element">
        <span class="fb-dash-form-element__label"><span aria-hidden="true">Which work mode do you prefer?</span></span>
        <div role="combobox" aria-required="true" id="mode">
          <input type="text" id="mode-input" role="combobox">
        </div>
      </div>
    </div>
  </div>
`;

function loadModal() {
  const env = createBrowserEnvironment({
    url: 'https://www.linkedin.com/jobs/view/123/',
    html: EASY_APPLY_STEP
  });
  const exports = loadExtensionContentScript(env);
  return { env, exports, modal: env.document.querySelector('.jobs-easy-apply-modal') };
}

describe('Tier 1: LinkedIn screening question extraction', () => {
  it('extracts legend, label, select, and combobox questions without collapsing them to the first label', () => {
    const { env, exports, modal } = loadModal();
    assert.ok(exports.extractFormQuestions, 'extractFormQuestions must be exported');
    const questions = exports.extractFormQuestions(modal);
    const texts = questions.map(q => q.questionText);

    assert.ok(texts.includes('First Name'), 'must extract First Name');
    assert.ok(texts.includes('How many years of experience do you have with PostgreSQL?'), 'must extract PostgreSQL question');
    assert.ok(texts.includes('Are you willing to commute to Bangalore?'), 'must extract commute legend, not the Yes option');
    assert.ok(texts.includes('Do you have a valid B1 visa?'), 'must extract visa select label');
    assert.ok(texts.includes('Which work mode do you prefer?'), 'must extract combobox question');

    const commute = questions.find(q => /commute/i.test(q.questionText));
    assert.strictEqual(commute.fieldType, 'radio');
    assert.deepStrictEqual(commute.options, ['Yes', 'No']);

    const visa = questions.find(q => /B1 visa/i.test(q.questionText));
    assert.strictEqual(visa.fieldType, 'select');
    assert.ok(visa.required, 'required select must be flagged');
    assert.deepStrictEqual(visa.options, ['Yes', 'No']);

    const pg = questions.find(q => /PostgreSQL/i.test(q.questionText));
    assert.strictEqual(pg.fieldType, 'number');
    assert.ok(pg.required, 'required numeric question must be flagged');

    const mode = questions.find(q => /work mode/i.test(q.questionText));
    assert.strictEqual(mode.fieldType, 'combobox');
    env.cleanup();
  });

  it('grounds skill years from the resume and refuses invented totals', () => {
    const { env, exports } = loadModal();
    const payload = {
      totalYearsExperience: 12,
      masterResume: {
        schema: {
          experience: [{
            role: 'Backend Engineer',
            startDate: '2022-01-01',
            endDate: '2026-01-01',
            highlights: ['Owned PostgreSQL migrations and query tuning']
          }]
        }
      }
    };

    const pg = exports.resolveScreeningAnswer(
      'How many years of experience do you have with PostgreSQL?',
      payload
    );
    assert.strictEqual(pg.answerText, '4');
    assert.ok(pg.confidence >= 0.8, 'resume-derived skill years are high confidence');

    const unknown = exports.resolveScreeningAnswer(
      'How many years of experience do you have with Kubernetes?',
      payload
    );
    assert.ok(!unknown || !unknown.answerText, 'unknown skills must not fall back to total experience or 5');

    const total = exports.resolveScreeningAnswer('How many years of professional experience do you have?', {
      totalYearsExperience: null
    });
    assert.ok(!total || !total.answerText, 'missing total experience must stay blank');
    env.cleanup();
  });

  it('answers commute and visa only from explicit profile facts', () => {
    const { env, exports } = loadModal();
    const yesNo = ['Yes', 'No'];

    const livesThere = exports.resolveScreeningAnswer({
      questionText: 'Are you willing to commute to Bangalore?',
      fieldType: 'radio',
      options: yesNo
    }, { currentCity: 'Bangalore', willingToCommute: null });
    assert.strictEqual(livesThere.answerText, 'Yes');

    const refuses = exports.resolveScreeningAnswer({
      questionText: 'Are you willing to commute to Bangalore?',
      fieldType: 'radio',
      options: yesNo
    }, { currentCity: 'Seattle', willingToCommute: false });
    assert.strictEqual(refuses.answerText, 'No');

    const differentCity = exports.resolveScreeningAnswer({
      questionText: 'Are you willing to commute to Bangalore?',
      fieldType: 'radio',
      options: yesNo
    }, { currentCity: 'Seattle', willingToCommute: true });
    assert.ok(!differentCity, 'a different city must not be guessed as a commute yes');

    const hasB1 = exports.resolveScreeningAnswer({
      questionText: 'Do you have a valid B1 visa?',
      fieldType: 'select',
      options: yesNo
    }, { visas: ['B1'], requiresVisaSponsorship: false });
    assert.strictEqual(hasB1.answerText, 'Yes');

    const unknownVisa = exports.resolveScreeningAnswer({
      questionText: 'Do you have a valid B1 visa?',
      fieldType: 'select',
      options: yesNo
    }, { requiresVisaSponsorship: false });
    assert.ok(!unknownVisa, 'sponsorship status must not be reused as a specific visa answer');

    const remembered = exports.resolveScreeningAnswer({
      questionText: 'Do you have a valid B1 visa?',
      fieldType: 'select',
      options: yesNo
    }, { answers: [{ questionText: 'Do you have a valid B1 visa?', answerText: 'No' }] });
    assert.strictEqual(remembered.answerText, 'No');
    assert.strictEqual(remembered.confidence, 1);
    env.cleanup();
  });

  it('safe-fills grounded controls and badges unanswered screening questions', async () => {
    const { env, exports, modal } = loadModal();
    const result = await exports.fillModalInputs(modal, {
      firstName: 'Priya',
      lastName: 'Shah',
      currentCity: 'Bangalore',
      totalYearsExperience: 12,
      expectedSalary: '',
      noticePeriodDays: null,
      requiresVisaSponsorship: false,
      masterResume: {
        schema: {
          experience: [{
            role: 'Backend Engineer',
            startDate: '2022-01-01',
            endDate: '2026-01-01',
            highlights: ['Owned PostgreSQL migrations and query tuning']
          }]
        }
      }
    }, true);

    assert.strictEqual(env.document.getElementById('fn').value, 'Priya');
    assert.strictEqual(env.document.getElementById('pg').value, '4');
    assert.strictEqual(env.document.getElementById('k8s').value, '');
    assert.ok(env.document.getElementById('c-yes').checked, 'commute Yes must be selected');
    assert.strictEqual(env.document.getElementById('visa').value, '');

    const reviewBadges = env.document.querySelectorAll('.vedha-review-badge');
    assert.ok(reviewBadges.length >= 2, 'unanswered visa and Kubernetes questions need review badges');
    const badgeText = Array.from(reviewBadges).map(b => b.textContent).join(' ');
    assert.match(badgeText, /Please review/);

    const k8s = env.document.getElementById('k8s');
    assert.strictEqual(k8s.getAttribute('data-vedha-review'), 'true');
    assert.ok(!/140000|^\s*5\s*$/.test(k8s.value), 'must not insert salary or generic year defaults');
    assert.ok(result.unansweredCount >= 2, 'unanswered count must surface fields left for the candidate');
    assert.ok(result.filledCount >= 3, 'name, PostgreSQL years, and commute must fill');
    env.cleanup();
  });
});
