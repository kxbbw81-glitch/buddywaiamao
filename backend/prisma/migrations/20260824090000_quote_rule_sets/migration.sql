CREATE TABLE "QuoteRuleSet" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "source" TEXT,
  "rules" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteRuleSet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRuleSet_code_key" ON "QuoteRuleSet"("code");
CREATE INDEX "QuoteRuleSet_status_updatedAt_idx" ON "QuoteRuleSet"("status", "updatedAt");
CREATE INDEX "QuoteRuleSet_createdById_updatedAt_idx" ON "QuoteRuleSet"("createdById", "updatedAt");

ALTER TABLE "QuoteRuleSet"
  ADD CONSTRAINT "QuoteRuleSet_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
