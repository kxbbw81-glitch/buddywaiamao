CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED');

CREATE TABLE "SalesOrder" (
  "id" TEXT NOT NULL,
  "orderNo" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdById" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "productId" TEXT,
  "sku" TEXT,
  "name" TEXT NOT NULL,
  "quantity" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FulfillmentEvent" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "type" "FulfillmentStatus" NOT NULL,
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FulfillmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "SalesOrder"("orderNo");
CREATE INDEX "SalesOrder_ownerId_updatedAt_idx" ON "SalesOrder"("ownerId", "updatedAt");
CREATE INDEX "SalesOrder_customerId_updatedAt_idx" ON "SalesOrder"("customerId", "updatedAt");
CREATE INDEX "SalesOrder_quoteId_updatedAt_idx" ON "SalesOrder"("quoteId", "updatedAt");
CREATE INDEX "OrderItem_salesOrderId_idx" ON "OrderItem"("salesOrderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "FulfillmentEvent_salesOrderId_createdAt_idx" ON "FulfillmentEvent"("salesOrderId", "createdAt");

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FulfillmentEvent" ADD CONSTRAINT "FulfillmentEvent_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentEvent" ADD CONSTRAINT "FulfillmentEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
