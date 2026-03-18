import cron from 'node-cron';
import { prisma, InterviewStatus } from '@vibe/database';
import {
  getOpenCodeManager,
  completeInterviewOnTimeout,
  markInterviewAsNoShow,
  voidInterviewForSystemError
} from './interview-service';
import { cleanupStaleEvaluationSnapshots } from './opencode-runtime-service';

const EVALUATION_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function startCleanupJob() {
  cron.schedule('*/1 * * * *', async () => {
    const now = new Date();

    const noShowInterviews = await prisma.interview.findMany({
      where: {
        status: InterviewStatus.PENDING,
        joinDeadlineAt: { lt: now }
      },
      select: { id: true }
    });

    for (const interview of noShowInterviews) {
      await markInterviewAsNoShow(interview.id);
    }

    // 1. Handle timed out interviews
    const expired = await prisma.interview.findMany({
      where: {
        status: InterviewStatus.IN_PROGRESS,
        endTime: { lt: now }
      }
    });

    for (const interview of expired) {
      await completeInterviewOnTimeout(interview.id);
    }

    const manager = await getOpenCodeManager();

    // 2. Detect crashed processes
    const inProgress = await prisma.interview.findMany({
      where: { status: InterviewStatus.IN_PROGRESS }
    });

    for (const interview of inProgress) {
      const instance = manager.getInstance(interview.id);

      if (!instance) {
        await voidInterviewForSystemError(interview.id, 'Process crashed unexpectedly');
      } else if (interview.port) {
        // Perform health check
        const isHealthy = await manager.checkHealth(interview.port);
        await prisma.interview.update({
          where: { id: interview.id },
          data: {
            healthStatus: isHealthy ? 'healthy' : 'unhealthy',
            lastHealthCheck: new Date()
          }
        });
      }
    }

    cleanupStaleEvaluationSnapshots(EVALUATION_SNAPSHOT_MAX_AGE_MS);
  });
}
