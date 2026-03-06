import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateExpiredToCompleted() {
  try {
    console.log('Starting migration: expired -> completed');

    const result = await prisma.interview.updateMany({
      where: {
        status: 'expired'
      },
      data: {
        status: 'completed'
      }
    });

    console.log(`✅ Successfully migrated ${result.count} interviews from 'expired' to 'completed'`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateExpiredToCompleted();
