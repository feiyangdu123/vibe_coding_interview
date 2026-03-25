import { FastifyInstance } from 'fastify';
import { prisma, InterviewStatus } from '@vibe/database';
import { getOpenCodeManager } from '../../services/interview-service';
import { authMiddleware, orgMiddleware } from '../../middleware/auth';

export default async function processesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', orgMiddleware);

  // Get all process statuses
  fastify.get('/api/admin/processes', async (request, reply) => {
    try {
      const manager = await getOpenCodeManager();

      // Get all in-progress interviews from database
      const interviews = await prisma.interview.findMany({
        where: {
          status: InterviewStatus.IN_PROGRESS,
          organizationId: request.user!.organizationId!
        },
        include: {
          candidate: true,
          problem: true
        },
        orderBy: { startTime: 'desc' }
      });

      // Get all instances from memory
      const memoryInstances = manager.getAllInstances();
      const memoryMap = new Map(memoryInstances.map(i => [i.interviewId, i]));

      // Merge data and perform health checks
      const processStatuses = await Promise.all(
        interviews.map(async (interview) => {
          const inMemory = memoryMap.has(interview.id);
          const inDatabase = true;

          let healthStatus = interview.healthStatus || 'unknown';
          let status: string = interview.status;

          // Detect crashed processes
          if (inDatabase && !inMemory) {
            status = 'crashed';
            healthStatus = 'unhealthy';
          } else if (interview.port && inMemory) {
            // Perform health check
            const isHealthy = await manager.checkHealth(interview.port);
            healthStatus = isHealthy ? 'healthy' : 'unhealthy';
          }

          return {
            interviewId: interview.id,
            candidateName: interview.candidate.name,
            problemTitle: interview.problem.title,
            port: interview.port,
            processId: interview.processId,
            status,
            healthStatus,
            startTime: interview.startTime?.toISOString() || null,
            endTime: interview.endTime?.toISOString() || null,
            lastHealthCheck: interview.lastHealthCheck?.toISOString() || null,
            inMemory,
            inDatabase,
            workDir: interview.workDir,
            processError: interview.processError
          };
        })
      );

      return reply.send({ processes: processStatuses });
    } catch (error) {
      console.error('Failed to get process statuses:', error);
      return reply.status(500).send({ error: 'Failed to get process statuses' });
    }
  });

  // Stop a process manually
  fastify.post<{ Params: { interviewId: string } }>(
    '/api/admin/processes/:interviewId/stop',
    async (request, reply) => {
      try {
        const { interviewId } = request.params;
        const manager = await getOpenCodeManager();

        const interview = await prisma.interview.findUnique({
          where: { id: interviewId }
        });

        if (!interview || interview.organizationId !== request.user!.organizationId!) {
          return reply.status(404).send({ error: 'Interview not found' });
        }

        await manager.stopInstance(interviewId);
        await prisma.interview.update({
          where: { id: interviewId },
          data: {
            status: InterviewStatus.COMPLETED,
            port: null,
            processId: null,
            healthStatus: null
          }
        });

        return reply.send({ success: true });
      } catch (error) {
        console.error('Failed to stop process:', error);
        return reply.status(500).send({ error: 'Failed to stop process' });
      }
    }
  );

  // Manual health check
  fastify.post<{ Params: { interviewId: string } }>(
    '/api/admin/processes/:interviewId/health-check',
    async (request, reply) => {
      try {
        const { interviewId } = request.params;
        const manager = await getOpenCodeManager();

        const interview = await prisma.interview.findUnique({
          where: { id: interviewId }
        });

        if (!interview || !interview.port) {
          return reply.status(404).send({ error: 'Interview not found or no port assigned' });
        }

        const isHealthy = await manager.checkHealth(interview.port);

        await prisma.interview.update({
          where: { id: interviewId },
          data: {
            healthStatus: isHealthy ? 'healthy' : 'unhealthy',
            lastHealthCheck: new Date()
          }
        });

        return reply.send({ healthy: isHealthy });
      } catch (error) {
        console.error('Failed to check health:', error);
        return reply.status(500).send({ error: 'Failed to check health' });
      }
    }
  );
}
