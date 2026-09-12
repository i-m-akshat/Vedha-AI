# Bug Fix / Explanation: Docker Compose Obsolete `version` Attribute

## 1. Issue Description
When executing `docker compose`, Docker emits the following warning:
```text
the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion
```

## 2. Root Cause & Meaning
- **What it means**: In the older **Docker Compose V1** (`docker-compose`), the `version: '3.8'` key told Compose which legacy schema parser to use.
- **Why it is obsolete**: With the introduction of **Docker Compose V2** and the unified **Compose Specification standard** (part of the Linux Foundation), Compose files are now format-agnostic. Modern Compose engines automatically adapt to all supported features without needing an explicit `version` property at the top.
- **Impact**: It is harmless (Docker simply ignores it), but it generates a noisy warning in terminal logs.

## 3. Resolution
Removed `version: '3.8'` from [`infra/docker-compose.yml`](file:///A:/AIProjects/Resumebuilder/infra/docker-compose.yml). The configuration now begins directly with the `services:` block in full accordance with the modern Compose Specification standard.
