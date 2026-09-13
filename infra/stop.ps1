# ResuMate / Vedha AI — Container Stop Script
Write-Host "Stopping ResuMate / Vedha AI containers..." -ForegroundColor Cyan

wsl -d podman-machine-default -u root podman stop vedha-backend vedha-frontend vedha-postgres vedha-redis

# Stop background localhost proxy if running
Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%localhost_proxy.py%'" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "All containers and proxy services stopped successfully." -ForegroundColor Green
