import type { FastifyInstance } from 'fastify';
import { prisma, ProblemVisibility, ProblemType } from '@vibe/database';
import type { CreateProblemDto } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';
import { authMiddleware } from '../../middleware/auth';

export async function problemRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  function buildProblemFilters(query: {
    search?: string;
    visibility?: string;
    problemType?: string;
    difficulty?: string;
    roleTrack?: string;
    language?: string;
    tags?: string;
  }) {
    const search = query.search?.trim() || '';
    const { visibility, problemType, difficulty, roleTrack, language, tags } = query;

    return {
      ...(visibility && { visibility }),
      ...(problemType && { problemType }),
      ...(difficulty && { difficulty }),
      ...(roleTrack && { roleTrack: { contains: roleTrack, mode: 'insensitive' as const } }),
      ...(language && { language }),
      ...(tags && { tags: { hasSome: tags.split(',').map(t => t.trim()) } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    };
  }

  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      visibility?: string;
      problemType?: string;
      difficulty?: string;
      roleTrack?: string;
      language?: string;
      tags?: string;
    }
  }>(
    '/api/admin/problems',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);

      const where: any = {
        organizationId: request.user!.organizationId,
        ...buildProblemFilters(request.query)
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
      const problem = await prisma.problem.findFirst({
        where: {
          id: request.params.id,
          organizationId: request.user!.organizationId
        }
      });

      if (!problem) {
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
    const problem = await prisma.problem.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.user!.organizationId
      }
    });

    if (!problem) {
      reply.code(404).send({ error: 'Problem not found' });
      return;
    }

    return await prisma.problem.delete({
      where: { id: request.params.id }
    });
  });

  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      problemType?: string;
      difficulty?: string;
      roleTrack?: string;
      language?: string;
      tags?: string;
    }
  }>(
    '/api/admin/problem-templates',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);
      const where: any = {
        isActive: true,
        ...buildProblemFilters(request.query)
      };

      const [data, total] = await Promise.all([
        prisma.problemTemplate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: getPaginationSkip(page, limit),
          take: limit
        }),
        prisma.problemTemplate.count({ where })
      ]);

      return {
        data,
        pagination: calculatePagination(page, limit, total)
      };
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/admin/problem-templates/:id/copy',
    async (request, reply) => {
      const template = await prisma.problemTemplate.findFirst({
        where: {
          id: request.params.id,
          isActive: true
        }
      });

      if (!template) {
        reply.code(404).send({ error: 'Problem template not found' });
        return;
      }

      const problem = await prisma.problem.create({
        data: {
          title: template.title,
          description: template.description,
          requirements: template.requirements,
          scoringCriteria: template.scoringCriteria as any,
          workDirTemplate: template.workDirTemplate,
          duration: template.duration,
          organizationId: request.user!.organizationId,
          createdById: request.user!.id,
          visibility: ProblemVisibility.PRIVATE,
          problemType: template.problemType,
          roleTrack: template.roleTrack,
          difficulty: template.difficulty,
          language: template.language,
          tags: template.tags,
          evaluationInstructionsText: template.evaluationInstructionsText,
          acceptanceCriteria: template.acceptanceCriteria as any
        }
      });

      return problem;
    }
  );
}
