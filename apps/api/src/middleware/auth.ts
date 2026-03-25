import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateSession } from '../services/auth-service';
import type { SessionUser } from '@vibe/shared-types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionToken = request.cookies?.sessionToken;

  if (!sessionToken) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const user = await validateSession(sessionToken);

  if (!user) {
    reply.code(401).send({ error: 'Invalid or expired session' });
    return;
  }

  request.user = user;
}

export async function orgMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user?.organizationId) {
    reply.code(403).send({ error: 'Organization membership required' });
    return;
  }
}

export async function platformAdminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.user?.role !== 'PLATFORM_ADMIN') {
    reply.code(403).send({ error: 'Platform admin access required' });
    return;
  }
}
