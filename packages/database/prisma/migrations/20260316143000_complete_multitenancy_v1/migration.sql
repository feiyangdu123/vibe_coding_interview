ALTER TABLE "Organization"
ADD COLUMN "slug" TEXT;

INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('default-org-id', 'Default Organization', 'default-org', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

UPDATE "Organization"
SET "slug" = CASE
  WHEN "id" = 'default-org-id' THEN 'default-org'
  ELSE CONCAT('org-', SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 8))
END
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "Organization"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

ALTER TABLE "Candidate"
ADD COLUMN "organizationId" TEXT;

UPDATE "Candidate"
SET "organizationId" = 'default-org-id'
WHERE "organizationId" IS NULL;

ALTER TABLE "Candidate"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Candidate"
ADD CONSTRAINT "Candidate_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "Candidate_email_key";

CREATE UNIQUE INDEX "Candidate_organizationId_email_key" ON "Candidate"("organizationId", "email");
CREATE INDEX "Candidate_organizationId_idx" ON "Candidate"("organizationId");

CREATE TABLE "ProblemTemplate" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "requirements" TEXT NOT NULL,
  "scoringCriteria" JSONB NOT NULL,
  "workDirTemplate" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "problemType" "ProblemType" NOT NULL DEFAULT 'CODING',
  "roleTrack" TEXT,
  "difficulty" TEXT,
  "language" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "evaluationInstructionsText" TEXT,
  "acceptanceCriteria" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProblemTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProblemTemplate_slug_key" ON "ProblemTemplate"("slug");
CREATE INDEX "ProblemTemplate_isActive_idx" ON "ProblemTemplate"("isActive");
CREATE INDEX "ProblemTemplate_problemType_idx" ON "ProblemTemplate"("problemType");
