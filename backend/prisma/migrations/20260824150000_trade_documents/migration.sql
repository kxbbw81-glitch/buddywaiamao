CREATE TABLE "TradeDocument" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "documentNo" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'GENERATED',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TradeDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradeDocument_salesOrderId_type_version_key" ON "TradeDocument"("salesOrderId", "type", "version");
CREATE INDEX "TradeDocument_salesOrderId_status_idx" ON "TradeDocument"("salesOrderId", "status");
CREATE INDEX "TradeDocument_customerId_createdAt_idx" ON "TradeDocument"("customerId", "createdAt");
CREATE INDEX "TradeDocument_type_status_createdAt_idx" ON "TradeDocument"("type", "status", "createdAt");

ALTER TABLE "TradeDocument" ADD CONSTRAINT "TradeDocument_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeDocument" ADD CONSTRAINT "TradeDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeDocument" ADD CONSTRAINT "TradeDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeDocument" ADD CONSTRAINT "TradeDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
