# NexFab AI CRM V2.0 AI 治理说明

## 1. 总原则

AI 是助手，不是最终业务决策者。第一版禁止 L5 自动业务决策。

所有对外动作必须满足：

```text
草稿 → 人工确认 → 执行/人工记录 → 结果留痕 → 审计
```

## 2. 当前可复用实现

| 能力 | 文件 | 测试 |
| --- | --- | --- |
| AI Gateway / AiTask | `backend/src/ai-gateway-routes.mjs` | `test:p2-ai-gateway` |
| 能力契约 / Schema / Eval | `backend/src/ai-gateway-routes.mjs` | `test:p2-ai-contract` |
| 策略 / 成本限额 | `backend/src/ai-gateway-routes.mjs` | `test:p2-ai-policy` |
| 人工确认 / 反馈 / 纠错 | `backend/src/ai-gateway-routes.mjs` | `test:p2-ai-feedback` |
| RAG 来源引用 | `backend/src/rag-routes.mjs`、`backend/src/knowledge-routes.mjs` | `test:p2-rag`、`test:p2-ai-citation` |
| ToolCall 人工批准台账 | `backend/src/ai-gateway-routes.mjs` | `test:p2-tool-call` |
| 连接器 / Webhook 台账 | `backend/src/integration-routes.mjs` | `test:p2-integration` |
| 异步 AI 队列 / SSE | `backend/src/ai-queue.mjs`、`backend/src/ai-task-events.mjs` | `test:p2-ai-async-sse`、前端 P2 集成 |

## 3. AI 分级

| 级别 | 第一版策略 |
| --- | --- |
| L0 提示解释 | 允许 |
| L1 草稿生成 | 允许，必须人工确认 |
| L2 结构化提取 | 允许，正式写入前审核 |
| L3 规则辅助 | 允许，最终动作由规则和人工决定 |
| L4 工具调用 | 谨慎允许，白名单 + 人工确认 |
| L5 自动业务决策 | 禁止 |

## 4. RAG 防幻觉

- 只引用已审核、未过期资料。
- 回答必须带来源。
- 资料不足时明确不知道。
- 禁止编造参数、认证、价格或承诺。

## 5. P2 队列、流式与向量库边界

- 异步本地草稿通过 Redis/BullMQ 优先队列执行；只有非生产环境允许内存回退，生产无 Redis 必须显式拒绝而不是伪装为可靠队列。
- SSE 只输出脱敏后的任务状态、阶段和审计指标；前端使用同源 SSE，失败时回退到任务轮询。
- pgvector migration 位于 `backend/prisma/migrations/20260825160000_pgvector_knowledge_embeddings/`，仅为 `KnowledgeChunk.embedding` 建立 `vector(1536)` 与 cosine HNSW 索引；已在隔离的本地 PostgreSQL 16 + pgvector 测试库执行 `prisma migrate deploy`、`npm run p2:pgvector-preflight` 与 `NEXFAB_REAL_DB_E2E=true npm run test:p2-postgres-e2e`。
- 上述验收证明迁移、RAG 引用、SSE 和真实 Redis/BullMQ 队列可在本地测试基础设施协同运行；未启用真实 embedding/模型供应商，不能宣称真实模型效果或生产数据质量已完成。

## 6. 待授权的真实能力

- 真实模型供应商配置与密钥加密。
- Prompt Eval 真实执行器。
- AI 成本与 token 精细统计。
- 纠错回灌知识库流程。
