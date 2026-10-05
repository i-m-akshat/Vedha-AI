# Bug Fix Plan: LinkedIn URL Scraping Authwall, ATS Score Fallback, and Cover Letter Grounding

## 1. Problem Statement
When a user pastes a LinkedIn search result URL (e.g. `https://www.linkedin.com/jobs/search-results/?currentJobId=4471195758...`):
1. **ATS Score stuck at 80% fallback**: The ATS match score computes as 80% with 0 matching keywords and 0 missing skills.
2. **Cover Letter "not coming properly"**: The cover letter addresses "Company" for "Role" with generic text and raw markdown formatting.
3. **User perception that backend is not running**: The fallback outputs gave the impression that the backend was not processing or stuck.

---

## 2. Root Cause Analysis
1. **LinkedIn Search Results URL Redirection**:
   - LinkedIn allows unauthenticated guest access to direct view URLs (`https://www.linkedin.com/jobs/view/{jobId}/`).
   - However, search result URLs containing `currentJobId` (`https://www.linkedin.com/jobs/search-results/?currentJobId={jobId}...`) require an active session and redirect unauthenticated HTTP GET requests to the LinkedIn login page (`<title>LinkedIn Login, Sign in | LinkedIn</title>`).
   - `JobScraperService` had no URL normalization to detect `currentJobId` query parameters and rewrite them to direct view URLs.
2. **Missing Authwall / Login Page Detection**:
   - When LinkedIn returned the login page HTML, `JobScraperService` did not recognize that it received an authwall. It fell back to `CleanElementText(document.Body)`, scraping the login page text ("Sign in with Apple, Sign in with a passkey, Email or phone, Password...").
   - Gemini parsed the login page text into an empty `JobDescriptionSchema`:
     ```json
     {"title":"","company":null,"mustHaveSkills":[],"keywords":[]}
     ```
   - Target Company defaulted to `"Company"` and Target Role defaulted to `"Role"`.
3. **Hardcoded ATS Engine Fallbacks**:
   - In `AtsScoringEngine.cs`:
     - When `job.MustHaveSkills.Count + job.NiceToHaveSkills.Count == 0`, `skillsScore` defaulted to `80`.
     - When `allTargetKeywords.Count == 0`, `keywordScore` defaulted to `85`.
     - Combined with experience score `63` and format score `95`: `85*0.35 + 80*0.35 + 63*0.20 + 95*0.10 = 79.85 -> 80%`.
     - An unparseable or empty job description therefore silently received a false "80% match" instead of detecting that the job description has no skills or keywords.
4. **Cover Letter Grounding with Empty Job Schema**:
   - In `ToolCommands.cs`, `GenerateCoverLetterCommand` built prompts with `TargetCompany: Company`, `TargetRole: Role`, and `Job Requirements: ` (empty list).
   - In `ResultStudioPage.tsx`, the cover letter was rendered inside a plain `whitespace-pre-wrap` div without markdown rendering, leaving raw asterisks and hash marks.
5. **Backend State**:
   - The backend was indeed running (HTTP 200 at `/health`), but prior to enabling `[boot] systemd=true` in WSL2, containers had exited when WSL went idle.

---

## 3. Proposed Fix

### A. URL Normalization & Authwall Detection in `JobScraperService.cs`
1. **URL Normalizer**:
   - Detect LinkedIn URLs with `currentJobId=(\d+)` and rewrite to canonical `https://www.linkedin.com/jobs/view/{jobId}/`.
   - Strip tracking query parameters.
2. **Authwall Detection**:
   - Inspect page title and body content for:
     - `<title>LinkedIn Login`
     - `linkedin.com/authwall`
     - `Sign in with Apple` / `Sign in with a passkey`
     - Text length < 100 characters
   - If an authwall is detected:
     - Try calling the local worker scraper (`http://vedha-worker:8000/api/playwright/scrape`) with headless browser.
     - If scraping still fails or yields login text, return a clear, user-friendly error:
       *"LinkedIn authentication barrier detected for this URL. Please open the job on LinkedIn, copy the job description text, and use the 'Paste Job Text' tab in Tailor Studio, or use the Vedha Chrome Extension."*

### B. ATS Scoring Engine Safeguards in `AtsScoringEngine.cs`
- If `totalTargetSkills == 0 && allTargetKeywords.Count == 0`:
  - Do NOT give artificial 80/85 scores.
  - Set a minimum base score (e.g. 20) with an explicit weakness: *"Could not extract technical requirements from the target job posting. Please ensure the job description text is complete."*

### C. Cover Letter Generation & Rendering Improvements
1. **Backend Prompting (`ToolCommands.cs`)**:
   - If `resume.TargetCompany` is empty or `"Company"`, extract candidate/job context or fallback to `[Company Name]` placeholder.
   - If `jobSchema.MustHaveSkills` is empty, extract skills from `resume.JobDescription.RawText` directly as fallback.
2. **Frontend UI (`ResultStudioPage.tsx`)**:
   - Render cover letter with clean markdown formatting or formatted paragraphs instead of raw markdown text.

---

## 4. Files Affected
- `backend/src/ResumeTailor.Infrastructure/WebScraping/JobScraperService.cs`
- `backend/src/ResumeTailor.Infrastructure/AtsEngine/AtsScoringEngine.cs`
- `backend/src/ResumeTailor.Application/Features/Tools/ToolCommands.cs`
- `frontend/src/pages/ResultStudioPage.tsx`
- `context.md`

---

## 5. Regression Risks
- URL normalization only affects LinkedIn URLs; existing Greenhouse, Lever, Ashby, and Workday scrapers remain untouched.
- ATS scoring engine safeguards only apply when a job has 0 extracted skills and 0 keywords.

---

## 6. Test Strategy & Verification Steps
1. Test LinkedIn URL normalization with `https://www.linkedin.com/jobs/search-results/?currentJobId=4471195758`. Verify it resolves to `https://www.linkedin.com/jobs/view/4471195758/` and successfully extracts **Software Engineer**, **Eurofins**, and the full job description text.
2. Run `dotnet test` to verify all 30 unit tests pass.
3. Test `CalculateScore` with empty and populated jobs to verify ATS scores are accurate.
4. Verify cover letter generation and display.
