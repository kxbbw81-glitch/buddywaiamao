ALTER TABLE "QuoteVersion"
  ADD COLUMN "lockStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedById" TEXT,
  ADD COLUMN "pdfSnapshot" JSONB;

CREATE INDEX "QuoteVersion_lockStatus_createdAt_idx" ON "QuoteVersion"("lockStatus", "createdAt");

CREATE TABLE "QuoteApproval" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "quoteVersionId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'LOW_MARGIN',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteApproval_quoteId_status_idx" ON "QuoteApproval"("quoteId", "status");
CREATE INDEX "QuoteApproval_quoteVersionId_status_idx" ON "QuoteApproval"("quoteVersionId", "status");
CREATE INDEX "QuoteApproval_requestedById_createdAt_idx" ON "QuoteApproval"("requestedById", "createdAt");
