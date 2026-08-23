CREATE TABLE "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'FAQ',
  "sourceName" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT 'v1',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "language" TEXT NOT NULL DEFAULT 'zh-CN',
  "productId" TEXT,
  "validUntil" TIMESTAMP(3),
  "summary" TEXT,
  "createdById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "chunkNo" INTEGER NOT NULL,
  "heading" TEXT,
  "content" TEXT NOT NULL,
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeDocument_status_updatedAt_idx" ON "KnowledgeDocument"("status", "updatedAt");
CREATE INDEX "KnowledgeDocument_productId_updatedAt_idx" ON "KnowledgeDocument"("productId", "updatedAt");
CREATE INDEX "KnowledgeDocument_type_status_updatedAt_idx" ON "KnowledgeDocument"("type", "status", "updatedAt");
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkNo_key" ON "KnowledgeChunk"("documentId", "chunkNo");
CREATE INDEX "KnowledgeChunk_documentId_chunkNo_idx" ON "KnowledgeChunk"("documentId", "chunkNo");

ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
