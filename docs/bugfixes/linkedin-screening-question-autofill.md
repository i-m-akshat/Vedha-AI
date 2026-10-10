# Bug Fix: LinkedIn Safe Auto-Fill Skips Screening Questions

## Classification
Bug Fix

## 1. Problem
Safe Biometric Auto-Fill populated First Name, Last Name, Email, and Phone, then skipped or mis-filled employer screening questions on LinkedIn Easy Apply steps 2 and 3. Examples:

- How many years of experience do you have with PostgreSQL?
- Are you willing to commute to Bangalore?
- Do you have a valid B1 visa?

Required controls stayed blank, or they received generic values (5 years, 30 days notice, 140000 salary, sponsorship “No”). The modal could not advance, and the candidate was not told which fields needed a human answer.

## 2. Root Cause
1. Question text was taken from the first `label` inside a broad container. Radio groups therefore resolved to the option “Yes” instead of the `legend`. `div[role="combobox"]` was treated as a city typeahead.
2. Any question containing “years of experience” was filled with `totalYearsExperience || 5`, including skill-specific prompts.
3. The popup payload invented `noticePeriodDays: 30`, `expectedSalary: "140000"`, and `requiresVisaSponsorship: false` when the profile omitted them.
4. `generate-answers` confidence was discarded, so a weak or missing model answer was indistinguishable from a verified fact. Unanswered fields had no inline “Please review” badge.

## 3. Fix
- `extractFormQuestions` scopes each control to the nearest single-question shell and reads legend, `.artdeco-text-input--label`, `.fb-dash-form-element__label`, associated labels, and combobox prompts. It records field type, options, and required state.
- `resolveScreeningAnswer` answers only from approved answers, explicit profile fields, `skillYears`, or dated resume roles that mention the skill. Commute “Yes” requires the named city to match the candidate’s city, or an explicit `willingToCommute` with no conflicting city. A named visa is not inferred from sponsorship status.
- Remaining questions go to `POST /api/orchestrator/generate-answers` with field type, options, and master resume id. Results below confidence 0.8 are not typed.
- Low-confidence and blank required controls get an amber outline and a “Please review” badge. Text is still entered with `typeLikeHuman` (15–35ms) and radios/dropdowns are selected with pointer movement.
- Popup no longer substitutes notice, salary, or sponsorship defaults.

## 4. Files
- `extension/content.js`
- `extension/popup.js`
- `tests/e2e/screening_questions.test.js`
- `tests/e2e/harness_env.js`
- `tests/e2e/runner.js`

## 5. Regression Risks
- A skill mentioned in several overlapping roles can sum to more years than calendar time. The value is still evidence-backed and is preferred to a constant.
- Questions whose labels are only placeholders still depend on `name`/`id` inference for identity fields. Unknown custom prompts stay blank for review.

## 6. Test Strategy
- Extraction fixture covers label, legend, select, and combobox on one Easy Apply step.
- Resolver tests reject total-years fallback, mismatched commute cities, and sponsorship-as-visa.
- Fill test checks PostgreSQL years, commute selection, and review badges.
- Full extension e2e suite, including offline blank-identity cases.

## 7. Verification
`node --check extension/content.js`, `node --check extension/popup.js`, and `node tests/e2e/runner.js` (142 passed).

## Changelog

### 2026-10-10T18:20:00+05:30
- **Changes Made**: Semantic extraction, confidence-gated grounding, review badges, removal of invented numeric defaults.
- **Why**: Safe auto-fill was inaccurate on employer screening questions and could trip Easy Apply validation.
- **Impacted Components**: Chrome extension content script and popup payload.
