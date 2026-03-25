import * as XLSX from 'xlsx';
import { prisma, InterviewStatus } from '@vibe/database';

export async function exportInterviewsToExcel(
  organizationId: string,
  filters: {
    search?: string;
    status?: InterviewStatus;
    aiStatus?: string;
    reviewStatus?: string;
    decision?: string;
  }
): Promise<Buffer> {
  // 构建查询条件（复用列表页逻辑）
  const where: any = { organizationId, deletedAt: null };

  if (filters.status) where.status = filters.status;
  if (filters.aiStatus) where.aiEvaluationStatus = filters.aiStatus;
  if (filters.reviewStatus) where.manualReviewStatus = filters.reviewStatus;
  if (filters.decision) where.finalDecision = filters.decision;

  if (filters.search) {
    where.OR = [
      { candidate: { name: { contains: filters.search, mode: 'insensitive' as const } } },
      { candidate: { email: { contains: filters.search, mode: 'insensitive' as const } } },
      { problem: { title: { contains: filters.search, mode: 'insensitive' as const } } }
    ];
  }

  // 查询数据
  const interviews = await prisma.interview.findMany({
    where,
    include: {
      candidate: true,
      problem: true,
      interviewer: true
    },
    orderBy: { createdAt: 'desc' }
  });

  // 转换为 Excel 行数据
  const rows = interviews.map(interview => ({
    '候选人姓名': interview.candidate.name,
    '候选人邮箱': interview.candidate.email,
    '候选人手机': interview.candidate.phone || '-',
    '职位名称': (interview.candidateSnapshot as any)?.positionName || '-',
    '题目标题': interview.problem.title,
    '面试官': interview.interviewer?.username || '-',
    '面试状态': interview.status,
    'AI评估状态': interview.aiEvaluationStatus || '-',
    'AI评分': interview.aiEvaluationScore?.toFixed(1) || '-',
    '复核状态': interview.manualReviewStatus || '-',
    '人工评分': interview.manualReviewScore?.toFixed(1) || '-',
    '最终结论': interview.finalDecision || '-',
    '创建时间': interview.createdAt.toISOString(),
    '开始时间': interview.startTime?.toISOString() || '-',
    '提交时间': interview.submittedAt?.toISOString() || '-'
  }));

  // 生成 Excel
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '面试结果');

  // 返回 Buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
