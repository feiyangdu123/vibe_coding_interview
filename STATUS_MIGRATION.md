# Interview Status Migration Summary

## Changes Made

### 1. Type Definition Update
- **File**: `packages/shared-types/src/index.ts`
- **Change**: Removed `'expired'` from `InterviewStatus` type
- **New type**: `'pending' | 'in_progress' | 'completed'`

### 2. Backend Service Update
- **File**: `apps/api/src/services/cleanup-service.ts`
- **Change**: Changed expired interview status from `'expired'` to `'completed'`
- **Impact**: When interviews expire (endTime < now), they are now marked as `'completed'` instead of `'expired'`

### 3. Frontend UI Updates

#### Admin Interviews Page
- **File**: `apps/web/app/admin/interviews/page.tsx`
- **Changes**:
  - Removed `expired` from `statusConfig`
  - Removed "已过期" option from status filter dropdown
  - Now only shows: 待开始 (pending), 进行中 (in_progress), 已完成 (completed)

#### Candidate Interview Page
- **File**: `apps/web/app/interview/[token]/page.tsx`
- **Change**: Changed expired status check from `'expired'` to `'completed'`
- **UI**: Changed text color from red (`text-red-600`) to gray (`text-gray-600`) for completed interviews

### 4. Database Migration
- **Script**: `packages/database/scripts/migrate-expired-to-completed.ts`
- **Action**: Updated all existing interviews with status `'expired'` to `'completed'`
- **Result**: Successfully migrated 3 interviews

## Status Mapping

| Old Status | New Status | Display Label |
|------------|------------|---------------|
| pending    | pending    | 待开始 (Not Started) |
| in_progress| in_progress| 进行中 (In Progress) |
| completed  | completed  | 已完成 (Completed) |
| expired    | completed  | 已完成 (Completed) |

## Rationale

The "expired" status was redundant with "completed" status. Both represent interviews that have ended:
- **Completed**: Interview ended normally (time expired or manually stopped)
- **Expired**: Interview ended due to timeout

Since both represent the same end state from a business perspective, consolidating them into a single "completed" status simplifies the system and reduces confusion.

## Testing Checklist

- [x] Type definitions updated
- [x] Backend cleanup service updated
- [x] Admin UI status filter updated
- [x] Candidate interview page updated
- [x] Database migration executed successfully
- [ ] Verify admin dashboard displays correctly
- [ ] Verify candidate interview page displays correctly
- [ ] Verify expired interviews show as "已完成"
- [ ] Verify status filter works correctly
