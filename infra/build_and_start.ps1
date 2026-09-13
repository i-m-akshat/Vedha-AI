# ResuMate / Vedha AI — Full Build & Container Startup Script
Write-Host "Rebuilding and starting ResuMate / Vedha AI containers in WSL Podman..." -ForegroundColor Cyan

wsl -d podman-machine-default -u root -e bash -c "true"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Podman machine is not running. Starting podman-machine-default..." -ForegroundColor Yellow
    podman machine start podman-machine-default
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to start podman-machine-default. Run 'podman machine list' for details."
    }
}

wsl -d podman-machine-default -u root -e bash -c "cd /mnt/a/AIProjects/Resumebuilder && podman --cgroup-manager=cgroupfs build -t localhost/infra-backend:latest -f infra/Dockerfile.backend . && podman --cgroup-manager=cgroupfs build -t localhost/infra-frontend:latest -f infra/Dockerfile.frontend ."
if ($LASTEXITCODE -ne 0) {
    throw "Podman image build failed. See the build output above."
}
wsl -d podman-machine-default -u root /mnt/a/AIProjects/Resumebuilder/infra/start_services.sh
if ($LASTEXITCODE -ne 0) {
    Write-Host "Podman networking failed. Restarting the Podman machine and retrying once..." -ForegroundColor Yellow
    podman machine stop podman-machine-default 2>$null
    podman machine start podman-machine-default
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to restart podman-machine-default. Run 'podman machine list' for details."
    }

    wsl -d podman-machine-default -u root /mnt/a/AIProjects/Resumebuilder/infra/start_services.sh
    if ($LASTEXITCODE -ne 0) {
        throw "Podman container startup failed after machine restart. See the startup output above."
    }
}

# Launch transparent localhost proxy in background if not already running
$proxyRunning = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%localhost_proxy.py%'" -ErrorAction SilentlyContinue
if (-not $proxyRunning) {
    Write-Host "Starting localhost transparent proxy..." -ForegroundColor Cyan
    Start-Process python -ArgumentList "$PSScriptRoot\localhost_proxy.py" -WindowStyle Hidden
}

Write-Host "`nBuild complete. All containers are active and healthy!" -ForegroundColor Green
Write-Host "Frontend App:         http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend Health:       http://localhost:5000/health" -ForegroundColor Yellow
Write-Host "Swagger UI & Docs:    http://localhost:3000/swagger" -ForegroundColor Yellow
