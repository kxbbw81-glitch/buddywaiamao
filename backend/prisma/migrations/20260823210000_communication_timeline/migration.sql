CREATE TYPE "CommunicationEventType" AS ENUM ('CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'NOTE');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

CREATE TABLE "CommunicationEvent" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "opportunityId" TEXT,
  "type" "CommunicationEventType" NOT NULL,
  "direction" "CommunicationDirection" NOT NULL,
  "summary" TEXT NOT NULL,
  "content" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ownerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationEvent_ownerId_occurredAt_idx" ON "CommunicationEvent"("ownerId", "occurredAt");
CREATE INDEX "CommunicationEvent_customerId_occurredAt_idx" ON "CommunicationEvent"("customerId", "occurredAt");
CREATE INDEX "CommunicationEvent_opportunityId_occurredAt_idx" ON "CommunicationEvent"("opportunityId", "occurredAt");
CREATE INDEX "CommunicationEvent_type_occurredAt_idx" ON "CommunicationEvent"("type", "occurredAt");

ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
