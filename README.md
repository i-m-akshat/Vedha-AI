# ResuMate AI — Enterprise AI Resume Tailoring & ATS Optimization Platform

[![.NET 10](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

ResuMate AI is a production-ready SaaS platform that bridges the gap between candidates and Applicant Tracking Systems (ATS). Upload an immutable Master Resume once, provide any job opening via URL (LinkedIn, Greenhouse, Lever, Workday, Ashby, Indeed) or raw text, and receive a mathematically truth-preserving, tailored resume, ATS scorecard, recruiter feedback, and ATS-safe PDF/DOCX downloads.

---

## 🌟 Key Features

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
- **Multi-Provider AI Abstraction**: First-class support for OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), and Google Gemini (2.0 Flash / Pro) with dynamic failover.
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
| **Containerization** | Docker, Docker Compose (all stored in `infra/`) |

See [ARCHITECTURE.md](file:///A:/AIProjects/Resumebuilder/ARCHITECTURE.md) for detailed design specifications.

---

## 🚀 Quick Start Guide

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Node.js 20+](https://nodejs.org/) & npm
- [Docker & Docker Compose](https://www.docker.com/) (optional, for containerized run)

### 1. Environment Configuration
Navigate to `infra/` and ensure `.env` is configured:
```bash
cp infra/.env.example infra/.env
```
*(Note: `infra/.env` is ignored by Git and must not be committed.)*

### 2. Running with Docker Compose
```bash
docker compose -f infra/docker-compose.yml up --build
```
- Frontend: `http://localhost:3000`
- Backend API & Swagger: `http://localhost:5000/swagger`

### 3. Running Locally for Development

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
