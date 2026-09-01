CREATE TABLE "ToolCall" (
  "id" TEXT NOT NULL,
  "aiTaskId" TEXT,
  "module" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "inputSummary" JSONB NOT NULL,
  "executionResult" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "externalRequestId" TEXT,
  "requiresHumanConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "confirmedById" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ToolCall_aiTaskId_createdAt_idx" ON "ToolCall"("aiTaskId", "createdAt");
CREATE INDEX "ToolCall_module_status_createdAt_idx" ON "ToolCall"("module", "status", "createdAt");
CREATE INDEX "ToolCall_toolName_action_status_idx" ON "ToolCall"("toolName", "action", "status");
CREATE INDEX "ToolCall_createdById_createdAt_idx" ON "ToolCall"("createdById", "createdAt");
CREATE INDEX "ToolCall_confirmedById_confirmedAt_idx" ON "ToolCall"("confirmedById", "confirmedAt");

ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_aiTaskId_fkey" FOREIGN KEY ("aiTaskId") REFERENCES "AiTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
