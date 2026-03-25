import type { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '@vibe/database';
import type {
  CreateOrganizationApiKeyConfigDto,
  SessionUser,
  UpdateOrganizationApiKeyConfigDto
} from '@vibe/shared-types';
import { authMiddleware } from '../../middleware/auth';

function ensureOrgAdmin(
  request: { user?: SessionUser },
  reply: FastifyReply
): request is { user: SessionUser & { role: 'ORG_ADMIN' } } {
  if (request.user?.role !== 'ORG_ADMIN') {
    reply.code(403).send({ error: 'Only organization admins can manage API key settings' });
    return false;
  }

  return true;
}

function normalizeName(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error('名称不能为空');
  }

  return normalized;
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error('Base URL 不能为空');
  }

  const url = new URL(normalized);
  return url.toString().replace(/\/+$/, '');
}

function normalizeApiKey(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error('API Key 不能为空');
  }

  return normalized;
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '****';
  }

  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

function toSummary(config: {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isSelected: boolean;
  createdAt: Date;
}) {
  return {
    id: config.id,
    name: config.name,
    baseUrl: config.baseUrl,
    apiKeyMasked: maskApiKey(config.apiKey),
    modelId: config.modelId,
    isSelected: config.isSelected,
    createdAt: config.createdAt.toISOString(),
  };
}

export async function organizationApiKeyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/api/admin/settings/api-keys', async (request, reply) => {
    if (!ensureOrgAdmin(request, reply)) {
      return;
    }

    const configs = await prisma.organizationApiKeyConfig.findMany({
      where: {
        organizationId: request.user.organizationId
      },
      orderBy: [
        { isSelected: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return {
      data: configs.map(toSummary)
    };
  });

  fastify.post<{ Body: CreateOrganizationApiKeyConfigDto }>(
    '/api/admin/settings/api-keys',
    async (request, reply) => {
      if (!ensureOrgAdmin(request, reply)) {
        return;
      }

      let name: string;
      let baseUrl: string;
      let apiKey: string;

      try {
        name = normalizeName(request.body.name);
        baseUrl = normalizeBaseUrl(request.body.baseUrl);
        apiKey = normalizeApiKey(request.body.apiKey);
      } catch (error: any) {
        if (error instanceof Error) {
          reply.code(400).send({ error: error.message });
          return;
        }

        throw error;
      }

      const created = await prisma.$transaction(async (tx) => {
        const existingCount = await tx.organizationApiKeyConfig.count({
          where: {
            organizationId: request.user.organizationId
          }
        });

        const shouldSelect = existingCount === 0;

        if (shouldSelect) {
          await tx.organizationApiKeyConfig.updateMany({
            where: {
              organizationId: request.user.organizationId,
              isSelected: true
            },
            data: {
              isSelected: false
            }
          });
        }

        return tx.organizationApiKeyConfig.create({
          data: {
            organizationId: request.user.organizationId,
            name,
            baseUrl,
            apiKey,
            modelId: (request.body.modelId || '').trim(),
            isSelected: shouldSelect
          }
        });
      });

      return toSummary(created);
    }
  );

  fastify.put<{ Params: { id: string }; Body: UpdateOrganizationApiKeyConfigDto }>(
    '/api/admin/settings/api-keys/:id',
    async (request, reply) => {
      if (!ensureOrgAdmin(request, reply)) {
        return;
      }

      const existing = await prisma.organizationApiKeyConfig.findFirst({
        where: {
          id: request.params.id,
          organizationId: request.user.organizationId
        }
      });

      if (!existing) {
        reply.code(404).send({ error: 'API Key 配置不存在' });
        return;
      }

      let name: string;
      let baseUrl: string;
      let nextApiKey: string | undefined;

      try {
        name = normalizeName(request.body.name);
        baseUrl = normalizeBaseUrl(request.body.baseUrl);
        nextApiKey = request.body.apiKey?.trim();

        if (nextApiKey) {
          nextApiKey = normalizeApiKey(nextApiKey);
        }
      } catch (error: any) {
        if (error instanceof Error) {
          reply.code(400).send({ error: error.message });
          return;
        }

        throw error;
      }

      const updated = await prisma.organizationApiKeyConfig.update({
        where: {
          id: existing.id
        },
        data: {
          name,
          baseUrl,
          ...(nextApiKey ? { apiKey: nextApiKey } : {}),
          ...(request.body.modelId !== undefined ? { modelId: request.body.modelId.trim() } : {})
        }
      });

      return toSummary(updated);
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/admin/settings/api-keys/:id/select',
    async (request, reply) => {
      if (!ensureOrgAdmin(request, reply)) {
        return;
      }

      const existing = await prisma.organizationApiKeyConfig.findFirst({
        where: {
          id: request.params.id,
          organizationId: request.user.organizationId
        }
      });

      if (!existing) {
        reply.code(404).send({ error: 'API Key 配置不存在' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.organizationApiKeyConfig.updateMany({
          where: {
            organizationId: request.user.organizationId,
            isSelected: true
          },
          data: {
            isSelected: false
          }
        });

        await tx.organizationApiKeyConfig.update({
          where: {
            id: existing.id
          },
          data: {
            isSelected: true
          }
        });
      });

      return { success: true };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api/admin/settings/api-keys/:id',
    async (request, reply) => {
      if (!ensureOrgAdmin(request, reply)) {
        return;
      }

      const existing = await prisma.organizationApiKeyConfig.findFirst({
        where: {
          id: request.params.id,
          organizationId: request.user.organizationId
        }
      });

      if (!existing) {
        reply.code(404).send({ error: 'API Key 配置不存在' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.organizationApiKeyConfig.delete({
          where: {
            id: existing.id
          }
        });

        if (existing.isSelected) {
          const fallback = await tx.organizationApiKeyConfig.findFirst({
            where: {
              organizationId: request.user.organizationId
            },
            orderBy: {
              createdAt: 'asc'
            }
          });

          if (fallback) {
            await tx.organizationApiKeyConfig.update({
              where: {
                id: fallback.id
              },
              data: {
                isSelected: true
              }
            });
          }
        }
      });

      return { success: true };
    }
  );
}
