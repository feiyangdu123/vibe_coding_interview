-- Step 1: Convert columns to TEXT
ALTER TABLE "Problem" ALTER COLUMN "problemType" DROP DEFAULT;
ALTER TABLE "Problem" ALTER COLUMN "problemType" TYPE TEXT;

ALTER TABLE "ProblemTemplate" ALTER COLUMN "problemType" DROP DEFAULT;
ALTER TABLE "ProblemTemplate" ALTER COLUMN "problemType" TYPE TEXT;

ALTER TABLE "EvaluationCriteriaConfig" ALTER COLUMN "problemType" TYPE TEXT;

-- Step 2: Map old values to new values
UPDATE "Problem" SET "problemType" = CASE "problemType"
  WHEN 'ALGO_ML' THEN 'ALGORITHM_MODELING'
  WHEN 'UI_DEVELOPMENT' THEN 'FEATURE_DEV'
  WHEN 'BACKEND' THEN 'DEBUG_FIX'
  WHEN 'DATA_ANALYSIS' THEN 'DATA_PROCESSING'
  WHEN 'ML_ENGINEERING' THEN 'AGENT_DEV'
  WHEN 'RND' THEN 'ITERATION_REFACTOR'
  ELSE "problemType"
END;

UPDATE "ProblemTemplate" SET "problemType" = CASE "problemType"
  WHEN 'ALGO_ML' THEN 'ALGORITHM_MODELING'
  WHEN 'UI_DEVELOPMENT' THEN 'FEATURE_DEV'
  WHEN 'BACKEND' THEN 'DEBUG_FIX'
  WHEN 'DATA_ANALYSIS' THEN 'DATA_PROCESSING'
  WHEN 'ML_ENGINEERING' THEN 'AGENT_DEV'
  WHEN 'RND' THEN 'ITERATION_REFACTOR'
  ELSE "problemType"
END;

UPDATE "EvaluationCriteriaConfig" SET "problemType" = CASE "problemType"
  WHEN 'ALGO_ML' THEN 'ALGORITHM_MODELING'
  WHEN 'UI_DEVELOPMENT' THEN 'FEATURE_DEV'
  WHEN 'BACKEND' THEN 'DEBUG_FIX'
  WHEN 'DATA_ANALYSIS' THEN 'DATA_PROCESSING'
  WHEN 'ML_ENGINEERING' THEN 'AGENT_DEV'
  WHEN 'RND' THEN 'ITERATION_REFACTOR'
  ELSE "problemType"
END;

-- Step 3: Drop old enum, create new enum
DROP TYPE "ProblemType";

CREATE TYPE "ProblemType" AS ENUM (
  'ALGORITHM_MODELING',
  'FEATURE_DEV',
  'DEBUG_FIX',
  'DATA_PROCESSING',
  'AGENT_DEV',
  'ITERATION_REFACTOR',
  'PRODUCT_DESIGN'
);

-- Step 4: Convert columns back to enum
ALTER TABLE "Problem" ALTER COLUMN "problemType" TYPE "ProblemType" USING "problemType"::"ProblemType";
ALTER TABLE "Problem" ALTER COLUMN "problemType" SET DEFAULT 'FEATURE_DEV';

ALTER TABLE "ProblemTemplate" ALTER COLUMN "problemType" TYPE "ProblemType" USING "problemType"::"ProblemType";
ALTER TABLE "ProblemTemplate" ALTER COLUMN "problemType" SET DEFAULT 'FEATURE_DEV';

ALTER TABLE "EvaluationCriteriaConfig" ALTER COLUMN "problemType" TYPE "ProblemType" USING "problemType"::"ProblemType";
