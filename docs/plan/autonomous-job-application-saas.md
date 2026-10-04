# Implementation Plan: Autonomous Job Application SaaS & Event-Driven Engine

## 1. Overview
This implementation plan outlines the engineering steps to transition the current Vedha AI platform into the event-driven microservices architecture defined in `System_Architecture_BRD.pdf`. It adds NATS JetStream messaging, pgvector semantic search, S3 document storage, stateless Playwright + AgentQL execution workers, HitL real-time resolution, and atomic credit transactions.

---

## 2. Files to Create

### Infrastructure & Containers (`infra/`)
- `infra/Dockerfile.worker`: Dockerfile for the Python Playwright + AgentQL stateless execution worker.
- `workers/playwright-agent/main.py`: Python worker listening to NATS JetStream `app.resume.generated`, executing AgentQL form filling, handling HitL, and emitting `app.worker.success`.
- `workers/playwright-agent/requirements.txt`: Python dependencies (`playwright`, `agentql`, `nats-py`, `boto3`, `requests`).

### Backend Core & Domain (`backend/src/ResumeTailor.Domain/`)
- `backend/src/ResumeTailor.Domain/Entities/CareerAchievement.cs`: Entity for RAG achievements and pgvector embeddings.
- `backend/src/ResumeTailor.Domain/Entities/ApplicationAudit.cs`: Entity tracking the BRD state machine (`pending`, `generating_resume`, `applying`, `success`, `failed`, `hitl_required`) and `ResumeS3Url`.
- `backend/src/ResumeTailor.Domain/Entities/IdempotentTransaction.cs`: Entity safeguarding credit deduction idempotency.

### Backend Infrastructure (`backend/src/ResumeTailor.Infrastructure/`)
- `backend/src/ResumeTailor.Infrastructure/Messaging/NatsEventBus.cs`: NATS JetStream publisher/consumer client interface and implementation.
- `backend/src/ResumeTailor.Infrastructure/Storage/MinioS3StorageService.cs`: S3-compatible client for uploading rendered PDFs to MinIO/S3.
- `backend/src/ResumeTailor.Infrastructure/Ai/EmbeddingService.cs`: Embedding generator (supporting `text-embedding-3-small` / Gemini embeddings).
- `backend/src/ResumeTailor.Infrastructure/Rag/RagResumeGenerator.cs`: Context RAG generator performing vector search on `CareerAchievements`, synthesizing markdown, compiling PDF, uploading to S3, and emitting `app.resume.generated`.
- `backend/src/ResumeTailor.Infrastructure/Billing/CreditTransactionService.cs`: Service consuming `app.worker.success` and performing atomic idempotent credit deductions.

### Backend Application Features (`backend/src/ResumeTailor.Application/Features/`)
- `backend/src/ResumeTailor.Application/Features/CareerAchievements/CareerAchievementCommandsAndQueries.cs`: CQRS handlers for vectorizing and managing candidate bullet points.
- `backend/src/ResumeTailor.Application/Features/Applications/ApplicationCommandsAndQueries.cs`: CQRS handlers for job ingestion, audit queries, and HitL resolution.

### Backend API Controllers (`backend/src/ResumeTailor.WebApi/Controllers/`)
- `backend/src/ResumeTailor.WebApi/Controllers/AutonomousApplicationsController.cs`: REST endpoints for job ingestion, career achievements RAG management, and HitL resolution.

### Backend Unit Tests (`tests/ResumeTailor.UnitTests/`)
- `tests/ResumeTailor.UnitTests/RagAndVectorSearchTests.cs`: Unit tests verifying cosine similarity retrieval and context RAG generation.
- `tests/ResumeTailor.UnitTests/IdempotentCreditDeductionTests.cs`: Unit tests verifying atomic credit deduction and double-charge prevention.

---

## 3. Files to Modify

### Infrastructure Configuration
- `infra/docker-compose.yml`:
  - Update `postgres` to image `pgvector/pgvector:pg16`.
  - Add `nats` container with JetStream (`nats:latest -js`).
  - Add `minio` container (`minio/minio`) with port mappings `9000:9000` and `9001:9001`.
  - Add `agentql-worker` service container.
- `infra/.env.example` & `infra/.env`:
  - Add `NATS_URL=nats://nats:4222`.
  - Add MinIO settings: `MINIO_ENDPOINT=minio:9000`, `MINIO_ACCESS_KEY=minioadmin`, `MINIO_SECRET_KEY=minioadmin`, `MINIO_BUCKET=vedha-resumes`.
  - Add `AGENTQL_API_KEY=your_agentql_api_key`.
  - Add `RESIDENTIAL_PROXY_URL=http://user:pass@proxy.example.com:8080`.

### Backend Project Files
- `backend/src/ResumeTailor.Domain/Entities/User.cs`: Add `CreditsBalance` and `MasterContextJson`.
- `backend/src/ResumeTailor.Infrastructure/ResumeTailor.Infrastructure.csproj`: Add package references for `Pgvector.EntityFrameworkCore`, `AWSSDK.S3`, and `NATS.Net`.
- `backend/src/ResumeTailor.Infrastructure/Persistence/ApplicationDbContext.cs`: Register `CareerAchievements`, `ApplicationAudits`, `IdempotentTransactions`, and configure pgvector extension.
- `backend/src/ResumeTailor.Infrastructure/DependencyInjection.cs`: Register `INatsEventBus`, `IS3StorageService`, `IEmbeddingService`, `IRagResumeGenerator`, and background message consumers.

### Frontend
- `frontend/src/api/index.ts`: Add API calls for autonomous job ingestion, career achievements, and HitL resolution.
- `frontend/src/types/orchestrator.ts`: Add TypeScript definitions for `ApplicationAuditDto`, `CareerAchievementDto`, and HitL events.
- `frontend/src/components/layout/Navbar.tsx`: Display current user `credits_balance`.
- `frontend/src/pages/OrchestratorQueuePage.tsx`: Add HitL interactive resolution modal and direct links to S3 resume artifacts.

---

## 4. Step-by-Step Implementation Sequence

### Phase 1: Infrastructure & Environment Scaffolding
1. Update `infra/.env.example` with NATS, MinIO, AgentQL, and proxy variables. Synchronize `infra/.env`.
2. Update `infra/docker-compose.yml` to include `pgvector`, `nats` (JetStream enabled), and `minio`.
3. Create `infra/Dockerfile.worker` and `workers/playwright-agent/requirements.txt`.

### Phase 2: Domain Entities & Database Persistence
1. Add `CareerAchievement.cs`, `ApplicationAudit.cs`, and `IdempotentTransaction.cs` to `ResumeTailor.Domain`.
2. Update `User.cs` with `CreditsBalance` (default 50) and `MasterContextJson`.
3. Update `ApplicationDbContext.cs` with DbSets, ModelBuilder configurations, and vector extension enablement.
4. Add EF Core migration / initialization script for pgvector and new tables.

### Phase 3: S3 Storage, Embeddings & RAG Generator
1. Implement `MinioS3StorageService` implementing `IS3StorageService` with bucket creation and presigned/public URL retrieval.
2. Implement `EmbeddingService` for vector generation (`text-embedding-3-small` / Gemini embeddings).
3. Implement `RagResumeGenerator`:
   - Generate embeddings for job descriptions.
   - Vector similarity search for top 15 verified bullet points.
   - Assemble grounded prompt and compile ATS PDF.
   - Upload PDF to S3 and generate `resume_s3_url`.

### Phase 4: NATS JetStream Messaging & Event Bus
1. Implement `NatsEventBus` with durable stream initialization:
   - Stream `APPLICATIONS` covering subjects `app.>`.
   - Topics: `app.job.ingested`, `app.resume.generated`, `app.worker.success`, `app.worker.hitl_required`.
2. Connect background hosted services in ASP.NET Core to consume `app.job.ingested` (triggering RAG pipeline) and `app.worker.success` (triggering credit deduction).

### Phase 5: Python Playwright + AgentQL Worker
1. Develop `workers/playwright-agent/main.py`:
   - Connects to NATS JetStream and subscribes to `app.resume.generated`.
   - Routes through rotating residential proxy.
   - Downloads PDF from S3.
   - Performs AgentQL semantic queries on the application page.
   - Checks for subjective questions: if found, emits `app.worker.hitl_required` and pauses for resolution.
   - Submits form and emits `app.worker.success`.

### Phase 6: Atomic Credit Ledger & Idempotency
1. Implement `CreditTransactionService`:
   - Atomically decrements `CreditsBalance` in `users`.
   - Inserts record into `IdempotentTransactions`.
   - Rejects duplicate application IDs.

### Phase 7: API Endpoints, Frontend & Verification
1. Implement `AutonomousApplicationsController.cs` in WebApi.
2. Update frontend API client, Navbar credits counter, and HitL modal.
3. Write unit tests for RAG vector retrieval and credit deduction idempotency.
4. Run test suite to ensure all unit tests pass.

---

## 5. Testing & Verification Strategy
- **Unit Tests**:
  - `RagAndVectorSearchTests`: Verify vector embedding cosine similarity sorting for top 15 achievements.
  - `IdempotentCreditDeductionTests`: Test that duplicate success events do not double-charge credits.
- **Integration Tests**:
  - Test NATS stream publishing and subscription.
  - Verify MinIO S3 bucket upload and URL retrieval.
- **End-to-End Test**:
  - Submit `POST /api/orchestrator/ingest-job` ➔ verify NATS event published ➔ verify RAG generation and S3 upload ➔ verify worker receives `app.resume.generated` ➔ verify `app.worker.success` triggers credit deduction.

---

## 6. Rollback Strategy
- All new entities, topics, and containers are decoupled and additive.
- Existing endpoints (`/api/orchestrator/prepare-package`, `/api/master-resume`) remain fully functional as fallback paths.
- Reverting consists of stopping NATS/MinIO containers and rolling back git commit.

---

## Changelog

| Date & Timestamp | Changes Made | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- |
| **2026-10-04 10:28:00 UTC** | Created implementation plan for Autonomous Job Application SaaS | Define step-by-step roadmap for NATS JetStream, pgvector, S3 storage, AgentQL workers, and credit transactions | All layers |
| **2026-10-04 10:37:00 UTC** | Successfully executed all 7 implementation phases and verified test suite | Delivered production-grade event-driven architecture, pgvector RAG, MinIO S3 storage, Playwright AgentQL worker, and UI components | All layers |
| **2026-10-04 10:52:00 UTC** | Fixed database schema auto-migrations, added `app.worker.failed` event consumption, registered dual route alias `/api/autonomous`, and initialized safe exception handling in worker | Fix runtime crashes on existing databases, prevent stuck application statuses, and guarantee zero credit deduction on worker failures | `backend/src/ResumeTailor.WebApi`, `backend/src/ResumeTailor.Infrastructure`, `workers/` |
