CREATE TABLE "AiCitation" (
  "id" TEXT NOT NULL,
  "aiTaskId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "knowledgeDocumentId" TEXT,
  "knowledgeChunkId" TEXT,
  "title" TEXT,
  "sourceName" TEXT,
  "version" TEXT,
  "locator" TEXT,
  "excerpt" TEXT,
  "confidence" DOUBLE PRECISION,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiCitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiCitation_aiTaskId_createdAt_idx" ON "AiCitation"("aiTaskId", "createdAt");
CREATE INDEX "AiCitation_sourceType_sourceId_idx" ON "AiCitation"("sourceType", "sourceId");
CREATE INDEX "AiCitation_knowledgeDocumentId_idx" ON "AiCitation"("knowledgeDocumentId");
CREATE INDEX "AiCitation_knowledgeChunkId_idx" ON "AiCitation"("knowledgeChunkId");

ALTER TABLE "AiCitation" ADD CONSTRAINT "AiCitation_aiTaskId_fkey" FOREIGN KEY ("aiTaskId") REFERENCES "AiTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCitation" ADD CONSTRAINT "AiCitation_knowledgeDocumentId_fkey" FOREIGN KEY ("knowledgeDocumentId") REFERENCES "KnowledgeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiCitation" ADD CONSTRAINT "AiCitation_knowledgeChunkId_fkey" FOREIGN KEY ("knowledgeChunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
