import type { FastifyInstance } from 'fastify';
import { prisma } from '@vibe/database';
import type { CreateProblemDto } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';

export async function problemRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { page?: string; limit?: string; search?: string } }>(
    '/api/admin/problems',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);
      const search = request.query.search?.trim() || '';

      const where = search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        : {};

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
      data: request.body
    });
  });

  fastify.put<{ Params: { id: string }; Body: Partial<CreateProblemDto> }>(
    '/api/admin/problems/:id',
    async (request) => {
      return await prisma.problem.update({
        where: { id: request.params.id },
        data: request.body
      });
    }
  );

  fastify.delete<{ Params: { id: string } }>('/api/admin/problems/:id', async (request) => {
    return await prisma.problem.delete({
      where: { id: request.params.id }
    });
  });
}
