-- AlterTable
ALTER TABLE "Problem" DROP COLUMN IF EXISTS "language",
DROP COLUMN IF EXISTS "roleTrack";

-- AlterTable
ALTER TABLE "ProblemTemplate" DROP COLUMN IF EXISTS "language",
DROP COLUMN IF EXISTS "roleTrack",
DROP COLUMN IF EXISTS "slug";

-- DropIndex
DROP INDEX IF EXISTS "ProblemTemplate_slug_key";
