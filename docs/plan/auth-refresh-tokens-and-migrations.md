# Implementation Plan: Refresh Tokens & Database Migration Architecture

**Plan Name**: `auth-refresh-tokens-and-migrations`  
**Classification**: Enhancement  
**Author**: Principal Software Engineer  
**Date**: 2026-10-09  
**Status**: Completed  

---

## 1. Overview & Phased Roadmap

This plan implements:
1. `RefreshToken` domain entity, DbContext configuration, and schema migration logic.
2. Cryptographic token generation and token refresh/revoke MediatR commands.
3. WebApi endpoints in `AuthController`: `POST /api/auth/refresh` and `POST /api/auth/revoke`.
4. Axios client transparent token refresh interceptor with queue replay on 401.
5. Zustand auth store updates for token pair management.
6. Unit and integration tests for refresh token rotation, revocation, and expiration.

---

## 2. Files to Create & Modify

### Files to Create
1. `backend/src/ResumeTailor.Domain/Entities/RefreshToken.cs`: Domain entity representing rotatable refresh tokens.
2. `docs/specs/auth-refresh-tokens-and-migrations.md`: Specification document (completed).
3. `docs/plan/auth-refresh-tokens-and-migrations.md`: This implementation plan.

### Files to Modify
1. `backend/src/ResumeTailor.Domain/Entities/User.cs`: Add `RefreshTokens` navigation collection.
2. `backend/src/ResumeTailor.Application/Common/Interfaces/IJwtTokenGenerator.cs` (or `IdentityServices.cs`): Add refresh token generation and principal extraction from expired token.
3. `backend/src/ResumeTailor.Application/Features/Auth/AuthCommands.cs`: Add `RefreshTokenCommand` and `RevokeTokenCommand` handlers, update `AuthResponseDto`.
4. `backend/src/ResumeTailor.WebApi/Controllers/AuthController.cs`: Add `POST /api/auth/refresh` and `POST /api/auth/revoke`.
5. `backend/src/ResumeTailor.Infrastructure/Persistence/ApplicationDbContext.cs`: Register `DbSet<RefreshToken>` and configure entity relationships.
6. `backend/src/ResumeTailor.WebApi/Program.cs`: Add automated table migration for `RefreshTokens` across SQLite and PostgreSQL.
7. `frontend/src/types/shared.ts`: Update `AuthResponseDto` to include `refreshToken`.
8. `frontend/src/api/index.ts`: Add `refreshToken` and `revokeToken` API methods.
9. `frontend/src/api/client.ts`: Implement Axios automatic token refresh with pending request queueing.
10. `frontend/src/stores/useAuthStore.ts`: Store and manage `vedha_refresh_token`.
11. `backend/tests/ResumeTailor.UnitTests/AuthTests.cs`: Add unit tests for refresh token generation, rotation, and revocation.

---

## 3. Step-by-Step Implementation Sequence

### Step 1: Domain & Database Layer
- Create `RefreshToken.cs` in `ResumeTailor.Domain.Entities`.
- Add `ICollection<RefreshToken> RefreshTokens` to `User.cs`.
- Add `DbSet<RefreshToken>` and Fluent API configurations in `ApplicationDbContext.cs`.
- Update `Program.cs` startup script with `CREATE TABLE IF NOT EXISTS "RefreshTokens"` for PostgreSQL and SQLite.

### Step 2: Application Layer & Commands
- Update `IJwtTokenGenerator` to declare `GenerateRefreshToken()` and `GetPrincipalFromExpiredToken(string token)`.
- Implement both in `JwtTokenGenerator` in `ResumeTailor.Infrastructure`.
- Update `RegisterCommand` and `LoginCommand` to generate and persist a fresh `RefreshToken`.
- Implement `RefreshTokenCommand` handler:
  - Validates expired access token.
  - Verifies matching active refresh token in database.
  - Rotates refresh token (marks old token replaced, creates new token).
  - Returns new JWT access token and new refresh token.
- Implement `RevokeTokenCommand` handler:
  - Marks specified refresh token as revoked.

### Step 3: WebApi Layer
- Expose `POST /api/auth/refresh` (AllowAnonymous).
- Expose `POST /api/auth/revoke` (AllowAnonymous / Authorize).

### Step 4: Frontend Client & Transparent Refresh
- Update `frontend/src/types/shared.ts` with `refreshToken?: string`.
- Update `authApi` in `frontend/src/api/index.ts`.
- Update `useAuthStore.ts` to persist `vedha_refresh_token` and clear it on logout.
- Update `frontend/src/api/client.ts`:
  - When a 401 is received on a non-auth endpoint, if a refresh token exists and is not currently refreshing:
    - Set `isRefreshing = true`.
    - Call `/api/auth/refresh`.
    - Replay queued failed requests with the new token.
    - If refresh fails, purge tokens and dispatch `vedha:unauthorized`.

### Step 5: Testing & Verification
- Add comprehensive xUnit tests in `AuthTests.cs`.
- Validate token rotation, revoked token rejection, expired token rejection, and DTO responses.

---

## 4. Changelog
- **2026-10-09T21:48:30+05:30**: Initial plan created and execution initiated.
- **2026-10-09T21:59:00+05:30**: Fully implemented all steps (Domain, Infrastructure, Application commands, WebApi controllers, Frontend transparent refresh interceptor, Zustand state sync, Unit tests). All 49 backend unit tests passing.

