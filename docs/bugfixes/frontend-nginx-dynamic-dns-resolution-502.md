# Bug Fix: Frontend Nginx 502 Bad Gateway Due to Stale Upstream DNS Caching

## 1. Problem Statement & Symptoms
After recreating or restarting the backend container (`vedha-backend`) during backend builds, requests originating from the browser frontend UI at `http://localhost:3000` (e.g., `GET /api/masterresume`, `POST /api/tailor/generate`, `POST /hubs/progress/negotiate`) failed with:
- **HTTP 502 Bad Gateway**
- Nginx error log in `vedha-frontend`:
  ```
  connect() failed (113: Host is unreachable) while connecting to upstream, client: 172.18.144.1, server: localhost, request: "GET /api/masterresume HTTP/1.1", upstream: "http://10.89.0.6:8080/api/masterresume", host: "localhost:3000"
  ```
- Direct requests to backend on port 5000 (`http://localhost:5000/health`) returned HTTP 200 OK without errors.

## 2. Root Cause Analysis
1. **Container IP Drift on Restart**:
   - In container runtime bridge networks (Podman netavark/bridge `infra_vedha-network`), when `vedha-backend` restarts or is recreated, Podman re-assigns the next available virtual IP address (in this instance, changing from `10.89.0.6` to `10.89.0.9`).
2. **Nginx Upstream Static DNS Caching**:
   - In standard Nginx open-source configurations:
     ```nginx
     upstream backend_api {
         server backend:8080;
         keepalive 32;
     }
     ```
     Nginx queries DNS for `backend` **only once** at server startup and permanently caches the resolved IP in memory.
   - When `vedha-backend` restarted to `10.89.0.9`, Nginx continued forwarding requests to the dead IP `10.89.0.6`, resulting in Linux kernel error `113: Host is unreachable` and returning HTTP 502 Bad Gateway to the client.
3. **Previous Band-Aid**:
   - Previously documented in `docs/bugfixes/frontend-nginx-502-stale-upstream.md`, the issue was temporarily worked around by manually restarting `vedha-frontend`. Every subsequent backend restart reintroduced the 502 Bad Gateway.

## 3. Permanent Architectural Solution
1. **Dynamic DNS Resolver in Nginx (`infra/nginx.conf`)**:
   - Configured Nginx with an active `resolver` directive pointing to the Podman/Docker bridge gateway DNS (`10.89.0.1` and `127.0.0.11`) with a short 5-second TTL (`valid=5s ipv6=off`):
     ```nginx
     resolver 10.89.0.1 127.0.0.11 valid=5s ipv6=off;
     set $backend_upstream http://backend:8080;
     ```
   - In Nginx open-source, using a variable (`$backend_upstream`) inside `proxy_pass $backend_upstream;` forces Nginx to dynamically re-query the nameserver when the 5-second TTL expires.
   - When `vedha-backend` restarts and receives a new IP, Nginx automatically detects the new IP within 5 seconds without requiring an Nginx restart or reload!
2. **Explicit Health Endpoint Proxying (`infra/nginx.conf`)**:
   - Added dedicated pass-through for `location = /health` directly forwarding to `$backend_upstream/health`.
3. **Backend Route Harmonization (`Program.cs`)**:
   - Added `app.MapGet("/api/health")` in addition to `/health` and `/healthz` so health probes succeed uniformly regardless of whether callers use `/health` or `/api/health`.

## 4. Verification & Testing
1. **Initial Verification**:
   - `curl.exe -i http://localhost:5000/api/health` -> HTTP 200 OK
   - `curl.exe -i http://localhost:3000/health` -> HTTP 200 OK
   - `curl.exe -i http://localhost:3000/api/health` -> HTTP 200 OK
   - `curl.exe -i http://localhost:3000/api/masterresume` -> HTTP 401 Unauthorized (properly authenticated backend response)
2. **Acid Test — Container Restart Recovery**:
   - Triggered `podman restart vedha-backend` while leaving `vedha-frontend` untouched.
   - Waited 6 seconds for the 5-second DNS TTL to expire.
   - Curled `http://localhost:3000/health` and `http://localhost:3000/api/masterresume`.
   - Result: Both returned HTTP 200 OK and HTTP 401 Unauthorized immediately. Zero 502 Bad Gateway errors occurred. Automatic recovery confirmed.
3. **Unit Tests**:
   - Executed `dotnet test backend/ResumeTailor.sln`: 35/35 tests passed with 0 warnings and 0 errors.
