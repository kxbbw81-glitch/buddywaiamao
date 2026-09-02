# NexFab AI CRM V2.0 报价规则说明

> 本文是 V2.0 指定文档入口，落点是当前后端规则版本与确定性报价引擎。

## 1. 原则

- 报价计算必须确定、可复算、可审计。
- AI 只能解释、生成草稿或提示风险，不能绕过规则和审批。
- EXW / FOB / CIF / DDP 必须由结构化费用项和规则版本计算。
- 文本费用项必须拒绝，不能参与数值求和。

## 2. 当前可复用实现

| 能力 | 文件 / 模型 | 测试 |
| --- | --- | --- |
| 规则版本 | `QuoteRuleSet` | `test:p2-quote-rules` |
| 报价计算 | `backend/src/quote-engine.mjs` | `test:p2-quote-rules` |
| 报价接口 | `backend/src/quote-routes.mjs` | `test:p2-quote` |
| 低毛利审批 | `QuoteApproval`、`quote-routes.mjs` | `test:p2-quote-lock` |
| PDF 与发送留痕 | `quote-pdf.mjs`、`CommunicationEvent` | `test:p2-quote-send` |

## 3. 最小字段口径

规则版本至少应包含：产品、币种、贸易条款、成本项、包装成本、物流/税费、MOQ、数量阶梯、目标毛利、审批阈值、有效期、版本状态。

报价快照至少应保存：规则版本、输入参数、计算明细、币种、有效期、毛利率、审批结果、PDF 快照、发送留痕。

## 4. 风险控制

- 低于成本：硬拦截。
- 低毛利：进入审批，审批前不能锁定正式版本。
- 无产品 / 无汇率 / 无规则版本：返回明确错误。
- 越权访问：返回 403，不泄露其他团队数据。
- 正式外发：必须人工确认并写沟通时间线。
