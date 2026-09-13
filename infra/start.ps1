# ResuMate / Vedha AI — Container Startup Script
Write-Host "Checking ResuMate / Vedha AI containers in WSL Podman..." -ForegroundColor Cyan
wsl -d podman-machine-default -u root /mnt/a/AIProjects/Resumebuilder/infra/start_services.sh
if ($LASTEXITCODE -ne 0) {
    throw "Podman container startup failed. Run 'podman ps -a' and inspect the startup output above."
}

# Launch transparent localhost proxy in background if not already running
$proxyRunning = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%localhost_proxy.py%'" -ErrorAction SilentlyContinue
if (-not $proxyRunning) {
    Write-Host "Starting localhost transparent proxy..." -ForegroundColor Cyan
    Start-Process python -ArgumentList "$PSScriptRoot\localhost_proxy.py" -WindowStyle Hidden
}

Write-Host "`nAll containers are active and healthy!" -ForegroundColor Green
Write-Host "Frontend App:         http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend Health:       http://localhost:5000/health" -ForegroundColor Yellow
Write-Host "Swagger UI & Docs:    http://localhost:3000/swagger" -ForegroundColor Yellow
