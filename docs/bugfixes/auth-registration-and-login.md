# Bug Fix Plan: Authentication (Registration & Login) Subsystem

**Document ID**: BFP-AUTH-001  
**Author**: Principal Software Engineer  
**Date**: 2026-10-09  
**Status**: Ready for Review / Implementation  
**Classification**: Bug Fix & Production Hardening  

---

## 1. Executive Summary & Root Cause Analysis

An end-to-end investigation of the authentication subsystem across the frontend React SPA, ASP.NET Core 10 backend, and container infrastructure identified multiple cascading root causes preventing user registration and login from operating reliably.

### Root Cause 1: Axios Response Interceptor Hard-Redirect Loop
- **File**: `frontend/src/api/client.ts`
- **Mechanism**: The global Axios 401 response interceptor was implemented as:
  ```typescript
  if (error.response?.status === 401) {
    localStorage.removeItem('vedha_token');
    localStorage.removeItem('resumate_token');
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      window.location.href = '/login';
    }
  }
  ```
- **Failure Mode**: When a user attempts to log in with invalid credentials or when the server rejects credentials, `AuthController.Login` returns `401 Unauthorized`. Because the app runs as an SPA mounted at `/`, `!window.location.pathname.includes('/login')` evaluates to `true`. Axios triggers `window.location.href = '/login'`, causing a full browser page refresh. This destroys the React component tree and error state before `LoginPage` can render `"Invalid email or password."`. If `/login` has no explicit route in Vite dev mode, this also triggers a blank screen or 404.

### Root Cause 2: Validation Error Contract Mismatch
- **Files**: `frontend/src/pages/AuthPages.tsx` vs `backend/src/ResumeTailor.WebApi/Middleware/ExceptionHandlingMiddleware.cs`
- **Mechanism**: When `RegisterCommand` or `LoginCommand` encounters a validation error (e.g., password length < 6, invalid email format, empty full name), `ValidationBehavior` throws `ValidationException`. The `ExceptionHandlingMiddleware` serializes:
  ```json
  {
    "statusCode": 400,
    "title": "Validation Failed",
    "detail": "One or more validation failures have occurred.",
    "errors": {
      "Password": ["The length of 'Password' must be at least 6 characters."]
    }
  }
  ```
- **Failure Mode**: `AuthPages.tsx` solely attempts to read `err.response?.data?.error`. Because `data.error` is `undefined`, the UI falls back to generic text (`"Registration failed."` or `"Invalid email or password."`). Users receive no feedback about password length requirements or invalid email syntax.

### Root Cause 3: JWT Claim Mapping Inconsistency (`sub` vs `NameIdentifier`)
- **Files**: `backend/src/ResumeTailor.Infrastructure/Identity/IdentityServices.cs`
- **Mechanism**: `CurrentUserService` resolves `UserId` strictly via:
  ```csharp
  var claim = _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
  ```
- **Failure Mode**: Under .NET 8/9/10, JWT claims inbound mapping behavior varies depending on token handler defaults. When tokens contain standard JWT `sub` (`JwtRegisteredClaimNames.Sub`), or when inbound claim type transformation is disabled or altered, `FindFirst(ClaimTypes.NameIdentifier)` returns `null`. This causes `/api/auth/me` to throw `UnauthorizedException`, immediately triggering session invalidation and throwing the user out.

### Root Cause 4: JWT Issuer & Audience Desynchronization
- **Files**: `infra/start_services.sh`, `backend/src/ResumeTailor.WebApi/appsettings.json`, `infra/.env.example`
- **Mechanism**: In `infra/start_services.sh`, default environment variables were hardcoded as:
  ```bash
  JWT_ISSUER="${JWT_ISSUER:-ResuMateApi}"
  JWT_AUDIENCE="${JWT_AUDIENCE:-ResuMateClient}"
  ```
  while `appsettings.json` configured:
  ```json
  "Issuer": "VedhaApi",
  "Audience": "VedhaClient"
  ```
- **Failure Mode**: Any token generated in one context was rejected with `SecurityTokenInvalidIssuerException` in another, failing authentication validation.

### Root Cause 5: Demo User Seeding Fragility & Schema Drift
- **Files**: `backend/src/ResumeTailor.WebApi/Program.cs`, `backend/src/ResumeTailor.Infrastructure/Persistence/ApplicationDbContext.cs`
- **Mechanism**: `Program.cs` seeded `demo@vedha.ai` with guard `if (!dbContext.Users.Any())`.
- **Failure Mode**: If any test user record was present in the database, `demo@vedha.ai` was omitted. Users attempting to use the default credentials in `LoginPage` (`demo@vedha.ai` / `Password123!`) were blocked. Additionally, using `EnsureCreated()` without migrations led to missing columns (`CreditsBalance`, `MasterContextJson`, `CustomOpenAiKey`, `PreferredAiProvider`) on existing databases.

### Root Cause 6: `localhost_proxy.py` Self-Referential Socket Loop
- **File**: `infra/localhost_proxy.py`
- **Mechanism**: If WSL2 IP resolution failed, `get_wsl_ip()` defaulted to `127.0.0.1`.
- **Failure Mode**: Connecting to `127.0.0.1:5000` routed back into `localhost_proxy.py` itself, causing recursive socket exhaustion, port locks (`SocketException 10048: address already in use`), and preventing the backend from binding.

---

## 2. Proposed Fixes & Architectural Enhancements

| Component | Target File | Proposed Fix |
| :--- | :--- | :--- |
| **Frontend API Client** | `frontend/src/api/client.ts` | Exclude `/auth/login` and `/auth/register` from 401 response interceptor redirects. Trigger state reset without forcing hard browser navigation. |
| **Frontend Auth Pages** | `frontend/src/pages/AuthPages.tsx` | Standardize error parser to unpack `errors`, `detail`, and `error` payloads from API responses. |
| **Frontend Auth Store** | `frontend/src/stores/useAuthStore.ts` | Canonicalize token storage key to `vedha_token`. Introduce `isInitialized` to eliminate race condition on boot. |
| **Frontend Shell** | `frontend/src/App.tsx` | Prevent dashboard flash before token verification completes. |
| **Backend Identity** | `backend/src/ResumeTailor.Infrastructure/Identity/IdentityServices.cs` | In `CurrentUserService`, check `ClaimTypes.NameIdentifier`, `JwtRegisteredClaimNames.Sub`, and `"sub"`. In `JwtTokenGenerator`, emit standard claims. |
| **Backend Seeding** | `backend/src/ResumeTailor.WebApi/Program.cs` | Idempotently seed/update `demo@vedha.ai` account regardless of existing user count. Ensure schema columns exist via safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. |
| **Infrastructure Config** | `infra/start_services.sh`, `infra/localhost_proxy.py` | Align `JWT_ISSUER`/`JWT_AUDIENCE` to `VedhaApi`/`VedhaClient`. Prevent `localhost_proxy.py` from proxying to `127.0.0.1`. |
| **Unit Testing** | `backend/tests/ResumeTailor.UnitTests/AuthTests.cs` | Add comprehensive unit tests covering registration, login, validation, password hashing, and user query handling. |

---

## 3. Regression Risks & Mitigations

1. **Risk**: Existing users with old tokens in `localStorage` experiencing unexpected session states.  
   **Mitigation**: Perform a one-time migration from `resumate_token` to `vedha_token` in `useAuthStore.ts`, and purge corrupted/unparseable tokens gracefully.
2. **Risk**: Inbound claim mapping changes affecting SignalR or background workers.  
   **Mitigation**: Emitting both `ClaimTypes.NameIdentifier` and `JwtRegisteredClaimNames.Sub` ensures both legacy and modern claim inspectors resolve the same Guid.
3. **Risk**: Seeding overwrite of demo user password in production environments.  
   **Mitigation**: Restrict demo user password upsert to development and staging environments (`app.Environment.IsDevelopment()`).

---

## 4. Test & Verification Strategy

- **Unit Tests**:
  - Test registration with valid data returns JWT and UserDto.
  - Test registration with duplicate email returns failure `Result`.
  - Test registration with short password fails `ValidationBehavior`.
  - Test login with valid credentials succeeds and returns valid JWT.
  - Test login with invalid password returns unauthorized failure `Result`.
- **Integration & Manual UI Verification**:
  - Navigate to `http://localhost:3000/`.
  - Sign in using prefilled `demo@vedha.ai` / `Password123!`. Verify dashboard loads with user name Alex Morgan.
  - Log out. Verify clean transition to login screen.
  - Create new account with custom email and password. Verify immediate transition into workspace with 50 credits and initialized state.
  - Test validation error display by entering a 3-character password on registration; verify exact error message appears in banner without page reload.

---

## Changelog
- **2026-10-09**: Initial Root Cause Analysis and Bug Fix Plan created.
