import type { FastifyInstance } from 'fastify';
import { prisma } from '@vibe/database';
import type { InterviewDraft } from '@vibe/shared-types';
import { authMiddleware, orgMiddleware } from '../../middleware/auth';

function parseCandidateIds(candidateId?: string | null) {
  if (!candidateId) {
    return [];
  }

  return candidateId
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function serializeCandidateIds(candidateIds?: string[]) {
  if (!candidateIds || candidateIds.length === 0) {
    return undefined;
  }

  return candidateIds.join(',');
}

export async function interviewDraftRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', orgMiddleware);

  // GET /api/admin/interview-drafts/current - 获取当前用户草稿
  fastify.get('/api/admin/interview-drafts/current', async (request, reply) => {
    const draft = await prisma.interviewDraft.findUnique({
      where: {
        organizationId_createdById: {
          organizationId: request.user!.organizationId!,
          createdById: request.user!.id
        }
      }
    });

    if (!draft) {
      return null;
    }

    const candidateIds = parseCandidateIds(draft.candidateId);

    return {
      id: draft.id,
      organizationId: draft.organizationId,
      createdById: draft.createdById,
      positionName: draft.positionName || undefined,
      interviewerId: draft.interviewerId || undefined,
      problemId: draft.problemId || undefined,
      scheduledStartAt: draft.scheduledStartAt?.toISOString() || undefined,
      duration: draft.duration || undefined,
      candidateMode: (draft.candidateMode as 'existing' | 'new' | 'bulk') || undefined,
      candidateId: candidateIds[0] || undefined,
      candidateIds,
      newCandidateName: draft.newCandidateName || undefined,
      newCandidateEmail: draft.newCandidateEmail || undefined,
      newCandidatePhone: draft.newCandidatePhone || undefined,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString()
    };
  });

  // POST /api/admin/interview-drafts - 保存/更新草稿 (upsert)
  fastify.post<{
    Body: Partial<Omit<InterviewDraft, 'id' | 'organizationId' | 'createdById' | 'createdAt' | 'updatedAt'>>;
  }>('/api/admin/interview-drafts', async (request, reply) => {
    const { candidateIds: draftCandidateIds, ...draftBody } = request.body;
    const payload = {
      ...draftBody,
      candidateId: serializeCandidateIds(draftCandidateIds) ?? draftBody.candidateId,
      scheduledStartAt: draftBody.scheduledStartAt
        ? new Date(draftBody.scheduledStartAt)
        : undefined
    };

    const draft = await prisma.interviewDraft.upsert({
      where: {
        organizationId_createdById: {
          organizationId: request.user!.organizationId!,
          createdById: request.user!.id
        }
      },
      update: {
        ...payload,
        updatedAt: new Date()
      },
      create: {
        ...payload,
        organizationId: request.user!.organizationId!,
        createdById: request.user!.id
      }
    });

    const savedCandidateIds = parseCandidateIds(draft.candidateId);

    return {
      id: draft.id,
      organizationId: draft.organizationId,
      createdById: draft.createdById,
      positionName: draft.positionName || undefined,
      interviewerId: draft.interviewerId || undefined,
      problemId: draft.problemId || undefined,
      scheduledStartAt: draft.scheduledStartAt?.toISOString() || undefined,
      duration: draft.duration || undefined,
      candidateMode: (draft.candidateMode as 'existing' | 'new' | 'bulk') || undefined,
      candidateId: savedCandidateIds[0] || undefined,
      candidateIds: savedCandidateIds,
      newCandidateName: draft.newCandidateName || undefined,
      newCandidateEmail: draft.newCandidateEmail || undefined,
      newCandidatePhone: draft.newCandidatePhone || undefined,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString()
    };
  });

  // DELETE /api/admin/interview-drafts/current - 删除当前用户草稿
  fastify.delete('/api/admin/interview-drafts/current', async (request, reply) => {
    await prisma.interviewDraft.deleteMany({
      where: {
        organizationId: request.user!.organizationId!,
        createdById: request.user!.id
      }
    });

    return { success: true };
  });
}
