# Bug Fix Plan: Backend Container Build Exit Status 100 (Ubuntu InRelease Clock Skew Resilience)

**Date:** 2026-10-15  
**Component:** `infra/Dockerfile.backend`, Podman / Docker Container Build Engine  
**Severity:** High (Blocked container image builds)  

---

## 1. Problem Statement & Symptoms
When executing `infra/build_and_start.ps1`, the Podman build failed repeatedly on step:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    fontconfig \
    fonts-dejavu-core \
    ...
    libasound2t64 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```
With the error:
```
while running runtime: exit status 100
WARNING: Build failed for localhost/infra-backend:latest on attempt 3 of 3.
Podman build failed for localhost/infra-backend:latest after 3 attempts.
```

---

## 2. Root Cause Analysis
Inside the `mcr.microsoft.com/dotnet/aspnet:10.0` base image (Ubuntu 24.04.5 LTS / Noble Numbat), `apt-get update` fetches the signed repository release index (`InRelease`) from `security.ubuntu.com` and `archive.ubuntu.com`. 

In WSL2 / VM container runtimes on Windows, host suspend/resume cycles or local timezone drifts frequently create clock skew between the container environment and the Ubuntu package mirrors. When `apt-get` encounters an `InRelease` file timestamped slightly in the future, it outputs:
```
E: Release file for http://security.ubuntu.com/ubuntu/dists/noble-security/InRelease is not valid yet (invalid for another 1h 13min 3s). Updates for this repository will not be applied.
E: Release file for http://archive.ubuntu.com/ubuntu/dists/noble-updates/InRelease is not valid yet (invalid for another 1h 38min 28s). Updates for this repository will not be applied.
```
Because the update was rejected, the package index remained empty. When subsequent `apt-get install` commands were executed, apt could not resolve package dependency trees and exited with status `100`.

---

## 3. Proposed Fix & Implementation
We added apt configuration options to tolerate clock skew and future release file timestamps:
- `-o Acquire::Check-Valid-Until=false`: Instructs apt not to fail validation if repository release expiration metadata is out of bounds.
- `-o Acquire::Max-FutureTime=86400`: Allows up to 24 hours of future clock skew on repository signatures, permanently immunizing the container build against VM/WSL clock drift.

In `infra/Dockerfile.backend`:
```dockerfile
RUN apt-get -o Acquire::Check-Valid-Until=false -o Acquire::Max-FutureTime=86400 update && \
    apt-get install -y --no-install-recommends \
        -o Acquire::Check-Valid-Until=false -o Acquire::Max-FutureTime=86400 \
        fontconfig \
        fonts-dejavu-core \
        fonts-liberation \
        libgdiplus \
        libnss3 \
        libatk-bridge2.0-0 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libdrm2 \
        libgbm1 \
        libasound2t64 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

---

## 4. Affected Files
- [`infra/Dockerfile.backend`](file:///A:/AIProjects/Resumebuilder/infra/Dockerfile.backend)

---

## 5. Verification Steps
1. Executed `podman build -t localhost/infra-backend:latest -f infra/Dockerfile.backend .`.
2. Verified that `apt-get` successfully updated package indices and installed all 76 prerequisite font and graphics libraries (`fonts-dejavu-core`, `libgdiplus`, `libnss3`, `libasound2t64`).
3. Successfully committed image: `Successfully tagged localhost/infra-backend:latest`.
