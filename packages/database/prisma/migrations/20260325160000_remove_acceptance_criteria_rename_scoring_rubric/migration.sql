-- AlterTable: Remove acceptanceCriteria and rename evaluationInstructionsText to scoringRubric
ALTER TABLE "Problem" DROP COLUMN IF EXISTS "acceptanceCriteria";
ALTER TABLE "Problem" RENAME COLUMN "evaluationInstructionsText" TO "scoringRubric";

ALTER TABLE "ProblemTemplate" DROP COLUMN IF EXISTS "acceptanceCriteria";
ALTER TABLE "ProblemTemplate" RENAME COLUMN "evaluationInstructionsText" TO "scoringRubric";
