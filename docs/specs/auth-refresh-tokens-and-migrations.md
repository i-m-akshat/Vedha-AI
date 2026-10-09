# Feature Specification: Refresh Tokens & Database Migration Architecture

**Feature Name**: `auth-refresh-tokens-and-migrations`  
**Classification**: Enhancement  
**Author**: Principal Software Engineer  
**Date**: 2026-10-09  
**Status**: Approved & In Progress  

---

## 1. Overview & Problem Statement

Currently, authentication relies on a single JWT access token with a 24-hour expiration stored in browser `localStorage`. If an access token expires or is revoked, the user's workflow is interrupted, forcing them back to the login screen. Furthermore, long-lived access tokens present a heightened attack surface if intercepted.

Additionally, schema evolution historically depended on `EnsureCreated()` with inline raw SQL patches, which cannot track forward/backward migration state or provide clean schema versioning.

This specification introduces:
1. **Cryptographically Secure Refresh Token Engine**: Short-lived JWT access tokens (15-60 minutes) paired with persistent, rotatable, cryptographically secure Refresh Tokens (7-30 days), supporting automatic transparent background refreshing in the frontend Axios client.
2. **Automated Migration & Schema Versioning**: Robust automated schema migration execution at startup for both PostgreSQL and SQLite, including the new `RefreshTokens` relational entity and index structures.

---

## 2. Business Goal

- **Enterprise Security**: Minimize JWT access token exposure window while adhering to OWASP Token Best Practices.
- **Frictionless User Experience**: Users remain seamlessly authenticated across days without unexpected session drops during active resume tailoring and job orchestrations.
- **Operational Reliability**: Provide zero-touch automated database schema migrations on service startup.

---

## 3. User Stories

- *As a job seeker*, I want my active session to automatically refresh in the background without abruptly logging me out in the middle of tailoring a resume or configuring an ATS application.
- *As a security-conscious enterprise user*, I want compromised or old sessions to be revokable without waiting 24 hours for a JWT to expire.
- *As a DevOps engineer*, I want database schemas and tables to apply cleanly and idempotently on container startup without manual SQL scripting.

---

## 4. Acceptance Criteria

1. `POST /api/auth/refresh` accepts `{ accessToken, refreshToken }` and returns a newly minted JWT access token and rotated refresh token.
2. `POST /api/auth/revoke` revokes the specified refresh token, preventing further renewals.
3. Attempting to use an expired or revoked refresh token returns `401 Unauthorized` and purges active credentials.
4. The frontend Axios client interceptor detects 401s on protected endpoints and transparently invokes `/api/auth/refresh`, retrying the original request without user interruption.
5. Concurrent requests hitting 401 while a refresh is in-flight are queued and replayed upon successful token refresh.
6. The `RefreshTokens` table is automatically created with appropriate foreign keys, cascade deletes, and unique indices on both PostgreSQL and SQLite.

---

## 5. Architecture & Data Flow

```
[ Frontend Client ]                    [ ASP.NET Core Backend ]              [ Database ]
        |                                         |                              |
        |--- 1. API Call (Expired JWT) ---------->|                              |
        |<-- 2. 401 Unauthorized -----------------|                              |
        |                                         |                              |
        |--- 3. POST /api/auth/refresh ---------->|                              |
        |       (AccessToken, RefreshToken)       |--- 4. Verify & Rotate ------>|
        |                                         |<-- 5. New Token Pair --------|
        |<-- 6. 200 OK (New Tokens) --------------|                              |
        |                                         |                              |
        |--- 7. Replay Original API Call -------->|                              |
        |<-- 8. 200 OK (Success) -----------------|                              |
```

---

## 6. API Changes

### `POST /api/auth/refresh`
- **Request Body**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "4a7f8e9b..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "refreshToken": "9c8b7a6d...",
    "user": { ... }
  }
  ```
- **Error `401 Unauthorized`**: `{ "error": "Invalid, expired, or revoked refresh token." }`

### `POST /api/auth/revoke`
- **Request Body**:
  ```json
  {
    "refreshToken": "4a7f8e9b..."
  }
  ```
- **Response `200 OK`**: `{ "success": true, "message": "Token revoked successfully." }`

---

## 7. Database Changes

### Entity: `RefreshToken`
- `Id` (Guid, Primary Key)
- `UserId` (Guid, Foreign Key -> `Users.Id`, Cascade Delete)
- `Token` (string, Unique Index, 128 characters cryptographically random)
- `ExpiresAtUtc` (DateTime)
- `CreatedAtUtc` (DateTime)
- `RevokedAtUtc` (DateTime, Nullable)
- `ReplacedByToken` (string, Nullable)

---

## 8. Changelog
- **2026-10-09T21:48:00+05:30**: Initial Feature Specification created and approved.
- **2026-10-09T21:59:00+05:30**: Implemented refresh token endpoints (`/api/auth/refresh`, `/api/auth/revoke`), Axios transparent token refresh interceptor with queue replay, Zustand store sync, and unit test suite (49 passing tests).
