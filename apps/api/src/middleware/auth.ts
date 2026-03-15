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
