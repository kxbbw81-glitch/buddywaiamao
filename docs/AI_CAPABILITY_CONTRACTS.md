# NexFab AI CRM V2.0 AI 能力契约

> 本文是 AI 能力契约入口，目标是让 AI 功能有边界、有 Schema、有审计。

## 1. 当前可复用实现

| 能力 | 证据 |
| --- | --- |
| 能力契约 | `AiCapabilityContract` |
| 输出 Schema | `AiOutputSchema` |
| Prompt 模板 | `PromptTemplate` |
| Gateway 执行 | `backend/src/ai-gateway-routes.mjs` |
| 失败留痕 | `AiTask` |
| 测试 | `npm run test:p2-ai-contract`、`npm run test:p2-ai-gateway` |

## 2. 契约规则

- ACTIVE 能力契约必须绑定 Prompt 和输出 Schema。
- 输出不符合 Schema 必须失败并写 `AiTask`，不得静默进入业务。
- L1-L4 均不允许取消人工确认。
- L5 自动业务决策禁止。
- finance 不能维护 Prompt / Schema / 能力契约。

## 3. 第一版能力清单

| capabilityCode | 业务价值 | 当前建议 |
| --- | --- | --- |
| `lead_summary` | 帮销售快速理解询盘 | 开发/保留 |
| `lead_score_explain` | 解释线索评分，不直接决定归属 | 开发/保留 |
| `quote_draft_assist` | 辅助报价单文案和风险解释 | 开发/保留 |
| `rag_answer` | 基于知识库回答产品/流程问题 | 开发/保留 |
| `document_summary` | 单证/合同摘要 | 可后续增强 |
| `external_tool_call` | 邮件/表格/物流等工具调用 | 仅台账 + 人工批准 |
