# Toast Position and Status Error Fix

## Issues Fixed

### 1. Toast Notification Blocking UI
**Problem**: Toast notifications appeared at top-right and blocked the "创建" (Create) buttons, taking too long to disappear.

**Solution**:
- Changed toast position from `top-right` to `bottom-right`
- Set duration to 2000ms (2 seconds) for faster dismissal
- File: `apps/web/app/layout.tsx`

### 2. Runtime Error on Interview Status Display
**Problem**: Error "Cannot read properties of undefined (reading 'variant')" when accessing `/admin/interviews`

**Root Cause**: Some interviews still had the legacy "expired" status in the database after the initial migration.

**Solutions Implemented**:

#### A. Immediate Fix - Robust Status Handling
- Added `getStatusConfig()` helper function with fallback logic
- Handles legacy "expired" status by mapping it to "completed"
- Provides default config for any unknown status values
- File: `apps/web/app/admin/interviews/page.tsx`

```typescript
const getStatusConfig = (status: string) => {
  if (status === 'expired') {
    return statusConfig.completed
  }
  return statusConfig[status as keyof typeof statusConfig] ||
    { label: status, variant: 'default' as const }
}
```

#### B. Data Migration
- Re-ran migration script to update remaining "expired" records
- Successfully migrated 1 additional interview
- Verified: 0 expired statuses remain in database

#### C. Automatic Migration on Server Startup
- Created `migration-service.ts` to handle legacy data cleanup
- Integrated into server startup sequence
- Runs automatically when API server starts
- Files:
  - `apps/api/src/services/migration-service.ts` (new)
  - `apps/api/src/server.ts` (updated)

## Testing Results

- ✅ All expired statuses migrated to completed
- ✅ UI handles legacy statuses gracefully
- ✅ Toast notifications appear in bottom-right corner
- ✅ Toast notifications dismiss after 2 seconds
- ✅ Create buttons no longer blocked by toasts
- ✅ Server startup migration ensures data consistency

## Files Modified

1. `apps/web/app/layout.tsx` - Toast configuration
2. `apps/web/app/admin/interviews/page.tsx` - Status display logic
3. `apps/api/src/services/migration-service.ts` - New migration service
4. `apps/api/src/server.ts` - Server startup migration
