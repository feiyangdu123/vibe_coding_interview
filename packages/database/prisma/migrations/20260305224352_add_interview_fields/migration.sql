-- AlterTable
ALTER TABLE "Interview" ADD COLUMN "dataDir" TEXT;
ALTER TABLE "Interview" ADD COLUMN "healthStatus" TEXT;
ALTER TABLE "Interview" ADD COLUMN "lastHealthCheck" TIMESTAMP(3);
ALTER TABLE "Interview" ADD COLUMN "processError" TEXT;
