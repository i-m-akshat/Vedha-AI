# Bug Fix: Podman Image Build & Container Orchestration Resilience

**Date:** 2026-10-24  
**Classification:** Bug Fix  
**Component:** `infra/build_and_start.ps1`, `infra/start.ps1`, `infra/start_services.sh`, `docs/architecture/system-design.html`  
**Severity:** High (Blocked containerized stack startup and image provisioning)  

---

## 1. Problem Statement & Symptoms

1. **Uninitialized Podman VM Crash in `build_and_start.ps1`**:
   Executing `build_and_start.ps1` on a machine where the Podman machine was uninitialized failed abruptly:
   ```text
   Error: podman-machine-default: VM does not exist
   throw "Unable to start podman-machine-default. Run 'podman machine list' for details."
   ```
   The script assumed `podman-machine-default` was already provisioned and only attempted `podman machine start`.

2. **Missing Image Validation & Broken Storage Isolation in `start.ps1`**:
   `start.ps1` previously invoked `wsl -d podman-machine-default -u root /mnt/.../start_services.sh`.
   - If the local application images (`localhost/infra-backend:latest`, `localhost/infra-frontend:latest`, `localhost/infra-worker:latest`) were not built yet, `start.ps1` failed immediately with container run errors because it had zero build logic or missing-image fallback.
   - Images built natively on Windows via `build_and_start.ps1` are registered under the Podman machine user storage (`/home/user/.local/share/containers/storage`). By launching WSL as `root` (`-u root`), `start_services.sh` inspected the root storage (`/var/lib/containers/storage`), resulting in `Image not found` failures despite successful builds on the host.
   - Swagger URL in `start.ps1` was incorrectly documented as `http://localhost:3000/swagger` instead of port `5000`.

3. **Race Condition on Service Readiness in `build_and_start.ps1`**:
   `build_and_start.ps1` launched `vedha-postgres` and `vedha-redis` and immediately launched `vedha-backend` without health polling. When database cold-starts required 2–4 seconds, the backend container failed on initial migration connection attempts.

---

## 2. Root Cause Analysis

1. **Lack of Machine Lifecycle Management**:
   The PowerShell orchestrators did not inspect `podman machine list` for the existence of `podman-machine-default` before attempting to start it. When absent, Podman requires `podman machine init podman-machine-default`.

2. **Divergent Execution Contexts (Root vs User Storage)**:
   Windows Podman CLI communicates via named pipe forwarding to the rootless user socket inside the WSL Podman machine. `start.ps1` bypassed the Windows Podman CLI and directly spawned WSL under `root`, creating two disjoint container worlds.

3. **Asymmetric Capabilities in `start.ps1` vs `build_and_start.ps1`**:
   `build_and_start.ps1` had retry logic for building images but lacked database readiness polling. `start.ps1` lacked any build capabilities and couldn't recover from missing container images.

---

## 3. Proposed Fix

1. **Machine Lifecycle Helper (`Ensure-PodmanMachine`)**:
   In both `start.ps1` and `build_and_start.ps1`:
   - Inspect existing Podman machines.
   - If `podman-machine-default` does not exist, initialize it via `podman machine init podman-machine-default`.
   - If stopped, start it via `podman machine start podman-machine-default`.
   - Verify connection readiness (`podman info` or `podman version`).

2. **Image Verification and Automated Build (`Ensure-ContainerImages`)**:
   - Provide shared `Invoke-PodmanBuildWithRetry` supporting retry backoff.
   - In `start.ps1`, inspect existing images (`podman images --format "{{.Repository}}:{{.Tag}}"`).
   - If any required image is missing, or if the user supplies `-Build` / `-Rebuild`, build the image automatically.
   - In `build_and_start.ps1`, rebuild all images (or skip if `-SkipBuild` is supplied).

3. **Standardized Orchestration & Health Readiness**:
   - Unify container orchestration through native Windows Podman CLI.
   - Implement readiness loop for PostgreSQL (`pg_isready`) and Redis (`redis-cli ping`) before starting backend.
   - Ensure `infra_vedha-network` is established with all required network aliases.
   - Correct Swagger UI link to `http://localhost:5000/swagger`.
   - Launch `localhost_proxy.py` in the background if not already active.

4. **Architecture Documentation**:
   - Synchronize `docs/architecture/system-design.html` with the resilient container build and orchestration lifecycle.

---

## 4. Files Affected

- [`infra/build_and_start.ps1`](file:///A:/AIProjects/Resumebuilder/infra/build_and_start.ps1) (modified)
- [`infra/start.ps1`](file:///A:/AIProjects/Resumebuilder/infra/start.ps1) (modified)
- [`docs/architecture/system-design.html`](file:///A:/AIProjects/Resumebuilder/docs/architecture/system-design.html) (modified)
- [`docs/bugfixes/podman-image-build-and-orchestration-fixes.md`](file:///A:/AIProjects/Resumebuilder/docs/bugfixes/podman-image-build-and-orchestration-fixes.md) (created)

---

## 5. Regression Risks

- **Zero Regressions for Docker Compose / Podman Compose**: `docker-compose.yml` and `run.sh` configurations remain 100% compliant and unaffected.
- **Improved Windows Developer Experience**: Developers running either `.\infra\start.ps1` or `.\infra\build_and_start.ps1` get automatic machine initialization, image auto-building, and robust database health verification.

---

## 6. Verification Steps

1. Verify `podman machine list` and connection status.
2. Execute `build_and_start.ps1` and verify image build, container startup, and readiness check flow.
3. Test `start.ps1` to ensure container startup, health verification, and proxy activation.
4. Verify HTTP endpoints:
   - Frontend: `http://localhost:3000`
   - Backend Health: `http://localhost:5000/health`
   - Swagger: `http://localhost:5000/swagger`
