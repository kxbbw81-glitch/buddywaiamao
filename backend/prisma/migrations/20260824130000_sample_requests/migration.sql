CREATE TABLE "SampleRequest" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quoteId" TEXT,
  "salesOrderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "quantity" DECIMAL(18,2) NOT NULL DEFAULT 1,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "estimatedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "shippingAddress" TEXT,
  "courier" TEXT,
  "trackingNo" TEXT,
  "feedback" JSONB,
  "note" TEXT,
  "ownerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SampleRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SampleRequest_ownerId_updatedAt_idx" ON "SampleRequest"("ownerId", "updatedAt");
CREATE INDEX "SampleRequest_customerId_updatedAt_idx" ON "SampleRequest"("customerId", "updatedAt");
CREATE INDEX "SampleRequest_productId_updatedAt_idx" ON "SampleRequest"("productId", "updatedAt");
CREATE INDEX "SampleRequest_status_updatedAt_idx" ON "SampleRequest"("status", "updatedAt");

ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
