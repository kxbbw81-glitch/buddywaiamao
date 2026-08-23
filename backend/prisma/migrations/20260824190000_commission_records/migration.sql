CREATE TABLE "CommissionRecord" (
  "id" TEXT NOT NULL,
  "salesId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "rate" DECIMAL(8,6) NOT NULL,
  "orderCount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "confirmedPaidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "outstandingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "commissionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "potentialCommission" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'CALCULATED',
  "snapshot" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionRecord_salesId_createdAt_idx" ON "CommissionRecord"("salesId", "createdAt");
CREATE INDEX "CommissionRecord_status_createdAt_idx" ON "CommissionRecord"("status", "createdAt");
CREATE INDEX "CommissionRecord_periodStart_periodEnd_idx" ON "CommissionRecord"("periodStart", "periodEnd");

ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
