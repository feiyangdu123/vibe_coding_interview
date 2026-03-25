import type { FastifyInstance } from 'fastify';
import {
  getInterviewByToken,
  startInterview,
  submitInterview,
  endInterviewByInterviewer,
  getInterviewEvents,
  withWorkspaceUrl,
  getWorkspaceUrlForPort
} from '../services/interview-service';

export async function interviewPublicRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { token: string } }>('/api/interview/:token', async (request, reply) => {
    const interview = await getInterviewByToken(request.params.token);
    if (!interview) {
      return reply.code(404).send({ error: 'Interview not found' });
    }
    return withWorkspaceUrl(interview);
  });

  fastify.post<{ Params: { token: string } }>('/api/interview/:token/start', async (request, reply) => {
    try {
      const interview = await startInterview(request.params.token);
      return withWorkspaceUrl(interview);
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
    const workspaceUrl = await getWorkspaceUrlForPort(interview.port);
    return {
      status: interview.status,
      startTime: interview.startTime,
      endTime: interview.endTime,
      port: interview.port,
      workspaceUrl
    };
  });

  fastify.post<{ Params: { token: string } }>('/api/interview/:token/submit', async (request, reply) => {
    try {
      const interview = await submitInterview(request.params.token);
      return interview;
    } catch (error) {
      const errorMessage = (error as Error).message;
      fastify.log.error({ error: errorMessage, token: request.params.token }, 'Failed to submit interview');
      return reply.code(400).send({ error: errorMessage });
    }
  });

  fastify.post<{ Params: { token: string } }>('/api/interview/:token/end-by-interviewer', async (request, reply) => {
    try {
      const interview = await endInterviewByInterviewer(request.params.token);
      return interview;
    } catch (error) {
      const errorMessage = (error as Error).message;
      fastify.log.error({ error: errorMessage, token: request.params.token }, 'Failed to end interview');
      return reply.code(400).send({ error: errorMessage });
    }
  });

  fastify.get<{
    Params: { token: string };
    Querystring: { page?: string; limit?: string };
  }>('/api/interview/:token/events', async (request, reply) => {
    try {
      const page = parseInt(request.query.page || '1');
      const limit = parseInt(request.query.limit || '50');
      const events = await getInterviewEvents(request.params.token, page, limit);
      return events;
    } catch (error) {
      const errorMessage = (error as Error).message;
      fastify.log.error({ error: errorMessage, token: request.params.token }, 'Failed to get interview events');
      return reply.code(400).send({ error: errorMessage });
    }
  });
}
