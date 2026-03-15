import type { FastifyInstance } from 'fastify';
import type { LoginDto, RegisterDto } from '@vibe/shared-types';
import { login, register, logout, validateSession } from '../services/auth-service';
import { authMiddleware } from '../middleware/auth';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post<{ Body: LoginDto }>('/api/auth/login', async (request, reply) => {
    const result = await login(request.body);

    if (!result) {
      reply.code(401).send({ error: 'Invalid username or password' });
      return;
    }

    reply.setCookie('sessionToken', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/'
    });

    return { user: result.user };
  });

  // Register (for initial setup)
  fastify.post<{ Body: RegisterDto }>('/api/auth/register', async (request, reply) => {
    try {
      const user = await register(request.body);
      return { user };
    } catch (error: any) {
      if (error.code === 'P2002') {
        reply.code(400).send({ error: 'Username already exists' });
        return;
      }
      throw error;
    }
  });

  // Logout
  fastify.post('/api/auth/logout', async (request, reply) => {
    const sessionToken = request.cookies?.sessionToken;

    if (sessionToken) {
      await logout(sessionToken);
    }

    reply.clearCookie('sessionToken', { path: '/' });
    return { success: true };
  });

  // Get current user
  fastify.get('/api/auth/me', { preHandler: authMiddleware }, async (request) => {
    return { user: request.user };
  });
}

