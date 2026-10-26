# ResuMate / Vedha AI — Container Stop Script (Native Windows Podman)
Write-Host "Stopping ResuMate / Vedha AI containers..." -ForegroundColor Cyan

$containers = @(
    "vedha-backend",
    "vedha-frontend",
    "vedha-worker",
    "vedha-crawler",
    "vedha-postgres",
    "vedha-redis",
    "vedha-nats",
    "vedha-minio"
)

# Attempt native Podman stop first
podman stop $containers 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    # Fallback to WSL if native connection is unconfigured
    wsl -d podman-machine-default -u root podman stop $containers 2>$null | Out-Null
}

# Stop background localhost proxy if running
Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%localhost_proxy.py%'" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping localhost transparent proxy (PID $($_.ProcessId))..." -ForegroundColor Cyan
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "All containers and proxies stopped." -ForegroundColor Green
