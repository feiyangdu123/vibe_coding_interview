CREATE TYPE "ProblemType" AS ENUM ('PRACTICAL');

CREATE TYPE "ProblemDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

ALTER TABLE "Problem"
ADD COLUMN "type" "ProblemType" NOT NULL DEFAULT 'PRACTICAL',
ADD COLUMN "difficulty" "ProblemDifficulty" NOT NULL DEFAULT 'MEDIUM';
