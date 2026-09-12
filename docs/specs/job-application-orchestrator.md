# Feature Specification: Job Application Orchestrator & Multi-Pipeline Engine

## 1. Overview & Problem Statement
Job seekers currently face high friction when applying across fragmented hiring platforms (LinkedIn Easy Apply, Naukri, Greenhouse, Lever, Ashby, Workday, Workable, SmartRecruiters). Generic automation bots either get banned (due to aggressive unattended LinkedIn activity) or fail on dynamic ATS screening questionnaires.

The **Job Application Orchestrator** solves this by introducing a multi-pipeline architecture that decouples source detection, AI question answering, resume tailoring, and browser execution. It stores candidate data once (work authorization, salary expectations, notice period, tech stack evidence) and equips Playwright browser adapters with an **Application Queue (Prepare -> Review -> Submit)** workflow.

---

## 2. Architecture: Multi-Pipeline Orchestrator

```text
                 Paste Job URL
                       │
                       ▼
            Identify Job Source
                       │
     ┌─────────────────┼─────────────────┐
     │                 │                 │
     ▼                 ▼                 ▼
 Pipeline 1        Pipeline 2        Pipeline 3
 LinkedIn           Naukri          External ATS
(Easy Apply)     (Apply Flow)    (Greenhouse/Lever/
                                  Ashby/Workday/Workable)
     │                 │                 │
     └─────────────────┼─────────────────┘
                       ▼
             Resume Tailoring Engine
                       ▼
            AI Question Answering Engine
          (Grounding on Candidate Profile)
                       ▼
               Application Queue
        [Resume + Cover Letter + Q&A]
                       ▼
           Playwright Automation Engine
  (Headed / Headless with Copilot Review Gateway)
```

---

## 3. Pipeline Definitions

### Pipeline 1: LinkedIn Easy Apply (Copilot Mode)
- **Design Philosophy**: High efficiency with zero account ban risk.
- **Workflow**:
  1. Open LinkedIn job posting via Playwright session.
  2. Detect "Easy Apply" button and launch modal.
  3. Form-filler automatically populates contact, experience, and custom questions using the **AI Question Answering Engine**.
  4. Attaches newly generated ATS-optimized PDF resume.
  5. **Copilot Review Gateway**: Pauses automatically before the final "Submit" button, notifying the user to verify answers and click Submit.

### Pipeline 2: Naukri Apply Pipeline
- **Workflow**:
  1. Analyzes job posting criteria.
  2. Formulates tailored resume and answers notice period, current CTC, and expected CTC questions.
  3. Uploads tailored resume and completes application.

### Pipeline 3: External ATS Adapters (`IJobApplicationProvider`)
- Dedicated DOM and API adapters for top enterprise Applicant Tracking Systems:
  - `GreenhouseProvider`
  - `LeverProvider`
  - `AshbyProvider`
  - `WorkdayProvider`
  - `WorkableProvider`
  - `SmartRecruitersProvider`
  - `BambooHrProvider`
  - `IcimsProvider`
- Executes robust form detection, dropdown selection, file attachment, and dynamic question answering.

---

## 4. Candidate Master Profile Schema
Extended to store all recurring job application questions:
- **Work Authorization & Visa**:
  - Country of citizenship, US / EU / India work authorization, requires visa sponsorship (Yes/No), current visa type.
- **Compensation & Availability**:
  - Expected salary / CTC (currency and range), current salary, notice period (e.g. 15/30/60/90 days), earliest start date.
- **Location Preferences**:
  - Current city/country, willing to relocate (Yes/No), remote preference (Remote only, Hybrid, On-site).
- **Technical & Experience Evidence Base**:
  - Structured evidence mapping (e.g. `Kubernetes` -> "Led cloud migration to EKS at CloudTech, managing 40 nodes").
- **Demographics & Equal Opportunity (Optional)**:
  - Gender, race/ethnicity, veteran status, disability status (for auto-filling voluntary standard US EEO/OFCCP questionnaires).

---

## 5. AI Question Answering Engine
- Analyzes any form question:
  - **Yes/No & Boolean**: Grounds answer in candidate profile; provides evidence if prompt asks for elaboration.
  - **Numeric & Experience**: Computes actual years of experience from Master Resume work history.
  - **Dropdown & Radio Matching**: Computes semantic similarity between form options and candidate profile attributes.
  - **Open-Ended Textareas**: Drafts concise STAR-format responses aligning candidate achievements to the question.

---

## 6. Application Queue & Review Studio
- Instead of blind instant submission:
  1. **Queue Item Generated**: Tailored Resume + Cover Letter + Generated Q&A Answers + Form Field Mappings.
  2. **Review Screen**: Candidate inspects answers, modifies any field if desired.
  3. **Launch Execution**: Click "Execute via Playwright" -> launches headed/headless automation worker with live real-time status.

---

## 7. Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-09-12 | Principal Engineer | v2.0.0 | Multi-Pipeline Job Application Orchestrator Architecture | Transform platform from standalone tailoring into unified application engine with LinkedIn Copilot, Naukri, and External ATS Playwright adapters | `Application/`, `Infrastructure/`, `Domain/`, `frontend/` |
