-- CreateEnum
CREATE TYPE "InterviewQuotaState" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "InterviewQuotaLedgerAction" AS ENUM ('GRANT', 'RESERVE', 'CONSUME', 'RELEASE', 'ADJUST');

-- CreateEnum
CREATE TYPE "InterviewQuotaLedgerReason" AS ENUM ('ORGANIZATION_CREATED', 'INTERVIEW_CREATED', 'INTERVIEW_COMPLETED', 'INTERVIEW_CANCELLED', 'CANDIDATE_NO_SHOW', 'SYSTEM_VOID', 'MANUAL_ADJUSTMENT', 'MIGRATION_BACKFILL');

-- AlterEnum
ALTER TYPE "EndReason" ADD VALUE 'CANCELLED_BY_ORG';
ALTER TYPE "EndReason" ADD VALUE 'CANDIDATE_NO_SHOW';

-- AlterEnum
ALTER TYPE "InterviewEventType" ADD VALUE 'CANCELLED';
ALTER TYPE "InterviewEventType" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "Interview"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "joinDeadlineAt" TIMESTAMP(3),
ADD COLUMN "joinWindowOpensAt" TIMESTAMP(3),
ADD COLUMN "quotaReservedAt" TIMESTAMP(3),
ADD COLUMN "quotaSettledAt" TIMESTAMP(3),
ADD COLUMN "quotaState" "InterviewQuotaState",
ADD COLUMN "scheduledStartAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InterviewDraft" ADD COLUMN "scheduledStartAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrganizationInterviewQuota" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "totalGranted" INTEGER NOT NULL DEFAULT 500,
    "reservedCount" INTEGER NOT NULL DEFAULT 0,
    "consumedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInterviewQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewQuotaLedger" (
    "id" TEXT NOT NULL,
    "organizationQuotaId" TEXT NOT NULL,
    "interviewId" TEXT,
    "createdById" TEXT,
    "action" "InterviewQuotaLedgerAction" NOT NULL,
    "reason" "InterviewQuotaLedgerReason" NOT NULL,
    "deltaTotal" INTEGER NOT NULL DEFAULT 0,
    "deltaReserved" INTEGER NOT NULL DEFAULT 0,
    "deltaConsumed" INTEGER NOT NULL DEFAULT 0,
    "totalAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "consumedAfter" INTEGER NOT NULL,
    "availableAfter" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewQuotaLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInterviewQuota_organizationId_key" ON "OrganizationInterviewQuota"("organizationId");

-- CreateIndex
CREATE INDEX "InterviewQuotaLedger_organizationQuotaId_createdAt_idx" ON "InterviewQuotaLedger"("organizationQuotaId", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewQuotaLedger_interviewId_idx" ON "InterviewQuotaLedger"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewQuotaLedger_createdById_idx" ON "InterviewQuotaLedger"("createdById");

-- CreateIndex
CREATE INDEX "Interview_scheduledStartAt_idx" ON "Interview"("scheduledStartAt");

-- CreateIndex
CREATE INDEX "Interview_joinDeadlineAt_idx" ON "Interview"("joinDeadlineAt");

-- CreateIndex
CREATE INDEX "Interview_quotaState_idx" ON "Interview"("quotaState");

-- AddForeignKey
ALTER TABLE "OrganizationInterviewQuota" ADD CONSTRAINT "OrganizationInterviewQuota_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuotaLedger" ADD CONSTRAINT "InterviewQuotaLedger_organizationQuotaId_fkey" FOREIGN KEY ("organizationQuotaId") REFERENCES "OrganizationInterviewQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuotaLedger" ADD CONSTRAINT "InterviewQuotaLedger_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuotaLedger" ADD CONSTRAINT "InterviewQuotaLedger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill quota rows for existing organizations.
INSERT INTO "OrganizationInterviewQuota" ("id", "organizationId", "totalGranted", "reservedCount", "consumedCount", "createdAt", "updatedAt")
SELECT
  'quota-' || o."id",
  o."id",
  500,
  0,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
LEFT JOIN "OrganizationInterviewQuota" q ON q."organizationId" = o."id"
WHERE q."organizationId" IS NULL;

-- Backfill schedule windows for existing interviews.
UPDATE "Interview"
SET
  "scheduledStartAt" = COALESCE("scheduledStartAt", "createdAt"),
  "joinWindowOpensAt" = COALESCE("joinWindowOpensAt", "createdAt" - INTERVAL '15 minutes'),
  "joinDeadlineAt" = COALESCE("joinDeadlineAt", "createdAt" + INTERVAL '30 minutes')
WHERE "scheduledStartAt" IS NULL
   OR "joinWindowOpensAt" IS NULL
   OR "joinDeadlineAt" IS NULL;

-- Backfill quota state per interview.
UPDATE "Interview"
SET
  "quotaState" = 'RESERVED',
  "quotaReservedAt" = COALESCE("quotaReservedAt", "createdAt")
WHERE "status" IN ('PENDING', 'IN_PROGRESS')
  AND "quotaState" IS NULL;

UPDATE "Interview"
SET
  "quotaState" = 'CONSUMED',
  "quotaReservedAt" = COALESCE("quotaReservedAt", "createdAt"),
  "quotaSettledAt" = COALESCE("quotaSettledAt", "submittedAt", "endTime", "createdAt")
WHERE "status" = 'COMPLETED'
  AND "endReason" IN ('TIME_UP', 'CANDIDATE_SUBMIT', 'INTERVIEWER_STOP')
  AND "quotaState" IS NULL;

UPDATE "Interview"
SET
  "quotaState" = 'RELEASED',
  "quotaReservedAt" = COALESCE("quotaReservedAt", "createdAt"),
  "quotaSettledAt" = COALESCE("quotaSettledAt", "cancelledAt", "endTime", "createdAt")
WHERE (
    "status" = 'CANCELLED'
    OR "endReason" = 'SYSTEM_ERROR'
  )
  AND "quotaState" IS NULL;

-- Backfill aggregate counters.
WITH interview_stats AS (
  SELECT
    i."organizationId",
    COUNT(*) FILTER (WHERE i."quotaState" = 'RESERVED')::INTEGER AS "reservedCount",
    COUNT(*) FILTER (WHERE i."quotaState" = 'CONSUMED')::INTEGER AS "consumedCount"
  FROM "Interview" i
  GROUP BY i."organizationId"
)
UPDATE "OrganizationInterviewQuota" q
SET
  "reservedCount" = stats."reservedCount",
  "consumedCount" = stats."consumedCount",
  "updatedAt" = CURRENT_TIMESTAMP
FROM interview_stats stats
WHERE q."organizationId" = stats."organizationId";

-- Seed an initial grant row and one migration snapshot row for auditability.
INSERT INTO "InterviewQuotaLedger" (
  "id",
  "organizationQuotaId",
  "action",
  "reason",
  "deltaTotal",
  "deltaReserved",
  "deltaConsumed",
  "totalAfter",
  "reservedAfter",
  "consumedAfter",
  "availableAfter",
  "metadata",
  "createdAt"
)
SELECT
  'quota-grant-' || q."organizationId",
  q."id",
  'GRANT',
  'ORGANIZATION_CREATED',
  q."totalGranted",
  0,
  0,
  q."totalGranted",
  0,
  0,
  q."totalGranted",
  jsonb_build_object('source', 'migration'),
  CURRENT_TIMESTAMP
FROM "OrganizationInterviewQuota" q
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "InterviewQuotaLedger" (
  "id",
  "organizationQuotaId",
  "action",
  "reason",
  "deltaTotal",
  "deltaReserved",
  "deltaConsumed",
  "totalAfter",
  "reservedAfter",
  "consumedAfter",
  "availableAfter",
  "metadata",
  "createdAt"
)
SELECT
  'quota-backfill-' || q."organizationId",
  q."id",
  'ADJUST',
  'MIGRATION_BACKFILL',
  0,
  q."reservedCount",
  q."consumedCount",
  q."totalGranted",
  q."reservedCount",
  q."consumedCount",
  q."totalGranted" - q."reservedCount" - q."consumedCount",
  jsonb_build_object('source', 'migration', 'note', 'Backfilled from existing interviews'),
  CURRENT_TIMESTAMP
FROM "OrganizationInterviewQuota" q
WHERE q."reservedCount" > 0 OR q."consumedCount" > 0
ON CONFLICT ("id") DO NOTHING;
