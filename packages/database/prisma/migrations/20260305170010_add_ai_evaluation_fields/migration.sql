-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "aiEvaluatedAt" TIMESTAMP(3),
ADD COLUMN     "aiEvaluationDetails" JSONB,
ADD COLUMN     "aiEvaluationError" TEXT,
ADD COLUMN     "aiEvaluationRaw" TEXT,
ADD COLUMN     "aiEvaluationRetries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiEvaluationScore" DOUBLE PRECISION,
ADD COLUMN     "aiEvaluationStatus" TEXT;
