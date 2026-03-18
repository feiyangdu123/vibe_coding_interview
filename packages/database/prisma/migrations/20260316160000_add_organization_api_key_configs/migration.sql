CREATE TABLE "OrganizationApiKeyConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "isSelected" BOOLEAN NOT NULL DEFAULT false,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationApiKeyConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrganizationApiKeyConfig"
ADD CONSTRAINT "OrganizationApiKeyConfig_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OrganizationApiKeyConfig_organizationId_idx" ON "OrganizationApiKeyConfig"("organizationId");
CREATE INDEX "OrganizationApiKeyConfig_organizationId_isSelected_idx" ON "OrganizationApiKeyConfig"("organizationId", "isSelected");
CREATE INDEX "OrganizationApiKeyConfig_lastUsedAt_idx" ON "OrganizationApiKeyConfig"("lastUsedAt");
CREATE UNIQUE INDEX "OrganizationApiKeyConfig_selected_per_org_key"
ON "OrganizationApiKeyConfig"("organizationId")
WHERE "isSelected" = true;
