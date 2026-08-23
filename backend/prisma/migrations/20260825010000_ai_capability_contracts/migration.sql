CREATE TABLE "AiOutputSchema" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT 'v1',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "schema" JSONB NOT NULL,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiOutputSchema_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCapabilityContract" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'L1',
  "version" TEXT NOT NULL DEFAULT 'v1',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scenario" TEXT NOT NULL,
  "inputSpec" JSONB NOT NULL,
  "permissionSpec" JSONB NOT NULL,
  "outputSpec" JSONB NOT NULL,
  "validationSpec" JSONB NOT NULL,
  "persistenceSpec" JSONB NOT NULL,
  "humanConfirmationSpec" JSONB NOT NULL,
  "forbiddenActions" JSONB NOT NULL,
  "fallbackSpec" JSONB NOT NULL,
  "auditSpec" JSONB NOT NULL,
  "evalSpec" JSONB NOT NULL,
  "promptCode" TEXT,
  "promptVersion" TEXT,
  "outputSchemaCode" TEXT,
  "outputSchemaVersion" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiCapabilityContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptEvalSet" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "promptCode" TEXT,
  "promptVersion" TEXT,
  "capabilityCode" TEXT,
  "capabilityVersion" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromptEvalSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptEvalCase" (
  "id" TEXT NOT NULL,
  "evalSetId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'NORMAL',
  "input" JSONB NOT NULL,
  "expected" JSONB NOT NULL,
  "expectedStatus" TEXT,
  "minConfidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromptEvalCase_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AiTask" ADD COLUMN "capabilityCode" TEXT;
ALTER TABLE "AiTask" ADD COLUMN "capabilityVersion" TEXT;
ALTER TABLE "AiTask" ADD COLUMN "outputSchemaCode" TEXT;
ALTER TABLE "AiTask" ADD COLUMN "outputSchemaVersion" TEXT;

CREATE UNIQUE INDEX "AiOutputSchema_code_version_key" ON "AiOutputSchema"("code", "version");
CREATE INDEX "AiOutputSchema_code_status_updatedAt_idx" ON "AiOutputSchema"("code", "status", "updatedAt");
CREATE INDEX "AiOutputSchema_module_status_updatedAt_idx" ON "AiOutputSchema"("module", "status", "updatedAt");

CREATE UNIQUE INDEX "AiCapabilityContract_code_version_key" ON "AiCapabilityContract"("code", "version");
CREATE INDEX "AiCapabilityContract_code_status_updatedAt_idx" ON "AiCapabilityContract"("code", "status", "updatedAt");
CREATE INDEX "AiCapabilityContract_module_status_updatedAt_idx" ON "AiCapabilityContract"("module", "status", "updatedAt");
CREATE INDEX "AiCapabilityContract_promptCode_promptVersion_idx" ON "AiCapabilityContract"("promptCode", "promptVersion");
CREATE INDEX "AiCapabilityContract_outputSchemaCode_outputSchemaVersion_idx" ON "AiCapabilityContract"("outputSchemaCode", "outputSchemaVersion");

CREATE UNIQUE INDEX "PromptEvalSet_code_key" ON "PromptEvalSet"("code");
CREATE INDEX "PromptEvalSet_module_status_updatedAt_idx" ON "PromptEvalSet"("module", "status", "updatedAt");
CREATE INDEX "PromptEvalSet_capabilityCode_capabilityVersion_idx" ON "PromptEvalSet"("capabilityCode", "capabilityVersion");
CREATE INDEX "PromptEvalSet_promptCode_promptVersion_idx" ON "PromptEvalSet"("promptCode", "promptVersion");
CREATE INDEX "PromptEvalCase_evalSetId_type_idx" ON "PromptEvalCase"("evalSetId", "type");

CREATE INDEX "AiTask_capabilityCode_capabilityVersion_idx" ON "AiTask"("capabilityCode", "capabilityVersion");
CREATE INDEX "AiTask_outputSchemaCode_outputSchemaVersion_idx" ON "AiTask"("outputSchemaCode", "outputSchemaVersion");

ALTER TABLE "AiOutputSchema" ADD CONSTRAINT "AiOutputSchema_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiCapabilityContract" ADD CONSTRAINT "AiCapabilityContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromptEvalSet" ADD CONSTRAINT "PromptEvalSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromptEvalCase" ADD CONSTRAINT "PromptEvalCase_evalSetId_fkey" FOREIGN KEY ("evalSetId") REFERENCES "PromptEvalSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
