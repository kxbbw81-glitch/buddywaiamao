CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "schedule" JSONB,
  "condition" JSONB NOT NULL,
  "action" JSONB NOT NULL,
  "retryPolicy" JSONB,
  "dedupePolicy" JSONB,
  "requiresManualOverride" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'DRY_RUN',
  "status" TEXT NOT NULL DEFAULT 'DRY_RUN_RECORDED',
  "inputSummary" JSONB NOT NULL,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "proposedActions" JSONB NOT NULL,
  "executionResult" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "idempotencyKey" TEXT,
  "duplicatePrevented" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationRule_code_key" ON "AutomationRule"("code");
CREATE INDEX "AutomationRule_module_status_updatedAt_idx" ON "AutomationRule"("module", "status", "updatedAt");
CREATE INDEX "AutomationRule_triggerType_status_idx" ON "AutomationRule"("triggerType", "status");
CREATE INDEX "AutomationRule_createdById_createdAt_idx" ON "AutomationRule"("createdById", "createdAt");
CREATE UNIQUE INDEX "AutomationRun_ruleId_idempotencyKey_key" ON "AutomationRun"("ruleId", "idempotencyKey");
CREATE INDEX "AutomationRun_ruleId_createdAt_idx" ON "AutomationRun"("ruleId", "createdAt");
CREATE INDEX "AutomationRun_mode_status_createdAt_idx" ON "AutomationRun"("mode", "status", "createdAt");
CREATE INDEX "AutomationRun_createdById_createdAt_idx" ON "AutomationRun"("createdById", "createdAt");

ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
