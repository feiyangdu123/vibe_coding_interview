import cron from 'node-cron';
import { prisma, InterviewStatus } from '@vibe/database';
import {
  getOpenCodeManager,
  completeInterviewOnTimeout,
  markInterviewAsNoShow,
  voidInterviewForSystemError
} from './interview-service';

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

    // 2. Health check prewarmed PENDING instances
    const prewarmedInterviews = await prisma.interview.findMany({
      where: {
        status: InterviewStatus.PENDING,
        openCodeStatus: 'ready',
        port: { not: null }
      }
    });

    for (const interview of prewarmedInterviews) {
      const instance = manager.getInstance(interview.id);
      if (!instance) {
        // Process crashed — mark as failed so startInterview falls back to sync launch
        await prisma.interview.update({
          where: { id: interview.id },
          data: {
            openCodeStatus: 'failed',
            openCodeError: 'Prewarmed process crashed',
            port: null,
            processId: null,
            healthStatus: 'unhealthy',
            lastHealthCheck: new Date()
          }
        });
      } else if (interview.port) {
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

    // 3. Detect crashed processes for IN_PROGRESS interviews
    const inProgress = await prisma.interview.findMany({
      where: { status: InterviewStatus.IN_PROGRESS }
    });

    for (const interview of inProgress) {
      // Skip interviews that are currently restarting
      if (interview.openCodeStatus === 'restarting') {
        // Safety timeout: if restarting for over 2 minutes, force void
        const lastCheck = interview.lastHealthCheck;
        if (lastCheck && (now.getTime() - lastCheck.getTime() > 2 * 60 * 1000)) {
          console.error(`Interview ${interview.id} stuck in restarting state for over 2 minutes, voiding`);
          await voidInterviewForSystemError(interview.id, 'OpenCode restart timed out');
        }
        continue;
      }

      const instance = manager.getInstance(interview.id);

      if (!instance) {
        // Only void if not being handled by crash callback (check openCodeStatus)
        const fresh = await prisma.interview.findUnique({
          where: { id: interview.id },
          select: { openCodeStatus: true }
        });
        if (fresh?.openCodeStatus === 'restarting') {
          continue;
        }
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
  });
}
