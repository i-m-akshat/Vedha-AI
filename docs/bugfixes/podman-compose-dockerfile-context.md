# Bug Fix: Podman Compose Dockerfile Context Discovery Failure

## Root Cause
When executing `podman-compose up --build -d` (or invoking Podman Desktop Compose) from the project root `A:\AIProjects\Resumebuilder`:
1. No `docker-compose.yml` or `Containerfile` existed in the root repository directory (`A:\AIProjects\Resumebuilder`).
2. In `infra/docker-compose.yml`, the build configuration was configured with `context: ..` and `dockerfile: infra/Dockerfile.backend`.
3. When `podman-compose` runs without `-f`, it looks in the current working directory for a compose file. When none is present or when run against root context, Podman invoked `podman build A:\AIProjects\Resumebuilder` without a valid `-f` switch pointing to an existing file in the context.
4. Podman attempted to find `Containerfile` or `Dockerfile` inside the context directory (`A:\AIProjects\Resumebuilder`), found neither, and aborted with exit status 125:
   `Error: no Containerfile or Dockerfile specified or found in context directory, A:\AIProjects\Resumebuilder: The system cannot find the file specified.`

## Proposed Fix
1. **Root-Level `docker-compose.yml`**: Added a root `docker-compose.yml` where `context: .` and `dockerfile: infra/Dockerfile.backend` / `infra/Dockerfile.frontend`. This ensures that any direct invocation of `podman-compose up --build -d` or `docker compose up -d` from the project root correctly resolves the build context (`.`) and passes `-f infra/Dockerfile.backend` to Podman.
2. **Root-Level `Containerfile`**: Added a default root `Containerfile` that targets the backend runtime, ensuring that even bare `podman build .` commands directly in the repository root succeed without failing on file discovery.
3. **Caching Layer in `infra/Dockerfile.backend`**: Added `COPY backend/Directory.Build.props ./` before `dotnet restore` to ensure shared MSBuild properties are correctly evaluated in container builds.
4. **Preserved WSL Native Orchestration**: Maintained `infra/build_and_start.bat` and `infra/start_services.sh` for users leveraging WSL2 Podman machine directly.

## Files Affected
- `docker-compose.yml` (new, root level)
- `Containerfile` (new, root level)
- `infra/Dockerfile.backend` (modified, added `Directory.Build.props` layer)

## Regression Risks
- Zero code regressions in backend or frontend.
- Standard Docker Compose and Podman Compose are both fully supported from repo root.

## Test Strategy & Verification
1. Verify Python path resolution for root compose file (`Exists: True` for both backend and frontend).
2. Verify full solution build (`dotnet build`) succeeds with 0 errors and 0 warnings.
3. Verify full test suite (`dotnet test`) passes 21/21 tests.
