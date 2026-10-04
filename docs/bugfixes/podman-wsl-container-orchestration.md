# Bug Fix Plan: WSL Podman Container Orchestration & Readiness Deadlock

## 1. Overview & Classification
- **Classification**: Bug Fix
- **Target Subsystems**: Infrastructure Container Scripts (`infra/start_services.sh`, `infra/build_and_start.ps1`, WSL Podman machine environment).

---

## 2. Root Cause Analysis

### 1. Broken Transient Scope Units in WSL Podman Machine
- **Symptom**: `netavark: error while applying dns entries: aardvark-dns failed to start: Failed to start transient scope unit: Transport endpoint is not connected`.
- **Root Cause**: When an underlying physical disk experiences an I/O retry/bus reset, WSL's background systemd D-Bus communication can get into a disconnected state (`systemctl status` returns `Transport endpoint is not connected`). Any container start using netavark network driver fails immediately upon attempting to register DNS entries.
- **Why It Appeared as "PostgreSQL or Redis did not become ready in time"**: `start_services.sh` used `podman start vedha-postgres 2>/dev/null || true`, hiding the container start failure. The subsequent readiness loop repeatedly executed `pg_isready` against an `Exited` container, timing out after 30 attempts (60 seconds).

### 2. Missing Network Aliases on Database & Cache Containers
- **Symptom**: `ConnectionStrings__DefaultConnection="Host=postgres;..."` cannot resolve hostname `postgres`.
- **Root Cause**: `vedha-postgres` was created with `--name vedha-postgres` but without `--network-alias postgres`. Similarly, `vedha-redis` lacked `--network-alias redis`.
- **Impact**: Even when containers were running, the backend container failed to resolve database hosts on `infra_vedha-network`.

### 3. Missing NATS & MinIO Containers in `start_services.sh`
- **Symptom**: Background services attempting to connect to `nats:4222` or `minio:9000` failed or fell back to in-memory routing.
- **Root Cause**: `docker-compose.yml` had NATS and MinIO, but `start_services.sh` only managed Postgres and Redis.
- **Fix**: Add automated creation and startup for `vedha-nats` and `vedha-minio` with appropriate network aliases.

### 4. Windows CRLF Line Endings in Sourced `.env`
- **Symptom**: In Bash, `. "$ENV_FILE"` on Windows files attaches `\r` to environment variable values, causing string matching and port parsing failures.
- **Fix**: Sanitize `$ENV_FILE` by stripping `\r` using `tr -d '\r'` before evaluating.

---

## 3. Files Affected
- `infra/start_services.sh`
- `infra/build_and_start.ps1`

---

## 4. Verification Steps
1. Ensure Podman WSL machine is healthy (`podman ps -a`).
2. Run `start_services.sh` and verify all containers (`vedha-postgres`, `vedha-redis`, `vedha-nats`, `vedha-minio`, `vedha-backend`, `vedha-frontend`) start and pass health checks.
3. Query `http://localhost:5000/health` and verify HTTP 200 OK.

---

## Changelog
- **2026-10-04T17:15:00+05:30**: Initial Bug Fix Plan created for WSL Podman container orchestration, network aliases, CRLF stripping, and readiness diagnostics.
- **2026-10-04T17:23:00+05:30**: Successfully resolved aardvark-dns root collision, verified clean container recreation, started all 5 containers, launched localhost transparent proxy, and verified `/health` (Healthy/Connected), Frontend (HTTP 200), Swagger UI (HTTP 200), and JWT auth login (`demo@vedha.ai`).
