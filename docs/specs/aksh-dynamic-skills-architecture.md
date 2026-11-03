# Feature Specification: Aksh Dynamic Skill Architecture & All-Platform Career Operating System

**Status:** APPROVED | **Date:** 2026-10-15  
**Companions:** `docs/plan/aksh-dynamic-skills-architecture.md`, `docs/architecture/lld.html`, `docs/architecture/system-design.html`

---

## 1. Overview
Previously, Aksh AI was rigidly constrained to automated job applications. Every incoming chat prompt was funneled into a hardcoded pipeline (`PLAN` -> `GROUND` -> `ACT` -> `REPORT` -> `GATE`), forcing tool calls like `todos_add` and `scrape_job` even when the candidate asked conversational, resume, interview, or salary questions.

This specification introduces a **Dynamic Skill Architecture** for Aksh AI in Vedha AI:
1. **Modular Skills**: Self-contained capability packages (`IAkshSkill`) with their own domain prompts, evaluation criteria, and tool subsets.
2. **Dynamic Skill Resolution & Streaming**: Aksh dynamically detects the candidate's intent, loads the appropriate skill, announces it to the frontend via SSE (`evt.type === "skill"`), and executes with specialized domain expertise.
3. **Conversational vs. Automated Application Decoupling**: Automated job application pipelines are **strictly opt-in via chat**: only engaged when the candidate pastes a job URL or explicitly requests application/packaging. All other tasks (resume review, interview coaching, salary negotiation, ATS keywords, queue inquiry) converse naturally and assistively.

---

## 2. Business Goal
Transform Aksh from a single-purpose application bot into an **All-in-One AI Career Operating System**. Enable candidates to rely on Aksh for every step of their career journey (resume critique, interview prep, salary benchmarks, application status) without losing the automated application copilot when they want it.

---

## 3. User Stories
- **As a candidate**, I want to ask Aksh to review my resume bullets or suggest missing ATS keywords without it forcing a job application pipeline.
- **As a candidate**, I want to practice behavioral (STAR) and technical interview questions tailored to my master resume and background.
- **As a candidate**, I want Aksh to benchmark my compensation expectations and suggest salary negotiation strategies based on my experience and location.
- **As a candidate**, I want to clearly see which specialized skill Aksh is using (e.g. `✨ Loaded Skill: Resume & ATS Bullet Optimizer`) so I understand what expert context is active.
- **As a candidate**, I want automated job application execution to engage ONLY when I explicitly provide a job URL or ask Aksh to apply for me.

---

## 4. Acceptance Criteria
1. When a user asks a general question, career question, or interview question, Aksh does NOT force an automated job application or call `scrape_job`/`prepare_package`.
2. Aksh resolves and announces skills via SSE: `skill` event with `id`, `name`, and `description`.
3. The frontend displays the active loaded skill badge during and after the turn.
4. Core skills implemented:
   - `ResumeOptimizerSkill` (`resume-optimizer`)
   - `InterviewCoachSkill` (`interview-coach`)
   - `JobApplicationCopilotSkill` (`job-application-copilot`)
   - `SalaryNegotiatorSkill` (`salary-negotiator`)
   - `ProfileAndQueueAuditSkill` (`profile-queue-audit`)
   - `CareerStrategistSkill` (`career-strategist`)
5. Full test suite (`dotnet test backend/ResumeTailor.sln`) passes 100%.

---

## 5. Functional Requirements
- **FR-1 Skill Contract (`IAkshSkill`)**: Each skill declares its identifier, display name, description, required tools, intent matcher (`CanHandle`), and specialized instructions (`GetInstructions`).
- **FR-2 Skill Registry (`IAkshSkillRegistry`)**: In-memory registry holding all skills; resolves the most relevant skill based on message text, session state, and presence of job URLs.
- **FR-3 SSE Skill Announcement**: Runner emits `new AkshStreamEvent("skill", new { id, name, description })` at the start of each turn.
- **FR-4 UI Skill Chip**: Frontend renders an animated pill badge indicating the active skill loaded for the conversation.
- **FR-5 Tool Grounding**: Skills leverage platform tools (`get_master_resume`, `get_candidate_profile`, `get_application_queue`, `recall_memory`, `scrape_job`).

---

## 6. Non-Functional Requirements
- **Performance**: Skill resolution is in-memory and executes in <1ms without network calls.
- **Maintainability**: New skills can be added simply by implementing `IAkshSkill` and registering them with DI.
- **Security**: No secrets or private tokens are surfaced in skill descriptions or instructions.

---

## 7. Architecture & Layers
- `backend/src/ResumeTailor.Infrastructure/Aksh/Skills/`:
  - `IAkshSkill.cs`: Core skill interface.
  - `AkshSkillRegistry.cs`: Registry & resolver.
  - Concrete skills: `ResumeOptimizerSkill.cs`, `InterviewCoachSkill.cs`, `JobApplicationCopilotSkill.cs`, `SalaryNegotiatorSkill.cs`, `ProfileAndQueueAuditSkill.cs`, `CareerStrategistSkill.cs`.
- `backend/src/ResumeTailor.Infrastructure/Aksh/AkshAgentRunner.cs`: Integrates skill resolution into the SSE turn stream.
- `frontend/src/pages/AskAkshPage.tsx`: Consumes `skill` events and renders active skill badge.

---

## 8. Database & API Changes
- **No breaking database changes**: Skills are modular runtime constructs.
- **SSE Stream additions**: Added event type `"skill"`.
- **Tool Enhancements**: `prepare_package` tool returns `generatedResumeId` and direct `resumePdfDownloadUrl` (`/api/resumes/{generatedResumeId}/export?format=Pdf`).
- **Dynamic Plan Generation**: `AkshPlanner.BuildInitialPlan` dynamically synthesizes a targeted 2-4 step milestone plan matching the active skill domain rather than enforcing the 4-step job application pipeline.
- **LLM Resilience**: Integrated HTTP 500/502/503/504/429 exponential backoff and automatic model fallback cascading (`gemini-2.5-flash` -> `gemini-2.0-flash` -> `gemini-1.5-flash` -> `gemini-flash-lite-latest`).
- **Multi-Turn Context Restoration**: The agent runner retains both user and assistant messages across turns (`m.SessionId == session.Id` without role exclusion) within a 14-turn sliding window.

---

## 9. Conversational Comprehension & Proactive Input Elicitation
- **Missing Prerequisite Detection**: When a user triggers an intent that requires specific data (e.g. *"I want my resume to be tailored"*, *"Help me prepare for an interview"*, *"Help me negotiate my offer"*):
  - The agent must not guess or attempt blind tool execution with dummy parameters.
  - The agent immediately comprehends what is missing and actively prompts the candidate:
    - *Resume Tailoring*: Requests the target Job Description (JD) text or job posting link (LinkedIn, Greenhouse, Lever, etc.).
    - *Interview Prep*: Requests the target company, role title, and preference for behavioral (STAR) vs technical drills.
    - *Salary Negotiation*: Requests the compensation breakdown (base, bonus, equity, location, competing offers).
- **Subsequent Turn Continuity**: In the subsequent turn, the agent recalls the previous turn's request and pairs the newly provided input (e.g. pasted JD or link) with the ongoing workflow seamlessly.

---

## 10. Strict Domain Guardrails (Application & User Career Data Only)
- **Authorized Domain Boundaries**:
  1. **Vedha AI Platform**: Features, page routes (`/studio`, `/tailor`, `/orchestrator`, `/settings`), Chrome extension usage, AI provider configuration, and token ledger mechanics.
  2. **Candidate Career Data**: Master resume, work history, skills, tailored resumes, cover letters, application queue items, and screening memories.
  3. **Professional Career Strategy**: Resume optimization, ATS keyword targeting, interview coaching (STAR & technical), and salary negotiation.
- **Guardrail Enforcement**:
  - The agent strictly declines off-topic inquiries (e.g. creative writing, homework, general trivia, politics, general software engineering not tied to candidate's stack).
  - Decline template: *"As your Vedha AI Career Copilot, I'm specifically focused on helping you land your next role—including resume tailoring, interview prep, job applications, and navigating the Vedha platform. How can I assist you with your resume, jobs, or applications today?"*

---

## 11. UI & Visual Experience
- **Chat-First Workflow**: Removed mandatory 3-field "Goal" form and "Start Run" barriers. Ask Aksh operates conversational-first (ChatGPT/Claude style). Message submission automatically starts a session with instant streaming.
- **Quick-Start Prompt Cards**: Renders interactive starter cards for top career workflows (Resume Optimization, Behavioral Mock Interview, Salary Negotiation, Queue & Profile Audit, Platform Guide).
- **Animated Sprint Runner**: Features a high-quality local running anime girl GIF (`/assets/anime-running.gif`) and dynamic status caption (`Aksh is sprinting... Running [Active Skill] engine`) while the AI streaming engine is actively processing.

---

## 12. Changelog
- **2026-10-15 (Phase 1)**: Created Feature Specification for Aksh Dynamic Skill Architecture. Decoupled conversational tasks from the automated application pipeline and added 6 modular career skills.
- **2026-10-15 (Phase 2)**: Added chat-first conversational overhaul, dynamic context-aware plan generation, anime girl running streaming indicator, in-chat PDF export links, and Gemini 500 transient error resilience with multi-model fallback cascading.
- **2026-10-15 (Phase 3)**: Added Proactive Input Elicitation (intelligently requesting JDs, links, or offer details when users initiate workflows), Strict Application & Career Data Domain Guardrails, PlatformNavigatorSkill for comprehensive app guidance, and multi-turn user/assistant conversational history restoration.
- **2026-10-28 (Phase 4)**: Added Conversational Chatbot Fluidity and Prompt-Adaptive Dynamic Skill Switching. Refactored intent classification to use word boundaries preventing false triggers on conversational keywords, added `SuggestedChips` to `IAkshSkill` streamed via SSE, optimized tool catalogs to eliminate unnecessary tool overhead during advisory/conceptual discussions, and enriched prompt instructions for fluid, natural dialogue.

---

## 13. Conversational Chatbot & Dynamic Skill Switching Engine (Phase 4)

### 13.1 Dual-Mode Operation: Conversational Chatbot vs. Action Copilot
Aksh AI operates in two complementary modes seamlessly within the same session:
1. **Conversational Chatbot Mode**:
   - Engages when the candidate greets, asks conceptual or strategic questions (e.g. STAR method overview, leveling criteria, tech stack roadmaps), seeks general career advice, or engages in open-ended discussion.
   - Responds conversationally, warmly, and with high intellectual rigor using rich Markdown formatting (bullet points `- `, bold headers, code snippets).
   - Operates with zero unnecessary tool overhead (`toolsForTurn = Array.Empty<string>()` or optional non-blocking tools) so responses stream instantly without latency.
2. **Autonomous Action Copilot Mode**:
   - Engages when the candidate provides a job URL, explicitly asks to tailor a resume, prepare an application package, or dispatch an application.
   - Activates the structured `PLAN -> GROUND -> ACT -> REPORT -> GATE` pipeline, executes tools, records usage in the single-writer ledger, and raises Review Gateway approval gates before any external submission.

### 13.2 Precision Skill Resolution Order
To eliminate keyword collisions (e.g. "application" in "What is the status of my application?" triggering the apply pipeline), skill resolution follows a strict priority chain:
1. `PlatformNavigatorSkill` (`platform-navigator`): Explicit questions regarding platform pages, extension, or settings.
2. `ProfileAndQueueAuditSkill` (`profile-queue-audit`): Application queue queries, status checks, work auth, and stored memories.
3. `InterviewCoachSkill` (`interview-coach`): Behavioral STAR drills, mock interviews, system design drills.
4. `SalaryNegotiatorSkill` (`salary-negotiator`): Total compensation benchmarks, counter-offer scripting, offer evaluation.
5. `ResumeOptimizerSkill` (`resume-optimizer`): Resume critiques, bullet rewrites using Google XYZ formula, ATS keyword gaps.
6. `JobApplicationCopilotSkill` (`job-application-copilot`): Explicit job apply directives or URLs with application intent.
7. `CareerStrategistSkill` (`career-strategist`): General career advisory, mentorship, transition planning, greetings, and fallback chat.

### 13.3 Real-Time Dynamic Suggested Prompt Chips
Each `IAkshSkill` defines domain-specific quick-action chips (`SuggestedChips`). When a skill is resolved for a turn, the SSE `"skill"` event delivers:
```json
{
  "id": "interview-coach",
  "name": "Behavioral & Technical Interview Coach",
  "description": "Simulates mock interviews, structures answers with STAR format, and coaches on technical & system design questions.",
  "suggestedChips": [
    "Ask me a STAR behavioral interview question",
    "How should I answer 'Tell me about yourself'?",
    "Simulate a System Design interview question",
    "What questions should I ask the hiring manager?"
  ]
}
```
The frontend dynamically displays these chips above the composer, enabling one-click exploratory steering.
