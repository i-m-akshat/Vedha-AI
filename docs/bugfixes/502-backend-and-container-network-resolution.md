# Bug Fix Plan: Resolving 502 Bad Gateway and Container Network Resolution in WSL Podman

## 1. Root Cause
1. **Network Partitioning / Split Networks**:
   - `docker-compose.yml` declared network `vedha-network` without an explicit `name` attribute. When executed via `podman-compose`, Podman generated a project-scoped network named `resumebuilder_vedha-network` on subnet `10.89.1.0/24`.
   - Meanwhile, manual launcher scripts ([infra/build_and_start.ps1](file:///A:/AIProjects/Resumebuilder/infra/build_and_start.ps1), [infra/start_services.sh](file:///A:/AIProjects/Resumebuilder/infra/start_services.sh)) created and attached containers to `infra_vedha-network` on subnet `10.89.0.0/24`.
   - The frontend container (`vedha-frontend`) was attached only to `infra_vedha-network`, while backend services were running on `resumebuilder_vedha-network`.
   - As a result, the frontend Nginx reverse proxy was physically partitioned from `backend:8080`, triggering HTTP `502 Bad Gateway`.
2. **Nginx Resolver Gateway Mismatch**:
   - In [infra/nginx.conf](file:///A:/AIProjects/Resumebuilder/infra/nginx.conf), the DNS resolver was hardcoded to `resolver 10.89.0.1 127.0.0.11;`.
   - On subnets where Aardvark DNS listens on `10.89.1.1`, Nginx encountered lookup timeouts trying to query `10.89.0.1`.
3. **Podman Parallel Build Bug in `podman-compose`**:
   - When building images with `podman-compose`, shared `context: .` across multiple services in parallel caused `podman-compose` to tag the ASP.NET Core backend binary onto `resumebuilder_frontend` and `resumebuilder_worker`.

## 2. Proposed Solution
1. Standardize the container network across all Compose and script files by explicitly pinning `name: infra_vedha-network` in [docker-compose.yml](file:///A:/AIProjects/Resumebuilder/docker-compose.yml).
2. Update [infra/nginx.conf](file:///A:/AIProjects/Resumebuilder/infra/nginx.conf) to include both `10.89.1.1` and `10.89.0.1` bridge gateways in the `resolver` directive with short TTL to guarantee instant, seamless DNS resolution across all Podman network subnets.
3. Cleanly attach `vedha-frontend` and backend to the unified network and reload Nginx.

## 3. Files Affected
- [docker-compose.yml](file:///A:/AIProjects/Resumebuilder/docker-compose.yml)
- [infra/nginx.conf](file:///A:/AIProjects/Resumebuilder/infra/nginx.conf)
- [context.md](file:///A:/AIProjects/Resumebuilder/context.md)

## 4. Regression Risks
- None; setting an explicit network name in `docker-compose.yml` ensures idempotent network sharing with external scripts and prevents project name prefixes.

## 5. Test Strategy & Verification Steps
1. Probe frontend reverse proxy health endpoint: `curl -i http://localhost:3000/health` (must return HTTP 200 OK with `status: Healthy, database: Connected`).
2. Probe Swagger UI through frontend: `curl -i http://localhost:3000/swagger/index.html` (must return HTTP 200 OK).
3. Probe API route through frontend: `curl -i http://localhost:3000/api/orchestrator/quick-match` (must return HTTP 405 Method Not Allowed directly from ASP.NET Core rather than Nginx 502).
