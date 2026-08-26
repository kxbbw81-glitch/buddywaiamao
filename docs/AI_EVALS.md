# NexFab AI CRM V2.0 AI 评测集说明

> 本文是 Prompt Eval 和 AI 输出质量评估入口。

## 1. 当前可复用实现

| 对象 | 用途 |
| --- | --- |
| `PromptEvalSet` | 评测集 |
| `PromptEvalCase` | 评测用例 |
| `AiCapabilityContract` | 绑定能力契约 |
| `AiOutputSchema` | 校验输出结构 |
| `AiTask` | 记录执行/失败/降级 |

实现文件：`backend/src/ai-gateway-routes.mjs`
验证命令：`npm run test:p2-ai-contract`

## 2. 第一版评测维度

- 是否符合输出 Schema。
- 是否泄露敏感字段。
- 是否要求人工确认。
- RAG 是否带来源。
- 资料不足时是否明确降级。
- 报价/毛利/审批场景是否不越权。

## 3. 当前边界

- 已有评测集与用例的模型和 smoke。
- 真实自动评测执行器、批量评分、Prompt A/B、线上质量看板后置。
- 未接真实模型时，可以用 fallback / dry-run 进行契约验证。
