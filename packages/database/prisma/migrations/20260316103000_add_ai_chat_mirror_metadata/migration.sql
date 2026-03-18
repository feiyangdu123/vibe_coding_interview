ALTER TABLE "Interview"
ADD COLUMN "aiChatMirrorSourceSessionId" TEXT,
ADD COLUMN "aiChatMirrorSessionId" TEXT,
ADD COLUMN "aiChatMirrorLastCandidateMessageAt" TIMESTAMP(3),
ADD COLUMN "aiChatMirrorLastUsedAt" TIMESTAMP(3);

CREATE INDEX "Interview_aiChatMirrorLastUsedAt_idx" ON "Interview"("aiChatMirrorLastUsedAt");
