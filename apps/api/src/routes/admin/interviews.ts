import type { FastifyInstance } from 'fastify';
import { prisma } from '@vibe/database';
import { createInterview } from '../../services/interview-service';
import { getChatHistory } from '../../services/chat-history-service';
import { evaluateInterview } from '../../services/ai-evaluation-service';
import type { CreateInterviewDto, InterviewStatus } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';

export async function interviewRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { page?: string; limit?: string; search?: string; status?: string } }>(
    '/api/admin/interviews',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);
      const search = request.query.search?.trim() || '';
      const status = request.query.status?.trim() || 'all';

      const where: any = {};

      // Status filter
      if (status && status !== 'all') {
        where.status = status as InterviewStatus;
      }

      // Search filter
      if (search) {
        where.OR = [
          { candidate: { name: { contains: search, mode: 'insensitive' as const } } },
          { candidate: { email: { contains: search, mode: 'insensitive' as const } } },
          { problem: { title: { contains: search, mode: 'insensitive' as const } } }
        ];
      }

      const [data, total] = await Promise.all([
        prisma.interview.findMany({
          where,
          include: {
            candidate: true,
            problem: true
          },
          orderBy: { createdAt: 'desc' },
          skip: getPaginationSkip(page, limit),
          take: limit
        }),
        prisma.interview.count({ where })
      ]);

      return {
        data,
        pagination: calculatePagination(page, limit, total)
      };
    }
  );

  fastify.get<{ Params: { id: string } }>('/api/admin/interviews/:id', async (request) => {
    return await prisma.interview.findUnique({
      where: { id: request.params.id },
      include: {
        candidate: true,
        problem: true
      }
    });
  });

  fastify.post<{ Body: CreateInterviewDto }>('/api/admin/interviews', async (request) => {
    return await createInterview(request.body);
  });

  fastify.delete<{ Params: { id: string } }>('/api/admin/interviews/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const interview = await prisma.interview.findUnique({
        where: { id }
      });

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      // If interview is in progress, stop the OpenCode instance
      if (interview.status === 'in_progress' && interview.processId) {
        try {
          process.kill(interview.processId);
        } catch (error) {
          console.error('Failed to kill OpenCode process:', error);
        }
      }

      // Delete the interview
      await prisma.interview.delete({
        where: { id }
      });

      return { success: true };
    } catch (error) {
      console.error('Delete interview error:', error);
      reply.code(500).send({ error: 'Failed to delete interview' });
    }
  });

  fastify.get<{ Params: { id: string } }>('/api/admin/interviews/:id/chat-history', async (request, reply) => {
    const { id } = request.params;
    const history = await getChatHistory(id);
    return history;
  });

  // 获取评估结果
  fastify.get<{ Params: { id: string } }>(
    '/api/admin/interviews/:id/evaluation',
    async (request, reply) => {
      const { id } = request.params;

      const interview = await prisma.interview.findUnique({
        where: { id },
        select: {
          aiEvaluationStatus: true,
          aiEvaluationScore: true,
          aiEvaluationDetails: true,
          aiEvaluationError: true,
          aiEvaluatedAt: true,
          aiEvaluationRetries: true
        }
      });

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      // 解析 aiEvaluationDetails 从 JSON 字符串
      let parsedDetails = null;
      if (interview.aiEvaluationDetails) {
        console.log('[Evaluation API] Raw aiEvaluationDetails type:', typeof interview.aiEvaluationDetails);
        console.log('[Evaluation API] Raw aiEvaluationDetails preview:', (interview.aiEvaluationDetails as string).substring(0, 100));

        try {
          // 尝试解析为 JSON
          parsedDetails = JSON.parse(interview.aiEvaluationDetails as string);
          console.log('[Evaluation API] Successfully parsed as JSON');
        } catch (error) {
          // 如果解析失败，可能是旧格式的纯文本
          console.log('[Evaluation API] Not JSON format, treating as legacy text format');
          // 对于旧格式，返回一个简单的结构，只显示原始文本
          parsedDetails = {
            totalScore: interview.aiEvaluationScore || 0,
            dimensions: [],
            summary: interview.aiEvaluationDetails as string
          };
        }
      }

      console.log('[Evaluation API] Returning parsedDetails:', parsedDetails ? 'object with totalScore=' + parsedDetails.totalScore : 'null');

      return {
        ...interview,
        aiEvaluationDetails: parsedDetails
      };
    }
  );

  // 手动触发评估
  fastify.post<{ Params: { id: string } }>(
    '/api/admin/interviews/:id/evaluate',
    async (request, reply) => {
      const { id } = request.params;

      const interview = await prisma.interview.findUnique({
        where: { id }
      });

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      if (interview.status === 'pending' || interview.status === 'in_progress') {
        reply.code(400).send({ error: 'Interview must be completed first' });
        return;
      }

      evaluateInterview(id).catch(err => {
        console.error('Evaluation trigger failed:', err);
      });

      return { message: 'Evaluation started' };
    }
  );
}
