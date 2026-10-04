# Bug Fix: Frontend Nginx 502 Bad Gateway Due to Stale Upstream DNS

## 1. Problem Statement & Symptoms
After recreating the backend container (`vedha-backend`) during the model configuration deployment, requests originating from the browser UI at `http://localhost:3000` (such as `GET /api/masterresume`, `POST /api/tailor/generate`, `PUT /api/masterresume`, and SignalR WebSocket negotiate `/hubs/progress/negotiate`) failed with:
- **HTTP 502 Bad Gateway**
- Nginx error log: `connect() failed (113: Host is unreachable) while connecting to upstream, client: 172.18.144.1, upstream: "http://10.89.0.5:8080/..."`

## 2. Root Cause Analysis
1. In Podman/Docker bridge networking, when a container is removed and recreated, it is assigned a new IP address on the virtual bridge (in this case, changing from `10.89.0.5` to `10.89.0.8`).
2. Nginx resolves upstream hostnames (`server backend:8080`) at startup and caches the IP address in memory.
3. Because `vedha-backend` was recreated while `vedha-frontend` remained running, Nginx continued attempting to proxy incoming browser traffic to the stale IP `10.89.0.5`, causing all subsequent API requests from the frontend UI to immediately return HTTP 502.

## 3. Solution & Verification
1. **Frontend Container Synchronization**:
   - Restarted `vedha-frontend`, prompting Nginx to resolve `backend` to its new live IP address (`10.89.0.8`).
   - Cleaned up `infra/nginx.conf` and ensured standard upstream keepalive proxying.
2. **End-to-End Verification**:
   - Verified all core frontend API routes through port 3000:
     - `GET /api/Auth/me`: HTTP 200 OK
     - `GET /api/masterresume`: HTTP 200 OK
     - `GET /api/masterresume/versions`: HTTP 200 OK
     - `POST /api/tailor/generate`: HTTP 200 OK (completed in 7.02s with Gemini Flash Lite)
     - `GET /api/Tailor/history`: HTTP 200 OK
     - `GET /api/CandidateProfile`: HTTP 200 OK
     - `GET /api/Prompts`: HTTP 200 OK
     - `POST /hubs/progress/negotiate`: HTTP 200 OK
