@echo off
echo [Vedha AI] Starting containers in WSL Podman...
wsl -d podman-machine-default -u root /mnt/a/AIProjects/Resumebuilder/infra/start_services.sh

start /b python "%~dp0localhost_proxy.py" >nul 2>&1

echo.
echo [Vedha AI] Containers started successfully!
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000/health
pause
