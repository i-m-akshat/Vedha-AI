# Implementation Plan: Truthful ATS Score Optimization (>85% - >90%)

## Overview
This plan outlines the changes required to elevate the tailored resume ATS score to **>85% or >90%** while strictly maintaining 100% truthfulness and zero hallucination.

---

## 1. Files to Create / Modify

| File | Nature of Change | Purpose |
| :--- | :--- | :--- |
| `backend/src/ResumeTailor.Infrastructure/AtsEngine/AtsScoringEngine.cs` | Modify | Fix regex word boundary for punctuation keywords (`C#`, `.NET`, `C++`, `CI/CD`), implement skill synonym dictionary, improve keyword matching. |
| `backend/src/ResumeTailor.Application/Features/Tailoring/TailorCommands.cs` | Modify | Upgrade tailoring prompt to enforce target title preservation, metric bullet retention, and high-impact keyword alignment. |
| `backend/src/ResumeTailor.Application/Features/Orchestrator/OrchestratorCommands.cs` | Modify | Synchronize orchestrator tailoring prompt with the advanced ATS optimization rules. |
| `backend/tests/ResumeTailor.UnitTests/AtsScoringEngineTests.cs` | Modify | Add unit tests for punctuation keywords, synonym matching, and high-score validation. |
| `context.md` | Modify | Update system context and handover logs. |

---

## 2. Step-by-Step Implementation Steps

### Step 1: Punctuation-Safe Keyword Matching & Synonym Graph (`AtsScoringEngine.cs`)
1. Replace `\b{Regex.Escape(keyword)}\b` with lookaround assertions:
   `@"(?<![a-zA-Z0-9])" + Regex.Escape(keyword) + @"(?![a-zA-Z0-9])"`.
2. Build an industry-standard synonym dictionary:
   - C# / CSharp
   - .NET / DotNet / .NET Core / ASP.NET / ASP.NET Core
   - C++ / CPP
   - Node.js / NodeJS / Node
   - React / React.js / ReactJS
   - PostgreSQL / Postgres
   - Amazon Web Services / AWS
   - Google Cloud Platform / GCP
   - Microsoft Azure / Azure
   - Kubernetes / K8s
   - CI/CD / Continuous Integration / Continuous Deployment
   - REST / RESTful API / REST APIs
   - Docker / Containerization
   - Microservices / Microservice Architecture
   - SQL / Relational Database
   - NoSQL / MongoDB
   - Redis / In-Memory Caching
3. When checking `ContainsKeyword(resumeFullText, keyword)` or matching skills:
   - Check direct match.
   - Check synonym cluster matches against candidate skills and resume text.

### Step 2: Preserve Tailored Job Title in `PersonalInfo` (`TailorCommands.cs` & `OrchestratorCommands.cs`)
1. In `TailorCommands.cs` and `OrchestratorCommands.cs`:
   - Keep candidate's real personal contact information (`FullName`, `Email`, `Phone`, `Location`, `LinkedInUrl`, `GitHubUrl`, `PortfolioUrl`) from `masterSchema`.
   - Allow `PersonalInfo.Title` to retain the AI-tailored role title matching the target job description.

### Step 3: Upgrade Tailoring Prompts for Truthful ATS Maximization
1. Update `systemPrompt` and `userPrompt`:
   - Explicitly instruct the model to prioritize retaining Master Resume bullets that have verified quantitative metrics (%, $, multipliers) so that `ExperienceRelevanceScore` achieves >= 90.
   - Instruct the model to reflect all matching Must-Have Skills and Key Responsibilities in the canonical wording expected by ATS parsers.
   - Ensure the Professional Summary names the target role and features 3-5 primary matching competencies.
   - Apply the same prompt enhancements to `PrepareApplicationPackageCommand` in `OrchestratorCommands.cs`.

### Step 4: Verification & Unit Testing
1. Add tests in `AtsScoringEngineTests.cs`:
   - Verify `C#`, `C++`, `.NET`, `CI/CD` match correctly.
   - Verify synonym matching (`PostgreSQL` matched by `Postgres`, `AWS` matched by `Amazon Web Services`).
   - Verify overall ATS score reaches >85% and >90% on realistic job profiles.
2. Run `dotnet test` to ensure all existing and new tests pass.

---

## 3. Rollback Strategy
All changes are non-breaking and covered by unit tests. If any regression occurs, git checkout on `AtsScoringEngine.cs` and `TailorCommands.cs` restores previous behavior immediately.

---

## Changelog

### 2026-10-05T23:30:00+05:30 — Initial Implementation Plan
- **Created**: Plan for ATS score maximization (>85% - >90%) with punctuation-safe regex, synonym expansion, and metric bullet elevation.
- **Rationale**: User request to target >85% or >90% ATS scores based on JD while remaining truthful.
