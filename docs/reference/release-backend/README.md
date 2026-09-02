# NexFab CRM 后端

当前后端按 V2.0 最终版继续推进，但已有模块必须优先复用，不得重复开发。复用口径见上一层目录：

- `../NexFab_AI外贸CRM系统_开发总提示词_V2.0_合并版.md`
- `../NexFab_V2.0后端复用执行清单.md`

未配置 PostgreSQL 时，真实数据库业务接口会明确返回 `503`，绝不生成演示数据；测试环境可通过内存 Prisma mock 跑 smoke。

- `GET /health`：进程状态和不泄露凭据的配置状态；`GET /ready`：仅在数据库与会话密钥都已配置时返回 200；
- `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/session`：密码校验与签名会话；
- `GET /api/navigation`：从已认证会话推导角色，返回对应的导航、角标、AI/演示标签与默认展开项；
- `GET /api/dashboard`：角色工作台摘要，聚合个人待办、未读通知、审批队列、工具动作、样品事项、回款队列、自动化运行和 Webhook 风险；只做本地摘要，不调用 AI 或外部服务；
- `GET/POST /api/todos`、`GET/PATCH /api/todos/:id`：个人待办清单；强制 `userId = session.user.id`，管理员也不能越权查看或修改别人的待办；
- `GET/POST /api/memos`、`GET/PATCH /api/memos/:id`：个人备忘；强制个人隔离，管理员也不能越权查看或修改别人的备忘；
- `GET/POST /api/leads`、`GET /api/leads/:id`、`POST /api/leads/:id/status`、`POST /api/leads/:id/assign`、`GET/POST /api/leads/:id/follow-ups`、`POST /api/leads/:id/convert`：轻量线索池、分配、跟进和转客户最小闭环；Lead 不强制关联客户，转客户/商机时复用现有 `Customer / Opportunity`，同名客户需人工确认；
- `GET/POST /api/inquiries`、`GET /api/inquiries/:id`、`POST /api/inquiries/:id/status`、`POST /api/inquiries/:id/items`、`POST /api/inquiries/:id/messages`：询盘与结构化需求最小闭环；支持需求摘要、缺失字段、询盘明细和渠道消息，第一版只记录 `aiExtracted` 结果，不调用模型；
- 客户、联系人、商机、跟进记录：具备输入校验、角色/数据范围校验和事务内审计边界；
- 产品 PIM、产品资料、报价中心、报价规则版本、报价规则只读计算、订单履约、样品管理、财务回款、外贸单证/对账、生产物流发货、提成/佣金、沟通时间线、知识库/RAG 有来源检索：均已有本地 smoke 与验证证据；
- `GET/POST /api/quote-rule-sets`、`GET /api/quote-rule-sets/:id`：维护报价规则版本，manager/admin 可写，sales/manager/exec/admin 可读，finance 403；
- `POST /api/quote-rule-sets/excel-audit`：只读审计 Excel 抽取摘要，识别 DDP 公式错误、文本费用项、无命名区域、无数据验证等风险；输出规则草稿建议但不创建正式规则；
- `POST /api/quotes/calculate`：按 V2.0 报价规则抽象进行只读计算，支持 `ruleSetId` 复用持久化规则版本；复用产品 PIM、客户数据范围和报价中心权限；覆盖 EXW/FOB/CIF/DDP、数值费用校验、低毛利审批标记，不会照抄 Excel 单元格坐标；
- `POST /api/quotes/:quoteId/versions/:versionId/lock`：锁定报价版本并生成可审计 `pdfSnapshot`；低毛利会先返回审批请求；
- `GET /api/quotes/:quoteId/versions/:versionId/pdf`：基于已锁定版本返回真实 `application/pdf` 二进制响应；
- `POST /api/quotes/:quoteId/send`：要求 `confirmedExternalSend=true`，仅记录人工外发确认，更新报价状态为 `SENT`，并写入沟通时间线；不会代发外部邮件；
- `GET /api/quotes/:quoteId/approvals`、`POST /api/quote-approvals/:id/decision`：低毛利审批最小闭环，manager/admin 可审批，销售不能自批；
- `GET/POST /api/samples`、`GET /api/samples/:id`、`PATCH /api/samples/:id/status`、`POST /api/samples/:id/convert-to-order`：样品申请、寄送、签收、反馈和样品通过后转订单闭环，复用客户数据范围、产品 PIM、报价快照、现有 SalesOrder/OrderItem/FulfillmentEvent 和 AuditLog；
- `GET /api/trade-documents`、`POST /api/orders/:orderId/documents/generate`、`GET /api/trade-documents/:id`、`POST /api/trade-documents/:id/review`、`GET /api/orders/:orderId/reconciliation`：PI/CI/PL/SC 生成、审核和订单对账最小闭环，复用订单、订单明细、财务确认回款、客户和 AuditLog；禁止手工覆盖单证金额、币种、客户和明细，已审核单证只能生成新版本；
- `PATCH /api/orders/:orderId/fulfillment/status`、`POST /api/orders/:orderId/shipments`、`GET /api/shipments`、`PATCH /api/shipments/:id/status`：生产/备货、待发货、发货和签收最小闭环，复用订单、回款、单证和 FulfillmentEvent；发货前强制校验已审核 CI/PL + PI 或 SC、全款、运输方式、ETD、ATD 和物流关键号；
- `GET /api/commissions`、`POST /api/commission-records/settle`、`GET /api/commission-records`、`GET /api/commission-records/:id`、`POST /api/commission-records/:id/approve`：提成报表、结算快照和审批最小闭环，复用订单、确认回款、报价归属、用户和 AuditLog；提成只基于 `CONFIRMED` 回款，销售只能看本人，经理看团队，finance/admin 可结算审批；
- `GET/POST /api/knowledge-documents`、`GET /api/knowledge-documents/:id`、`POST /api/knowledge-documents/:id/review`、`POST /api/rag/query`：知识文档分段、人工审核和 RAG 有来源检索最小闭环；仅 `APPROVED` 且未过期知识片段可进入回答，回答展示文件名、版本和片段来源，资料不足明确不知道；
- `GET /api/ai-gateway/status`、`GET/POST /api/prompt-templates`、`GET /api/prompt-templates/:id`、`POST /api/ai-gateway/run`、`GET /api/ai-tasks`、`GET /api/ai-tasks/:id`：统一 AI Gateway、Prompt 模板注册表和 AI 调用审计最小闭环；本地草稿不调用外部模型，云端未配置时返回 502 并写失败任务，禁止 200 空结果；
- `GET/POST /api/ai-output-schemas`、`GET /api/ai-output-schemas/:id`、`GET/POST /api/ai-capability-contracts`、`GET /api/ai-capability-contracts/:id`、`GET/POST /api/prompt-eval-sets`、`GET /api/prompt-eval-sets/:id`、`GET/POST /api/prompt-eval-sets/:id/cases`：AI 输出 Schema、能力契约和最小评测集闭环；ACTIVE 能力必须绑定 ACTIVE Prompt 与输出 Schema，L1-L4 必须保留人工确认/审核策略，Gateway 可按能力契约运行并校验输出；列表接口分页，Schema/契约列表默认只返回摘要；
- `GET/POST /api/ai-policy-rules`、`GET /api/ai-policy-rules/:id`、`GET/POST /api/ai-cost-limits`、`GET /api/ai-cost-limits/:id`：AI 模块策略、供应商/模型白名单、禁止动作、等级上限、人工确认、token/cost 限额闭环；`POST /api/ai-gateway/run` 会先过策略与限额，违规返回 403 并写失败 `AiTask`，不会外发数据；
- `GET/POST /api/ai-tasks/:id/feedback`、`GET /api/ai-feedback/:id`：AI 输出人工确认、采纳、驳回、纠错留痕闭环；必须 `confirmedHumanReview=true`，纠错必须带人工修订输出，驳回必须带原因，第一版拒绝直接写正式业务表；
- `GET /api/ai-tasks/:id/citations`、`GET /api/ai-citations/:id`：AI/RAG 引用来源留痕闭环；`POST /api/rag/query` 会写 `AiTask` 并把已审核且未过期的知识片段来源写入 `AiCitation`，任务详情返回 `_count.citations`；
- `GET/POST /api/tool-calls`、`GET /api/tool-calls/:id`、`POST /api/tool-calls/:id/confirm`、`POST /api/tool-calls/:id/result`：外部工具调用与对外动作人工批准台账；第一版只登记草稿、人工确认和人工执行结果，不直接调用邮件、社媒、物流、MCP 或其他外部连接器；
- `GET/POST /api/automation-rules`、`GET /api/automation-rules/:id`、`PATCH /api/automation-rules/:id/status`、`POST /api/automation-rules/:id/run`、`GET /api/automation-runs`、`GET /api/automation-runs/:id`：自动化规则中心最小闭环；支持启停、dry-run、人工覆盖运行、执行日志、幂等去重和失败/降级台账，第一版不直接触发外部动作；
- `GET/POST /api/notifications`、`GET /api/notifications/:id`、`PATCH /api/notifications/:id/read`：站内通知最小闭环；通知列表强制仅返回当前用户自己的通知，管理员也不能越权查看个人通知；
- `GET/POST /api/integration-connections`、`GET /api/integration-connections/:id`、`PATCH /api/integration-connections/:id/status`：连接器配置台账；只保存配置摘要、`secretRef`、降级方式和健康状态，不保存明文密钥、token、密码或 cookie；
- `GET/POST /api/webhook-events`、`GET /api/webhook-events/:id`：Webhook 接收台账；第一版只记录接收摘要，按 provider + idempotencyKey 防重复，不自动处理、确认或触发外部动作；
- 交接文档中尚未实现的端点统一返回 `501 NOT_IMPLEMENTED`，不会伪造业务数据；
- RAG 当前为本地关键词检索 + 抽取式来源回答 + `AiCitation` 来源留痕；AI Gateway 当前为 `LOCAL_DRAFT` 本地草稿 + 云端未配置显式失败；Dashboard 当前为本地角色摘要；`Lead/Inquiry` 当前为轻量线索、询盘与人工确认转客户/商机；`Todo/Memo` 当前为强隔离个人工作台数据；`ToolCall` 当前为外部动作审批/执行结果台账；`AutomationRule/AutomationRun` 当前为规则 dry-run 与人工覆盖日志；`Notification/IntegrationConnection/WebhookEvent` 当前为站内通知、连接器配置和 Webhook 接收台账，不会真实调用外部连接器或自动改写业务数据。没有密钥读取、写入、模型请求或外部向量库调用。无可用资料时返回 `RAG_NOT_CONFIGURED` 或 `INSUFFICIENT_CONTEXT`，云端 AI 未配置时返回 `AI_GATEWAY_NOT_CONFIGURED`，不会伪造 AI 业务答案。

## 本地运行

要求 Node.js 20+。无需安装依赖即可启动当前 API 骨架：

```bash
cd backend
npm run start
```

服务默认仅监听 `127.0.0.1:8787`。数据库接入前，复制 `.env.example` 为 `.env` 并填写真实的 `DATABASE_URL` 和至少 32 字符的 `SESSION_SECRET`；不要提交 `.env`。

## 下一阶段

1. 在 PostgreSQL 测试环境配置后，执行 Prisma 校验与迁移；
2. 创建首个管理员账号，并用真实账号完成客户/商机闭环验收；
3. 按 V2.0 继续推进真实外部邮件网关、PDF/单证视觉模板精修、真实物流接口、多币种汇率和 AI Gateway 云端供应商接入等后续模块时，先复用当前已完成模块；
4. 经过单独授权后再接入真实模型调用、OCR/解析任务、向量库、流式返回、真实 Prompt Eval 执行器、真实费用统计和 AI 纠错回灌知识库流程。
