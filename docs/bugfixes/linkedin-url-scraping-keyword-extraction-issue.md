# [BUG-4082] LinkedIn Job URL Ingestion: Incomplete Job Description Scraping Resulting in Missing ATS Keywords & Fallback Fit Scoring

| Field | Value |
| :--- | :--- |
| **Issue Key** | BUG-4082 |
| **Issue Type** | 🐞 Defect / Bug Report |
| **Component** | `JobIngestionService` / `JobScraperService` / `AtsScoringEngine` |
| **Severity** | **High** (Core Candidate Workflow Impairment) |
| **Priority** | **P1 - Urgent** |
| **Reporter** | Senior Business Analyst / Product Operations |
| **Affected Layers** | Web Studio Orchestrator (`/orchestrator`), Chrome Copilot Extension (`content.js` & `popup.js`) |

---

## 1. Executive Summary & Problem Statement

When a candidate pastes a public or direct LinkedIn Job URL (e.g., `https://www.linkedin.com/jobs/view/{jobId}/`) into the Vedha AI Studio or Chrome Extension, the ingestion pipeline fails to extract the complete job description text and requirement blocks.

Consequently:
- The keyword extraction pipeline identifies zero or incomplete hard skills, technical stacks, and core requirements.
- The **ATS Fit Analysis** renders empty or degraded keyword tags (missing green "Matched Skills" and amber "Missing Requirements" badges).
- The ATS scoring algorithm defaults to a generic heuristic fallback (e.g., ~80% baseline) rather than calculating an authentic semantic evaluation against the candidate's verified Master Resume.

---

## 2. Business Impact & User Journey Friction

1. **Erosion of Candidate Trust**: Users rely on Vedha AI to reveal precise keyword gaps before applying (e.g., missing frameworks, required cloud platforms, minimum years of experience). When keywords fail to extract, the ATS Fit report appears unhelpful and unreliable.
2. **Suboptimal AI Resume Tailoring**: Downstream tailoring models (Gemini RAG pipeline) receive truncated or empty job requirement context, producing generic resumes that fail to pass enterprise Applicant Tracking Systems.
3. **Drop in Conversion & Productivity**: Candidates are forced to leave their automated flow, manually highlight hundreds of words on LinkedIn, and copy-paste raw text into textareas instead of benefiting from seamless 1-click URL ingestion.

---

## 3. Expected vs. Actual Behavior

| Dimension | Expected Behavior | Actual Behavior |
| :--- | :--- | :--- |
| **Scraped Content** | Complete job title, company name, location, workplace type, and full un-truncated job description (including "About the job", "Qualifications", "Key Responsibilities", and expandable text). | Incomplete or empty description text; often only captures top-card header metadata or LinkedIn's guest wall placeholder. |
| **Keyword Extraction** | 10–25 domain-specific hard skills, certifications, and technologies extracted via NLP/LLM taxonomy. | 0 to 2 keywords extracted; critical technical proficiencies and domain tools are completely absent. |
| **ATS Score Breakdown** | Granular multi-dimensional scoring based on keyword match percentage, experience relevance, and hard skill coverage with interactive badge breakdown. | System triggers fallback scoring mode (~80%); keyword pill breakdown renders empty or "N/A". |

---

## 4. Steps to Reproduce (STR)

1. Open LinkedIn and find any active job posting (e.g., *Senior Full-Stack .NET Developer* or *Staff AI Engineer*).
2. Copy the URL from the browser address bar (e.g., `https://www.linkedin.com/jobs/view/4123456789/`).
3. Navigate to **Vedha AI Web Portal** (`http://localhost:3000/orchestrator`) or open the **Vedha Copilot Extension Popup**.
4. In the **Target Job URL** input field, paste the copied LinkedIn URL and click **Analyze / Fetch Job**.
5. Inspect the ingested job description preview and open the **ATS Fit** tab.

**Observed Result**: The ingested text is truncated or missing, and the keyword extraction returns zero core skill badges or a fallback ATS score.

---

## 5. Technical Context & Root Cause Analysis (Engineering Notes)

1. **LinkedIn Authwall & Dynamic Client Rendering**:
   - LinkedIn serves dynamic single-page content via GraphQL/Ember.js. When scraped via simple HTTP clients (`HttpClient` in C#), LinkedIn frequently returns HTTP 429 (Rate Limit) or redirects to the guest login splash page (`/login`), yielding near-zero body text.
2. **Headless Playwright "Show More" Truncation**:
   - When the backend hands off scraping to the Playwright worker (`workers/playwright-agent/main.py`), LinkedIn's guest layout frequently hides the description behind an expandable `<button aria-label="Show more, opens a modal...">` ("Show more" button inside `.show-more-less-html__markup`).
   - If the worker does not wait for dynamic hydration or fails to click "Show more", only the initial preview lines are captured.
3. **Downstream Token Threshold Fallback**:
   - `IAtsScoringEngine` requires a minimum word threshold (> 150 words) to execute meaningful TF-IDF and Gemini semantic matching. When the extracted text is truncated, the engine safely falls back to standard baseline scoring without keywords.

---

## 6. Business Acceptance Criteria (Definition of Done)

- [ ] **AC-1 (Full-Text Description Retrieval)**: Pasting any valid LinkedIn job posting URL (`/jobs/view/...`, `/jobs/search/?currentJobId=...`, or collection views) successfully extracts the complete un-truncated job description, including text concealed behind "Show more".
- [ ] **AC-2 (Authwall Resilience)**: The scraper gracefully retrieves public guest job data without getting blocked by LinkedIn's guest sign-in modal.
- [ ] **AC-3 (Accurate Keyword Taxonomy Extraction)**: The keyword extraction pipeline extracts at least 8–20 relevant hard skills, frameworks, and requirements from the ingested job description.
- [ ] **AC-4 (Graceful Fallback & Intuitive UX)**:
  - If a specific LinkedIn URL is hard-blocked by cloud IP firewalls, the UI must immediately prompt:
    > *"LinkedIn restricted automatic scraping for this link. Please paste the job description text directly or click 'Safe Fill' via the Chrome Extension."*
  - The job description textarea must automatically expand and focus for immediate pasting.
- [ ] **AC-5 (Authentic ATS Fit Scoring)**: Ingested jobs with complete descriptions generate a dynamic, non-fallback ATS score reflecting true candidate alignment with clear "Matched" and "Missing" badge categorizations.
