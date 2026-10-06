<div align="center">
  <img src="docs/assets/vedha-logo.png" alt="Vedha AI Logo" width="130" style="border-radius: 24px; margin-bottom: 8px;" />
  <h1>Vedha AI</h1>
  <p><strong>The AI Career Operating System & Multi-Pipeline Job Application Orchestrator</strong></p>

  <p>
    <a href="https://dotnet.microsoft.com/"><img src="https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet" alt=".NET 10" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18%2F19-61DAFB?logo=react" alt="React" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css" alt="Tailwind CSS" /></a>
    <a href="https://threejs.org/"><img src="https://img.shields.io/badge/Three.js-Spatial_3D-000000?logo=three.js" alt="Three.js" /></a>
    <a href="https://nats.io/"><img src="https://img.shields.io/badge/NATS-JetStream-27AAE1?logo=nats.io" alt="NATS" /></a>
    <a href="https://min.io/"><img src="https://img.shields.io/badge/MinIO-S3_Storage-C72C48?logo=minio" alt="MinIO" /></a>
    <a href="https://crawl4ai.com/"><img src="https://img.shields.io/badge/Crawl4AI-Stealth_Scraping-FF6B6B" alt="Crawl4AI" /></a>
  </p>
</div>

---

Vedha AI is an enterprise-grade AI Career Operating System that bridges the gap between candidates, Applicant Tracking Systems (ATS), and company career portals. Upload an immutable Master Resume once, provide any job opening via URL or raw text, and receive a mathematically truth-preserving, tailored resume, comprehensive ATS scorecard, recruiter feedback, and automated multi-pipeline application staging.

---

## 🌟 Key Features

- **Multi-Pipeline Job Application Orchestrator**:
  - Dedicated automation providers for LinkedIn Easy Apply (Copilot Mode), Naukri, Greenhouse, Lever, Ashby, and Workday.
  - Event-driven background application processing using **NATS JetStream** (`app.job.ingested` ➔ `app.resume.generated` ➔ `app.worker.success`).
  - Autonomous AI Playwright Worker (`workers/`) for semantic DOM navigation, resume attachment, and anti-bot evasion.
- **Chrome Extension Copilot (Manifest V3)**:
  - **Adaptive Floating Copilot Dock**: Draggable floating pill/card with active modal elevation (`manageModalStacking`) so application dialogs are never blocked.
  - **Dynamic LinkedIn Easy Apply AI Q&A Engine**: Real-time DOM inspection extracting employer questions, grounded AI answering via Google Gemini, and biometric Gaussian keystroke jitter auto-filling.
  - 1-click job scraping directly from active browser tabs.
- **Advanced Scraping Microservice (Crawl4AI)**:
  - Dedicated `unclecode/crawl4ai` microservice running on port 11235 with Playwright stealth mode and automated JavaScript accordions unrolling (`.show-more-less-html__button--more` on LinkedIn, `.styles_jhc__read-more-btn` on Naukri).
  - Next.js SPA dynamic hydration management and dual-engine fallback to AngleSharp.
- **Candidate Master Profile & Verified Evidence Base**:
  - Store work authorization, visa sponsorship requirements, notice period, and salary expectations once.
  - Key-value evidence knowledge base for verified real-world accomplishments.
- **Browser Agent Screening Question Memory**:
  - Caches company-specific screening Q&A pairs. Automatically reuses verified answers on repeat applications to the same employer with zero AI latency.
- **Copilot Review Gateway**:
  - Stages the pre-filled application package and tailored resume PDF; halts before final submission so candidate retains 100% control and safety.
- **Strict "Never Lie" Guarantee**:
  - Algorithmic truth-preservation validator in `AtsScoringEngine.cs` enforcing quantitative metric invariance and company/degree entity subsets without hallucinating unverified credentials.
- **Hardened ATS Scoring & Regex Taxonomy**:
  - Self-healing regex taxonomy covering 60+ industry standards with AI fallback keyword extraction to prevent artificial scoring penalties.
- **Futuristic 3D Spatial Interface**:
  - Ambient Three.js neural constellation background (`FuturisticCanvas3D.tsx`) with interactive parallax and cyber telemetry headers.
  - Holographic radial progress gauges and animated radar upload state trackers.
- **S3-Compatible Object Storage (MinIO)**:
  - S3 bucket storage backed by MinIO with AWS SigV4 authentication (`AWSSDK.S3`) and resilient local disk caching.

---

## 🏗️ Architecture & Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend API** | ASP.NET Core 10 Web API | Clean Architecture, CQRS (MediatR), FluentValidation, EF Core |
| **Database** | PostgreSQL 16 + pgvector | Relational schema, master resume versions, vector embeddings |
| **Cache & Distributed State**| Redis 7 Alpine | Idempotency locks, distributed session state, screening memory |
| **Message Broker** | NATS JetStream | Event stream topics (`app.job.ingested`, `app.resume.generated`) |
| **Object Storage** | MinIO (Chainguard S3) | AWS SigV4 signed document storage (`vedha-resumes` bucket) |
| **Scraper Microservice** | Crawl4AI (Python 3.11) | Headless Playwright stealth scraper with JS hooks |
| **Browser Worker** | Python 3.11 + Playwright | Autonomous ATS form submitter & AgentQL semantic automation |
| **Frontend SPA** | React 18/19, Vite, Tailwind | Three.js Spatial 3D, TanStack Query, Zustand, Nginx reverse proxy |
| **Chrome Extension** | Manifest V3 | Draggable copilot dock, DOM question extractor, biometric jitter |
| **Document Parsers** | PdfPig, OpenXML, Markdig | PDF unwrapping, DOCX extraction, Markdown formatting |
| **PDF Generation** | QuestPDF | Strict single-column typographic ATS layout standard |
| **Real-Time Logs** | ASP.NET Core SignalR | WebSocket streaming of scraping, tailoring, and scoring telemetry |

---

## 🚀 Quick Start Guide

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Node.js 20+](https://nodejs.org/) & npm
- [Podman](https://podman.io/) or [Docker](https://www.docker.com/)

---

### 1. Environment Configuration
Navigate to `infra/` and configure your environment:
```bash
cp infra/.env.example infra/.env
```
Ensure you configure your `GEMINI_API_KEY` (or OpenAI/Claude keys) in `infra/.env`.

---

### 2. Running with Containers

#### Option A: One-Click Windows Launcher (Native Podman + WSL2)
On Windows with WSL Podman, run the orchestrator script:
```powershell
# Rebuild images and start all 8 containers + transparent localhost proxy:
.\infra\build_and_start.ps1

# Quick restart without rebuilding:
.\infra\start.ps1
```
*(CMD users can run `infra\build_and_start.bat` or `infra\start.bat`)*

#### Option B: Standard Docker Compose
```bash
docker compose up --build -d
```

---

### 3. Service Access Endpoints

Once started, all services are available on standard localhost ports:

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:3000](http://localhost:3000) | Full React SPA, Studio, and Dashboard |
| **Backend API Health** | [http://localhost:5000/health](http://localhost:5000/health) | Health check probe (Database + Redis status) |
| **Interactive Swagger UI** | [http://localhost:3000/swagger](http://localhost:3000/swagger) | OpenAPI interactive documentation |
| **MinIO Storage Console** | [http://localhost:9001](http://localhost:9001) | S3 web console (user: `minioadmin` / pass: `minioadmin`) |
| **Crawl4AI Microservice** | [http://localhost:11235/health](http://localhost:11235/health) | Anti-bot scraping engine health check |

---

### 4. Install the Chrome Extension

1. Ensure the web application is running at `http://localhost:3000`.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the [extension/](file:///A:/AIProjects/Resumebuilder/extension) directory.
5. Navigate to any job posting (e.g. LinkedIn, Naukri, Greenhouse, Lever).
6. The draggable **⚡ Vedha Copilot** dock will appear at the bottom-right, allowing 1-click job scraping and AI Easy Apply auto-fill.

---

### 5. Running Locally for Development (Bare Metal)

#### Backend (.NET 10 WebAPI):
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
├── ARCHITECTURE.md          # Comprehensive architectural blueprint
├── SYSTEM_DESIGN_AND_PATTERNS.md # Masterclass in Clean Architecture & SOLID patterns
├── INTERESTING_THINGS.md    # 18 deep engineering highlights & innovation breakdowns
├── README.md                # Project documentation and quick start guide
├── context.md               # Continuous architecture knowledge base & session history
├── infra/
│   ├── docker-compose.yml       # Production multi-service container orchestration
│   ├── Dockerfile.backend       # Multi-stage .NET 10 container image
│   ├── Dockerfile.frontend      # Multi-stage Node 22 + Alpine Nginx container image
│   ├── Dockerfile.worker        # Playwright Python 3.11 container image
│   ├── nginx.conf               # Reverse proxy configuration with multi-gateway resolver
│   ├── localhost_proxy.py       # Transparent host-to-WSL proxy
│   └── build_and_start.ps1      # Automated build and container orchestrator
├── backend/                 # ASP.NET Core 10 Clean Architecture Solution
│   ├── src/
│   │   ├── ResumeTailor.Domain/         # Entities, Value Objects, Domain Events
│   │   ├── ResumeTailor.Application/    # CQRS MediatR Handlers, Interfaces, Validation
│   │   ├── ResumeTailor.Infrastructure/ # EF Core, S3 MinIO, NATS, Scrapers, AI Multi-Provider
│   │   └── ResumeTailor.WebApi/         # Controllers, SignalR Hub, Auth Middleware
│   └── tests/                           # 40+ Unit and Integration Tests (100% passing)
├── frontend/                # React 18/19 + TypeScript + Vite SPA
├── extension/               # Chrome Manifest V3 Extension (Draggable Copilot & Q&A)
├── workers/                 # Autonomous Playwright Browser Worker (AgentQL & NATS)
├── docs/
│   ├── specs/               # Feature Specifications
│   ├── plan/                # Implementation Plans
│   └── bugfixes/            # Bug Fix Root Cause & Verification Plans
└── infra/                   # Container configurations, Dockerfiles, and scripts
    ├── .env.example         # Environment template
    ├── Dockerfile.backend   # Multi-stage .NET 10 container image
    ├── Dockerfile.frontend  # Multi-stage Node 22 + Alpine Nginx container image
    ├── Dockerfile.worker    # Playwright Python 3.11 container image
    ├── nginx.conf           # Reverse proxy configuration with multi-gateway resolver
    ├── localhost_proxy.py   # Transparent host-to-WSL proxy
    └── build_and_start.ps1  # Automated build and container orchestrator
```

---

## 📄 License
MIT License.
