# Feature Specification: Truthful ATS Score Optimization (>85% - >90%)

## Problem Statement
Job seekers using Vedha AI need tailored resumes that consistently score **>85% or >90%** on target Job Descriptions (JDs) to reliably pass Applicant Tracking Systems (ATS) like Greenhouse, Lever, Workday, and Taleo, while strictly preserving 100% truthfulness (zero hallucination of companies, dates, degrees, metrics, or technologies the candidate does not have).

Prior to this enhancement, ATS scores frequently plateaued or dropped below 80% due to:
1. **Broken Regex Boundary Matching (`\b`)**: The ATS scoring engine used `\b{keyword}\b`, which failed to match technical keywords with non-alphanumeric characters (`C#`, `C++`, `.NET`, `ASP.NET`, `CI/CD`, `TCP/IP`).
2. **Lack of Industry Skill Synonyms**: Valid skills like "PostgreSQL" vs "Postgres", "React.js" vs "React", "AWS" vs "Amazon Web Services", or "RESTful APIs" vs "REST API" were not recognized as matches.
3. **Title Erasure Bug**: During tailoring, `tailoredSchema.PersonalInfo = masterSchema.PersonalInfo;` wiped out the AI-tailored target job title, preventing title and role keyword matching.
4. **Sub-optimal Metric Bullet Prioritization**: Tailoring did not explicitly prioritize retaining bullets with verified quantitative metrics (%, $, multipliers) from the master resume, lowering the `ExperienceRelevanceScore` (weight 20%).
5. **Prompt Divergence between Tailor and Orchestrator Pipelines**: `OrchestratorCommands.cs` used a minimal prompt that omitted aggressive keyword mirroring, leading to lower scores in autonomous packages.

## Business Goal
Maximize interview conversion rates by ensuring generated resumes achieve high ATS match scores (**>85% - >90%**) tailored specifically to the target role while maintaining absolute factual integrity and passing strict recruiter audits.

## Scope
1. **ATS Scoring Engine Enhancements (`AtsScoringEngine.cs`)**:
   - Fix boundary matching using non-alphanumeric lookaround assertions: `(?<![a-zA-Z0-9])keyword(?![a-zA-Z0-9])`.
   - Implement an extensible Skill Taxonomy & Synonym Dictionary mapping canonical industry skill variations.
   - Refine keyword and skills matching to credit verified candidate competencies accurately.
2. **Resume Tailoring Prompt Optimization (`TailorCommands.cs` & `OrchestratorCommands.cs`)**:
   - Harmonize the Executive Resume Strategist & ATS Optimization system prompt across both manual and autonomous orchestrator pipelines.
   - Enforce targeted keyword mirroring in the Professional Summary and Experience bullets.
   - Explicitly instruct the AI to prioritize retaining and elevating master resume bullets that contain real quantified metrics (%, $, x) to maximize `ExperienceRelevanceScore`.
   - Preserve candidate contact details while permitting the tailored `Title` to match the target job title.
3. **Truth Preservation & Anti-Hallucination Guardrails**:
   - Strict validation of companies, institutions, certifications, and metric invariants via `ValidateTruthPreservation`.

## Out of Scope
- Fabricating or inventing candidate experiences, employers, degrees, metrics, or skills not present in the Master Resume.

## Functional Requirements
1. **Punctuation-Safe Keyword Matching**: Keywords like `C#`, `.NET`, `C++`, `CI/CD`, `PL/SQL`, and `Node.js` must be recognized accurately in resume text.
2. **Synonym Matching**: Common industry equivalents (e.g. `PostgreSQL` / `Postgres`, `Amazon Web Services` / `AWS`, `React` / `React.js`, `Kubernetes` / `K8s`, `Docker` / `Containerization`, `REST API` / `RESTful APIs`) must match if the candidate possesses the underlying competency.
3. **Quantitative Metrics Elevation**: Tailored experience must retain real metrics from the master resume to achieve an `ExperienceRelevanceScore` >= 90.
4. **Summary Keyword Density**: The tailored Professional Summary must lead with the target role and incorporate 3-5 primary matching competencies.
5. **Score Target**: A tailored resume matching a relevant JD must achieve an overall ATS score >= 85% (and >= 90% for high-overlap profiles).

## Non-Functional Requirements
- **Performance**: ATS score calculation must execute in < 15ms.
- **Reliability**: Zero crashes or unhandled regex exceptions on arbitrary keyword inputs.
- **Maintainability**: Centralized synonym mapping and clean domain contracts.
- **Security**: No user data leakage or prompt injection vulnerabilities.

---

## Changelog

### 2026-10-05T23:30:00+05:30 — Initial Specification
- **Created**: Initial specification for truth-preserving ATS score optimization targeting >85% to >90%.
- **Rationale**: User requested that the resume ATS score achieve >85% or >90% based on target JD while being truthful.
- **Impacted Components**: `AtsScoringEngine.cs`, `TailorCommands.cs`, `OrchestratorCommands.cs`, Unit Tests.
