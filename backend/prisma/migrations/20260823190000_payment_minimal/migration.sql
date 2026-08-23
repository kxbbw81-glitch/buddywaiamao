CREATE TYPE "OrderPaymentStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'REJECTED');

CREATE TABLE "OrderPayment" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "OrderPaymentStatus" NOT NULL DEFAULT 'REGISTERED',
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "confirmedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderPayment_salesOrderId_status_idx" ON "OrderPayment"("salesOrderId", "status");
CREATE INDEX "OrderPayment_customerId_createdAt_idx" ON "OrderPayment"("customerId", "createdAt");
CREATE INDEX "OrderPayment_status_createdAt_idx" ON "OrderPayment"("status", "createdAt");

ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
