#!/bin/bash
set -e

echo "=== ResuMate / Vedha AI Container Orchestrator ==="

# Load local development values when available; never embed API keys in this script.
ENV_FILE="/mnt/a/AIProjects/Resumebuilder/infra/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-resumate_db}"
POSTGRES_USER="${POSTGRES_USER:-resumate_admin}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-resumate_secret_password_change_me}"
JWT_SECRET="${JWT_SECRET:-super_secret_jwt_key_at_least_32_characters_long_for_security_hs256}"
JWT_ISSUER="${JWT_ISSUER:-ResuMateApi}"
JWT_AUDIENCE="${JWT_AUDIENCE:-ResuMateClient}"
JWT_EXPIRY_MINUTES="${JWT_EXPIRY_MINUTES:-1440}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
DEFAULT_AI_PROVIDER="${DEFAULT_AI_PROVIDER:-Gemini}"
DEFAULT_AI_MODEL="${DEFAULT_AI_MODEL:-gemini-3.8-flash}"

# 1. Reset netavark nftables table to eliminate any stale DNAT locks
nft delete table inet netavark 2>/dev/null || true

# 2. Ensure network exists
if ! podman network exists infra_vedha-network; then
    echo "Creating network infra_vedha-network..."
    podman network create infra_vedha-network
fi

# 3. Create or start PostgreSQL and Redis
echo "Checking postgres & redis..."
if podman container exists vedha-postgres; then
  podman start vedha-postgres 2>/dev/null || true
else
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
  podman run -d --name vedha-redis \
    --network infra_vedha-network \
    -p 6379:6379 \
    -v redis_data:/data \
    redis:7-alpine
fi

for attempt in $(seq 1 30); do
  if podman exec vedha-postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1 \
    && podman exec vedha-redis redis-cli ping >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "PostgreSQL or Redis did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

# 4. Remove existing backend/frontend containers if present
podman rm -f vedha-backend vedha-frontend 2>/dev/null || true

# 5. Start Backend
echo "Starting vedha-backend..."
podman run -d --name vedha-backend \
  --network infra_vedha-network \
  --network-alias backend \
  --network-alias vedha-backend \
  -p 5000:8080 \
  -e ASPNETCORE_ENVIRONMENT=Development \
  -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD};" \
  -e ConnectionStrings__Redis="redis:6379" \
  -e JwtSettings__Secret="${JWT_SECRET}" \
  -e JwtSettings__Issuer="${JWT_ISSUER}" \
  -e JwtSettings__Audience="${JWT_AUDIENCE}" \
  -e JwtSettings__ExpiryMinutes="${JWT_EXPIRY_MINUTES}" \
  -e AiSettings__GeminiApiKey="${GEMINI_API_KEY}" \
  -e AiSettings__DefaultProvider="${DEFAULT_AI_PROVIDER}" \
  -e AiSettings__DefaultModel="${DEFAULT_AI_MODEL}" \
  -e EnableSwagger="true" \
  localhost/infra-backend:latest

# 6. Start Frontend
echo "Starting vedha-frontend..."
podman run -d --name vedha-frontend \
  --network infra_vedha-network \
  -p 3000:80 \
  localhost/infra-frontend:latest

echo "=== All containers started successfully ==="
podman ps -a
