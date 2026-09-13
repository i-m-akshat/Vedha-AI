<div align="center">
  <img src="docs/assets/vedha-logo.png" alt="Vedha AI Logo" width="130" style="border-radius: 24px; margin-bottom: 8px;" />
  <h1>Vedha AI</h1>
  <p><strong>The AI Career Operating System & Multi-Pipeline Job Application Orchestrator</strong></p>

  <p>
    <a href="https://dotnet.microsoft.com/"><img src="https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet" alt=".NET 10" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.0-61DAFB?logo=react" alt="React 19" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css" alt="Tailwind CSS" /></a>
    <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker" alt="Docker" /></a>
  </p>
</div>

---

Vedha AI is a production-ready AI Career Operating System that bridges the gap between candidates, Applicant Tracking Systems (ATS), and company career portals. Upload an immutable Master Resume once, provide any job opening via URL or raw text, and receive a mathematically truth-preserving, tailored resume, ATS scorecard, recruiter feedback, and automated multi-pipeline application staging.

---

## 🌟 Key Features

- **Multi-Pipeline Job Application Orchestrator**:
  - Dedicated automation providers for LinkedIn Easy Apply (Copilot Mode), Naukri, Greenhouse, Lever, Ashby, and Workday.
  - Generic AI Browser Agent with dynamic semantic DOM form field detection for custom company career portals.
  - Multi-hop redirect unwinding for aggregator links (LinkedIn external apply, Indeed, Wellfound).
- **Candidate Master Profile & Verified Evidence Base**:
  - Store work authorization, visa sponsorship requirements, notice period, and salary expectations once.
  - Key-value evidence knowledge base for verified real-world accomplishments.
- **Browser Agent Screening Question Memory**:
  - Caches company-specific screening Q&A pairs. Automatically reuses verified answers on repeat applications to the same employer.
- **Copilot Review Gateway**:
  - Stages the pre-filled application package and tailored resume PDF; halts before final submission so candidate retains 100% control and safety.
- **Immutable Master Resume**: Upload once in PDF, DOCX, or Markdown. It is parsed into a structured, typed JSON schema and permanently preserved.
- **Smart Job Scraper**: Automatically extracts and cleans job descriptions from LinkedIn, Greenhouse, Lever, Workday, Ashby, Indeed, and generic career pages.
- **Strict "Never Lie" Guarantee**: Rewrites bullets, emphasizes relevant skills, and reorganizes experience without hallucinating fake companies, roles, degrees, or certifications.
- **Comprehensive ATS Scorecard**:
  - Estimated ATS Match percentage.
  - Matching Keywords vs Missing Keywords breakdown.
  - Recruiter strengths, weaknesses, and actionable feedback.
  - Missing skills learning roadmap.
- **Multi-Format ATS-Safe Exports**:
  - Single-column ATS PDF rendered with strict typographic hierarchy.
  - Formatted DOCX document.
  - Clean Markdown and JSON data.
- **Multi-Provider AI Abstraction**: Standardized on Google Gemini (`gemini-2.0-flash` for sub-second parsing, ATS scoring & Q&A, and `gemini-1.5-pro` for deep synthesis) with full support for OpenAI and Claude.
- **Integrated Job Application Tracker**: Built-in Kanban workflow (`Saved` ➔ `Applied` ➔ `Interviewing` ➔ `Offered` ➔ `Rejected`) with linked resumes and interview prep.
- **Chrome Extension (Manifest V3)**: 1-click job scraping directly from active browser tabs.
- **Live Real-time Generation Terminal**: SignalR live log streaming of scraping, parsing, tailoring, and scoring steps.

---

## 🏗️ Architecture & Technology Stack

| Component | Technology |
| :--- | :--- |
| **Backend** | ASP.NET Core 10 Web API, Clean Architecture, CQRS (MediatR), FluentValidation, EF Core |
| **Database** | PostgreSQL, Redis (Caching / Distributed state) |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Framer Motion |
| **Document Parsers** | PdfPig (PDF), DocumentFormat.OpenXml (DOCX), Markdig (Markdown) |
| **Web Scraping** | AngleSharp with custom Readability pipeline & User-Agent rotation |
| **PDF Generation** | QuestPDF (Single-column ATS standard) |
| **Real-Time Logs** | ASP.NET Core SignalR WebSockets |
| **Extension** | Google Chrome Extension Manifest V3 |
| **Containerization** | Docker, Docker Compose, Podman (all configs stored in `infra/`) |

See [ARCHITECTURE.md](file:///A:/AIProjects/Resumebuilder/ARCHITECTURE.md) for detailed design specifications, [SYSTEM_DESIGN_AND_PATTERNS.md](file:///A:/AIProjects/Resumebuilder/SYSTEM_DESIGN_AND_PATTERNS.md) for a masterclass on SOLID principles and design patterns in this codebase, and [INTERESTING_THINGS.md](file:///A:/AIProjects/Resumebuilder/INTERESTING_THINGS.md) for core engineering highlights and innovations.

---

## 🚀 Quick Start Guide

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Node.js 20+](https://nodejs.org/) & npm
- [Docker](https://www.docker.com/) or [Podman](https://podman.io/) (optional, for containerized execution)

### 1. Environment Configuration
Navigate to `infra/` and ensure `.env` is configured:
```bash
cp infra/.env.example infra/.env
```
*(Note: `infra/.env` is ignored by Git and must not be committed.)*

---

### 2. Running with Containers

#### Option A: Docker Compose
```bash
docker compose -f infra/docker-compose.yml up --build
```

#### Option B: Podman on Windows (WSL)
On Windows with WSL Podman, use the automated one-click launcher scripts in `infra/`:
```powershell
# Rebuild images and launch containers (recommended):
.\infra\build_and_start.ps1

# Quick launch existing images:
.\infra\start.ps1

# Stop containers:
.\infra\stop.ps1
```
*(CMD users can run `infra\start.bat`, `infra\stop.bat`, or `infra\build_and_start.bat`)*

On Windows, use `build_and_start.ps1` or `build_and_start.bat` for rebuilds. The currently installed `podman-compose 1.6.0` drops the `dockerfile` field when generating build commands, so `podman compose up --build` incorrectly looks for a root `Dockerfile` and fails. The launcher calls Podman directly with the correct `-f infra/Dockerfile.*` paths.

#### Option C: Native Linux / Docker Compose
```bash
podman compose -f infra/docker-compose.yml up -d --build
# or
docker compose -f infra/docker-compose.yml up -d --build
```

#### Service URLs:
- **Frontend UI**: `http://172.18.158.83:3000` (or `http://localhost:3000`)
- **Backend API & Swagger**: `http://172.18.158.83:3000/swagger`
- **Health Checks**: `http://172.18.158.83:5000/health`

### 3. Install the Chrome Extension

1. Start the frontend and backend so `http://localhost:3000` and `http://localhost:5000` are available.
2. Open `http://localhost:3000` in Chrome and sign in. Reload the page once after installing the extension so the extension can synchronize the session token.
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the repository's `extension/` folder.
4. Open a supported job page and reload it. Click the Vedha AI extension icon to verify the detected title, company, and source.
5. Use **Send to Vedha AI Orchestrator** to stage the job, or use **Safe Biometric Auto-Fill** to populate visible application fields. Review all values and submit manually.

The extension currently expects the local development ports above. It does not submit applications automatically.

---

### 4. Running Locally for Development

#### Backend (.NET 10):
```bash
cd backend/src/ResumeTailor.WebApi
dotnet run
```

#### Frontend (React + Vite):
```bash
cd frontend
npm install
npm run dev
```

---

## 📁 Repository Structure
```
.
├── ARCHITECTURE.md          # Comprehensive architectural overview
├── README.md                # Project documentation
├── backend/                 # ASP.NET Core 10 Clean Architecture Solution
│   ├── src/
│   │   ├── ResumeTailor.Domain/
│   │   ├── ResumeTailor.Application/
│   │   ├── ResumeTailor.Infrastructure/
│   │   └── ResumeTailor.WebApi/
│   └── tests/
├── frontend/                # React 19 + TypeScript + Vite SPA
├── extension/               # Chrome Manifest V3 Extension
├── docs/
│   ├── specs/               # Feature Specifications
│   ├── plan/                # Implementation Plans
│   └── bugfixes/            # Bug Fix Root Cause & Verification Plans
└── infra/                   # Container configs, Dockerfiles, and .env templates
    ├── .env.example
    ├── docker-compose.yml
    ├── Dockerfile.backend
    ├── Dockerfile.frontend
    └── nginx.conf
```

---

## 📄 License
MIT License.
