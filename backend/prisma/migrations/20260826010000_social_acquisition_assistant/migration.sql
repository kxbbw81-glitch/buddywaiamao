-- P3-B 社媒获客：只记录合规账号、草稿、人工审核与互动意图；不保存平台密钥，也不执行外部发布。
CREATE TABLE "SocialAccount" (
  "id" TEXT NOT NULL,
  "integrationConnectionId" TEXT,
  "platform" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "accountRef" TEXT,
  "fallbackMode" TEXT NOT NULL DEFAULT 'MANUAL_PUBLISH',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPost" (
  "id" TEXT NOT NULL,
  "socialAccountId" TEXT,
  "platform" TEXT NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "contentType" TEXT NOT NULL DEFAULT 'POST',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "campaignCode" TEXT,
  "utm" JSONB,
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "approvalNote" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInteraction" (
  "id" TEXT NOT NULL,
  "socialAccountId" TEXT,
  "socialPostId" TEXT,
  "platform" TEXT NOT NULL,
  "interactionType" TEXT NOT NULL,
  "externalRef" TEXT,
  "authorAlias" TEXT,
  "content" TEXT NOT NULL,
  "intent" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  "proposedReply" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "leadId" TEXT,
  "campaignCode" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialInteraction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialAccount_integrationConnectionId_key" ON "SocialAccount"("integrationConnectionId");
CREATE UNIQUE INDEX "SocialAccount_platform_accountRef_key" ON "SocialAccount"("platform", "accountRef");
CREATE UNIQUE INDEX "SocialInteraction_platform_externalRef_key" ON "SocialInteraction"("platform", "externalRef");
CREATE INDEX "SocialAccount_platform_status_updatedAt_idx" ON "SocialAccount"("platform", "status", "updatedAt");
CREATE INDEX "SocialAccount_createdById_createdAt_idx" ON "SocialAccount"("createdById", "createdAt");
CREATE INDEX "SocialPost_platform_status_scheduledAt_idx" ON "SocialPost"("platform", "status", "scheduledAt");
CREATE INDEX "SocialPost_campaignCode_createdAt_idx" ON "SocialPost"("campaignCode", "createdAt");
CREATE INDEX "SocialPost_createdById_createdAt_idx" ON "SocialPost"("createdById", "createdAt");
CREATE INDEX "SocialInteraction_platform_intent_status_createdAt_idx" ON "SocialInteraction"("platform", "intent", "status", "createdAt");
CREATE INDEX "SocialInteraction_leadId_createdAt_idx" ON "SocialInteraction"("leadId", "createdAt");
CREATE INDEX "SocialInteraction_campaignCode_createdAt_idx" ON "SocialInteraction"("campaignCode", "createdAt");

ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialInteraction" ADD CONSTRAINT "SocialInteraction_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialInteraction" ADD CONSTRAINT "SocialInteraction_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialInteraction" ADD CONSTRAINT "SocialInteraction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialInteraction" ADD CONSTRAINT "SocialInteraction_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
