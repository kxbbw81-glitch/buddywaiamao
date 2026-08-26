# NexFab AI CRM V2.0 数据模型说明

> 阶段 0 文档。以 `backend/prisma/schema.prisma` 为当前事实来源。

## 1. 核心模型分组

| 分组 | 当前模型 |
| --- | --- |
| 组织与权限 | `Team`、`User`、`AuditLog` |
| 产品与资料 | `ProductCategory`、`Product`、`ProductDoc` |
| 客户与销售 | `Customer`、`CustomerFingerprint`、`Contact`、`Opportunity`、`FollowUp` |
| 获客与询盘 | `Lead`、`LeadFollowUp`、`Inquiry`、`InquiryItem`、`ChannelMessage` |
| 报价 | `Quote`、`QuoteVersion`、`QuoteApproval`、`QuoteRuleSet` |
| 样品与订单 | `SampleRequest`、`SalesOrder`、`OrderItem`、`FulfillmentEvent` |
| 财务与单证 | `OrderPayment`、`TradeDocument`、`CommissionRecord` |
| 生产物流 | `Shipment` |
| 工作台与沟通 | `Todo`、`Memo`、`CommunicationEvent`、`Notification` |
| 知识库与 RAG | `KnowledgeDocument`、`KnowledgeChunk`、`AiCitation` |
| AI 治理 | `AiConfig`、`PromptTemplate`、`AiOutputSchema`、`AiCapabilityContract`、`PromptEvalSet`、`PromptEvalCase`、`AiPolicyRule`、`AiCostLimit`、`AiTask`、`AiFeedback`、`ToolCall` |
| 自动化与集成 | `AutomationRule`、`AutomationRun`、`IntegrationConnection`、`WebhookEvent` |

## 2. 主链路关系

```text
Lead / Inquiry
  → Customer / Contact / Opportunity
  → FollowUp / CommunicationEvent / Todo
  → Quote / QuoteVersion / QuoteApproval
  → SampleRequest
  → SalesOrder / OrderItem / FulfillmentEvent
  → OrderPayment
  → TradeDocument / Shipment
  → CommissionRecord / 后续 FollowUp / Todo
  → AuditLog 全程追溯
```

## 3. 权限与数据范围

- `sales`：本人业务范围。
- `manager`：团队范围。
- `finance`：财务域全局读写，非财务/沟通/AI 场景受限。
- `exec`：全局只读为主。
- `admin`：全局管理，但个人 Todo/Memo/通知仍强制本人隔离。

## 4. PII 与安全策略

V2.0 目标要求邮箱、电话、WhatsApp、个人社媒账号等 PII 使用 AES-256-GCM 加密存储，外发 AI 前脱敏。当前发布基线具备客户指纹查重和 AI 输入摘要脱敏测试；完整 PII 加密字段落地需作为 P0 安全补齐项单独验收。

## 5. 迁移策略

- 当前 schema 与 migrations 已存在，`prisma validate` 通过。
- PostgreSQL + pgvector 是 P2 阶段门禁，不能跳过测试库彩排直接写生产库。
- SQLite/历史库迁移、受控彩排、真实 DB E2E runner 当前发布基线未纳入；需要时从交接 backend 最小迁入，不重造迁移体系。
