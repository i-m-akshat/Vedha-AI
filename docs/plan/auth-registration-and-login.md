# Implementation Plan: Authentication (Registration & Login) Enablement & Hardening

**Document ID**: PLAN-AUTH-001  
**Author**: Principal Software Engineer  
**Date**: 2026-10-09  
**Status**: Approved & In Progress  
**Category**: Major Change (Authentication & Identity)  

---

## 1. Overview & Objectives

This implementation plan defines the exact steps required to fix, harden, and fully enable registration and login across the Vedha AI system. It resolves the front-end interceptor loop, improves validation error feedback, synchronizes JWT claim generation and validation, ensures reliable demo user seeding, and hardens database schemas.

---

## 2. Files to Create & Modify

### Files to Create
1. `backend/tests/ResumeTailor.UnitTests/AuthTests.cs`: Comprehensive unit tests for `RegisterCommand`, `LoginCommand`, `GetCurrentUserQuery`, `PasswordHasher`, and `JwtTokenGenerator`.
2. `docs/bugfixes/auth-registration-and-login.md`: Detailed Root Cause Analysis and Bug Fix Plan (completed).
3. `docs/plan/auth-registration-and-login.md`: This implementation plan.

### Files to Modify
1. `frontend/src/api/client.ts`: Exclude `/auth/login` and `/auth/register` from 401 response interceptor redirects.
2. `frontend/src/pages/AuthPages.tsx`: Extract rich validation errors from backend error payloads (`errors`, `detail`, `error`).
3. `frontend/src/stores/useAuthStore.ts`: Standardize canonical token key (`vedha_token`), add `isInitialized` state flag, cleanly handle session boot.
4. `frontend/src/App.tsx`: Incorporate boot/initialization state check before rendering `AppShell` or `LoginPage`.
5. `backend/src/ResumeTailor.Infrastructure/Identity/IdentityServices.cs`: Emit standard claims (`sub` + `NameIdentifier`) in `JwtTokenGenerator` and multi-fallback claim extraction in `CurrentUserService`.
6. `backend/src/ResumeTailor.WebApi/Program.cs`: Idempotent seeding for demo user `demo@vedha.ai`, safe column migrations for both SQLite and PostgreSQL, and graceful hosted service cancellation handling.
7. `infra/start_services.sh`: Fix default `JWT_ISSUER` and `JWT_AUDIENCE` to `VedhaApi` and `VedhaClient`.
8. `infra/localhost_proxy.py`: Guard against self-binding/forwarding when `target_ip` is `127.0.0.1`.

---

## 3. Database Migrations & Schema Strategy

The application currently utilizes EF Core with `EnsureCreated()`. To guarantee zero-drift compatibility across SQLite (local developer environment) and PostgreSQL 16 (production container):
- Add explicit, idempotent column checks during startup in `Program.cs`:
  - `Users.CreditsBalance` (`INTEGER DEFAULT 50`)
  - `Users.MasterContextJson` (`TEXT NULL`)
  - `Users.CustomOpenAiKey` (`TEXT NULL`)
  - `Users.CustomClaudeKey` (`TEXT NULL`)
  - `Users.CustomGeminiKey` (`TEXT NULL`)
  - `Users.PreferredAiProvider` (`INTEGER DEFAULT 2` for Gemini)
  - `Users.PreferredModel` (`TEXT NULL`)
- Upsert seed logic:
  - If `demo@vedha.ai` does not exist, insert with BCrypt hash of `"Password123!"`, role `"User"`, 50 credits.
  - If `demo@vedha.ai` exists and environment is Development, update password hash to verify `"Password123!"` is active.

---

## 4. API & Contract Changes

No breaking API route changes are introduced. Contracts are preserved:
- `POST /api/auth/register` (body: `{ email, password, fullName }`) ➔ returns `200 OK` `{ token, user }` or `400 Bad Request` `{ error: "..." }` / `{ errors: { ... } }`.
- `POST /api/auth/login` (body: `{ email, password }`) ➔ returns `200 OK` `{ token, user }` or `401 Unauthorized` `{ error: "..." }`.
- `GET /api/auth/me` (header: `Authorization: Bearer <token>`) ➔ returns `200 OK` `UserDto` or `401 Unauthorized`.

---

## 5. Step-by-Step Implementation Sequence

### Phase 1: Backend Identity & Token Hardening
1. In `IdentityServices.cs`:
   - In `JwtTokenGenerator.GenerateToken`:
     - Add `new Claim(JwtRegisteredClaimNames.Sub, userId.ToString())`.
     - Retain `new Claim(ClaimTypes.NameIdentifier, userId.ToString())`.
     - Retain `new Claim(ClaimTypes.Email, email)`.
     - Retain `new Claim(ClaimTypes.Role, role)`.
   - In `CurrentUserService.UserId`:
     - Read `FindFirst(ClaimTypes.NameIdentifier)?.Value ?? FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? FindFirst("sub")?.Value`.
2. In `Program.cs`:
   - Refactor user seeding to look up `demo@vedha.ai` specifically, rather than `!dbContext.Users.Any()`.
   - Update SQLite and PostgreSQL column alteration scripts to include all nullable API key and provider columns.

### Phase 2: Frontend Client & UI Error Handling
1. In `frontend/src/api/client.ts`:
   - Update the 401 response interceptor:
     ```typescript
     apiClient.interceptors.response.use(
       (response) => response,
       (error) => {
         const requestUrl = error.config?.url || '';
         const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
         
         if (error.response?.status === 401 && !isAuthEndpoint) {
           localStorage.removeItem('vedha_token');
           localStorage.removeItem('resumate_token');
           // Trigger app-level logout state without forcing destructive page reload
           window.dispatchEvent(new CustomEvent('vedha:unauthorized'));
         }
         return Promise.reject(error);
       }
     );
     ```
2. In `frontend/src/pages/AuthPages.tsx`:
   - Create a helper `formatApiError(err: any): string` that inspects:
     - `err.response?.data?.error`
     - `err.response?.data?.detail`
     - `err.response?.data?.errors` (flattens object values)
     - Fallback error message
   - Wire `formatApiError` into both `handleLogin` and `handleRegister`.
3. In `frontend/src/stores/useAuthStore.ts`:
   - Unify token retrieval: check `vedha_token`, fallback to `resumate_token`, and persist strictly to `vedha_token`.
   - Add `isInitialized: boolean` (initially `false`).
   - Listen for `vedha:unauthorized` custom event to execute `logout()`.
   - In `fetchMe()`, finalize with `isInitialized: true`.
4. In `frontend/src/App.tsx`:
   - Check `isInitialized`: if a token exists and `fetchMe()` is pending, render a clean loading spinner rather than flashing the dashboard.

### Phase 3: Infrastructure Configuration Alignment
1. In `infra/start_services.sh`:
   - Change `JWT_ISSUER="${JWT_ISSUER:-VedhaApi}"` and `JWT_AUDIENCE="${JWT_AUDIENCE:-VedhaClient}"`.
2. In `infra/localhost_proxy.py`:
   - Check if `target_ip == "127.0.0.1"`; if so, avoid self-forwarding and log a clean message.

### Phase 4: Unit Testing & Verification
1. Create `backend/tests/ResumeTailor.UnitTests/AuthTests.cs` using xUnit and Moq/InMemory/Mock DbContext.
2. Verify token generation, claim extraction, password verification, and registration validation.
3. Test end-to-end login with `demo@vedha.ai` / `Password123!` and registration of a new user.

---

## 6. Rollback Strategy

1. Frontend changes are purely client-side routing and error extraction enhancements; they do not alter API endpoints or payloads. If needed, git checkout can revert `frontend/src/api/client.ts` and `AuthPages.tsx`.
2. Backend claim additions (`sub` alongside `NameIdentifier`) are backward-compatible with any existing token inspection logic.
3. Database changes add optional nullable columns and idempotent indices; no tables or existing columns are dropped.

---

## 7. Changelog
- **2026-10-09T21:37:00+05:30**:
  - **Status**: Completed
  - **Changes Made**:
    - `frontend/src/api/client.ts`: Excluded `/auth/login` and `/auth/register` from 401 response interceptor redirects to prevent SPA reload loop. Dispatched `vedha:unauthorized` decoupled event for authenticated endpoints.
    - `frontend/src/pages/AuthPages.tsx`: Added `extractErrorMessage` to unpack validation errors (`errors`, `detail`, `title`, `error`) and provide actionable field-level feedback on login and registration.
    - `frontend/src/stores/useAuthStore.ts`: Standardized on `vedha_token`, added `isInitialized` state flag, subscribed to `vedha:unauthorized` event to reset state smoothly.
    - `frontend/src/App.tsx`: Added session verification view (`isInitialized`) to eliminate premature UI flash before `fetchMe()` completes.
    - `backend/src/ResumeTailor.Infrastructure/Identity/IdentityServices.cs`: Added standard JWT `sub` and `email` claims in `JwtTokenGenerator`. Expanded `CurrentUserService` to extract `UserId` with fallbacks for `ClaimTypes.NameIdentifier`, `JwtRegisteredClaimNames.Sub`, and `"sub"`.
    - `backend/src/ResumeTailor.WebApi/Program.cs`: Hardened schema check to add all missing `User` columns (`CreditsBalance`, `MasterContextJson`, `CustomOpenAiKey`, `CustomClaudeKey`, `CustomGeminiKey`, `PreferredAiProvider`, `PreferredModel`) across SQLite and PostgreSQL. Converted demo user seeding to idempotent upsert for `demo@vedha.ai`.
    - `backend/src/ResumeTailor.Infrastructure/Messaging/NatsWorkerEventConsumerHostedService.cs`: Handled `OperationCanceledException` gracefully on shutdown to prevent false fatal host crashes.
    - `infra/start_services.sh`: Synchronized default JWT issuer and audience fallbacks to `VedhaApi` and `VedhaClient`.
    - `infra/localhost_proxy.py`: Guarded against forwarding to `127.0.0.1` to eliminate recursive loop deadlock.
    - `backend/tests/ResumeTailor.UnitTests/AuthTests.cs`: Created comprehensive unit test suite covering password hashing, token claims emission, identity resolution, and encryption masking.
  - **Rationale & Root Reason**: Fixes broken registration and login flows, resolves silent 401 redirect loops in SPA, provides clear error messaging for validation failures, prevents schema-drift runtime crashes, and unifies authentication contracts across services.
  - **Impacted Components**: Frontend API client, Auth store, Auth pages, Backend Identity, DbContext seeding, Infrastructure proxy, Unit tests.
