# NexFab AI CRM V2.0 阶段0复用矩阵

> 日期：2026-08-25
> 基线：`a01389c0d62f7c33552774cdd0f60142cf46ec86`
> 目的：把当前发布仓库、交接 backend、V2.0 规范之间的关系说清楚，避免重复开发和平行重写。

## 1. 总结

当前正确工作树已经具备外贸 CRM V2.0 第一版的大部分后端主链路能力。阶段0结论不是“从零重写”，而是：

- **直接复用**：认证/RBAC、动态导航、CRM 主链路、产品、报价、样品、订单、回款、单证、物流、RAG、AI 治理、连接器台账等。
- **最小改造**：生产部署配置、正式前端联调、Excel V2 规则导入、真实 PostgreSQL/pgvector/队列/流式 AI 门禁。
- **需新建或补齐**：V2 指定的精确文档入口、报价规则治理文档、Prompt/AI 契约索引、集成治理文档。
- **暂缓**：真实第三方连接器、真实模型调用、OCR、NL2SQL、P95 性能、移动端精修、CI/CD 自动发布。


## 1.1 阶段0独立验证证据

阶段0已取得正确基线 backend 的独立验证证据：

| 验证项 | 结果 | 说明 |
| --- | --- | --- |
| `npm test` | PASS | 基础安全、导航、权限与数据范围测试通过 |
| `npm run test:smoke` | PASS | G1 客户/联系人/商机/跟进主链路 smoke 通过 |
| 24 个 `npm run test:p2-*` | PASS | P2 业务、报价、AI、集成等模块 smoke 全部通过 |

已确认的 24 个 `test:p2-*` 范围：

```text
test:p2-acquisition
test:p2-ai-citation
test:p2-ai-contract
test:p2-ai-feedback
test:p2-ai-gateway
test:p2-ai-policy
test:p2-automation
test:p2-commission
test:p2-dashboard
test:p2-excel-audit
test:p2-fulfillment-shipment
test:p2-integration
test:p2-order
test:p2-payment
test:p2-product
test:p2-quote
test:p2-quote-lock
test:p2-quote-rules
test:p2-quote-send
test:p2-rag
test:p2-sample
test:p2-timeline
test:p2-tool-call
test:p2-trade-document
```

注意：以上结果证明当前后端主链路和模块 smoke 具备可复用基础，但不等于 P0-P3 全部完成。P0-P3 仍必须按正式前端、生产配置、真实数据库、AI/连接器授权和发布门禁继续验收。

## 1.2 阶段0识别的真实缺口

| 缺口 | 所属阶段 | 是否阻断阶段0 | 处理原则 |
| --- | --- | --- | --- |
| 缺正式 Next.js 前端工程 | P0/P1 | 否 | 后端已可复用；下一步需建立正式前端并对接现有 API，不重造后端 |
| P0 PII 加密复核 | P0 | 否 | 复核客户、联系人、线索、AI 摘要和日志中敏感字段脱敏/加密边界 |
| 正式模板导入 | P1 | 否 | 先沿用 Excel 审计与规则草稿，后续补产品/报价/客户模板导入 |
| PostgreSQL + pgvector | P2 | 否 | 已完成隔离 PostgreSQL 16 + pgvector 的全迁移、预检和 RAG/SSE E2E；真实 embedding 供应商仍待授权 |
| BullMQ / 队列 | P2 | 否 | 已实现 Redis/BullMQ 优先队列；生产无 Redis 显式拒绝，开发/测试可见地回退内存 |
| SSE / 流式 AI | P2 | 否 | 已实现脱敏状态 SSE 和前端同源消费；真实 Redis 场景仍需独立环境验证 |
| 真实模型与真实连接器 | P2/P3 | 否 | 缺授权/凭据，不作为代码阻断；保持台账与人工确认 |
| P3 工程化：CI、移动端 | P3 | 否 | 已加入仅测试 CI、PWA 安装入口与移动导航；发布、备份监控、性能实测仍后续处理 |

## 2. 后端能力复用矩阵

| V2.0 能力块 | 当前发布仓库证据 | 交接 backend 复用结论 | 当前处理 |
| --- | --- | --- | --- |
| 认证 / 会话 | `backend/src/security.mjs`、`backend/src/server.mjs`、`npm test` | 可复用 | P0 直接复用 |
| 五角色 RBAC / 数据范围 | `backend/src/access.mjs`、`npm test` | 可复用 | P0 直接复用 |
| 后端动态导航 | `backend/src/navigation.mjs`、`npm test` | 可复用 | P0 直接复用 |
| 工作台 / Todo / Memo | `backend/src/dashboard-routes.mjs`、`test:p2-dashboard` | 可复用 | P0/P1 直接复用 |
| 客户 / 联系人 / 商机 / 跟进 | `backend/src/crm-routes.mjs`、`test:smoke` | 可复用 | P1 直接复用 |
| 获客 / 线索 / 询盘 / 查重 | `backend/src/acquisition-routes.mjs`、`backend/src/customer-fingerprint.mjs`、`test:p2-acquisition` | 可复用 | P1 直接复用，公海自动规则后续增强 |
| 产品 PIM / 产品资料 | `backend/src/product-routes.mjs`、`test:p2-product` | 可复用 | P1 直接复用 |
| 报价 / 规则 / 审批 / PDF / 发送 | `backend/src/quote-routes.mjs`、`backend/src/quote-engine.mjs`、`test:p2-quote*` | 可复用 | P1 直接复用，Excel 导入后续增强 |
| Excel V2 报价审计 | `backend/src/quote-excel-audit.mjs`、`test:p2-excel-audit` | 可复用 | P1/P2 作为迁移门禁，不作为运行时公式引擎 |
| 样品 / 样品转订单 | `backend/src/sample-routes.mjs`、`test:p2-sample` | 可复用 | P1 直接复用 |
| 订单 / 履约事件 | `backend/src/order-routes.mjs`、`test:p2-order` | 可复用 | P1 直接复用 |
| 回款 / 财务确认 | `backend/src/payment-routes.mjs`、`test:p2-payment` | 可复用 | P1 直接复用 |
| 单证 / 对账 | `backend/src/trade-document-routes.mjs`、`test:p2-trade-document` | 可复用 | P1 直接复用，模板视觉后续优化 |
| 生产 / 物流 / 发货 / 签收 | `backend/src/fulfillment-routes.mjs`、`test:p2-fulfillment-shipment` | 可复用 | P1 直接复用 |
| 提成 / 佣金 | `backend/src/commission-routes.mjs`、`test:p2-commission` | 可复用 | P1/P3 直接复用，多币种/冲销后续增强 |
| 沟通时间线 | `backend/src/timeline-routes.mjs`、`test:p2-timeline` | 可复用 | P1 直接复用 |
| 知识库 / RAG / 引用 | `backend/src/knowledge-routes.mjs`、`backend/src/rag-routes.mjs`、`test:p2-rag`、`test:p2-ai-citation` | 可复用 | P2 直接复用，真实向量库后置 |
| AI Gateway / 契约 / 策略 / 反馈 / ToolCall | `backend/src/ai-gateway-routes.mjs`、`test:p2-ai-*`、`test:p2-tool-call` | 可复用 | P2 直接复用，真实模型与 SSE 后置 |
| 自动化 / 通知 / 连接器 / Webhook | `backend/src/automation-routes.mjs`、`backend/src/integration-routes.mjs`、`test:p2-automation`、`test:p2-integration` | 可复用 | P2 直接复用，真实平台凭据后置 |
| PostgreSQL 迁移 / 受控彩排 / 真实 DB E2E | 目标仓库未内置完整工具链 | 交接 backend 可复用 | P2/P3 门禁时按最小文件迁入，不阻断阶段0文档收口 |

## 3. V2 指定文档差距

| 指定文档 | 当前是否有精确文件 | 等价内容 | 阶段0处理 |
| --- | --- | --- | --- |
| `QUOTATION_V2_AUDIT.md` | 否 | `QUOTE_ENGINE.md`、Excel V2 审计说明、`quote-excel-audit` 测试 | 新增桥接文档 |
| `QUOTATION_RULES.md` | 否 | `QUOTE_ENGINE.md`、`quote-engine.mjs`、`QuoteRuleSet`、报价规则测试 | 新增桥接文档 |
| `QUOTATION_MIGRATION.md` | 否 | Excel 审计说明、`test:p2-excel-audit`、报价规则版本测试 | 新增桥接文档 |
| `PROMPT_REGISTRY.md` | 否 | `AI_GOVERNANCE.md`、`PromptTemplate`、`AiTask` | 新增桥接文档 |
| `AI_CAPABILITY_CONTRACTS.md` | 否 | `AiCapabilityContract`、`AiOutputSchema`、`test:p2-ai-contract` | 新增桥接文档 |
| `AI_EVALS.md` | 否 | `PromptEvalSet`、`PromptEvalCase`、`test:p2-ai-contract` | 新增桥接文档 |
| `INTEGRATIONS.md` | 否 | `integration-routes.mjs`、`IntegrationConnection`、`WebhookEvent`、`test:p2-integration` | 新增桥接文档 |

## 4. P0-P3 工作包门禁

### P0 基础平台

- 目标：保证五角色、会话、导航、数据范围、工作台、审计日志、配置校验可运行。
- 复用：当前 backend 直接复用。
- 验收：`npm test`、`npm run test:smoke`、`npm run test:p2-dashboard`。

### P1 无 AI 外贸全闭环

- 目标：线索/询盘 → 去重 → 客户/商机 → 跟进 → 报价/PDF/发送 → 样品 → 转订单 → 回款 → 单证 → 生产/发货/签收 → 复购跟进 → 审计。
- 复用：当前 backend P2 smoke 已覆盖这些 P1 主链路模块。
- 验收：各 `test:p2-*` 业务 smoke + 最小 E2E。

### P2 AI 与报价规则治理

- 目标：AI Gateway、RAG、Prompt、能力契约、评测集、策略限额、ToolCall 人工确认、报价规则版本治理。
- 复用：当前 backend 已有本地/dry-run 闭环。
- 需改造：真实模型、pgvector、队列、SSE、真实连接器必须走授权门禁。

### P3 高级生产化

- 目标：性能、移动端、CI/CD、备份监控、第三方 ERP/物流/邮件/B2B 平台正式接入。
- 当前状态：暂缓，不阻断“先跑通整个流程”。

## 5. 当前不做事项

- 不复制整包交接 backend。
- 不新增平行业务模型或路由。
- 不部署、不 SSH、不写生产库。
- 不执行 `git add` / `git commit` / `git push` / `git merge`。
- 不把真实 AI/连接器/pgvector/队列/P95/UI 精修作为当前阶段0阻断项。
