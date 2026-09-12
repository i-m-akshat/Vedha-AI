# Bug Fix / Troubleshooting: Docker Daemon Named Pipe Connection

## 1. Issue Description
When executing `docker compose up` or inspecting container images, the command fails with:
```text
unable to get image 'infra-frontend': error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/images/infra-frontend/json": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

## 2. Root Cause Analysis
- **Root Cause**: The Docker Desktop application on Windows is installed (`C:\Program Files\Docker\Docker\Docker Desktop.exe`), but its background daemon engine is not currently running.
- **Why It Occurred**: The Windows named pipe `//./pipe/dockerDesktopLinuxEngine` is only created and exposed when Docker Desktop is actively running and the Linux engine has initialized.
- **Secondary Factor**: If running `docker compose up` without `--build` when images have not yet been compiled locally, Docker Compose attempts to pull `infra-frontend` from Docker Hub rather than building from `infra/Dockerfile.frontend`.

---

## 3. Resolution Steps

### Method A: Start Docker Desktop & Build Containers
1. **Launch Docker Desktop**:
   - Start Docker Desktop from the Windows Start menu or run:
     ```powershell
     Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
     ```
2. **Wait for Docker Engine to initialize** (whale icon turns steady in system tray, ~20-30s).
3. **Run Compose with `--build` flag from project root**:
   ```powershell
   docker compose -f infra/docker-compose.yml up -d --build
   ```

---

### Method B: Zero-Docker Local Development Mode (Fastest)
Vedha AI is engineered with zero-config fallback (built-in SQLite and local Vite HMR) so developers do not need Docker running to develop:

1. **Terminal 1 — Run Backend**:
   ```powershell
   cd A:\AIProjects\Resumebuilder\backend\src\ResumeTailor.WebApi
   dotnet run
   ```
   - API & Swagger available at `http://localhost:5000/swagger`

2. **Terminal 2 — Run Frontend**:
   ```powershell
   cd A:\AIProjects\Resumebuilder\frontend
   $env:PATH = "C:\Program Files\nodejs;" + $env:PATH
   npm run dev
   ```
   - Web App UI available at `http://localhost:3000`
