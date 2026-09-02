# NexFab AI CRM V2.0 Prompt 注册表

> 本文是 Prompt 治理入口；当前只登记能力和证据，不写入任何真实密钥或敏感内容。

## 1. 原则

- Prompt 必须版本化、可审计、可回滚。
- 任何 L1-L4 AI 输出进入正式业务前必须人工确认。
- Prompt 输入摘要必须脱敏，不保存明文密码、token、key 或客户隐私。

## 2. 当前模型与实现

| 对象 | 用途 |
| --- | --- |
| `PromptTemplate` | Prompt 模板、版本、状态和适用模块 |
| `AiTask` | 每次 AI 调用/本地草稿/失败降级的审计记录 |
| `AiFeedback` | 采纳、驳回、纠错和人工处理反馈 |
| `AiPolicyRule` / `AiCostLimit` | 模块开关、成本和风险策略 |

实现文件：`backend/src/ai-gateway-routes.mjs`
相关文档：`docs/AI_GOVERNANCE.md`
验证命令：`npm run test:p2-ai-gateway`、`npm run test:p2-ai-feedback`、`npm run test:p2-ai-policy`

## 3. 第一版建议注册 Prompt

| code | 场景 | AI 等级 | 人工审核 |
| --- | --- | --- | --- |
| `lead_summary` | 线索/询盘摘要 | L1 | 必须 |
| `followup_suggestion` | 销售跟进建议 | L1 | 必须 |
| `quote_explanation` | 报价明细解释 | L1/L3 | 必须 |
| `email_draft` | 邮件/WhatsApp 回复草稿 | L1 | 必须 |
| `contract_summary` | 合同/单证摘要 | L1/L2 | 必须 |
| `rag_answer` | 知识库问答 | L1 | 必须带来源 |

## 4. 暂缓项

- 真实模型密钥配置。
- SSE 流式输出。
- 自动 Prompt Eval 执行器。
- 自动对外发送。
