@echo off
echo [Vedha AI] Rebuilding and launching containers in WSL Podman...
wsl -d podman-machine-default -u root -e bash -c "cd /mnt/a/AIProjects/Resumebuilder && podman --cgroup-manager=cgroupfs build -t localhost/infra-backend:latest -f infra/Dockerfile.backend . && podman --cgroup-manager=cgroupfs build -t localhost/infra-frontend:latest -f infra/Dockerfile.frontend . && podman --cgroup-manager=cgroupfs build -t localhost/infra-worker:latest -f infra/Dockerfile.worker ."
wsl -d podman-machine-default -u root /mnt/a/AIProjects/Resumebuilder/infra/start_services.sh

start /b python "%~dp0localhost_proxy.py" >nul 2>&1

echo.
echo [Vedha AI] Build complete. All containers active!
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000/health
pause
