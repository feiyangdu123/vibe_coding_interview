import type { FastifyInstance } from 'fastify';
import { prisma, InterviewStatus } from '@vibe/database';
import {
  createInterview,
  createBatchInterviews,
  endInterviewByInterviewer,
  getInterviewEvents,
  cancelPendingInterview
} from '../../services/interview-service';
import { getChatHistory } from '../../services/chat-history-service';
import { evaluateInterview, getEvaluationHistory, getEvaluationRun, getEvaluationStream } from '../../services/ai-evaluation-service';
import { exportInterviewsToExcel } from '../../services/interview-export-service';
import type { CreateInterviewDto, SubmitManualReviewDto, SubmitReviewDecisionDto, BatchCreateInterviewDto } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';
import { authMiddleware, orgMiddleware } from '../../middleware/auth';

export async function interviewRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', orgMiddleware);

  fastify.get<{ Querystring: { page?: string; limit?: string; search?: string; status?: string; aiStatus?: string; reviewStatus?: string; decision?: string } }>(
    '/api/admin/interviews',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);
      const search = request.query.search?.trim() || '';
      const status = request.query.status?.trim() || 'all';
      const aiStatus = request.query.aiStatus?.trim() || '';
      const reviewStatus = request.query.reviewStatus?.trim() || '';
      const decision = request.query.decision?.trim() || '';

      const where: any = {
        organizationId: request.user!.organizationId!,
        deletedAt: null
      };

      // Status filter
      if (status && status !== 'all') {
        where.status = status.toUpperCase() as InterviewStatus;
      }

      // AI evaluation status filter
      if (aiStatus) {
        where.aiEvaluationStatus = aiStatus;
      }

      // Manual review status filter
      if (reviewStatus) {
        where.manualReviewStatus = reviewStatus;
      }

      // Final decision filter
      if (decision) {
        where.finalDecision = decision;
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
            problem: true,
            interviewer: true
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

  // GET /api/admin/interviews/position-names — 岗位名称自动补全
  fastify.get<{ Querystring: { q?: string } }>(
    '/api/admin/interviews/position-names',
    async (request) => {
      const organizationId = request.user!.organizationId!;
      const q = request.query.q?.trim() || '';

      const results = await prisma.interview.findMany({
        where: {
          organizationId,
          positionName: q
            ? { not: null, contains: q, mode: 'insensitive' as const }
            : { not: null }
        },
        select: { positionName: true },
        distinct: ['positionName'],
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return results
        .map(r => r.positionName)
        .filter((name): name is string => Boolean(name));
    }
  );

  fastify.get<{ Params: { id: string } }>('/api/admin/interviews/:id', async (request, reply) => {
    const interview = await prisma.interview.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.user!.organizationId!
      },
      include: {
        candidate: true,
        problem: true,
        interviewer: true
      }
    });

    if (!interview) {
      reply.code(404).send({ error: 'Interview not found' });
      return;
    }

    return interview;
  });

  fastify.post<{ Body: CreateInterviewDto }>('/api/admin/interviews', async (request, reply) => {
    try {
      return await createInterview(
        request.body,
        request.user!.organizationId!,
        request.user!.id
      );
    } catch (error) {
      console.error('Create interview error:', error);
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to create interview'
      });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/api/admin/interviews/:id', async (request, reply) => {
    try {
      const interview = await cancelPendingInterview(
        request.params.id,
        request.user!.organizationId!,
        request.user!.id
      );

      return { success: true, interview };
    } catch (error) {
      console.error('Cancel interview error:', error);
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to cancel interview'
      });
    }
  });

  fastify.post<{ Params: { id: string } }>('/api/admin/interviews/:id/cancel', async (request, reply) => {
    try {
      return await cancelPendingInterview(
        request.params.id,
        request.user!.organizationId!,
        request.user!.id
      );
    } catch (error) {
      console.error('Cancel interview error:', error);
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to cancel interview'
      });
    }
  });

  // 软删除面试（仅已结束的面试）
  fastify.post<{ Params: { id: string } }>('/api/admin/interviews/:id/delete', async (request, reply) => {
    const interview = await prisma.interview.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.user!.organizationId!
      },
      select: { id: true, status: true, deletedAt: true }
    });

    if (!interview) {
      reply.code(404).send({ error: 'Interview not found' });
      return;
    }

    if (interview.deletedAt) {
      reply.code(400).send({ error: '面试已被删除' });
      return;
    }

    const allowedStatuses: InterviewStatus[] = [
      InterviewStatus.COMPLETED,
      InterviewStatus.CANCELLED,
      InterviewStatus.EXPIRED,
      InterviewStatus.SUBMITTED
    ];

    if (!allowedStatuses.includes(interview.status as InterviewStatus)) {
      reply.code(400).send({ error: '只能删除已结束的面试（已完成、已取消、已过期、已提交）' });
      return;
    }

    await prisma.interview.update({
      where: { id: interview.id },
      data: { deletedAt: new Date() }
    });

    return { success: true };
  });

  fastify.get<{ Params: { id: string } }>('/api/admin/interviews/:id/chat-history', async (request, reply) => {
    const { id } = request.params;
    console.log(`[Chat History API] Fetching for interview ${id}`);

    const interview = await prisma.interview.findUnique({
      where: { id },
      select: { dataDir: true, organizationId: true }
    });

    if (!interview || interview.organizationId !== request.user!.organizationId!) {
      reply.code(404).send({ error: 'Interview not found' });
      return;
    }

    console.log(`[Chat History API] dataDir: ${interview.dataDir}`);

    const history = await getChatHistory(id);

    if (history.error) {
      console.error(`[Chat History API] Error: ${history.error}`);
      // Return 200 with error field instead of 500, so frontend can display the error message
      return history;
    }

    console.log(`[Chat History API] Successfully fetched ${history.messages.length} messages`);
    return history;
  });

  fastify.get<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>('/api/admin/interviews/:id/events', async (request, reply) => {
    const interview = await prisma.interview.findUnique({
      where: { id: request.params.id },
      select: { token: true, organizationId: true }
    });

    if (!interview || interview.organizationId !== request.user!.organizationId!) {
      reply.code(404).send({ error: 'Interview not found' });
      return;
    }

    const page = parseInt(request.query.page || '1');
    const limit = parseInt(request.query.limit || '50');
    return await getInterviewEvents(interview.token, page, limit);
  });

  fastify.post<{ Params: { id: string } }>('/api/admin/interviews/:id/end', async (request, reply) => {
    const interview = await prisma.interview.findUnique({
      where: { id: request.params.id },
      select: { token: true, organizationId: true, status: true }
    });

    if (!interview || interview.organizationId !== request.user!.organizationId!) {
      reply.code(404).send({ error: 'Interview not found' });
      return;
    }

    if (interview.status !== InterviewStatus.IN_PROGRESS) {
      reply.code(400).send({ error: 'Interview is not in progress' });
      return;
    }

    try {
      return await endInterviewByInterviewer(interview.token);
    } catch (error) {
      console.error('End interview error:', error);
      reply.code(500).send({ error: 'Failed to end interview' });
    }
  });

  // 获取评估结果
  fastify.get<{ Params: { id: string } }>(
    '/api/admin/interviews/:id/evaluation',
    async (request, reply) => {
      const { id } = request.params;

      const interview = await prisma.interview.findFirst({
        where: {
          id,
          organizationId: request.user!.organizationId!
        },
        select: {
          organizationId: true,
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

      // Fetch rawOutput from latest AiEvaluationRun for fallback display
      let rawOutput: string | null = null;
      const latestRun = await prisma.aiEvaluationRun.findFirst({
        where: { interviewId: id },
        orderBy: { version: 'desc' },
        select: { rawOutput: true }
      });
      if (latestRun?.rawOutput) {
        rawOutput = latestRun.rawOutput;
      }

      return {
        ...interview,
        aiEvaluationDetails: parsedDetails,
        rawOutput
      };
    }
  );

  // 手动触发评估（支持重跑）
  fastify.post<{ Params: { id: string } }>(
    '/api/admin/interviews/:id/evaluate',
    async (request, reply) => {
      const { id } = request.params;

      const interview = await prisma.interview.findFirst({
        where: {
          id,
          organizationId: request.user!.organizationId!
        }
      });

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      if (interview.status === InterviewStatus.PENDING || interview.status === InterviewStatus.IN_PROGRESS) {
        reply.code(400).send({ error: 'Interview must be completed first' });
        return;
      }

      if (interview.aiEvaluationStatus === 'running') {
        reply.code(409).send({ error: 'AI evaluation is already running' });
        return;
      }

      // 已复核面试：仅新增评估版本，不改变 manualReviewStatus
      // 未复核面试：重置评估状态
      if (interview.manualReviewStatus !== 'completed') {
        await prisma.interview.update({
          where: { id },
          data: {
            aiEvaluationStatus: 'pending',
            manualReviewStatus: null
          }
        });
      }

      evaluateInterview(id, request.user!.id).catch(err => {
        console.error('Evaluation trigger failed:', err);
      });

      return {
        message: 'Evaluation started',
        status: 'running'
      };
    }
  );

  // Submit manual review
  fastify.post<{ Params: { id: string }; Body: SubmitManualReviewDto }>(
    '/api/admin/interviews/:id/manual-review',
    async (request, reply) => {
      const interview = await prisma.interview.findUnique({
        where: { id: request.params.id }
      });

      if (!interview || interview.organizationId !== request.user!.organizationId!) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      return await prisma.interview.update({
        where: { id: request.params.id },
        data: {
          manualReviewStatus: 'completed',
          manualReviewScore: request.body.manualReviewScore,
          manualReviewNotes: request.body.manualReviewNotes,
          manualReviewConclusion: request.body.manualReviewConclusion,
          manualReviewedAt: new Date(),
          manualReviewedBy: request.user!.id
        }
      });
    }
  );

  // 获取评估历史（所有版本）
  fastify.get<{ Params: { id: string } }>(
    '/api/admin/interviews/:id/evaluation-history',
    async (request, reply) => {
      const { id } = request.params;

      const interview = await prisma.interview.findUnique({
        where: { id },
        select: { organizationId: true }
      });

      if (!interview || interview.organizationId !== request.user!.organizationId!) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      const history = await getEvaluationHistory(id);
      return history;
    }
  );

  // 获取指定评估版本的详细信息
  fastify.get<{ Params: { id: string; runId: string } }>(
    '/api/admin/interviews/:id/evaluation-runs/:runId',
    async (request, reply) => {
      const { id, runId } = request.params;

      const interview = await prisma.interview.findUnique({
        where: { id },
        select: { organizationId: true }
      });

      if (!interview || interview.organizationId !== request.user!.organizationId!) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      const run = await getEvaluationRun(runId);

      if (!run || run.interviewId !== id) {
        reply.code(404).send({ error: 'Evaluation run not found' });
        return;
      }

      return run;
    }
  );

  // 提交最终复核结论
  fastify.post<{ Params: { id: string }; Body: SubmitReviewDecisionDto }>(
    '/api/admin/interviews/:id/review',
    async (request, reply) => {
      const { id } = request.params;
      const { decision, notes, score } = request.body;

      const interview = await prisma.interview.findUnique({
        where: { id }
      });

      if (!interview || interview.organizationId !== request.user!.organizationId!) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      // 验证状态：只有 pending 或 null 的面试可以提交复核结论
      if (interview.manualReviewStatus === 'completed') {
        // 允许重新提交，但记录日志
        console.log(`[Review] Re-submitting review for interview ${id}`);
      }

      return await prisma.interview.update({
        where: { id },
        data: {
          manualReviewStatus: 'completed',
          finalDecision: decision,
          manualReviewScore: score,
          manualReviewNotes: notes,
          manualReviewedAt: new Date(),
          manualReviewedBy: request.user!.id
        }
      });
    }
  );

  // SSE: 流式评估输出
  fastify.get<{ Params: { id: string } }>(
    '/api/admin/interviews/:id/evaluation-stream',
    async (request, reply) => {
      const { id } = request.params;

      const interview = await prisma.interview.findFirst({
        where: {
          id,
          organizationId: request.user!.organizationId!
        },
        select: { id: true }
      });

      if (!interview) {
        reply.code(404).send({ error: 'Interview not found' });
        return;
      }

      // Find running evaluation run
      const runningRun = await prisma.aiEvaluationRun.findFirst({
        where: { interviewId: id, status: 'running' },
        orderBy: { version: 'desc' }
      });

      // Set SSE headers (include CORS since raw writeHead bypasses Fastify's CORS plugin)
      const origin = request.headers.origin || '*';
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true'
      });

      if (!runningRun) {
        // No active evaluation — check for latest completed run and return its rawOutput
        const latestRun = await prisma.aiEvaluationRun.findFirst({
          where: { interviewId: id },
          orderBy: { version: 'desc' },
          select: { rawOutput: true, status: true }
        });

        if (latestRun?.rawOutput) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: latestRun.rawOutput })}\n\n`);
        }
        reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        reply.raw.end();
        return;
      }

      const emitter = getEvaluationStream(runningRun.id);

      if (!emitter) {
        // Emitter gone — evaluation may have just finished
        const run = await prisma.aiEvaluationRun.findUnique({
          where: { id: runningRun.id },
          select: { rawOutput: true }
        });
        if (run?.rawOutput) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: run.rawOutput })}\n\n`);
        }
        reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        reply.raw.end();
        return;
      }

      const onData = (text: string) => {
        reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
      };

      const onDone = () => {
        reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        reply.raw.end();
        cleanup();
      };

      const onError = (errorMsg: string) => {
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`);
        reply.raw.end();
        cleanup();
      };

      const cleanup = () => {
        emitter.removeListener('data', onData);
        emitter.removeListener('done', onDone);
        emitter.removeListener('error', onError);
      };

      emitter.on('data', onData);
      emitter.on('done', onDone);
      emitter.on('error', onError);

      // Client disconnect
      request.raw.on('close', () => {
        cleanup();
      });
    }
  );

  // POST /api/admin/interviews/batch - 批量创建面试
  fastify.post<{ Body: BatchCreateInterviewDto }>(
    '/api/admin/interviews/batch',
    async (request, reply) => {
      try {
        return await createBatchInterviews(
          request.body,
          request.user!.organizationId!,
          request.user!.id
        );
      } catch (error) {
        console.error('Batch create interview error:', error);
        reply.code(400).send({
          error: error instanceof Error ? error.message : 'Failed to batch create interviews'
        });
      }
    }
  );

  // GET /api/admin/interviews/export - 导出 Excel
  fastify.get<{
    Querystring: {
      search?: string;
      status?: string;
      aiStatus?: string;
      reviewStatus?: string;
      decision?: string;
    };
  }>('/api/admin/interviews/export', async (request, reply) => {
    const buffer = await exportInterviewsToExcel(request.user!.organizationId!, {
      search: request.query.search,
      status: request.query.status as InterviewStatus,
      aiStatus: request.query.aiStatus,
      reviewStatus: request.query.reviewStatus,
      decision: request.query.decision
    });

    const filename = `interviews_${new Date().toISOString().split('T')[0]}.xlsx`;

    reply
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  });
}
