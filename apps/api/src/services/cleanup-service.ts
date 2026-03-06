import cron from 'node-cron';
import { prisma } from '@vibe/database';
import { getOpenCodeManager } from './interview-service';
import { evaluateInterview } from './ai-evaluation-service';

export function startCleanupJob() {
  cron.schedule('*/1 * * * *', async () => {
    const manager = await getOpenCodeManager();

    // 1. Handle expired interviews
    const expired = await prisma.interview.findMany({
      where: {
        status: 'in_progress',
        endTime: { lt: new Date() }
      }
    });

    for (const interview of expired) {
      await manager.stopInstance(interview.id);
      await prisma.interview.update({
        where: { id: interview.id },
        data: {
          status: 'expired',
          port: null,
          processId: null,
          healthStatus: null
        }
      });

      // 触发 AI 评估（异步，不阻塞清理流程）
      if (interview.aiEvaluationStatus === 'pending') {
        evaluateInterview(interview.id).catch(err => {
          console.error(`Failed to start evaluation for ${interview.id}:`, err);
        });
      }
    }

    // 2. Detect crashed processes
    const inProgress = await prisma.interview.findMany({
      where: { status: 'in_progress' }
    });

    for (const interview of inProgress) {
      const instance = manager.getInstance(interview.id);

      if (!instance) {
        // Database shows running but process doesn't exist = crashed
        await prisma.interview.update({
          where: { id: interview.id },
          data: {
            status: 'completed',
            port: null,
            processId: null,
            healthStatus: 'unhealthy',
            processError: 'Process crashed unexpectedly'
          }
        });

        // 崩溃的面试也触发评估
        if (interview.aiEvaluationStatus === 'pending') {
          evaluateInterview(interview.id).catch(err => {
            console.error(`Failed to start evaluation for ${interview.id}:`, err);
          });
        }
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
