CREATE TABLE "PromptTemplate" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT 'v1',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "level" TEXT NOT NULL DEFAULT 'L1',
  "body" TEXT NOT NULL,
  "outputSchema" JSONB,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiTask" (
  "id" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'L1',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "promptCode" TEXT,
  "promptVersion" TEXT,
  "inputSummary" JSONB NOT NULL,
  "output" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "dataSentToCloud" BOOLEAN NOT NULL DEFAULT false,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromptTemplate_code_version_key" ON "PromptTemplate"("code", "version");
CREATE INDEX "PromptTemplate_code_status_updatedAt_idx" ON "PromptTemplate"("code", "status", "updatedAt");
CREATE INDEX "PromptTemplate_module_status_updatedAt_idx" ON "PromptTemplate"("module", "status", "updatedAt");
CREATE INDEX "AiTask_createdById_createdAt_idx" ON "AiTask"("createdById", "createdAt");
CREATE INDEX "AiTask_module_status_createdAt_idx" ON "AiTask"("module", "status", "createdAt");
CREATE INDEX "AiTask_provider_createdAt_idx" ON "AiTask"("provider", "createdAt");
CREATE INDEX "AiTask_promptCode_promptVersion_idx" ON "AiTask"("promptCode", "promptVersion");

ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiTask" ADD CONSTRAINT "AiTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
