#!/bin/bash
set -e

echo "=== ResuMate / Vedha AI Container Orchestrator ==="

# Load local development values when available; sanitize Windows CRLF line endings
ENV_FILE="/mnt/a/AIProjects/Resumebuilder/infra/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  eval "$(tr -d '\r' < "$ENV_FILE")"
  set +a
fi

POSTGRES_DB=$(echo "${POSTGRES_DB:-resumate_db}" | tr -d '\r')
POSTGRES_USER=$(echo "${POSTGRES_USER:-resumate_admin}" | tr -d '\r')
POSTGRES_PASSWORD=$(echo "${POSTGRES_PASSWORD:-resumate_secret_password_change_me}" | tr -d '\r')
JWT_SECRET=$(echo "${JWT_SECRET:-super_secret_jwt_key_at_least_32_characters_long_for_security_hs256}" | tr -d '\r')
JWT_ISSUER=$(echo "${JWT_ISSUER:-VedhaApi}" | tr -d '\r')
JWT_AUDIENCE=$(echo "${JWT_AUDIENCE:-VedhaClient}" | tr -d '\r')
JWT_EXPIRY_MINUTES=$(echo "${JWT_EXPIRY_MINUTES:-1440}" | tr -d '\r')
GEMINI_API_KEY=$(echo "${GEMINI_API_KEY:-}" | tr -d '\r')
DEFAULT_AI_PROVIDER=$(echo "${DEFAULT_AI_PROVIDER:-Gemini}" | tr -d '\r')
DEFAULT_AI_MODEL=$(echo "${DEFAULT_AI_MODEL:-gemini-flash-lite-latest}" | tr -d '\r')
AI_MAX_TOKENS=$(echo "${AI_MAX_TOKENS:-16384}" | tr -d '\r')
Aksh__Enabled=$(echo "${Aksh__Enabled:-false}" | tr -d '\r')
Aksh__DailyTokenBudget=$(echo "${Aksh__DailyTokenBudget:-200000}" | tr -d '\r')
Aksh__Model=$(echo "${Aksh__Model:-}" | tr -d '\r')
CRAWL4AI_API_TOKEN=$(echo "${CRAWL4AI_API_TOKEN:-vedha_crawler_token_2026}" | tr -d '\r')
CRAWLER_ENABLED=$(echo "${CRAWLER_ENABLED:-true}" | tr -d '\r')
AGENTQL_API_KEY=$(echo "${AGENTQL_API_KEY:-}" | tr -d '\r')
RESIDENTIAL_PROXY_URL=$(echo "${RESIDENTIAL_PROXY_URL:-}" | tr -d '\r')
WORKER_STEALTH_ENGINE=$(echo "${WORKER_STEALTH_ENGINE:-patchright}" | tr -d '\r')
MINIO_ACCESS_KEY=$(echo "${MINIO_ACCESS_KEY:-minioadmin}" | tr -d '\r')
MINIO_SECRET_KEY=$(echo "${MINIO_SECRET_KEY:-minioadmin}" | tr -d '\r')

# 1. Reset netavark nftables table to eliminate any stale DNAT locks
nft delete table inet netavark 2>/dev/null || true

# 2. Ensure network exists
if ! podman network exists infra_vedha-network; then
    echo "Creating network infra_vedha-network..."
    podman network create infra_vedha-network
fi

# 3. Create or start PostgreSQL, Redis, and NATS
echo "Checking postgres & redis..."
if podman container exists vedha-postgres; then
  podman start vedha-postgres 2>/dev/null || true
else
  echo "Creating and starting vedha-postgres container..."
  podman run -d --name vedha-postgres \
    --network infra_vedha-network \
    -p 5432:5432 \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -v postgres_data:/var/lib/postgresql/data \
    postgres:16-alpine
fi

if podman container exists vedha-redis; then
  podman start vedha-redis 2>/dev/null || true
else
  echo "Creating and starting vedha-redis container..."
  podman run -d --name vedha-redis \
    --network infra_vedha-network \
    -p 6379:6379 \
    -v redis_data:/data \
    redis:7-alpine
fi

if podman container exists vedha-nats; then
  podman start vedha-nats 2>/dev/null || true
else
  echo "Creating and starting vedha-nats container..."
  podman run -d --name vedha-nats \
    --network infra_vedha-network \
    --network-alias nats \
    --network-alias vedha-nats \
    -p 4222:4222 -p 8222:8222 \
    nats:latest -js -m 8222 2>/dev/null || true
fi

if podman container exists vedha-minio; then
  podman start vedha-minio 2>/dev/null || true
else
  echo "Creating and starting vedha-minio container..."
  podman run -d --name vedha-minio \
    --network infra_vedha-network \
    --network-alias minio \
    --network-alias vedha-minio \
    -p 9000:9000 -p 9001:9001 \
    -e MINIO_ROOT_USER="${MINIO_ACCESS_KEY}" \
    -e MINIO_ROOT_PASSWORD="${MINIO_SECRET_KEY}" \
    -v minio_data:/data \
    cgr.dev/chainguard/minio:latest server /data --console-address :9001
fi

echo "Waiting for postgres & redis readiness..."
for attempt in $(seq 1 30); do
  if podman exec vedha-postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1 \
    && podman exec vedha-redis redis-cli ping >/dev/null 2>&1; then
    echo "PostgreSQL and Redis are ready!"
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "PostgreSQL or Redis did not become ready in time." >&2
    echo "=== PostgreSQL Logs ==="
    podman logs --tail 20 vedha-postgres || true
    echo "=== Redis Logs ==="
    podman logs --tail 20 vedha-redis || true
    exit 1
  fi
  sleep 2
done

# 4. Remove existing backend/frontend/worker containers if present
podman rm -f vedha-backend vedha-frontend vedha-worker 2>/dev/null || true

# 5. Start Backend
echo "Starting vedha-backend..."
podman run -d --name vedha-backend \
  --network infra_vedha-network \
  --network-alias backend \
  --network-alias vedha-backend \
  -p 5000:8080 \
  -v vedha_storage_data:/app/s3_local_cache \
  -e ASPNETCORE_ENVIRONMENT=Development \
  -e ConnectionStrings__DefaultConnection="Host=vedha-postgres;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD};" \
  -e ConnectionStrings__Redis="vedha-redis:6379" \
  -e NatsSettings__Url="nats://vedha-nats:4222" \
  -e S3Settings__Endpoint="minio:9000" \
  -e S3Settings__PublicEndpoint="http://localhost:9000" \
  -e S3Settings__AccessKey="${MINIO_ACCESS_KEY}" \
  -e S3Settings__SecretKey="${MINIO_SECRET_KEY}" \
  -e S3Settings__BucketName="vedha-resumes" \
  -e JwtSettings__Secret="${JWT_SECRET}" \
  -e JwtSettings__Issuer="${JWT_ISSUER}" \
  -e JwtSettings__Audience="${JWT_AUDIENCE}" \
  -e JwtSettings__ExpiryMinutes="${JWT_EXPIRY_MINUTES}" \
  -e AiSettings__GeminiApiKey="${GEMINI_API_KEY}" \
  -e AiSettings__DefaultProvider="${DEFAULT_AI_PROVIDER}" \
  -e AiSettings__DefaultModel="${DEFAULT_AI_MODEL}" \
  -e AiSettings__MaxTokens="${AI_MAX_TOKENS}" \
  -e Aksh__Enabled="${Aksh__Enabled}" \
  -e Aksh__DailyTokenBudget="${Aksh__DailyTokenBudget}" \
  -e Aksh__Model="${Aksh__Model}" \
  -e Crawl4AiSettings__BaseUrl="http://vedha-crawler:11235" \
  -e Crawl4AiSettings__Enabled="${CRAWLER_ENABLED}" \
  -e Crawl4AiSettings__ApiToken="${CRAWL4AI_API_TOKEN}" \
  -e EnableSwagger="true" \
  localhost/infra-backend:latest

# 6. Start Frontend
echo "Starting vedha-frontend..."
podman run -d --name vedha-frontend \
  --network infra_vedha-network \
  --network-alias frontend \
  -p 3000:80 \
  localhost/infra-frontend:latest

# 7. Start Playwright Worker
echo "Starting vedha-worker..."
podman run -d --name vedha-worker \
  --network infra_vedha-network \
  --network-alias worker \
  --network-alias vedha-worker \
  -p 8000:8000 \
  -e NATS_URL="nats://vedha-nats:4222" \
  -e MINIO_ENDPOINT="minio:9000" \
  -e MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY}" \
  -e MINIO_SECRET_KEY="${MINIO_SECRET_KEY}" \
  -e MINIO_BUCKET="vedha-resumes" \
  -e AGENTQL_API_KEY="${AGENTQL_API_KEY}" \
  -e RESIDENTIAL_PROXY_URL="${RESIDENTIAL_PROXY_URL}" \
  -e WORKER_STEALTH_ENGINE="${WORKER_STEALTH_ENGINE}" \
  localhost/infra-worker:latest

echo "=== All containers started successfully ==="
podman ps -a
