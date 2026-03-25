import type { FastifyInstance } from 'fastify';
import { prisma } from '@vibe/database';
import type { CreateOrganizationUserDto } from '@vibe/shared-types';
import { authMiddleware, orgMiddleware } from '../../middleware/auth';
import { hashPassword } from '../../utils/password';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', orgMiddleware);

  function ensureOrgAdmin(request: { user?: { role?: string } }, reply: any): boolean {
    if (request.user?.role !== 'ORG_ADMIN') {
      reply.code(403).send({ error: 'Only organization admins can manage members' });
      return false;
    }
    return true;
  }

  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/admin/users',
    async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit) : 100;

      const users = await prisma.user.findMany({
        where: {
          organizationId: request.user!.organizationId!
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true
        },
        orderBy: { username: 'asc' },
        take: limit
      });

      return { data: users };
    }
  );

  fastify.post<{ Body: CreateOrganizationUserDto }>(
    '/api/admin/users',
    async (request, reply) => {
      if (!ensureOrgAdmin(request, reply)) {
        return;
      }

      try {
        const user = await prisma.user.create({
          data: {
            username: request.body.username,
            passwordHash: hashPassword(request.body.password),
            email: request.body.email || null,
            role: request.body.role,
            organizationId: request.user!.organizationId!
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            createdAt: true
          }
        });

        return user;
      } catch (error: any) {
        if (error.code === 'P2002') {
          reply.code(400).send({ error: '用户名已存在' });
          return;
        }
        throw error;
      }
    }
  );
}
