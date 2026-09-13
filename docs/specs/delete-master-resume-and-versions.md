# Feature Specification: Delete Master Resume and Version History

## Task Classification
**New Feature & Enhancement**

## 1. Problem Statement
Users who upload a master resume or create multiple versions currently have no self-service mechanism to delete their active master resume and clear its historical version snapshots. When a candidate wishes to start fresh, delete test data, or purge sensitive personal data under GDPR/privacy guidelines, they require a clean, safe purge action.

## 2. Business Goal
Provide candidates full control over their master resume lifecycle and data privacy by enabling complete, safe deletion of the active master resume and all historical version snapshots, resetting the workspace to a clean onboarding state.

## 3. User Stories
- **As a candidate**, I want to delete my master resume and all its version history with a single confirmed action, so that I can upload a fresh resume or remove outdated experience.
- **As a security/privacy conscious user**, I want my previous version snapshots to be permanently erased from the database upon deletion so that no stale personal data remains.

## 4. Acceptance Criteria
1. `DELETE /api/masterresume` permanently removes the authenticated user's active `MasterResume` and all linked `ResumeVersion` entities.
2. If any derived `GeneratedResume` or `ApplicationQueueItem` records reference the deleted master resume, they are cleanly cascade-deleted or unlinked without foreign key constraint violations.
3. The frontend `MasterResumePage` provides a clear "Delete Master Resume" button with a confirmation modal explaining that all version history will be purged.
4. Upon successful deletion, the client state in `useTailorStore` is cleared, and the UI transitions immediately to the initial upload dropzone.
5. All endpoints return appropriate HTTP status codes (`200 OK` or `204 NoContent` on success, `404 Not Found` if no resume exists, `401 Unauthorized` if not authenticated).

## 5. Functional Requirements
- **FR-1: Backend MediatR Command**: Create `DeleteMasterResumeCommand` handling user-scoped deletion of `MasterResume` and `ResumeVersions`.
- **FR-2: Controller Endpoint**: Expose `DELETE /api/masterresume` in `MasterResumeController`.
- **FR-3: Frontend API & Store**: Add `masterResumeApi.delete()` and `useResumeStore.deleteMasterResume()`.
- **FR-4: UI Modal**: In `MasterResumePage.tsx`, add a destructive button with a confirmation dialogue ("Are you sure you want to delete your master resume and all X saved versions? This action cannot be undone.").
- **FR-5: Dashboard & Studio Reset**: Dashboard and Tailor Studio immediately reflect that no master resume is currently loaded.

## 6. Non-Functional Requirements
- **Security**: Strict tenant isolation (`r.UserId == currentUserId`).
- **Data Integrity**: Atomic transaction via EF Core ensuring `ResumeVersions` and `MasterResume` are deleted together.
- **Performance**: Sub-100ms execution time for single-user purge.

## 7. Architecture & Layer Impacts
- **Domain / Persistence**: `ApplicationDbContext` cascade configuration.
- **Application Layer**: `DeleteMasterResumeCommand` in `ResumeTailor.Application.Features.MasterResumeFeatures`.
- **API Layer**: `DELETE /api/masterresume` in `MasterResumeController`.
- **Frontend Layer**: `masterResumeApi`, `useTailorStore`, `MasterResumePage.tsx`.

## 8. API Changes
### `DELETE /api/masterresume`
- **Auth**: Bearer Token required.
- **Response**: `{ success: true, message: "Master resume and all version history successfully deleted." }` (200 OK).

## 9. Database Changes
- Ensure `MasterResume` -> `ResumeVersions` has `DeleteBehavior.Cascade`.
- Ensure `MasterResume` -> `GeneratedResumes` has `DeleteBehavior.Cascade` to prevent orphaned records or constraint errors.

## 10. UI Changes
- Add "Delete Master" action in `MasterResumePage.tsx` header alongside "Save Master" and "Versions".
- Add confirmation modal with destructive action styling.

## 11. Edge Cases
- **No Master Resume Exists**: Return `404 Not Found` with clear message.
- **Concurrent Requests**: Idempotent deletion handling.
- **Derived Tailored Resumes**: Cascade clean-up ensures zero foreign key exceptions in PostgreSQL.

## 12. Risks & Mitigations
- **Accidental Deletion**: Protected by an explicit confirmation modal requiring user acknowledgment.

## Changelog
- **2026-09-12**: Initial specification for Master Resume and Version History purge feature.
