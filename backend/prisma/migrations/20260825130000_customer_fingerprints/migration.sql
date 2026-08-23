CREATE TABLE "CustomerFingerprint" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerFingerprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerFingerprint_type_normalized_key" ON "CustomerFingerprint"("type", "normalized");
CREATE INDEX "CustomerFingerprint_customerId_idx" ON "CustomerFingerprint"("customerId");
CREATE INDEX "CustomerFingerprint_type_normalized_idx" ON "CustomerFingerprint"("type", "normalized");

ALTER TABLE "CustomerFingerprint"
  ADD CONSTRAINT "CustomerFingerprint_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
