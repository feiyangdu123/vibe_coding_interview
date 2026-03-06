import type { FastifyInstance } from 'fastify';
import { getInterviewByToken, startInterview } from '../services/interview-service';

export async function interviewPublicRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { token: string } }>('/api/interview/:token', async (request, reply) => {
    const interview = await getInterviewByToken(request.params.token);
    if (!interview) {
      return reply.code(404).send({ error: 'Interview not found' });
    }
    return interview;
  });

  fastify.post<{ Params: { token: string } }>('/api/interview/:token/start', async (request, reply) => {
    try {
      const interview = await startInterview(request.params.token);
      return interview;
    } catch (error) {
      const errorMessage = (error as Error).message;
      fastify.log.error({ error: errorMessage, token: request.params.token }, 'Failed to start interview');
      return reply.code(400).send({ error: errorMessage });
    }
  });

  fastify.get<{ Params: { token: string } }>('/api/interview/:token/status', async (request, reply) => {
    const interview = await getInterviewByToken(request.params.token);
    if (!interview) {
      return reply.code(404).send({ error: 'Interview not found' });
    }
    return {
      status: interview.status,
      startTime: interview.startTime,
      endTime: interview.endTime,
      port: interview.port
    };
  });
}
