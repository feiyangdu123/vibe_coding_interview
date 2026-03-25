import type { FastifyInstance } from 'fastify';
import { prisma } from '@vibe/database';
import type { CreateProblemTemplateDto, UpdateProblemTemplateDto, UpsertEvaluationCriteriaConfigDto } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';
import { authMiddleware, platformAdminMiddleware } from '../../middleware/auth';

export async function platformRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', platformAdminMiddleware);

  // --- Platform Stats ---
  fastify.get('/api/platform/stats', async () => {
    const [orgCount, interviewTotal, activeTemplates, inProgressInterviews, interviewsByOrg] =
      await Promise.all([
        prisma.organization.count(),
        prisma.interview.count(),
        prisma.problemTemplate.count({ where: { isActive: true } }),
        prisma.interview.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.interview.groupBy({
          by: ['organizationId'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 20
        })
      ]);

    // Fetch org names for the grouped stats
    const orgIds = interviewsByOrg.map((g) => g.organizationId);
    const orgs = orgIds.length > 0
      ? await prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true, slug: true }
        })
      : [];
    const orgMap = new Map(orgs.map((o) => [o.id, o]));

    return {
      orgCount,
      interviewTotal,
      activeTemplates,
      inProgressInterviews,
      interviewsByOrg: interviewsByOrg.map((g) => ({
        organizationId: g.organizationId,
        organizationName: orgMap.get(g.organizationId)?.name ?? '未知',
        organizationSlug: orgMap.get(g.organizationId)?.slug ?? '',
        interviewCount: g._count.id
      }))
    };
  });

  // --- Problem Templates CRUD ---

  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      problemType?: string;
      difficulty?: string;
    }
  }>('/api/platform/templates', async (request) => {
    const { page, limit } = parsePaginationParams(request.query);
    const { search, problemType, difficulty } = request.query;

    const where: any = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      }),
      ...(problemType && { problemType }),
      ...(difficulty && { difficulty })
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
  });

  fastify.post<{ Body: CreateProblemTemplateDto }>('/api/platform/templates', async (request) => {
    return await prisma.problemTemplate.create({
      data: request.body
    });
  });

  fastify.put<{ Params: { id: string }; Body: UpdateProblemTemplateDto }>(
    '/api/platform/templates/:id',
    async (request, reply) => {
      const template = await prisma.problemTemplate.findUnique({
        where: { id: request.params.id }
      });

      if (!template) {
        reply.code(404).send({ error: 'Template not found' });
        return;
      }

      return await prisma.problemTemplate.update({
        where: { id: request.params.id },
        data: request.body
      });
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api/platform/templates/:id',
    async (request, reply) => {
      const template = await prisma.problemTemplate.findUnique({
        where: { id: request.params.id }
      });

      if (!template) {
        reply.code(404).send({ error: 'Template not found' });
        return;
      }

      // Soft delete
      return await prisma.problemTemplate.update({
        where: { id: request.params.id },
        data: { isActive: false }
      });
    }
  );

  // --- Evaluation Criteria Configs ---

  fastify.get('/api/platform/evaluation-configs', async () => {
    return await prisma.evaluationCriteriaConfig.findMany({
      orderBy: { problemType: 'asc' }
    });
  });

  fastify.put<{ Params: { problemType: string }; Body: UpsertEvaluationCriteriaConfigDto }>(
    '/api/platform/evaluation-configs/:problemType',
    async (request) => {
      const { problemType } = request.params;
      const data = request.body;

      return await prisma.evaluationCriteriaConfig.upsert({
        where: { problemType: problemType as any },
        update: {
          displayName: data.displayName,
          description: data.description,
          dimensions: data.dimensions as any,
          promptTemplate: data.promptTemplate,
          isActive: data.isActive ?? true
        },
        create: {
          problemType: problemType as any,
          displayName: data.displayName,
          description: data.description,
          dimensions: data.dimensions as any,
          promptTemplate: data.promptTemplate,
          isActive: data.isActive ?? true
        }
      });
    }
  );
}
