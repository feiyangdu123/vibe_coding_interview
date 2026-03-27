import type { FastifyInstance } from 'fastify';
import { prisma, ProblemVisibility, ProblemType } from '@vibe/database';
import type { CreateProblemDto } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';
import { authMiddleware, orgMiddleware } from '../../middleware/auth';

export async function problemRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', orgMiddleware);

  // --- Problems with activity stats (must be before /:id routes) ---
  fastify.get('/api/admin/problems/with-activity', async (request) => {
    const orgId = request.user!.organizationId!;

    const problems = await prisma.problem.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        difficulty: true,
        problemType: true,
        duration: true,
        interviews: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            aiEvaluationStatus: true,
            aiEvaluationScore: true,
            createdAt: true,
            candidate: { select: { name: true } }
          }
        }
      }
    });

    const data = problems.map(p => {
      const interviews = p.interviews;
      const completed = interviews.filter(
        i => ['COMPLETED', 'SUBMITTED'].includes(i.status) &&
          i.aiEvaluationStatus === 'completed' &&
          i.aiEvaluationScore != null
      );
      const scores = completed.map(i => i.aiEvaluationScore!);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const top = completed.sort((a, b) => (b.aiEvaluationScore ?? 0) - (a.aiEvaluationScore ?? 0))[0];
      const latestActivity = interviews.length > 0
        ? interviews.reduce((latest, i) => i.createdAt > latest ? i.createdAt : latest, interviews[0].createdAt)
        : null;

      return {
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        problemType: p.problemType,
        duration: p.duration,
        interviewCount: interviews.length,
        completedCount: completed.length,
        avgScore,
        topCandidate: top ? { name: top.candidate.name, score: Math.round(top.aiEvaluationScore!) } : null,
        latestActivity
      };
    });

    // Sort by latest activity descending, nulls last
    data.sort((a, b) => {
      if (!a.latestActivity && !b.latestActivity) return 0;
      if (!a.latestActivity) return 1;
      if (!b.latestActivity) return -1;
      return new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime();
    });

    return { data };
  });

  // --- Problem leaderboard ---
  fastify.get<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>('/api/admin/problems/:id/leaderboard', async (request, reply) => {
    const orgId = request.user!.organizationId!;
    const { page, limit } = parsePaginationParams(request.query);

    const problem = await prisma.problem.findFirst({
      where: { id: request.params.id, organizationId: orgId, deletedAt: null },
      select: { id: true, title: true, difficulty: true, problemType: true, duration: true }
    });

    if (!problem) {
      reply.code(404).send({ error: 'Problem not found' });
      return;
    }

    const where = {
      problemId: request.params.id,
      organizationId: orgId,
      deletedAt: null,
      status: { in: ['COMPLETED' as const, 'SUBMITTED' as const] },
      aiEvaluationStatus: 'completed',
      aiEvaluationScore: { not: null }
    };

    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        where,
        orderBy: [{ aiEvaluationScore: 'desc' }, { submittedAt: 'asc' }],
        skip: getPaginationSkip(page, limit),
        take: limit,
        select: {
          id: true,
          aiEvaluationScore: true,
          aiEvaluationDetails: true,
          startTime: true,
          submittedAt: true,
          status: true,
          endReason: true,
          candidate: { select: { name: true, email: true } }
        }
      }),
      prisma.interview.count({ where })
    ]);

    const skip = getPaginationSkip(page, limit);
    const data = interviews.map((iv, idx) => {
      const durationMs = iv.startTime && iv.submittedAt
        ? new Date(iv.submittedAt).getTime() - new Date(iv.startTime).getTime()
        : null;

      let aiEvaluationDetails: any = null;
      if (iv.aiEvaluationDetails) {
        try { aiEvaluationDetails = JSON.parse(iv.aiEvaluationDetails); } catch { aiEvaluationDetails = iv.aiEvaluationDetails; }
      }

      return {
        rank: skip + idx + 1,
        interviewId: iv.id,
        candidateName: iv.candidate.name,
        candidateEmail: iv.candidate.email,
        aiScore: iv.aiEvaluationScore != null ? Math.round(iv.aiEvaluationScore) : null,
        durationMinutes: durationMs != null ? Math.round(durationMs / 60000) : null,
        completedAt: iv.submittedAt,
        aiEvaluationDetails,
        status: iv.status,
        endReason: iv.endReason
      };
    });

    return {
      problem,
      data,
      pagination: calculatePagination(page, limit, total)
    };
  });

  function buildProblemFilters(query: {
    search?: string;
    visibility?: string;
    problemType?: string;
    difficulty?: string;
    tags?: string;
  }) {
    const search = query.search?.trim() || '';
    const { visibility, problemType, difficulty, tags } = query;

    return {
      ...(visibility && { visibility }),
      ...(problemType && { problemType }),
      ...(difficulty && { difficulty }),
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
      tags?: string;
    }
  }>(
    '/api/admin/problems',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);

      const where: any = {
        organizationId: request.user!.organizationId!,
        deletedAt: null,
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
        organizationId: request.user!.organizationId!,
        createdById: request.user!.id,
        visibility: request.body.visibility || ProblemVisibility.PRIVATE,
        problemType: request.body.problemType || ProblemType.FEATURE_DEV
      }
    });
  });

  fastify.put<{ Params: { id: string }; Body: Partial<CreateProblemDto> }>(
    '/api/admin/problems/:id',
    async (request, reply) => {
      const problem = await prisma.problem.findFirst({
        where: {
          id: request.params.id,
          organizationId: request.user!.organizationId!
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
        organizationId: request.user!.organizationId!
      }
    });

    if (!problem) {
      reply.code(404).send({ error: 'Problem not found' });
      return;
    }

    return await prisma.problem.update({
      where: { id: request.params.id },
      data: { deletedAt: new Date() }
    });
  });

  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      problemType?: string;
      difficulty?: string;
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

      // Check if this org already copied this template
      const existing = await prisma.problem.findFirst({
        where: {
          organizationId: request.user!.organizationId!,
          sourceTemplateId: template.id,
          deletedAt: null
        }
      });

      if (existing) {
        return { ...existing, alreadyExists: true };
      }

      const problem = await prisma.problem.create({
        data: {
          title: template.title,
          description: template.description,
          requirements: template.requirements,
          scoringCriteria: template.scoringCriteria as any,
          workDirTemplate: template.workDirTemplate,
          duration: template.duration,
          organizationId: request.user!.organizationId!,
          createdById: request.user!.id,
          visibility: ProblemVisibility.PRIVATE,
          problemType: template.problemType,
          difficulty: template.difficulty,
          tags: template.tags,
          scoringRubric: template.scoringRubric,
          sourceTemplateId: template.id
        }
      });

      return problem;
    }
  );
}
