-- Step 1: Add PLATFORM_ADMIN to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';

-- Step 2: Make User.organizationId optional
ALTER TABLE "User" ALTER COLUMN "organizationId" DROP NOT NULL;

-- Step 3: Replace ProblemType enum
-- Since PostgreSQL requires new enum values to be committed before use,
-- we recreate the enum type entirely.

-- First, drop defaults that reference the old enum
ALTER TABLE "Problem" ALTER COLUMN "problemType" DROP DEFAULT;
ALTER TABLE "ProblemTemplate" ALTER COLUMN "problemType" DROP DEFAULT;

-- Convert columns to text temporarily
ALTER TABLE "Problem" ALTER COLUMN "problemType" TYPE TEXT USING "problemType"::TEXT;
ALTER TABLE "ProblemTemplate" ALTER COLUMN "problemType" TYPE TEXT USING "problemType"::TEXT;

-- Migrate data while it's text
UPDATE "Problem" SET "problemType" = 'BACKEND' WHERE "problemType" = 'CODING';
UPDATE "Problem" SET "problemType" = 'BACKEND' WHERE "problemType" = 'SYSTEM_DESIGN';
UPDATE "Problem" SET "problemType" = 'ALGO_ML' WHERE "problemType" = 'ALGORITHM';
UPDATE "Problem" SET "problemType" = 'RND' WHERE "problemType" = 'DEBUGGING';

UPDATE "ProblemTemplate" SET "problemType" = 'BACKEND' WHERE "problemType" = 'CODING';
UPDATE "ProblemTemplate" SET "problemType" = 'BACKEND' WHERE "problemType" = 'SYSTEM_DESIGN';
UPDATE "ProblemTemplate" SET "problemType" = 'ALGO_ML' WHERE "problemType" = 'ALGORITHM';
UPDATE "ProblemTemplate" SET "problemType" = 'RND' WHERE "problemType" = 'DEBUGGING';

-- Drop old enum and create new one
DROP TYPE "ProblemType";
CREATE TYPE "ProblemType" AS ENUM ('ALGO_ML', 'UI_DEVELOPMENT', 'BACKEND', 'DATA_ANALYSIS', 'ML_ENGINEERING', 'RND');

-- Convert columns back to enum type
ALTER TABLE "Problem" ALTER COLUMN "problemType" TYPE "ProblemType" USING "problemType"::"ProblemType";
ALTER TABLE "Problem" ALTER COLUMN "problemType" SET DEFAULT 'BACKEND';

ALTER TABLE "ProblemTemplate" ALTER COLUMN "problemType" TYPE "ProblemType" USING "problemType"::"ProblemType";
ALTER TABLE "ProblemTemplate" ALTER COLUMN "problemType" SET DEFAULT 'BACKEND';

-- Step 4: Create EvaluationCriteriaConfig table
CREATE TABLE "EvaluationCriteriaConfig" (
    "id" TEXT NOT NULL,
    "problemType" "ProblemType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "dimensions" JSONB NOT NULL,
    "promptTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationCriteriaConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvaluationCriteriaConfig_problemType_key" ON "EvaluationCriteriaConfig"("problemType");
