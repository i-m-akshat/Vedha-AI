# Implementation Plan: Delete Master Resume and Version History

## Task Classification
**New Feature & Enhancement**

## 1. Overview
Implement the end-to-end functionality allowing users to delete their master resume and all associated historical version snapshots, updating backend handlers, EF Core cascades, frontend API, Zustand store, and UI views.

## 2. Step-by-Step Implementation Steps

### Step 1: Update Application Layer (`backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs`)
- Define `public record DeleteMasterResumeCommand : IRequest<Result<bool>>;`
- Implement `IRequestHandler<DeleteMasterResumeCommand, Result<bool>>` inside `MasterResumeCommandHandler`.
- In handler:
  1. Retrieve `UserId` from `ICurrentUserService`.
  2. Query `_context.MasterResumes.Include(r => r.Versions).Include(r => r.DerivedTailoredResumes).FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive)`.
  3. If not found, return `Result<bool>.Failure("No active master resume found.")`.
  4. Remove linked `Versions` and `DerivedTailoredResumes` (and their analyses).
  5. Remove `MasterResume`.
  6. Save changes to database.
  7. Return `Result<bool>.Success(true)`.

### Step 2: Update EF Core Cascade Configuration (`backend/src/ResumeTailor.Infrastructure/Persistence/ApplicationDbContext.cs`)
- Set `b.HasOne(g => g.MasterResume).WithMany(m => m.DerivedTailoredResumes).HasForeignKey(g => g.MasterResumeId).OnDelete(DeleteBehavior.Cascade);`

### Step 3: Update WebApi Controller (`backend/src/ResumeTailor.WebApi/Controllers/MasterResumeAndJobControllers.cs`)
- Add `[HttpDelete]` endpoint:
  ```csharp
  [HttpDelete]
  public async Task<IActionResult> DeleteMasterResume()
  {
      var result = await Mediator.Send(new DeleteMasterResumeCommand());
      if (result.IsFailure)
          return NotFound(new { error = result.Error });

      return Ok(new { success = true, message = "Master resume and all version history successfully deleted." });
  }
  ```

### Step 4: Update Frontend API Client (`frontend/src/api/index.ts`)
- Add `delete: () => apiClient.delete('/masterresume').then(res => res.data),` to `masterResumeApi`.

### Step 5: Update Frontend Zustand Store (`frontend/src/stores/useTailorStore.ts`)
- Add `deleteMasterResume: () => Promise<void>` to `ResumeState`.
- Set `masterResume: null` and `versions: []` on successful deletion.

### Step 6: Update Frontend Master Resume Page (`frontend/src/pages/MasterResumePage.tsx`)
- Add "Delete Master" button in action bar.
- Add confirmation modal with warning about purging all version history.
- Reset schema and editor state upon confirmed deletion.

## 3. Files to Modify
- `backend/src/ResumeTailor.Application/Features/MasterResume/MasterResumeCommands.cs`
- `backend/src/ResumeTailor.Infrastructure/Persistence/ApplicationDbContext.cs`
- `backend/src/ResumeTailor.WebApi/Controllers/MasterResumeAndJobControllers.cs`
- `frontend/src/api/index.ts`
- `frontend/src/stores/useTailorStore.ts`
- `frontend/src/pages/MasterResumePage.tsx`

## 4. Testing & Verification Strategy
1. **Unit/Integration Logic**: Verify MediatR command purges master resume and all versions without constraint failure.
2. **API Verification**: Verify `DELETE /api/masterresume` returns 200 OK and subsequent `GET /api/masterresume` returns null.
3. **UI Verification**: Verify frontend confirms deletion, resets to dropzone, and cleans up version history modal.

## 5. Rollback Strategy
If any issues occur, revert `MasterResumeCommands.cs` and `MasterResumePage.tsx` to previous git commits.

## Changelog
- **2026-09-12**: Initial implementation plan for Master Resume and Version History purge feature.
