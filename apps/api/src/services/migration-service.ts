import { prisma, InterviewStatus } from '@vibe/database';

/**
 * One-time migration to update legacy 'expired' status to 'completed'
 * This runs on server startup to ensure data consistency
 */
export async function migrateExpiredStatus() {
  try {
    const result = await prisma.interview.updateMany({
      where: {
        status: InterviewStatus.EXPIRED
      },
      data: {
        status: InterviewStatus.COMPLETED
      }
    });

    if (result.count > 0) {
      console.log(`[Migration] Updated ${result.count} interviews from 'expired' to 'completed'`);
    }
  } catch (error) {
    console.error('[Migration] Failed to migrate expired status:', error);
  }
}
