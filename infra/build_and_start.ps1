# ResuMate / Vedha AI — Full Build & Container Startup Script (Native Windows Podman)
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$NoProxy
)

$ErrorActionPreference = "Stop"

Write-Host "=== ResuMate / Vedha AI Container Orchestrator ===" -ForegroundColor Cyan

# 1. Ensure Podman machine is initialized and running
function Ensure-PodmanMachine {
    Write-Host "Verifying Podman machine environment..." -ForegroundColor Cyan
    $existingMachines = podman machine list --format "{{.Name}}" 2>$null
    if ($existingMachines -notmatch "podman-machine-default") {
        Write-Host "Podman machine 'podman-machine-default' does not exist. Initializing..." -ForegroundColor Yellow
        podman machine init podman-machine-default
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to initialize podman-machine-default. Please verify Podman installation."
        }
    }

    $runningMachines = podman machine list --format "{{if .Running}}{{.Name}}{{end}}" 2>$null
    if ($runningMachines -notmatch "podman-machine-default") {
        Write-Host "Starting podman-machine-default..." -ForegroundColor Yellow
        $startOutput = podman machine start podman-machine-default 2>&1
        if ($LASTEXITCODE -ne 0 -and $startOutput -notmatch "already running") {
            throw "Unable to start podman-machine-default: $startOutput"
        }
    }

    # Verify Podman engine connection
    $null = podman version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Podman client cannot connect to the Podman engine socket. Please check 'podman machine list'."
    }
}

Ensure-PodmanMachine

# 2. Build Container Images natively (with automated retry for network resilience)
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path

function Invoke-PodmanBuildWithRetry {
    param(
        [Parameter(Mandatory=$true)][string]$Tag,
        [Parameter(Mandatory=$true)][string]$DockerfilePath,
        [Parameter(Mandatory=$true)][string]$ContextPath,
        [int]$MaxRetries = 3
    )
    $attempt = 1
    while ($attempt -le $MaxRetries) {
        Write-Host "Building $Tag (Attempt $attempt of $MaxRetries)..." -ForegroundColor Cyan
        podman build -t $Tag -f $DockerfilePath $ContextPath
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully built and tagged $Tag." -ForegroundColor Green
            return
        }
        Write-Warning "Build failed for $Tag on attempt $attempt of $MaxRetries."
        if ($attempt -lt $MaxRetries) {
            Write-Host "Waiting 5 seconds before retrying image build..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        }
        $attempt++
    }
    throw "Podman build failed for $Tag after $MaxRetries attempts."
}

if (-not $SkipBuild) {
    Write-Host "Building application container images..." -ForegroundColor Cyan
    Invoke-PodmanBuildWithRetry -Tag "localhost/infra-backend:latest" -DockerfilePath "$PSScriptRoot\Dockerfile.backend" -ContextPath $repoRoot
    Invoke-PodmanBuildWithRetry -Tag "localhost/infra-frontend:latest" -DockerfilePath "$PSScriptRoot\Dockerfile.frontend" -ContextPath $repoRoot
    Invoke-PodmanBuildWithRetry -Tag "localhost/infra-worker:latest" -DockerfilePath "$PSScriptRoot\Dockerfile.worker" -ContextPath $repoRoot
} else {
    Write-Host "Skipping image build step as requested (-SkipBuild)." -ForegroundColor Yellow
}

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
$jwtIssuer    = if ($envMap["JWT_ISSUER"]) { $envMap["JWT_ISSUER"] } else { "VedhaApi" }
$jwtAudience  = if ($envMap["JWT_AUDIENCE"]) { $envMap["JWT_AUDIENCE"] } else { "VedhaClient" }
$jwtExpiry    = if ($envMap["JWT_EXPIRY_MINUTES"]) { $envMap["JWT_EXPIRY_MINUTES"] } else { "1440" }
$geminiKey    = if ($envMap["GEMINI_API_KEY"]) { $envMap["GEMINI_API_KEY"] } else { "" }
$geminiModel  = if ($envMap["GEMINI_MODEL"]) { $envMap["GEMINI_MODEL"] } else { "gemini-2.5-flash" }
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
$crawlerToken = if ($envMap["CRAWL4AI_API_TOKEN"]) { $envMap["CRAWL4AI_API_TOKEN"] } else { "vedha_crawler_token_2026" }
$crawlerEnabled = if ($envMap["CRAWLER_ENABLED"]) { $envMap["CRAWLER_ENABLED"] } else { "true" }
$minioAccess  = if ($envMap["MINIO_ACCESS_KEY"]) { $envMap["MINIO_ACCESS_KEY"] } else { "minioadmin" }
$minioSecret  = if ($envMap["MINIO_SECRET_KEY"]) { $envMap["MINIO_SECRET_KEY"] } else { "minioadmin" }
$minioBucket  = if ($envMap["MINIO_BUCKET"]) { $envMap["MINIO_BUCKET"] } else { "vedha-resumes" }

# 4. Ensure Network exists
$networks = podman network ls --format "{{.Name}}" 2>$null
if ($networks -notcontains "infra_vedha-network") {
    Write-Host "Creating network infra_vedha-network..." -ForegroundColor Cyan
    podman network create infra_vedha-network
}

# 5. Start Core Infrastructure (PostgreSQL, Redis, NATS, MinIO, Crawler)
Write-Host "Checking core infrastructure services..." -ForegroundColor Cyan
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
        -e MINIO_ROOT_USER=$minioAccess -e MINIO_ROOT_PASSWORD=$minioSecret `
        -v minio_data:/data `
        cgr.dev/chainguard/minio:latest server /data --console-address :9001
} else {
    podman start vedha-minio 2>$null | Out-Null
}

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

# 6. Wait for Database & Redis Readiness
Write-Host "Waiting for PostgreSQL & Redis readiness..." -ForegroundColor Cyan
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    $pgReady = podman exec vedha-postgres pg_isready -U $postgresUser -d $postgresDb 2>$null
    $redisReady = podman exec vedha-redis redis-cli ping 2>$null
    if ($LASTEXITCODE -eq 0 -and $redisReady -match "PONG") {
        Write-Host "PostgreSQL and Redis are ready!" -ForegroundColor Green
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Warning "PostgreSQL or Redis did not report healthy within 30 seconds; continuing startup."
}

# 7. Start Application Containers (Backend, Frontend, Worker)
Write-Host "Starting vedha-backend..." -ForegroundColor Cyan
podman rm -f vedha-backend *>$null
Start-Sleep -Milliseconds 300
podman run -d --name vedha-backend --network infra_vedha-network --network-alias backend --network-alias vedha-backend `
    -p 5000:8080 `
    -v vedha_storage_data:/app/s3_local_cache `
    -e ASPNETCORE_ENVIRONMENT=Development `
    -e ConnectionStrings__DefaultConnection="Host=postgres;Port=5432;Database=$postgresDb;Username=$postgresUser;Password=$postgresPass;" `
    -e ConnectionStrings__Redis="redis:6379" `
    -e NatsSettings__Url="nats://nats:4222" `
    -e S3Settings__Endpoint="minio:9000" `
    -e S3Settings__PublicEndpoint="http://localhost:9000" `
    -e S3Settings__AccessKey="$minioAccess" `
    -e S3Settings__SecretKey="$minioSecret" `
    -e S3Settings__BucketName="$minioBucket" `
    -e JwtSettings__Secret="$jwtSecret" `
    -e JwtSettings__Issuer="$jwtIssuer" `
    -e JwtSettings__Audience="$jwtAudience" `
    -e JwtSettings__ExpiryMinutes="$jwtExpiry" `
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
    -e Crawl4AiSettings__Enabled="$crawlerEnabled" `
    -e Crawl4AiSettings__ApiToken="$crawlerToken" `
    -e EnableSwagger="true" `
    localhost/infra-backend:latest
if ($LASTEXITCODE -ne 0) { throw "Failed to start vedha-backend container." }

Write-Host "Starting vedha-frontend..." -ForegroundColor Cyan
podman rm -f vedha-frontend *>$null
Start-Sleep -Milliseconds 300
podman run -d --name vedha-frontend --network infra_vedha-network --network-alias frontend -p 3000:80 localhost/infra-frontend:latest
if ($LASTEXITCODE -ne 0) { throw "Failed to start vedha-frontend container." }

Write-Host "Starting vedha-worker..." -ForegroundColor Cyan
podman rm -f vedha-worker *>$null
Start-Sleep -Milliseconds 300
podman run -d --name vedha-worker --network infra_vedha-network --network-alias worker --network-alias vedha-worker `
    -p 8000:8000 `
    -e NATS_URL="nats://nats:4222" `
    -e MINIO_ENDPOINT="minio:9000" `
    -e MINIO_ACCESS_KEY="$minioAccess" `
    -e MINIO_SECRET_KEY="$minioSecret" `
    -e MINIO_BUCKET="$minioBucket" `
    -e AGENTQL_API_KEY="$agentqlKey" `
    -e RESIDENTIAL_PROXY_URL="$resProxy" `
    -e WORKER_STEALTH_ENGINE="$stealthEngine" `
    -e GEMINI_API_KEY="$geminiKey" `
    -e GEMINI_MODEL="$geminiModel" `
    localhost/infra-worker:latest
if ($LASTEXITCODE -ne 0) { throw "Failed to start vedha-worker container." }

# 8. Start Transparent Localhost Proxy
if (-not $NoProxy) {
    $proxyRunning = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%localhost_proxy.py%'" -ErrorAction SilentlyContinue
    if (-not $proxyRunning) {
        Write-Host "Starting localhost transparent proxy..." -ForegroundColor Cyan
        Start-Process python -ArgumentList "$PSScriptRoot\localhost_proxy.py" -WindowStyle Hidden
    }
}

Write-Host "`n=== Build & Startup Complete ===" -ForegroundColor Green
Write-Host "Frontend App:         http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend Health:       http://localhost:5000/health" -ForegroundColor Yellow
Write-Host "Swagger UI & Docs:    http://localhost:5000/swagger" -ForegroundColor Yellow
