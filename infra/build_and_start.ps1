# ResuMate / Vedha AI — Full Build & Container Startup Script (Native Windows Podman)
$ErrorActionPreference = "Stop"

Write-Host "=== ResuMate / Vedha AI Container Orchestrator ===" -ForegroundColor Cyan

# 1. Ensure Podman machine is running
$machineStatus = podman machine list --format "{{.Running}}" 2>$null
if ($machineStatus -notmatch "true|Currently running") {
    Write-Host "Podman machine is not running. Starting podman-machine-default..." -ForegroundColor Yellow
    podman machine start podman-machine-default
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to start podman-machine-default. Run 'podman machine list' for details."
    }
}

# 2. Build Container Images natively
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Write-Host "Building backend image (localhost/infra-backend:latest)..." -ForegroundColor Cyan
podman build -t localhost/infra-backend:latest -f "$PSScriptRoot\Dockerfile.backend" $repoRoot
if ($LASTEXITCODE -ne 0) { throw "Podman backend build failed." }

Write-Host "Building frontend image (localhost/infra-frontend:latest)..." -ForegroundColor Cyan
podman build -t localhost/infra-frontend:latest -f "$PSScriptRoot\Dockerfile.frontend" $repoRoot
if ($LASTEXITCODE -ne 0) { throw "Podman frontend build failed." }

Write-Host "Building worker image (localhost/infra-worker:latest)..." -ForegroundColor Cyan
podman build -t localhost/infra-worker:latest -f "$PSScriptRoot\Dockerfile.worker" $repoRoot
if ($LASTEXITCODE -ne 0) { throw "Podman worker build failed." }

# 3. Load Environment Variables from infra/.env
$envMap = @{}
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | Where-Object { $_ -match '^([^#=\s]+)\s*=\s*(.*)$' } | ForEach-Object {
        $envMap[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$postgresUser = if ($envMap["POSTGRES_USER"]) { $envMap["POSTGRES_USER"] } else { "resumate_admin" }
$postgresPass = if ($envMap["POSTGRES_PASSWORD"]) { $envMap["POSTGRES_PASSWORD"] } else { "resumate_secret_password_change_me" }
$postgresDb   = if ($envMap["POSTGRES_DB"]) { $envMap["POSTGRES_DB"] } else { "resumate_db" }
$jwtSecret    = if ($envMap["JWT_SECRET"]) { $envMap["JWT_SECRET"] } else { "super_secret_jwt_key_at_least_32_characters_long_for_security_hs256" }
$jwtIssuer    = if ($envMap["JWT_ISSUER"]) { $envMap["JWT_ISSUER"] } else { "ResuMateApi" }
$jwtAudience  = if ($envMap["JWT_AUDIENCE"]) { $envMap["JWT_AUDIENCE"] } else { "ResuMateClient" }
$geminiKey    = if ($envMap["GEMINI_API_KEY"]) { $envMap["GEMINI_API_KEY"] } else { "" }
$aiProvider   = if ($envMap["DEFAULT_AI_PROVIDER"]) { $envMap["DEFAULT_AI_PROVIDER"] } else { "Gemini" }
$aiModel      = if ($envMap["DEFAULT_AI_MODEL"]) { $envMap["DEFAULT_AI_MODEL"] } else { "gemini-flash-lite-latest" }
$aiMaxTokens  = if ($envMap["AI_MAX_TOKENS"]) { $envMap["AI_MAX_TOKENS"] } else { "16384" }
$agentqlKey   = if ($envMap["AGENTQL_API_KEY"]) { $envMap["AGENTQL_API_KEY"] } else { "" }
$resProxy     = if ($envMap["RESIDENTIAL_PROXY_URL"]) { $envMap["RESIDENTIAL_PROXY_URL"] } else { "" }
$stealthEngine = if ($envMap["WORKER_STEALTH_ENGINE"]) { $envMap["WORKER_STEALTH_ENGINE"] } else { "patchright" }
$akshEnabled  = if ($envMap["Aksh__Enabled"]) { $envMap["Aksh__Enabled"] } else { "false" }
$akshBudget   = if ($envMap["Aksh__DailyTokenBudget"]) { $envMap["Aksh__DailyTokenBudget"] } else { "200000" }
$akshModel    = if ($envMap["Aksh__Model"]) { $envMap["Aksh__Model"] } else { "" }
$akshMaxRuns  = if ($envMap["Aksh__MaxConcurrentRuns"]) { $envMap["Aksh__MaxConcurrentRuns"] } else { "3" }
$dispatchEnabled = if ($envMap["Dispatch__Enabled"]) { $envMap["Dispatch__Enabled"] } else { "true" }

# 4. Ensure Network exists
$networks = podman network ls --format "{{.Name}}" 2>$null
if ($networks -notcontains "infra_vedha-network") {
    Write-Host "Creating network infra_vedha-network..." -ForegroundColor Cyan
    podman network create infra_vedha-network
}

# 5. Start Core Infrastructure (PostgreSQL, Redis, NATS)
Write-Host "Checking core services (PostgreSQL, Redis, NATS)..." -ForegroundColor Cyan
$existingContainers = podman ps -a --format "{{.Names}}" 2>$null

if ($existingContainers -notcontains "vedha-postgres") {
    Write-Host "Creating vedha-postgres container..." -ForegroundColor Cyan
    podman run -d --name vedha-postgres --network infra_vedha-network --network-alias postgres --network-alias vedha-postgres `
        -p 5432:5432 -e POSTGRES_USER=$postgresUser -e POSTGRES_PASSWORD=$postgresPass -e POSTGRES_DB=$postgresDb `
        -v postgres_data:/var/lib/postgresql/data postgres:16-alpine
} else {
    podman start vedha-postgres 2>$null | Out-Null
}

if ($existingContainers -notcontains "vedha-redis") {
    Write-Host "Creating vedha-redis container..." -ForegroundColor Cyan
    podman run -d --name vedha-redis --network infra_vedha-network --network-alias redis --network-alias vedha-redis `
        -p 6379:6379 -v redis_data:/data redis:7-alpine
} else {
    podman start vedha-redis 2>$null | Out-Null
}

if ($existingContainers -notcontains "vedha-nats") {
    Write-Host "Creating vedha-nats container..." -ForegroundColor Cyan
    podman run -d --name vedha-nats --network infra_vedha-network --network-alias nats --network-alias vedha-nats `
        -p 4222:4222 -p 8222:8222 nats:latest -js -m 8222
} else {
    podman start vedha-nats 2>$null | Out-Null
}

if ($existingContainers -notcontains "vedha-minio") {
    Write-Host "Creating vedha-minio container..." -ForegroundColor Cyan
    podman run -d --name vedha-minio --network infra_vedha-network --network-alias minio --network-alias vedha-minio `
        -p 9000:9000 -p 9001:9001 `
        -e MINIO_ROOT_USER="minioadmin" -e MINIO_ROOT_PASSWORD="minioadmin" `
        -v minio_data:/data `
        cgr.dev/chainguard/minio:latest server /data --console-address :9001
} else {
    podman start vedha-minio 2>$null | Out-Null
}

$crawlerToken = if ($envMap["CRAWL4AI_API_TOKEN"]) { $envMap["CRAWL4AI_API_TOKEN"] } else { "vedha_crawler_token_2026" }
if ($existingContainers -notcontains "vedha-crawler") {
    Write-Host "Creating vedha-crawler container..." -ForegroundColor Cyan
    podman run -d --name vedha-crawler --network infra_vedha-network --network-alias crawler --network-alias vedha-crawler `
        -p 11235:11235 `
        -e CRAWL4AI_API_TOKEN="$crawlerToken" `
        -e CRAWL4AI_HOOKS_ENABLED="true" `
        unclecode/crawl4ai:latest
} else {
    podman start vedha-crawler 2>$null | Out-Null
}

# 6. Start Application Containers (Backend, Frontend)
Write-Host "Starting vedha-backend..." -ForegroundColor Cyan
podman rm -f vedha-backend 2>$null | Out-Null
podman run -d --name vedha-backend --network infra_vedha-network --network-alias backend --network-alias vedha-backend `
    -p 5000:8080 `
    -v vedha_storage_data:/app/s3_local_cache `
    -e ASPNETCORE_ENVIRONMENT=Development `
    -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=$postgresDb;Username=$postgresUser;Password=$postgresPass;" `
    -e ConnectionStrings__Redis="redis:6379" `
    -e NatsSettings__Url="nats://nats:4222" `
    -e S3Settings__Endpoint="minio:9000" `
    -e S3Settings__PublicEndpoint="http://localhost:9000" `
    -e S3Settings__AccessKey="minioadmin" `
    -e S3Settings__SecretKey="minioadmin" `
    -e S3Settings__BucketName="vedha-resumes" `
    -e JwtSettings__Secret="$jwtSecret" `
    -e JwtSettings__Issuer="$jwtIssuer" `
    -e JwtSettings__Audience="$jwtAudience" `
    -e AiSettings__GeminiApiKey="$geminiKey" `
    -e AiSettings__DefaultProvider="$aiProvider" `
    -e AiSettings__DefaultModel="$aiModel" `
    -e AiSettings__MaxTokens="$aiMaxTokens" `
    -e Aksh__Enabled="$akshEnabled" `
    -e Aksh__DailyTokenBudget="$akshBudget" `
    -e Aksh__Model="$akshModel" `
    -e Aksh__MaxConcurrentRuns="$akshMaxRuns" `
    -e Dispatch__Enabled="$dispatchEnabled" `
    -e Crawl4AiSettings__BaseUrl="http://crawler:11235" `
    -e Crawl4AiSettings__Enabled="true" `
    -e Crawl4AiSettings__ApiToken="$crawlerToken" `
    -e EnableSwagger="true" `
    localhost/infra-backend:latest
if ($LASTEXITCODE -ne 0) { throw "Failed to start vedha-backend container." }

Write-Host "Starting vedha-frontend..." -ForegroundColor Cyan
podman rm -f vedha-frontend 2>$null | Out-Null
podman run -d --name vedha-frontend --network infra_vedha-network -p 3000:80 localhost/infra-frontend:latest
if ($LASTEXITCODE -ne 0) { throw "Failed to start vedha-frontend container." }

Write-Host "Starting vedha-worker..." -ForegroundColor Cyan
podman rm -f vedha-worker 2>$null | Out-Null
podman run -d --name vedha-worker --network infra_vedha-network --network-alias worker --network-alias vedha-worker `
    -p 8000:8000 `
    -e NATS_URL="nats://nats:4222" `
    -e MINIO_ENDPOINT="minio:9000" `
    -e MINIO_ACCESS_KEY="minioadmin" `
    -e MINIO_SECRET_KEY="minioadmin" `
    -e MINIO_BUCKET="vedha-resumes" `
    -e AGENTQL_API_KEY="$agentqlKey" `
    -e RESIDENTIAL_PROXY_URL="$resProxy" `
    -e WORKER_STEALTH_ENGINE="$stealthEngine" `
    localhost/infra-worker:latest
if ($LASTEXITCODE -ne 0) { throw "Failed to start vedha-worker container." }

# 7. Start Transparent Localhost Proxy
$proxyRunning = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%localhost_proxy.py%'" -ErrorAction SilentlyContinue
if (-not $proxyRunning) {
    Write-Host "Starting localhost transparent proxy..." -ForegroundColor Cyan
    Start-Process python -ArgumentList "$PSScriptRoot\localhost_proxy.py" -WindowStyle Hidden
}

Write-Host "`n=== Build & Startup Complete ===" -ForegroundColor Green
Write-Host "Frontend App:         http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend Health:       http://localhost:5000/health" -ForegroundColor Yellow
Write-Host "Swagger UI & Docs:    http://localhost:5000/swagger" -ForegroundColor Yellow
