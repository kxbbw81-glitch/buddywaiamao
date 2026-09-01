-- 修复说明：[低危-会话安全] User 补 tokenVersion（登出撤销旧会话）。
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
-- 修复说明：[中危-性能] User.teamId 索引。
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
-- 修复说明：[中危-数据一致性] 并发重复转单/重复结算兜底。
CREATE UNIQUE INDEX "SalesOrder_quoteId_key" ON "SalesOrder"("quoteId");
CREATE UNIQUE INDEX "CommissionRecord_salesId_currency_periodStart_periodEnd_key" ON "CommissionRecord"("salesId", "currency", "periodStart", "periodEnd");
-- 修复说明：[低危-性能] WebhookEvent.externalEventId 索引。
CREATE INDEX "WebhookEvent_externalEventId_idx" ON "WebhookEvent"("externalEventId");
-- 修复说明：[中危-数据一致性] QuoteApproval 补外键。
ALTER TABLE "QuoteApproval" ADD CONSTRAINT "QuoteApproval_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteApproval" ADD CONSTRAINT "QuoteApproval_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteApproval" ADD CONSTRAINT "QuoteApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteApproval" ADD CONSTRAINT "QuoteApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
