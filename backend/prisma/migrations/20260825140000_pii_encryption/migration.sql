-- P0 PII static encryption compatibility fields.
-- Existing plaintext columns are retained for phased migration/backward-compatible reads.
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "emailCiphertext" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "phoneCiphertext" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "emailHash" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "phoneHash" TEXT;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailCiphertext" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "phoneCiphertext" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailHash" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "phoneHash" TEXT;

CREATE INDEX IF NOT EXISTS "Contact_emailHash_idx" ON "Contact"("emailHash");
CREATE INDEX IF NOT EXISTS "Contact_phoneHash_idx" ON "Contact"("phoneHash");
CREATE INDEX IF NOT EXISTS "Lead_emailHash_idx" ON "Lead"("emailHash");
CREATE INDEX IF NOT EXISTS "Lead_phoneHash_idx" ON "Lead"("phoneHash");
