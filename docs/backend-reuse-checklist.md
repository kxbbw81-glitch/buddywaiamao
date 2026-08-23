# NexFab / AI 一体化业务平台 V2.0 后端复用执行清单

> 当前口径：以 `NexFab_AI外贸CRM系统_开发总提示词_V2.0_合并版.md` 为唯一最终版项目规范；旧资料、旧提示词、旧规划只能作参考素材，任何冲突一律服从 V2.0 合并版。
> 执行原则：先审计当前实现，再复用已有后端；不得因为 V2.0 范围更完整就从零重复开发。

## 1. 最终版依据

- 最终版总提示词：`/Users/dream/Documents/NexFab_CRM交接资料/NexFab_AI外贸CRM系统_开发总提示词_V2.0_合并版.md`
- 当前交接后端：`/Users/dream/Documents/NexFab_CRM交接资料/backend`
- 历史可复用后端基线：`/Users/dream/Documents/codex_workspace/01_Projects_正式项目/外贸crm系统开发/nexfab-crm-from-zai/source`
- 当前项目方案文档副本：`/Users/dream/Documents/codex_workspace/01_Projects_正式项目/外贸crm系统开发/方案文档/NexFab_AI外贸CRM系统_开发总提示词_V2.0_合并版.md`
- Excel V2 报价规则审计：`/Users/dream/Documents/NexFab_CRM交接资料/NexFab_ExcelV2报价规则审计与迁移说明_20260823.md`

## 2. 已经在当前交接后端做过、禁止重复开发的模块

这些模块当前已具备本地可运行后端、测试和验证证据。后续主线不得重新设计一套平行模型或接口，只能在审计后复用、迁入、补齐或升级。

| 模块 | 当前可复用文件 | 当前状态 | 复用要求 |
| --- | --- | --- | --- |
| 认证 / 会话 / 角色导航 | `src/security.mjs`、`src/navigation.mjs`、`src/server.mjs`、`test/phase1.mjs` | 已通过 `npm test` | 保留签名会话、角色导航和安全边界；如迁入 Next.js，先映射能力，不重写业务规则 |
| RBAC / 数据范围 / 审计边界 | `src/access.mjs`、各 route 内事务审计、`test/*smoke.mjs` | 已覆盖 sales/manager/finance/exec/admin | 继续沿用五角色和 owner/team/global 口径；新模块必须补越权 403 与 AuditLog |
| 工作台 / 个人 Todo / Memo | `src/dashboard-routes.mjs`、`test/p2-dashboard-smoke.mjs`、既有 `Todo/Memo` 模型 | `RUNNABLE-PASS` | 复用 User、AuditLog、QuoteApproval、Notification、ToolCall、AutomationRun 等既有模块；已覆盖 `GET /api/dashboard`、个人待办、个人备忘、管理员也不能越权查看个人 Todo/Memo |
| 获客 / 线索 / 询盘 | `src/acquisition-routes.mjs`、`test/p2-acquisition-smoke.mjs`、`20260825120000_acquisition_leads_inquiries` | `RUNNABLE-PASS` | 复用 Customer、Opportunity、User、AuditLog 和历史询盘口径；已覆盖 Lead、LeadFollowUp、Inquiry、InquiryItem、ChannelMessage、线索分配、跟进、转客户/商机、同名客户人工确认和询盘需求结构化 |
| G1 CRM 主链路 | `src/crm-routes.mjs`、`test/g1-smoke.mjs` | `RUNNABLE-PASS` | 客户、联系人、商机、跟进记录不重做；只按 V2.0 补字段或迁移 |
| 产品 PIM / 产品资料 | `src/product-routes.mjs`、`test/p2-product-smoke.mjs`、`20260823100000_product_pim` | `RUNNABLE-PASS` | 作为 V2.0 产品知识库结构化数据底座；后续 RAG 引用它，不另建孤立产品库 |
| 报价中心 / 报价规则版本 / Excel 只读审计 / 只读报价计算 / 版本锁定审批 / PDF与发送留痕 | `src/quote-routes.mjs`、`src/quote-engine.mjs`、`src/quote-excel-audit.mjs`、`src/quote-pdf.mjs`、`test/p2-quote-smoke.mjs`、`test/p2-quote-rules-smoke.mjs`、`test/p2-excel-audit-smoke.mjs`、`test/p2-quote-lock-smoke.mjs`、`test/p2-quote-send-smoke.mjs`、`20260823130000_quote_center`、`20260824090000_quote_rule_sets`、`20260824110000_quote_lock_approval` | `RUNNABLE-PASS` | 作为快速报价/报价版本底座；已补 `QuoteRuleSet`、Excel 抽取摘要审计、EXW/FOB/CIF/DDP 只读计算、`ruleSetId` 复用、PDF 快照、版本锁定、低毛利审批、真实 PDF 二进制响应和人工发送留痕，不重造 Quote |
| 订单履约 | `src/order-routes.mjs`、`test/p2-order-smoke.mjs`、`20260823160000_order_fulfillment` | `RUNNABLE-PASS` | 作为报价转订单、订单 gate、履约事件底座；后续模块必须复用 SalesOrder/FulfillmentEvent，不重造订单体系 |
| 样品管理 | `src/sample-routes.mjs`、`test/p2-sample-smoke.mjs`、`20260824130000_sample_requests` | `RUNNABLE-PASS` | 复用客户、产品 PIM、角色数据范围和 AuditLog；已覆盖样品申请、寄送、签收、反馈，不另建孤立客户/产品/订单体系 |
| 财务回款 | `src/payment-routes.mjs`、`test/p2-payment-smoke.mjs`、`20260823190000_payment_minimal` | `RUNNABLE-PASS` | 作为订单与回款底座；后续补汇率版本，不重做 OrderPayment |
| 外贸单证 / 发票 / 对账 | `src/trade-document-routes.mjs`、`test/p2-trade-document-smoke.mjs`、`20260824150000_trade_documents` | `RUNNABLE-PASS` | 复用订单、订单明细、财务确认回款、客户和 AuditLog；已覆盖 PI/CI/PL/SC 生成、审核、版本化和订单对账，不另建孤立单证金额体系 |
| 生产 / 物流 / 发货 | `src/fulfillment-routes.mjs`、`test/p2-fulfillment-shipment-smoke.mjs`、`20260824170000_shipments` | `RUNNABLE-PASS` | 复用订单、回款、单证、FulfillmentEvent 和 AuditLog；已覆盖生产/备货、待发货、物流记录、发货、签收和硬门禁，不另建平行履约体系 |
| 提成 / 佣金 | `src/commission-routes.mjs`、`test/p2-commission-smoke.mjs`、`20260824190000_commission_records` | `RUNNABLE-PASS` | 复用订单、确认回款、报价归属、用户和 AuditLog；已覆盖提成报表、结算快照和财务审批，不重做订单或回款金额 |
| 沟通时间线 | `src/timeline-routes.mjs`、`test/p2-timeline-smoke.mjs`、`20260823210000_communication_timeline` | `RUNNABLE-PASS` | 作为邮件/WhatsApp/电话等渠道记录聚合底座；真实渠道接入后写入该时间线 |
| 知识库 / RAG 有来源检索 | `src/knowledge-routes.mjs`、`src/rag-routes.mjs`、`test/p2-rag-smoke.mjs`、`20260824210000_knowledge_base` | `RUNNABLE-PASS` | 复用产品 PIM、客户/商机权限和 RAG 安全红线；仅已审核且未过期知识片段可回答，资料不足明确不知道，不伪造 AI 答案 |
| 统一 AI Gateway / 调用审计 | `src/ai-gateway-routes.mjs`、`test/p2-ai-gateway-smoke.mjs`、`20260824230000_ai_gateway_tasks` | `RUNNABLE-PASS` | 复用 User、AuditLog、权限边界和内存 smoke；已覆盖 Prompt 注册表、L1 本地草稿、云端未配置 502、AiTask 调用审计、敏感字段 redaction 和 L5 阻断；真实模型/密钥/向量库需单独授权后接入 |
| AI 能力契约 / 输出 Schema / 最小评测集 | `src/ai-gateway-routes.mjs`、`test/p2-ai-contract-smoke.mjs`、`20260825010000_ai_capability_contracts` | `RUNNABLE-PASS` | 复用 AI Gateway、PromptTemplate、AiTask、User、AuditLog；已覆盖 AiCapabilityContract、AiOutputSchema、PromptEvalSet/Case、ACTIVE 契约必须绑定 Prompt/Schema、L1-L4 人工确认、按契约运行和 Schema 失败 502 |
| AI 策略 / 模块开关 / 成本限额 | `src/ai-gateway-routes.mjs`、`test/p2-ai-policy-smoke.mjs`、`20260825030000_ai_policy_cost_limits` | `RUNNABLE-PASS` | 复用 AI Gateway、能力契约、AiTask 和 AuditLog；已覆盖 AiPolicyRule、AiCostLimit、模块等级上限、云端禁用、供应商/模型白名单、禁止动作、人工确认和 token/cost 硬限额 |
| AI 人工确认 / 反馈 / 纠错留痕 | `src/ai-gateway-routes.mjs`、`test/p2-ai-feedback-smoke.mjs`、`20260825050000_ai_feedback` | `RUNNABLE-PASS` | 复用 AI Gateway、AiTask、能力契约、User、AuditLog；已覆盖 AiFeedback、人工确认必填、采纳/驳回/纠错/需人工处理、纠错输出留痕、拒绝直接写正式业务表 |
| AI/RAG 引用来源留痕 | `src/rag-routes.mjs`、`src/ai-gateway-routes.mjs`、`test/p2-ai-citation-smoke.mjs`、`20260825070000_ai_citations` | `RUNNABLE-PASS` | 复用知识库/RAG、AiTask、KnowledgeDocument、KnowledgeChunk 和 AuditLog；已覆盖 RAG 查询写 AiTask、已审核知识片段写 AiCitation、引用列表/详情、任务引用计数和无来源零引用 |
| 外部工具调用 / 人工批准台账 | `src/ai-gateway-routes.mjs`、`test/p2-tool-call-smoke.mjs`、`20260825090000_tool_calls` | `RUNNABLE-PASS` | 复用 AiTask、User、AuditLog 和权限边界；已覆盖 ToolCall、草稿登记、禁止自动执行、人工确认、人工执行结果记录、失败降级记录和列表摘要 |
| 自动化规则 / 试运行 / 执行日志 | `src/automation-routes.mjs`、`test/p2-automation-smoke.mjs`、`20260825110000_automation_rules` | `RUNNABLE-PASS` | 复用 User、AuditLog、Todo/ToolCall 后续动作口径；已覆盖 AutomationRule、AutomationRun、规则启停、dry-run、人工覆盖运行、幂等防重复、运行日志和列表摘要 |
| 通知 / 连接器 / Webhook 接收台账 | `src/integration-routes.mjs`、`test/p2-integration-smoke.mjs`、`20260825113000_integration_notifications` | `RUNNABLE-PASS` | 复用 User、AuditLog、自动化/ToolCall 安全边界；已覆盖 Notification、IntegrationConnection、WebhookEvent、个人通知隔离、明文密钥拒绝、连接器降级方式、Webhook 幂等防重复和只记录不自动处理 |

## 3. 历史项目里可审计复用的后端能力

历史代码不能整包覆盖当前干净主线，但可以作为“已做过的能力库”点读复用。

可优先审计的目录：

- API 路由：`nexfab-crm-from-zai/source/src/app/api`
- Prisma schema 与种子：`nexfab-crm-from-zai/source/prisma`
- AI/Agent：`source/src/app/api/agent/*`、`source/src/app/api/ai*`、`source/src/app/api/ai-config/*`
- 权限模板：`source/src/app/api/permission-templates/*`
- 报价/订单/回款：`source/src/app/api/quotations/*`、`source/src/app/api/orders/*`、`source/src/app/api/payments/*`
- 线索/询盘/社媒：`source/src/app/api/inquiries/*`、`source/src/app/api/social-posts/*`
- 样品/复购/审批/提成：`source/src/app/api/samples/*`、`source/src/app/api/repurchase/*`、`source/src/app/api/approvals/*`、`source/src/app/api/commission/*`

复用规则：

1. 先看当前交接后端是否已经实现；已经实现的，不从历史代码重写。
2. 历史代码只点读目标模块，不全仓扫描、不卡在旧部署报告。
3. 复用前必须确认：数据模型、角色、数据范围、审计、错误格式、测试覆盖是否符合 V2.0。
4. 历史代码如果依赖 SQLite、旧角色、旧导航或旧 UI 命名，只提取业务逻辑，不直接搬入口径。
5. 任何迁入都要补本地 smoke：五角色、越权 403、输入校验、审计或只读降级。

## 4. 下一阶段建议执行顺序

当前本地后端已覆盖基础 CRM、工作台/Todo/Memo、获客/线索/询盘、产品、报价、订单、回款、单证、生产物流、提成、沟通时间线、知识库/RAG 有来源检索、AI Gateway、AI 能力契约、AI 策略限额、AI 人工确认反馈、AI/RAG 引用来源留痕、外部工具调用人工批准台账、自动化规则试运行日志、站内通知、连接器配置台账和 Webhook 接收台账。按 V2.0 往前走时，优先做“补齐闭环”，不是重写已有闭环。

1. 工作台 / 个人 Todo / Memo：已让 `GET /api/dashboard` 从占位 501 变为可运行本地角色摘要；已复用既有 `Todo/Memo` 模型，补个人待办、个人备忘和管理员也不能越权查看个人数据的红线。
2. 获客 / 线索 / 询盘：已新增 `Lead`、`LeadFollowUp`、`Inquiry`、`InquiryItem`、`ChannelMessage`，覆盖轻量线索池、分配、跟进、转客户/商机、同名客户人工确认和询盘结构化；Lead 不与 Customer 并行长期流转。
3. PostgreSQL 测试库联调：验证当前 migrations 能落地，补真实数据库 smoke。当前本机未发现 `psql` / `pg_isready`，本机 5432 端口未开放，Docker CLI 存在但 daemon 未连接；需等待测试 PostgreSQL 或 Docker 可用。
4. Excel V2 报价表审计与抽象：已完成只读审计，结论见 `NexFab_ExcelV2报价规则审计与迁移说明_20260823.md`。Excel 可作业务蓝本，但 DDP、利润率、物流引用存在错位风险，不得硬编码单元格。
5. 报价规则增强：已在现有 `Quote / QuoteVersion / Product / AuditLog / CommunicationEvent` 口径上新增 `QuoteRuleSet`、`GET/POST /api/quote-rule-sets`、`POST /api/quote-rule-sets/excel-audit`、`POST /api/quotes/calculate`、`POST /api/quotes/:quoteId/versions/:versionId/lock`、`GET /api/quotes/:quoteId/versions/:versionId/pdf`、`POST /api/quotes/:quoteId/send`、`GET /api/quotes/:quoteId/approvals`、`POST /api/quote-approvals/:id/decision` 和 `ruleSetId` 复用，覆盖 Excel 摘要审计、贸易术语、费用项、汇率、PDF 快照、版本锁定、低毛利审批、PDF 二进制响应、人工发送留痕与沟通时间线。
6. 样品管理：已新增样品申请、寄送、签收、反馈闭环；下一步可补样品转订单、样品费用和正式订单联动。
7. 单证 / 发票 / 对账：已新增 `TradeDocument`、PI/CI/PL/SC 生成审核、只从订单/订单明细/财务确认回款取数、已审核单证新版本和订单对账放行判断。
8. 生产 / 物流 / 发货：已新增 `Shipment`、生产/备货状态门禁、待发货门禁、物流发货关键字段校验和签收回写订单状态。
9. 提成 / 佣金：已参考历史 commission 路由业务口径，新增 `CommissionRecord`、提成报表、结算快照和财务审批；提成只基于 `CONFIRMED` 回款。
10. 知识库 / RAG 有来源检索：已新增 `KnowledgeDocument`、`KnowledgeChunk`、知识文档创建/审核和 `POST /api/rag/query` 有来源回答；仅使用 `APPROVED` 且未过期资料片段。
11. 统一 AI Gateway / 调用审计：已新增 `PromptTemplate`、`AiTask`、Prompt 注册表、L1 本地草稿、云端未配置 502 和调用审计；真实模型供应商、密钥、流式返回、真实评测执行器、真实费用回传和工具调用需单独授权后接。
12. AI 能力契约 / 输出 Schema / 最小评测集：已新增 `AiCapabilityContract`、`AiOutputSchema`、`PromptEvalSet`、`PromptEvalCase`，并让 Gateway 可按 `capabilityCode` 运行和校验输出；后续真实模型接入必须先绑定能力契约。
13. AI 策略 / 模块开关 / 成本限额：已新增 `AiPolicyRule`、`AiCostLimit`，并让 Gateway 运行前检查模块开关、等级上限、云端许可、供应商/模型白名单、禁止动作、人工确认和 token/cost 限额。
14. AI 人工确认 / 反馈 / 纠错留痕：已新增 `AiFeedback`，并提供 AI 任务下采纳、驳回、纠错和需人工处理记录；第一版只记录人工确认结果，不直接写入正式业务表。
15. AI/RAG 引用来源留痕：已新增 `AiCitation`，并让 RAG 查询写 `AiTask` 与来源引用；引用只来自已审核且未过期知识片段，无来源时明确零引用。
16. 外部工具调用 / 人工批准台账：已新增 `ToolCall`，覆盖外部动作草稿、人工确认、人工执行结果和失败降级记录；第一版不直接调用外部连接器。
17. 自动化规则 / 试运行 / 执行日志：已新增 `AutomationRule`、`AutomationRun`，覆盖启停、dry-run、人工覆盖运行、执行日志和幂等防重复；第一版不直接触发外部动作。
18. 通知 / 连接器 / Webhook 接收台账：已新增 `Notification`、`IntegrationConnection`、`WebhookEvent`，覆盖站内通知、个人通知隔离、连接器配置摘要、secretRef、安全降级方式、Webhook 接收记录、幂等防重复和只记录不自动处理；第一版不真实调用外部服务。
19. PostgreSQL 实库联调：等待受控测试库后补真实迁移和 CRUD smoke。

## 5. 主线执行时的固定提示

后续交给 Codex 主线时，必须带上这段：

> 按 V2.0 合并版执行，但当前项目已有可复用后端。先审计 `/Users/dream/Documents/NexFab_CRM交接资料/backend`、`NexFab_V2.0后端复用执行清单.md` 和 `NexFab_ExcelV2报价规则审计与迁移说明_20260823.md`，确认已有模块后复用，不要重复开发。历史 `nexfab-crm-from-zai/source` 只作为点读复用库，不得整包覆盖当前干净主线。Excel V2 只作为报价业务蓝本，不得硬编码单元格坐标或照抄当前错误公式。每次新增模块必须说明复用了什么、补了什么、没有重复开发什么，并给本地测试证据。

## 6. 当前禁止事项

- 不部署、不 SSH、不操作生产数据库。
- 不 git add / commit / push / merge，除非用户另行明确授权。
- 不把 V2.0 目标架构当作当前已完成事实。
- 不用旧导航、旧角色、旧报告覆盖 V2.0 最终版。
- 不为追求“看起来完整”伪造 AI、RAG、报价、财务或订单能力。
