# Bug Fix Plan: S3 Resume Storage & Download Fix

## Issue Summary
When attempting to download or view a generated resume via the public S3 URL (e.g. `http://localhost:9000/vedha-resumes/resumes/ec9ac25b-fd59-4613-a613-b2a26c7b19e7/Target_Employer_Resume.pdf`), the connection fails or returns an error.

## Root Cause Analysis
1. **Missing MinIO Runtime & Deprecated Image**: Upstream MinIO archived community Docker images from Docker Hub. In `infra/start_services.sh`, the MinIO service container was not active.
2. **Missing Host Port Forwarding**: The Windows localhost proxy (`infra/localhost_proxy.py`) only mapped ports `[3000, 5000, 6379, 4222]`; port `9000` was not forwarded.
3. **Storage Disconnect in Backend**: `MinioS3StorageService.cs` saved the generated PDF to its local cache (`s3_local_cache/vedha-resumes/{applicationId}_{fileName}`) and returned a durable URL (`http://localhost:9000/vedha-resumes/...`), but the ASP.NET Core backend had no endpoint to serve bucket keys under `/vedha-resumes/{**key}` or `/api/storage/{bucket}/{**key}`.
4. **Container Storage Volatility**: Container restarts without a dedicated storage volume could erase the `s3_local_cache` directory.

## Proposed Solution
1. **Add Native Storage Controller / Endpoint to ASP.NET Core API**:
   - Create `StorageController.cs` in `ResumeTailor.WebApi`.
   - Map route `[HttpGet("/vedha-resumes/{**key}")]` and `[HttpGet("/api/storage/{bucket}/{**key}")]`.
   - Parse `applicationId` and `fileName` from the key, look up the file in `s3_local_cache/{bucket}/`, and return `File(stream, "application/pdf", fileName, enableRangeProcessing: true)`.
   - Also support `PUT` for S3 compatibility so services within the mesh can PUT files directly if desired.
2. **Proxy Port 9000 to Backend**:
   - In `infra/localhost_proxy.py`, forward port `9000` to backend port `5000` (container port `8080`).
   - This ensures all existing and future links formatted as `http://localhost:9000/vedha-resumes/...` resolve immediately and stream the PDF.
3. **Persist Storage Volume**:
   - In `infra/start_services.sh`, mount `vedha_storage_data:/app/s3_local_cache` to ensure generated resumes persist across container restarts.
   - Restore the existing backed-up resume `ec9ac25b-fd59-4613-a613-b2a26c7b19e7_Target_Employer_Resume.pdf` into the persistent volume.
4. **Frontend Direct Fallback**:
   - Ensure `OrchestratorQueuePage.tsx` handles both S3 direct URLs and backend storage routes gracefully.

## Affected Files
- `backend/src/ResumeTailor.WebApi/Controllers/StorageController.cs` (New)
- `infra/localhost_proxy.py` (Modified)
- `infra/start_services.sh` (Modified)
- `infra/docker-compose.yml` (Modified)

## Regression Risks
- Low risk. The storage controller only responds to `/vedha-resumes/*` and `/api/storage/*`. Existing API routes (`/api/auth`, `/api/autonomous/*`, etc.) remain completely untouched.

## Test Strategy & Verification
1. Build `ResumeTailor.sln` to ensure 0 compiler warnings/errors and run `dotnet test` (all 30 tests pass).
2. Re-publish backend container with storage controller and persistent volume.
3. Restore `ec9ac25b-fd59-4613-a613-b2a26c7b19e7_Target_Employer_Resume.pdf`.
4. Update `localhost_proxy.py` to forward port 9000.
5. Verify `curl -I http://localhost:9000/vedha-resumes/resumes/ec9ac25b-fd59-4613-a613-b2a26c7b19e7/Target_Employer_Resume.pdf` returns `HTTP/1.1 200 OK` and `Content-Type: application/pdf`.
6. Verify browser can open and render the resume PDF.
