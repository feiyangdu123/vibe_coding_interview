# Database Migration Scripts

## Migrate Expired to Completed

This script updates all interviews with status 'expired' to 'completed'.

### Run the migration:

```bash
cd packages/database
npx tsx scripts/migrate-expired-to-completed.ts
```

This is a one-time migration needed after removing the 'expired' status from the system.
