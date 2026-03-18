import type { FastifyInstance } from 'fastify';
import { prisma } from '@vibe/database';
import type { CreateCandidateDto } from '@vibe/shared-types';
import { parsePaginationParams, calculatePagination, getPaginationSkip } from '../../utils/pagination';
import { authMiddleware } from '../../middleware/auth';
import * as XLSX from 'xlsx';

export async function candidateRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // --- Template download (must be registered before /:id routes) ---
  fastify.get('/api/admin/candidates/import-template', async (_request, reply) => {
    const rows = [
      { '姓名（必填）': '张三', '邮箱（必填）': 'zhangsan@example.com', '手机号（选填）': '13800138000' },
      { '姓名（必填）': '李四', '邮箱（必填）': 'lisi@example.com', '手机号（选填）': '' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 18 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '候选人导入模板');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="candidate-import-template.xlsx"')
      .send(buffer);
  });

  // --- Batch import ---
  fastify.post('/api/admin/candidates/batch', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      reply.code(400).send({ error: '请上传 Excel 文件' });
      return;
    }

    const buffer = await file.toBuffer();
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      reply.code(400).send({ error: '无法解析 Excel 文件，请确认文件格式正确' });
      return;
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      reply.code(400).send({ error: 'Excel 文件中没有工作表' });
      return;
    }

    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);
    if (rawRows.length === 0) {
      reply.code(400).send({ error: 'Excel 文件中没有数据行' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^1[3-9]\d{9}$/;

    const errors: { row: number; reason: string }[] = [];
    const validCandidates: { name: string; email: string; phone?: string }[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // Excel row (1-indexed header + data)

      // Support both template column names and simple names
      const name = String(raw['姓名（必填）'] || raw['姓名'] || raw['name'] || '').trim();
      const email = String(raw['邮箱（必填）'] || raw['邮箱'] || raw['email'] || '').trim().toLowerCase();
      const phone = String(raw['手机号（选填）'] || raw['手机号'] || raw['phone'] || '').trim();

      if (!name) {
        errors.push({ row: rowNum, reason: '姓名不能为空' });
        continue;
      }
      if (!email || !emailRegex.test(email)) {
        errors.push({ row: rowNum, reason: '邮箱格式不正确' });
        continue;
      }
      if (phone && !phoneRegex.test(phone)) {
        errors.push({ row: rowNum, reason: '手机号格式不正确' });
        continue;
      }
      if (seenEmails.has(email)) {
        errors.push({ row: rowNum, reason: `文件中存在重复邮箱: ${email}` });
        continue;
      }

      seenEmails.add(email);
      validCandidates.push({ name, email, phone: phone || undefined });
    }

    if (validCandidates.length === 0) {
      return { success: 0, skipped: 0, failed: errors.length, errors };
    }

    // Check which emails already exist in this organization
    const existingCandidates = await prisma.candidate.findMany({
      where: {
        organizationId: request.user!.organizationId,
        email: { in: validCandidates.map(c => c.email) }
      },
      select: { email: true }
    });
    const existingEmails = new Set(existingCandidates.map(c => c.email.toLowerCase()));

    const toCreate: typeof validCandidates = [];
    let skipped = 0;
    for (const candidate of validCandidates) {
      if (existingEmails.has(candidate.email)) {
        skipped++;
      } else {
        toCreate.push(candidate);
      }
    }

    if (toCreate.length > 0) {
      await prisma.candidate.createMany({
        data: toCreate.map(c => ({
          ...c,
          organizationId: request.user!.organizationId
        }))
      });
    }

    return {
      success: toCreate.length,
      skipped,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined
    };
  });
  fastify.get<{ Querystring: { page?: string; limit?: string; search?: string } }>(
    '/api/admin/candidates',
    async (request) => {
      const { page, limit } = parsePaginationParams(request.query);
      const search = request.query.search?.trim() || '';

      const where = {
        organizationId: request.user!.organizationId,
        ...(search
          ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } }
            ]
          }
          : {})
      };

      const [data, total] = await Promise.all([
        prisma.candidate.findMany({
          where,
          include: {
            _count: {
              select: {
                interviews: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: getPaginationSkip(page, limit),
          take: limit
        }),
        prisma.candidate.count({ where })
      ]);

      return {
        data: data.map(({ _count, ...candidate }) => ({
          ...candidate,
          interviewCount: _count.interviews
        })),
        pagination: calculatePagination(page, limit, total)
      };
    }
  );

  fastify.post<{ Body: CreateCandidateDto }>('/api/admin/candidates', async (request, reply) => {
    try {
      return await prisma.candidate.create({
        data: {
          ...request.body,
          organizationId: request.user!.organizationId
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        reply.code(400).send({ error: '该邮箱已在当前企业中存在' });
        return;
      }
      throw error;
    }
  });

  fastify.put<{ Params: { id: string }; Body: CreateCandidateDto }>('/api/admin/candidates/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, email, phone } = request.body;

    try {
      const existing = await prisma.candidate.findFirst({
        where: {
          id,
          organizationId: request.user!.organizationId
        },
        select: { id: true }
      });

      if (!existing) {
        reply.code(404).send({ error: 'Candidate not found' });
        return;
      }

      const candidate = await prisma.candidate.update({
        where: { id },
        data: { name, email, phone }
      });
      return candidate;
    } catch (error: any) {
      if (error.code === 'P2002') {
        reply.code(400).send({ error: '该邮箱已在当前企业中存在' });
        return;
      }
      reply.code(404).send({ error: 'Candidate not found' });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/api/admin/candidates/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const candidate = await prisma.candidate.findFirst({
        where: {
          id,
          organizationId: request.user!.organizationId
        },
        select: { id: true }
      });

      if (!candidate) {
        reply.code(404).send({ error: 'Candidate not found' });
        return;
      }

      // Check if candidate has any interviews
      const interviewCount = await prisma.interview.count({
        where: {
          candidateId: id,
          organizationId: request.user!.organizationId
        }
      });

      if (interviewCount > 0) {
        reply.code(400).send({ error: 'Cannot delete candidate with existing interviews' });
        return;
      }

      await prisma.candidate.delete({
        where: { id }
      });

      return { success: true };
    } catch (error) {
      reply.code(404).send({ error: 'Candidate not found' });
    }
  });
}
