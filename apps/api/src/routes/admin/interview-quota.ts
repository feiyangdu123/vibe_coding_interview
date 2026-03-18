import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import {
  getInterviewQuotaSummaryForOrganization,
  listInterviewQuotaLedger
} from '../../services/interview-quota-service';
import { parsePaginationParams } from '../../utils/pagination';

export async function interviewQuotaRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/api/admin/interview-quota', async (request) => {
    return getInterviewQuotaSummaryForOrganization(request.user!.organizationId);
  });

  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      flow?: string;
    };
  }>('/api/admin/interview-quota/ledger', async (request) => {
    const { page, limit } = parsePaginationParams(request.query);
    const flow =
      request.query.flow === 'consumed' ||
      request.query.flow === 'released' ||
      request.query.flow === 'reserved'
        ? request.query.flow
        : 'all';

    return listInterviewQuotaLedger(request.user!.organizationId, {
      page,
      limit,
      flow
    });
  });
}
