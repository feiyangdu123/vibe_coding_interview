import type { FastifyInstance } from 'fastify';
import { prisma, ProblemVisibility, ProblemType } from '@vibe/database';
import type { CreateProblemDto } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';
import { authMiddleware } from '../../middleware/auth';

export async function problemRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get<{ Querystring: { page?: string; limit?: string; search?: string } }>(
    '/api/admin/problems',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);
      const search = request.query.search?.trim() || '';

      const where = {
        organizationId: request.user!.organizationId,
        ...(search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } }
          ]
        } : {})
      };

      const [data, total] = await Promise.all([
        prisma.problem.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: getPaginationSkip(page, limit),
          take: limit
        }),
        prisma.problem.count({ where })
      ]);

      return {
        data,
        pagination: calculatePagination(page, limit, total)
      };
    }
  );

  fastify.post<{ Body: CreateProblemDto }>('/api/admin/problems', async (request) => {
    return await prisma.problem.create({
      data: {
        ...request.body,
        organizationId: request.user!.organizationId,
        createdById: request.user!.id,
        visibility: request.body.visibility || ProblemVisibility.PRIVATE,
        problemType: request.body.problemType || ProblemType.CODING
      }
    });
  });

  fastify.put<{ Params: { id: string }; Body: Partial<CreateProblemDto> }>(
    '/api/admin/problems/:id',
    async (request, reply) => {
      const problem = await prisma.problem.findUnique({
        where: { id: request.params.id }
      });

      if (!problem || problem.organizationId !== request.user!.organizationId) {
        reply.code(404).send({ error: 'Problem not found' });
        return;
      }

      return await prisma.problem.update({
        where: { id: request.params.id },
        data: request.body
      });
    }
  );

  fastify.delete<{ Params: { id: string } }>('/api/admin/problems/:id', async (request, reply) => {
    const problem = await prisma.problem.findUnique({
      where: { id: request.params.id }
    });

    if (!problem || problem.organizationId !== request.user!.organizationId) {
      reply.code(404).send({ error: 'Problem not found' });
      return;
    }

    return await prisma.problem.delete({
      where: { id: request.params.id }
    });
  });
}
