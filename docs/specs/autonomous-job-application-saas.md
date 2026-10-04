# Feature Specification: Autonomous Job Application SaaS & Event-Driven Engine

## 1. Problem Statement
The current job application process requires candidates to manually search, tailor resumes, complete lengthy ATS (Applicant Tracking System) questionnaires, and submit applications repeatedly. Existing automation tools rely on brittle CSS selectors (e.g. `div.apply-button-3x`) that break whenever an ATS platform updates its DOM, or use naive text rewrites that introduce hallucinations or fail keyword matching. Furthermore, monolithic architectures struggle with long-running, timeout-prone browser sessions and anti-bot mitigation firewalls (Cloudflare Turnstile, PerimeterX, DataDome).

## 2. Business Goal
To implement a production-grade, multi-tenant Autonomous Job Application SaaS adhering strictly to the **System Architecture & BRD: Autonomous Job Application SaaS** specification. The platform provides:
- Autonomous background job discovery and ingestion.
- Resilient event-driven microservices orchestration using NATS JetStream.
- Context-aware Hybrid RAG dynamic resume tailoring powered by pgvector embeddings and strict truth-preservation guardrails.
- Cloud document generation with S3-compatible object persistence.
- Stateless AI Playwright workers utilizing semantic AI queries (AgentQL) and rotating residential proxies to bypass brittle DOM structures.
- Human-in-the-Loop (HitL) real-time escalation for subjective screening questions.
- Atomic transaction credit accounting with strict idempotency to protect user balances.

## 3. Scope
- **Message Broker**: NATS JetStream integration with topics `app.job.ingested`, `app.resume.generated`, `app.worker.success`, and `app.worker.hitl_required`.
- **Database & Multi-Tenancy**:
  - PostgreSQL with `pgvector` extension enabled.
  - Multi-tenant data segregation with user tenant boundaries.
  - Table `career_achievements` storing vector embeddings for verified bullet points.
  - User credit balance management (`credits_balance`) and `master_context` JSONB.
  - Application audit tracking with status lifecycle (`pending`, `generating_resume`, `applying`, `success`, `failed`, `hitl_required`) and `resume_s3_url`.
- **Hybrid RAG Generator**:
  - Embedding pipeline (`text-embedding-3-small` / Gemini embeddings).
  - Cosine similarity vector search retrieving the top 15 relevant career achievements.
  - Markdown compilation to styled HTML / PDF, uploaded directly to an S3-compatible bucket (MinIO / AWS S3).
- **AI Playwright Worker**:
  - Stateless worker container subscribing to NATS JetStream.
  - Semantic DOM element querying via AgentQL / semantic selectors.
  - Rotating residential proxy integration.
  - HitL fallback triggering WebSocket alerts on subjective queries.
- **Credit Accounting**:
  - Atomic credit deduction on `app.worker.success` with idempotent transaction logging.
- **Frontend & WebSockets**:
  - Live HitL modal for answering subjective prompts in real time.
  - User credits display and top-up indicators.

## 4. Out of Scope
- Automated direct payment processor (Stripe/Razorpay webhook) checkout flow; focus is on the credit deduction engine and ledger.
- CAPTCHA solving farms (system utilizes HitL escalation or proxy rotation for anti-bot mitigation).

## 5. User Stories
- **As a job seeker**, I want the platform to automatically extract my career achievements into vector embeddings, so that my applications are generated using only my verified accomplishments.
- **As a job seeker**, I want my applications to be processed asynchronously without crashing when browser forms take minutes to fill, so that my submissions are resilient and reliable.
- **As a job seeker**, I want to be notified via real-time WebSocket if a company asks an unexpected subjective question (e.g., "Why do you want to work here?"), so that I can provide an authentic response without failing the application run.
- **As a SaaS user**, I want my credits to be deducted ONLY when an application is successfully submitted, and never double-charged for retries.

## 6. Functional Requirements
1. **Job Ingestion Engine**:
   - Accepts job postings (Title, Description, ATS URL) and publishes `app.job.ingested` to NATS JetStream.
   - De-duplicates jobs per user based on URL and company hash.
2. **Context RAG Resume Generator**:
   - Subscribes to `app.job.ingested`.
   - Embeds job description via embedding model (`text-embedding-3-small` / Gemini embeddings).
   - Performs pgvector cosine search against `career_achievements` (`WHERE user_id = @userId ORDER BY embedding <=> @jobEmbedding LIMIT 15`).
   - Prompts LLM to assemble a tailored Markdown resume using ONLY verified achievements.
   - Renders Markdown to ATS-compliant PDF, uploads to S3-compatible storage, and acquires a durable URL.
   - Publishes `app.resume.generated` with job details and `resume_s3_url`.
3. **Execution Queue & State Machine**:
   - Uses NATS JetStream with durable consumer acknowledgments (ACK/NAK).
   - Manages state progression: `pending` ➔ `generating_resume` ➔ `applying` ➔ (`hitl_required` ➔ `applying`) ➔ `success` / `failed`.
4. **AI Playwright Workers**:
   - Subscribes to `app.resume.generated`.
   - Stateless Python / Node container configured with Playwright and AgentQL.
   - Routes browser traffic through rotating residential proxies.
   - Queries DOM semantically using AgentQL queries (e.g. `{"first_name": "First name input box", "resume_upload": "File upload for resume or CV", "submit_btn": "Submit application button"}`).
   - Sets PDF file directly from S3 download stream into the file input.
   - Detects subjective questions: if detected and not in user memory, sets DB status to `hitl_required` and publishes `app.worker.hitl_required` for real-time WebSocket client intervention.
   - Upon successful submission, publishes `app.worker.success`.
5. **Credit & Idempotency Subsystem**:
   - Consumes `app.worker.success`.
   - Checks `idempotent_transactions` by `application_id`. If already processed, acknowledges and exits.
   - If not processed, atomically decrements `users.credits_balance` by 1 within a database transaction and records the idempotency key.

## 7. Non-Functional Requirements
- **Performance**: Embeddings generation and vector search must complete in < 800ms. S3 PDF upload must complete in < 1.5s.
- **Security**: Strict tenant isolation across all tables. S3 bucket credentials and proxy tokens encrypted. Zero execution directly from cloud provider IPs.
- **Reliability**: At-least-once message delivery via NATS JetStream durable consumers with exponential backoff retries.
- **Scalability**: Worker containers are completely stateless and can scale horizontally across multiple container instances without state coordination.
- **Maintainability**: Clean Architecture, CQRS, and clear separation between API orchestration and execution workers.

## 8. Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Event-Driven Microservices Architecture                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [User / Cron / Webhook]                                                    │
│         │                                                                   │
│         ▼ (POST /api/orchestrator/ingest-job)                               │
│  ┌──────────────────────────────┐                                           │
│  │   Core API Backend (.NET 10) │                                           │
│  │   - Creates ApplicationAudit │                                           │
│  └──────────────┬───────────────┘                                           │
│                 │                                                           │
│                 ▼ Publishes 'app.job.ingested'                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    NATS JetStream Message Broker                      │  │
│  └──────┬─────────────────────────────────────────────────────────▲──────┘  │
│         │                                                         │         │
│         ▼ Subscribes 'app.job.ingested'                           │         │
│  ┌────────────────────────────────────────┐                       │         │
│  │      Context RAG & PDF Generator       │                       │         │
│  │  1. Embed Job Description              │                       │         │
│  │  2. pgvector Search (Top 15 bullets)   │                       │         │
│  │  3. LLM Markdown Synthesis             │                       │         │
│  │  4. Render PDF & Upload to MinIO/S3    │                       │         │
│  └──────┬─────────────────────────────────┘                       │         │
│         │                                                         │         │
│         ▼ Publishes 'app.resume.generated'                        │         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    NATS JetStream Message Broker                      │  │
│  └──────┬─────────────────────────────────────────────────────────▲──────┘  │
│         │                                                         │         │
│         ▼ Subscribes 'app.resume.generated'                       │         │
│  ┌───────────────────────────────────────────────────────┐        │         │
│  │      Stateless AI Playwright Worker (AgentQL)         │        │         │
│  │  - Rotating Residential Proxy                         │        │         │
│  │  - AgentQL Semantic Form Field Queries                │        │         │
│  │  - Attach S3 PDF & Fill Candidate Profile             │        │         │
│  │  - HitL Escalation on Ambiguity ('hitl_required') ────┼────────┘         │
│  │  - Emits 'app.worker.success' ────────────────────────┼────────┘         │
│  └───────────────────────────────────────────────────────┘                  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │              Billing & Credit Deduction Consumer                      │  │
│  │  - Consumes 'app.worker.success'                                      │  │
│  │  - Checks Idempotency Key                                             │  │
│  │  - Atomically Decrements users.credits_balance                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9. API Changes

### New & Updated Endpoints
- `POST /api/orchestrator/ingest-job`
  - Body: `{ jobTitle: string, jobDescription: string, jobUrl: string, company: string }`
  - Response: `{ applicationId: string, status: "pending", queueTopic: "app.job.ingested" }`
- `GET /api/orchestrator/applications`
  - Query: `?status=pending|generating_resume|applying|success|failed|hitl_required`
  - Response: `List<ApplicationAuditDto>`
- `POST /api/orchestrator/career-achievements`
  - Body: `{ content: string }`
  - Computes embedding vector and persists to `career_achievements`.
- `GET /api/orchestrator/career-achievements`
  - Returns list of verified bullet points with embedding metadata.
- `POST /api/orchestrator/hitl-resolve`
  - Body: `{ applicationId: string, question: string, answer: string }`
  - Resumes the paused Playwright worker session.
- `GET /api/users/credits`
  - Returns `{ creditsBalance: number, recentTransactions: List<TransactionDto> }`

## 10. Database Changes (PostgreSQL + pgvector)

### Table: `users` (Alterations)
```sql
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "CreditsBalance" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "MasterContextJson" JSONB NULL;
```

### Table: `career_achievements` (New)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "CareerAchievements" (
    "Id" UUID PRIMARY KEY,
    "UserId" UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "Content" TEXT NOT NULL,
    "Embedding" vector(1536) NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS "IX_CareerAchievements_UserId" ON "CareerAchievements"("UserId");
```

### Table: `applications` (New / Updated Audit Table)
```sql
CREATE TABLE IF NOT EXISTS "ApplicationAudits" (
    "Id" UUID PRIMARY KEY,
    "UserId" UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "JobTitle" VARCHAR(255) NOT NULL,
    "CompanyName" VARCHAR(255) NOT NULL,
    "JobUrl" VARCHAR(2048) NOT NULL,
    "Status" VARCHAR(50) NOT NULL, -- pending, generating_resume, applying, success, failed, hitl_required
    "ResumeS3Url" VARCHAR(2048) NULL,
    "ErrorMessage" TEXT NULL,
    "HitlQuestion" TEXT NULL,
    "HitlAnswer" TEXT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS "IX_ApplicationAudits_UserId_Status" ON "ApplicationAudits"("UserId", "Status");
```

### Table: `idempotent_transactions` (New)
```sql
CREATE TABLE IF NOT EXISTS "IdempotentTransactions" (
    "IdempotencyKey" VARCHAR(255) PRIMARY KEY,
    "UserId" UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "ApplicationId" UUID NOT NULL REFERENCES "ApplicationAudits"("Id") ON DELETE CASCADE,
    "CreditsDeducted" INTEGER NOT NULL,
    "ProcessedAtUtc" TIMESTAMP WITH TIME ZONE NOT NULL
);
```

## 11. UI Changes
- **Credits Badge in Navbar**: Shows user remaining application credits with visual warning when < 5.
- **Career Achievements Studio**: UI tab allowing users to add, manage, and vectorize career accomplishments.
- **Real-Time HitL Modal**: Pops up instantly via WebSocket whenever status transitions to `hitl_required`, allowing instant user answer submission.
- **Application Audits Pipeline View**: Displays status badges (`pending`, `generating_resume`, `applying`, `hitl_required`, `success`, `failed`) and clickable direct links to the S3 PDF.

## 12. Edge Cases
- **Missing or Invalid Job URL**: The ingestion endpoint validates the URL and returns RFC 7807 Bad Request if malformed.
- **Vector Search Zero-Match**: If a candidate has no career achievements stored, the RAG generator falls back to the Master Resume text and logs a warning.
- **S3 Connectivity Failure**: Retries upload with exponential backoff up to 3 times before setting application status to `failed`.
- **Worker Hang / Crash**: NATS JetStream redelivery with `MaxDeliver=3` and consumer timeout. If worker fails 3 times, application transitions to `failed` and no credits are deducted.
- **Duplicate Success Event**: The idempotency table ensures that consuming duplicate `app.worker.success` messages will not deduct credits twice.

## 13. Risks & Mitigations
- **Risk**: pgvector extension requires PostgreSQL container restart and specific compilation.  
  *Mitigation*: Use official `pgvector/pgvector:pg16` Docker image in `infra/docker-compose.yml`.
- **Risk**: External ATS forms frequently change UI structure.  
  *Mitigation*: AgentQL semantic queries evaluate field intents rather than brittle CSS selectors, dramatically lowering failure rates.
- **Risk**: Anti-bot bans on cloud server IPs.  
  *Mitigation*: Playwright workers route through rotating residential proxies with proxy authentication.

## 14. Future Extensions
- Automated credit top-up via Stripe webhook integration.
- ATS status webhooks / automated email scraping for interview invitation tracking.

---

## Changelog

| Date & Timestamp | Changes Made | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- |
| **2026-10-04 10:25:00 UTC** | Initialized specification for Autonomous Job Application SaaS & Event-Driven Engine | Align codebase with `System_Architecture_BRD.pdf` requirements for NATS JetStream, pgvector, S3 storage, AgentQL workers, and credit accounting | `infra/`, `backend/`, `workers/`, `frontend/` |
| **2026-10-04 10:37:00 UTC** | Completed full implementation and test verification of event-driven microservices architecture | Bring platform into 100% compliance with BRD specification: NATS JetStream, pgvector RAG, MinIO S3, Playwright AgentQL worker, and atomic credit deductions | All layers |
| **2026-10-04 10:52:00 UTC** | Fixed database schema auto-migrations, added `app.worker.failed` event consumption, registered dual route alias `/api/autonomous`, and initialized safe exception handling in worker | Fix runtime crashes on existing databases, prevent stuck application statuses, and guarantee zero credit deduction on worker failures | `backend/src/ResumeTailor.WebApi`, `backend/src/ResumeTailor.Infrastructure`, `workers/` |
