# Bug Fix Plan: Resolving Demo Login Failure Caused by Empty JWT Secret Key

## 1. Root Cause
1. **Empty JWT Secret Evaluation in Container Environment**:
   - In [docker-compose.yml](file:///A:/AIProjects/Resumebuilder/docker-compose.yml), the container environment variable was specified as `JwtSettings__Secret=${JWT_SECRET}`.
   - When `JWT_SECRET` was omitted from `.env` or passed as an empty string, the environment variable was injected into the backend container as an empty string `""` rather than null.
   - In [IdentityServices.cs](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Identity/IdentityServices.cs), `JwtTokenGenerator` resolved the key using the null-coalescing operator:
     ```csharp
     var secret = _configuration["JwtSettings:Secret"] ?? "super_secret_jwt_key_at_least_32_characters_long_for_security_hs256";
     ```
   - Because `""` (empty string) is not `null`, the null-coalescing fallback never fired. `secret` evaluated to `""`.
   - `Encoding.UTF8.GetBytes("")` generated a 0-byte array, causing `new SymmetricSecurityKey(new byte[0])` to throw:
     ```
     Unhandled exception occurred: IDX10703: Cannot create a 'Microsoft.IdentityModel.Tokens.SymmetricSecurityKey', key length is zero.
     ```
   - This threw an unhandled 500 Internal Server Error upon `POST /api/auth/login`, causing the frontend login to fail with an error banner.

## 2. Proposed Solution
1. **Harden `JwtTokenGenerator` in Application/Infrastructure**:
   - Replace simple null-coalescing with `!string.IsNullOrWhiteSpace(rawSecret) && rawSecret.Trim().Length >= 32` so empty, whitespace, or truncated keys safely fall back to the default 256-bit development secret.
2. **Harden `AesGcmEncryptionService`**:
   - Check `string.IsNullOrWhiteSpace` before using `SecuritySettings:DataProtectionKey` or `JwtSettings:Secret`.
3. **Add Compose Fallback**:
   - Configure `JwtSettings__Secret=${JWT_SECRET:-super_secret_jwt_key_at_least_32_characters_long_for_security_hs256}` in `docker-compose.yml`.

## 3. Files Affected
- [backend/src/ResumeTailor.Infrastructure/Identity/IdentityServices.cs](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Identity/IdentityServices.cs)
- [backend/src/ResumeTailor.Infrastructure/Security/AesGcmEncryptionService.cs](file:///A:/AIProjects/Resumebuilder/backend/src/ResumeTailor.Infrastructure/Security/AesGcmEncryptionService.cs)
- [docker-compose.yml](file:///A:/AIProjects/Resumebuilder/docker-compose.yml)
- [context.md](file:///A:/AIProjects/Resumebuilder/context.md)

## 4. Regression Risks
- None. Any valid, 32+ character production `JWT_SECRET` configured in `.env` continues to take precedence.

## 5. Test Strategy & Verification Steps
1. Execute `POST /api/auth/login` with `demo@vedha.ai` and `Password123!`. Verify HTTP 200 OK with valid HS256 JWT payload and user object.
2. Execute `POST /api/auth/register` with new credentials. Verify HTTP 200 OK.
