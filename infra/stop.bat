@echo off
echo [Vedha AI] Stopping containers...
wsl -d podman-machine-default -u root podman stop vedha-backend vedha-frontend vedha-postgres vedha-redis

powershell -Command "Get-CimInstance Win32_Process -Filter \"CommandLine LIKE '%%localhost_proxy.py%%'\" -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo [Vedha AI] Containers and services stopped successfully.
pause
