CREATE TABLE "AiPolicyRule" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "maxLevel" TEXT NOT NULL DEFAULT 'L3',
  "allowCloud" BOOLEAN NOT NULL DEFAULT false,
  "allowedProviders" JSONB,
  "allowedModels" JSONB,
  "blockedActions" JSONB NOT NULL,
  "requireHumanConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "dataScopePolicy" JSONB,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiPolicyRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCostLimit" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "period" TEXT NOT NULL DEFAULT 'MONTHLY',
  "provider" TEXT,
  "model" TEXT,
  "maxTokens" INTEGER NOT NULL DEFAULT 0,
  "maxCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "hardBlock" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiCostLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiPolicyRule_code_key" ON "AiPolicyRule"("code");
CREATE INDEX "AiPolicyRule_module_status_updatedAt_idx" ON "AiPolicyRule"("module", "status", "updatedAt");
CREATE INDEX "AiPolicyRule_maxLevel_status_idx" ON "AiPolicyRule"("maxLevel", "status");

CREATE UNIQUE INDEX "AiCostLimit_code_key" ON "AiCostLimit"("code");
CREATE INDEX "AiCostLimit_module_status_updatedAt_idx" ON "AiCostLimit"("module", "status", "updatedAt");
CREATE INDEX "AiCostLimit_provider_model_status_idx" ON "AiCostLimit"("provider", "model", "status");

ALTER TABLE "AiPolicyRule" ADD CONSTRAINT "AiPolicyRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiCostLimit" ADD CONSTRAINT "AiCostLimit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
