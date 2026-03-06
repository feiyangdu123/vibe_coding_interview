import type { FastifyInstance } from 'fastify';
import { prisma } from '@vibe/database';
import type { CreateCandidateDto } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';

export async function candidateRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { page?: string; limit?: string; search?: string } }>(
    '/api/admin/candidates',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);
      const search = request.query.search?.trim() || '';

      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        : {};

      const [data, total] = await Promise.all([
        prisma.candidate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: getPaginationSkip(page, limit),
          take: limit
        }),
        prisma.candidate.count({ where })
      ]);

      return {
        data,
        pagination: calculatePagination(page, limit, total)
      };
    }
  );

  fastify.post<{ Body: CreateCandidateDto }>('/api/admin/candidates', async (request) => {
    return await prisma.candidate.create({
      data: request.body
    });
  });

  fastify.put<{ Params: { id: string }; Body: CreateCandidateDto }>('/api/admin/candidates/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, email, phone } = request.body;

    try {
      const candidate = await prisma.candidate.update({
        where: { id },
        data: { name, email, phone }
      });
      return candidate;
    } catch (error) {
      reply.code(404).send({ error: 'Candidate not found' });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/api/admin/candidates/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      // Check if candidate has any interviews
      const interviewCount = await prisma.interview.count({
        where: { candidateId: id }
      });

      if (interviewCount > 0) {
        reply.code(400).send({ error: 'Cannot delete candidate with existing interviews' });
        return;
      }

      await prisma.candidate.delete({
        where: { id }
      });

      return { success: true };
    } catch (error) {
      reply.code(404).send({ error: 'Candidate not found' });
    }
  });
}

