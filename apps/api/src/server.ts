import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
config({ path: resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { authRoutes } from './routes/auth';
import { problemRoutes } from './routes/admin/problems';
import { candidateRoutes } from './routes/admin/candidates';
import { interviewRoutes } from './routes/admin/interviews';
import processesRoutes from './routes/admin/processes';
import { interviewPublicRoutes } from './routes/interview';
import { startCleanupJob } from './services/cleanup-service';
import { migrateExpiredStatus } from './services/migration-service';

const fastify = Fastify({
  logger: true
});

async function start() {
  // Run one-time migration for legacy data
  await migrateExpiredStatus();

  await fastify.register(cors, {
    origin: 'http://localhost:3000',
    credentials: true
  });

  await fastify.register(cookie);

  // Health check
  fastify.get('/', async () => {
    return {
      status: 'ok',
      service: 'Vibe Coding Interview API',
      version: '1.0.0'
    };
  });

  fastify.get('/health', async () => {
    return { status: 'healthy' };
  });

  await fastify.register(authRoutes);
  await fastify.register(problemRoutes);
  await fastify.register(candidateRoutes);
  await fastify.register(interviewRoutes);
  await fastify.register(processesRoutes);
  await fastify.register(interviewPublicRoutes);

  startCleanupJob();

  const port = Number(process.env.API_PORT) || 3001;
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`API server running on http://localhost:${port}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
