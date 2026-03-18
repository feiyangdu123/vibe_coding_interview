import {
  prisma,
  Prisma,
  InterviewQuotaLedgerAction,
  InterviewQuotaLedgerReason,
  InterviewQuotaState
} from '@vibe/database';
import type {
  InterviewQuotaSummary,
  InterviewQuotaLedgerEntry,
  PaginatedResponse
} from '@vibe/shared-types';
import { calculatePagination, getPaginationSkip } from '../utils/pagination';

type PrismaTx = Prisma.TransactionClient;

type LockedQuotaRow = {
  id: string;
  organizationId: string;
  totalGranted: number;
  reservedCount: number;
  consumedCount: number;
};

type LedgerMetadata = Prisma.InputJsonValue | undefined;

export const DEFAULT_INTERVIEW_QUOTA_TOTAL = 500;
export const INTERVIEW_JOIN_OPEN_OFFSET_MINUTES = 15;
export const INTERVIEW_NO_SHOW_GRACE_MINUTES = 30;

function buildQuotaSummary(quota: {
  totalGranted: number;
  reservedCount: number;
  consumedCount: number;
}): InterviewQuotaSummary {
  return {
    totalGranted: quota.totalGranted,
    reservedCount: quota.reservedCount,
    consumedCount: quota.consumedCount,
    availableCount: quota.totalGranted - quota.reservedCount - quota.consumedCount
  };
}

export function getInterviewScheduleWindow(scheduledStartAt: Date) {
  const joinWindowOpensAt = new Date(
    scheduledStartAt.getTime() - INTERVIEW_JOIN_OPEN_OFFSET_MINUTES * 60 * 1000
  );
  const joinDeadlineAt = new Date(
    scheduledStartAt.getTime() + INTERVIEW_NO_SHOW_GRACE_MINUTES * 60 * 1000
  );

  return {
    joinWindowOpensAt,
    joinDeadlineAt
  };
}

async function createQuotaLedgerEntry(
  tx: PrismaTx,
  {
    organizationQuotaId,
    interviewId,
    createdById,
    action,
    reason,
    deltaTotal = 0,
    deltaReserved = 0,
    deltaConsumed = 0,
    totalAfter,
    reservedAfter,
    consumedAfter,
    metadata
  }: {
    organizationQuotaId: string;
    interviewId?: string;
    createdById?: string | null;
    action: InterviewQuotaLedgerAction;
    reason: InterviewQuotaLedgerReason;
    deltaTotal?: number;
    deltaReserved?: number;
    deltaConsumed?: number;
    totalAfter: number;
    reservedAfter: number;
    consumedAfter: number;
    metadata?: LedgerMetadata;
  }
) {
  await tx.interviewQuotaLedger.create({
    data: {
      organizationQuotaId,
      interviewId,
      createdById: createdById || null,
      action,
      reason,
      deltaTotal,
      deltaReserved,
      deltaConsumed,
      totalAfter,
      reservedAfter,
      consumedAfter,
      availableAfter: totalAfter - reservedAfter - consumedAfter,
      metadata
    }
  });
}

export async function initializeOrganizationInterviewQuota(
  tx: PrismaTx,
  organizationId: string,
  totalGranted: number = DEFAULT_INTERVIEW_QUOTA_TOTAL
) {
  const existing = await tx.organizationInterviewQuota.findUnique({
    where: { organizationId }
  });

  if (existing) {
    return existing;
  }

  const quota = await tx.organizationInterviewQuota.create({
    data: {
      organizationId,
      totalGranted
    }
  });

  await createQuotaLedgerEntry(tx, {
    organizationQuotaId: quota.id,
    action: InterviewQuotaLedgerAction.GRANT,
    reason: InterviewQuotaLedgerReason.ORGANIZATION_CREATED,
    deltaTotal: totalGranted,
    totalAfter: totalGranted,
    reservedAfter: 0,
    consumedAfter: 0,
    metadata: { source: 'app' }
  });

  return quota;
}

async function lockOrganizationInterviewQuota(tx: PrismaTx, organizationId: string): Promise<LockedQuotaRow> {
  await initializeOrganizationInterviewQuota(tx, organizationId);

  const rows = await tx.$queryRaw<LockedQuotaRow[]>`
    SELECT "id", "organizationId", "totalGranted", "reservedCount", "consumedCount"
    FROM "OrganizationInterviewQuota"
    WHERE "organizationId" = ${organizationId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new Error('Interview quota not initialized');
  }

  return rows[0];
}

export async function getInterviewQuotaSummaryForOrganization(
  organizationId: string
): Promise<InterviewQuotaSummary> {
  return prisma.$transaction(async (tx) => {
    const quota = await initializeOrganizationInterviewQuota(tx, organizationId);
    return buildQuotaSummary(quota);
  });
}

export async function reserveQuotaForCreatedInterviews(
  tx: PrismaTx,
  organizationId: string,
  interviewIds: string[],
  createdById?: string | null
) {
  const quota = await lockOrganizationInterviewQuota(tx, organizationId);
  const currentSummary = buildQuotaSummary(quota);

  if (currentSummary.availableCount < interviewIds.length) {
    throw new Error(`面试配额不足，当前仅剩 ${currentSummary.availableCount} 场可创建`);
  }

  await tx.organizationInterviewQuota.update({
    where: { id: quota.id },
    data: {
      reservedCount: {
        increment: interviewIds.length
      }
    }
  });

  for (const [index, interviewId] of interviewIds.entries()) {
    await createQuotaLedgerEntry(tx, {
      organizationQuotaId: quota.id,
      interviewId,
      createdById,
      action: InterviewQuotaLedgerAction.RESERVE,
      reason: InterviewQuotaLedgerReason.INTERVIEW_CREATED,
      deltaReserved: 1,
      totalAfter: quota.totalGranted,
      reservedAfter: quota.reservedCount + index + 1,
      consumedAfter: quota.consumedCount,
      metadata: {
        type: interviewIds.length > 1 ? 'batch' : 'single',
        batchSize: interviewIds.length
      }
    });
  }

  return {
    totalGranted: quota.totalGranted,
    reservedCount: quota.reservedCount + interviewIds.length,
    consumedCount: quota.consumedCount,
    availableCount: quota.totalGranted - quota.reservedCount - quota.consumedCount - interviewIds.length
  };
}

export async function settleInterviewQuota(
  tx: PrismaTx,
  {
    interviewId,
    organizationId,
    action,
    reason,
    createdById,
    metadata,
    settledAt = new Date()
  }: {
    interviewId: string;
    organizationId: string;
    action: 'consume' | 'release';
    reason: InterviewQuotaLedgerReason;
    createdById?: string | null;
    metadata?: LedgerMetadata;
    settledAt?: Date;
  }
) {
  const interview = await tx.interview.findUnique({
    where: { id: interviewId },
    select: { id: true, quotaState: true }
  });

  if (!interview) {
    throw new Error('Interview not found');
  }

  if (interview.quotaState !== InterviewQuotaState.RESERVED) {
    return null;
  }

  const quota = await lockOrganizationInterviewQuota(tx, organizationId);
  const nextReservedCount = Math.max(0, quota.reservedCount - 1);
  const nextConsumedCount =
    action === 'consume' ? quota.consumedCount + 1 : quota.consumedCount;

  await tx.organizationInterviewQuota.update({
    where: { id: quota.id },
    data: {
      reservedCount: {
        decrement: 1
      },
      ...(action === 'consume'
        ? {
            consumedCount: {
              increment: 1
            }
          }
        : {})
    }
  });

  await tx.interview.update({
    where: { id: interviewId },
    data: {
      quotaState:
        action === 'consume'
          ? InterviewQuotaState.CONSUMED
          : InterviewQuotaState.RELEASED,
      quotaSettledAt: settledAt
    }
  });

  await createQuotaLedgerEntry(tx, {
    organizationQuotaId: quota.id,
    interviewId,
    createdById,
    action:
      action === 'consume'
        ? InterviewQuotaLedgerAction.CONSUME
        : InterviewQuotaLedgerAction.RELEASE,
    reason,
    deltaReserved: -1,
    deltaConsumed: action === 'consume' ? 1 : 0,
    totalAfter: quota.totalGranted,
    reservedAfter: nextReservedCount,
    consumedAfter: nextConsumedCount,
    metadata
  });

  return {
    totalGranted: quota.totalGranted,
    reservedCount: nextReservedCount,
    consumedCount: nextConsumedCount,
    availableCount: quota.totalGranted - nextReservedCount - nextConsumedCount
  };
}

export async function listInterviewQuotaLedger(
  organizationId: string,
  {
    page,
    limit,
    flow = 'all'
  }: {
    page: number;
    limit: number;
    flow?: 'all' | 'consumed' | 'released' | 'reserved';
  }
): Promise<PaginatedResponse<InterviewQuotaLedgerEntry>> {
  const where: Prisma.InterviewQuotaLedgerWhereInput = {
    organizationQuota: {
      organizationId
    }
  };

  if (flow === 'consumed') {
    where.action = InterviewQuotaLedgerAction.CONSUME;
  } else if (flow === 'released') {
    where.action = InterviewQuotaLedgerAction.RELEASE;
  } else if (flow === 'reserved') {
    where.action = InterviewQuotaLedgerAction.RESERVE;
  }

  const [data, total] = await Promise.all([
    prisma.interviewQuotaLedger.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true
          }
        },
        interview: {
          select: {
            id: true,
            token: true,
            status: true,
            quotaState: true,
            scheduledStartAt: true,
            candidate: {
              select: {
                name: true,
                email: true
              }
            },
            interviewer: {
              select: {
                username: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: getPaginationSkip(page, limit),
      take: limit
    }),
    prisma.interviewQuotaLedger.count({ where })
  ]);

  return {
    data: data.map((entry) => ({
      id: entry.id,
      action: entry.action,
      reason: entry.reason,
      deltaTotal: entry.deltaTotal,
      deltaReserved: entry.deltaReserved,
      deltaConsumed: entry.deltaConsumed,
      totalAfter: entry.totalAfter,
      reservedAfter: entry.reservedAfter,
      consumedAfter: entry.consumedAfter,
      availableAfter: entry.availableAfter,
      createdAt: entry.createdAt.toISOString(),
      createdBy: entry.createdBy
        ? {
            id: entry.createdBy.id,
            username: entry.createdBy.username
          }
        : null,
      interview: entry.interview
        ? {
            id: entry.interview.id,
            token: entry.interview.token,
            status: entry.interview.status,
            quotaState: entry.interview.quotaState,
            scheduledStartAt: entry.interview.scheduledStartAt?.toISOString() ?? null,
            candidate: entry.interview.candidate,
            interviewer: entry.interview.interviewer
          }
        : null
    })),
    pagination: calculatePagination(page, limit, total)
  };
}
