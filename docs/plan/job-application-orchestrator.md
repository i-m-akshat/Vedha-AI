# Implementation Plan: Job Application Orchestrator & Multi-Pipeline Engine

## 1. Scope & Execution Overview
Implement the complete multi-pipeline architecture:
- **Phase 1: Domain & Profile Data Expansion**: Extended `UserProfile` & `CandidatePreferences` entities (Visa, Salary, Notice Period, Relocation, Evidence Base).
- **Phase 2: AI Question Answering Engine**: CQRS query & handler to take arbitrary screening questions from forms and generate grounded, evidence-backed answers.
- **Phase 3: Browser Automation & Provider Adapters (`IJobApplicationProvider`)**:
  - `Microsoft.Playwright` integration.
  - Providers: `LinkedInCopilotProvider`, `NaukriProvider`, `GreenhouseProvider`, `LeverProvider`, `AshbyProvider`, `WorkdayProvider`, `WorkableProvider`, `SmartRecruitersProvider`.
  - Provider Factory (`IJobApplicationProviderFactory`).
- **Phase 4: Application Queue & Review UI**:
  - Frontend Queue Manager (Prepare -> Review -> Launch Automation).
  - Profile preferences configuration view (Visa, Notice period, CTC).
- **Phase 5: Infrastructure & Docker**: Update `infra/Dockerfile.backend` and `infra/.env.example` with Playwright browser installation.

---

## 2. Step-by-Step Task Breakdown

### Step 1: Extended Domain Entities & Value Objects
- Create `CandidateProfile` entity with WorkAuthorization, NoticePeriodDays, ExpectedSalary, CurrentSalary, WillingToRelocate, PreferredLocations, EvidenceKnowledgeBase.
- Create `ScreeningQuestionAnswer` value object with QuestionText, FieldType, AnswerValue, ConfidenceScore, EvidenceCited.
- Create `ApplicationQueueItem` entity tracking pipeline status (`Prepared`, `Reviewing`, `FillingForm`, `AwaitingUserSubmit`, `Completed`, `Failed`).

### Step 2: Application Layer CQRS Features
- `GenerateScreeningAnswersCommand`: Takes list of extracted form questions and maps answers using AI + CandidateProfile.
- `EnqueueApplicationCommand`: Creates a queue item containing TailoredResumeId, CoverLetter, and Pre-filled Screening Answers.
- `ExecuteApplicationPipelineCommand`: Triggers the appropriate `IJobApplicationProvider` with Playwright browser instance.
- `GetApplicationQueueQuery`: Returns active queue items for review and execution.

### Step 3: Infrastructure Playwright & Provider Implementations
- Install `Microsoft.Playwright` in `ResumeTailor.Infrastructure`.
- Define interface `IJobApplicationProvider`:
  ```csharp
  public interface IJobApplicationProvider
  {
      JobSource SupportedSource { get; }
      Task<ApplicationResult> FillApplicationAsync(
          BrowserContext context, 
          string jobUrl, 
          CandidateProfile profile, 
          byte[] resumePdfBytes, 
          List<ScreeningQuestionAnswer> prefilledAnswers, 
          bool isCopilotReviewMode, 
          CancellationToken cancellationToken);
  }
  ```
- Implement individual providers:
  - `GreenhouseProvider`: Targets standard Greenhouse input fields, dropdowns, resume file input (`input[type="file"]`), custom questions, and submits.
  - `LeverProvider`: Targets Lever resume upload, personal fields, custom questions, and submits.
  - `AshbyProvider`: Targets Ashby application form layout.
  - `LinkedInCopilotProvider`: Navigates to job URL, clicks Easy Apply, cycles through modal steps, fills pre-generated answers, attaches resume, and pauses at the final review screen for candidate click.
  - `NaukriProvider`: Handles Naukri form flow.
  - `WorkdayProvider` & `WorkableProvider`: Handles corporate ATS multi-step wizards.

### Step 4: Frontend UI Enhancements
- **Candidate Profile / Question Base Tab**: Form to save Work Authorization, Notice Period (days), Salary expectations, and custom Q&A answers once.
- **Application Queue / Review Drawer**: Shows prepared packages with pre-filled answers and 1-click "Launch Playwright Copilot".
- **Real-Time Step Visualizer**: Displays browser automation steps in real-time.

---

## 3. Changelog

| Date | Author | Version | Summary of Changes | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-09-12 | Principal Engineer | v2.0.0 | Multi-Pipeline Orchestrator Plan | Implementation plan for LinkedIn Copilot, Naukri, and External ATS Playwright adapters | `Domain`, `Application`, `Infrastructure`, `frontend` |
