# NexFab AI CRM V2.0 报价规则迁移说明

> 本文说明从 Excel V2 到后端报价规则版本的迁移边界。

## 1. 迁移策略

1. 先只读审计 Excel，不直接导入正式规则。
2. 对命名区域、产品、费用项、公式、数据验证做结构化检查。
3. 脏数据返回 BLOCKED，并给清洗原因。
4. 清洗后只生成规则草稿。
5. 经理/管理员审核后，才可发布 ACTIVE `QuoteRuleSet`。

## 2. 当前证据

- 审计说明：`docs/QUOTATION_V2_AUDIT.md`
- 报价规则：`docs/QUOTATION_RULES.md`
- 审计实现：`backend/src/quote-excel-audit.mjs`
- 报价引擎：`backend/src/quote-engine.mjs`
- 规则版本测试：`backend/test/p2-quote-rules-smoke.mjs`
- Excel 审计测试：`backend/test/p2-excel-audit-smoke.mjs`

## 3. 当前缺口

| 缺口 | 是否阻断当前主链路 | 后续处理 |
| --- | --- | --- |
| 标准 Excel 导入模板未定版 | 否 | P1/P2 增强 |
| 自动创建 ACTIVE 规则需人工审核流程 | 否 | 已有规则/审批基础上最小补齐 |
| 多物流报价源真实接入 | 否 | P3 连接器授权后接入 |
| 多币种实时汇率源 | 否 | 先用手工/台账，后续接汇率连接器 |

## 4. 验收命令

```bash
cd backend
npm run test:p2-excel-audit
npm run test:p2-quote-rules
npm run test:p2-quote-lock
```
