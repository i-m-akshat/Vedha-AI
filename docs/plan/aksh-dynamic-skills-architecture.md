# Implementation Plan: Aksh Dynamic Skill Architecture

## 1. Overview
Build a first-class Skill Architecture for Aksh AI in Vedha AI. Allow Aksh to dynamically detect user intent, announce the loaded skill via SSE (`skill`), compose specialized domain instructions, and seamlessly serve all career needs (resume optimization, interview prep, salary negotiation, application tracking, and automated application copilot).

---

## 2. Files to Create & Modify

### A. Backend - Skills Core
1. `backend/src/ResumeTailor.Infrastructure/Aksh/Skills/IAkshSkill.cs`:
   - Defines `IAkshSkill` interface (`Id`, `DisplayName`, `Description`, `RequiredTools`, `CanHandle(string message, AkshSession session)`, `GetInstructions(AkshSession session)`).
2. `backend/src/ResumeTailor.Infrastructure/Aksh/Skills/AkshSkillRegistry.cs`:
   - `IAkshSkillRegistry` and default implementation. Registers all 6 skills and provides `Resolve(message, session)`.
3. Concrete skill implementations:
   - `ResumeOptimizerSkill.cs`: Google XYZ impact formula, ATS keywords, master resume bullet critique.
   - `InterviewCoachSkill.cs`: STAR behavioral format, system design, mock Q&A, company culture alignment.
   - `JobApplicationCopilotSkill.cs`: Multi-step application pipeline with Review Gateway approval gate.
   - `SalaryNegotiatorSkill.cs`: Compensation benchmarking, total comp breakdown, negotiation strategy.
   - `ProfileAndQueueAuditSkill.cs`: Application queue status, screening memory lookup, profile auditing.
   - `CareerStrategistSkill.cs`: Fallback general career strategy, learning roadmaps, tech stack trends.

### B. Backend - Runner & DI Wiring
4. `backend/src/ResumeTailor.Infrastructure/DependencyInjection.cs`:
   - Register `IAkshSkillRegistry` as a singleton.
5. `backend/src/ResumeTailor.Infrastructure/Aksh/AkshAgentRunner.cs`:
   - Inject `IAkshSkillRegistry`.
   - Resolve skill at the start of each turn.
   - Stream `new AkshStreamEvent("skill", new { id = skill.Id, name = skill.DisplayName, description = skill.Description })`.
   - Include skill instructions in `BuildPrompt`.
   - Ensure deterministic prepare pipeline ONLY executes when `JobApplicationCopilotSkill` is active and candidate requested it.

### D. Backend - LLM Resilience & Fallback Cascading
8. `backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs`:
   - Updated retry handler to treat HTTP 500, 502, 503, 504, and 429 as retryable transient errors with exponential backoff.
   - Implemented `GetNextFallbackModel` across `gemini-2.5-flash` -> `gemini-2.0-flash` -> `gemini-1.5-flash` -> `gemini-flash-lite-latest`.
9. `backend/src/ResumeTailor.Application/Features/Orchestrator/OrchestratorCommands.cs`:
   - Added graceful fallback in `PrepareApplicationPackageCommand`: if tailoring throws a transient exception, defaults to factual `masterSchema` with `truthFailed = true` / manual review gate.

### E. Frontend - Chat-First Overhaul & Sprinting Runner
10. `frontend/src/pages/AskAkshPage.tsx`:
   - Eliminated Goal form; messaging auto-creates session with instant streaming.
   - Added interactive starter suggestion cards.
   - Integrated animated runner sprint card using local `/assets/anime-running.gif`.

### F. Backend - Proactive Input Elicitation, Domain Guardrails & Platform Navigation (Phase 3)
11. `backend/src/ResumeTailor.Infrastructure/Aksh/Skills/PlatformNavigatorSkill.cs`:
   - Implement `PlatformNavigatorSkill` to provide comprehensive walkthroughs of Vedha AI features (`/studio`, `/tailor`, `/orchestrator`, `/settings`, extension, tokens).
12. `backend/src/ResumeTailor.Infrastructure/Aksh/Skills/AkshSkillRegistry.cs`:
   - Register `PlatformNavigatorSkill` with high priority.
13. `backend/src/ResumeTailor.Infrastructure/Aksh/Skills/ResumeOptimizerSkill.cs`:
   - Expand keyword matcher to include `"tailor"`, `"tailoring"`, `"customise"`.
   - Update instructions to detect missing JD or job link: if the user asks for tailoring without providing a JD or URL, acknowledge and proactively ask for the JD text or job link.
14. `backend/src/ResumeTailor.Infrastructure/Aksh/Skills/InterviewCoachSkill.cs` & `SalaryNegotiatorSkill.cs`:
   - Add proactive input prompts when target role or compensation breakdown is omitted.
15. `backend/src/ResumeTailor.Infrastructure/Aksh/AkshPrompts.cs`:
   - Add strict domain guardrails: strictly limit scope to Vedha AI and user career data, declining off-topic prompts.
16. `backend/src/ResumeTailor.Infrastructure/Aksh/AkshAgentRunner.cs`:
   - Include user messages in prompt history (`m.SessionId == session.Id`) with a 14-turn sliding window.
   - Add pre-turn candidate grounding context injection.

---

## 3. Testing & Verification
1. Run `dotnet test backend/ResumeTailor.sln` to ensure all unit tests pass.
2. Add unit tests for `PlatformNavigatorSkill`, resume tailoring query matching, and domain guardrails in `AkshSkillRegistryTests.cs`.
3. Verify multi-turn conversational context continuity.

---

## 4. Changelog
- **2026-10-15 (Phase 1)**: Created implementation plan for Aksh Dynamic Skill Architecture.
- **2026-10-15 (Phase 2)**: Added chat-first conversational redesign, Gemini 500 cascading fallback, in-chat resume export link, anime girl sprint indicator, and dynamic plan milestone generation.
- **2026-10-15 (Phase 3)**: Added Proactive Input Elicitation (intelligently requesting JDs/links or offer numbers), Strict Application & Career Data Domain Guardrails, PlatformNavigatorSkill for app guidance, and multi-turn user/assistant conversational history restoration.

