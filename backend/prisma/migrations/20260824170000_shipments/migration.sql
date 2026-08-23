CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SHIPPED',
  "transportMode" TEXT NOT NULL,
  "carrier" TEXT,
  "trackingNo" TEXT,
  "bookingNo" TEXT,
  "billOfLadingNo" TEXT,
  "containerNo" TEXT,
  "etd" TIMESTAMP(3) NOT NULL,
  "atd" TIMESTAMP(3) NOT NULL,
  "eta" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Shipment_salesOrderId_status_idx" ON "Shipment"("salesOrderId", "status");
CREATE INDEX "Shipment_customerId_createdAt_idx" ON "Shipment"("customerId", "createdAt");
CREATE INDEX "Shipment_status_createdAt_idx" ON "Shipment"("status", "createdAt");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
