# G1 验证状态

## 已通过（无数据库）

- `node --check src/crm-routes.mjs src/server.mjs`
- `npm test`：会话、密码校验、导航角色过滤、数据范围、联系人/跟进分页
- `npm run test:smoke`：admin/sales/manager/finance/exec 登录、导航、客户/联系人、商机/跟进、sales 越权 403、manager 团队范围、finance 访问 CRM 403、exec 写入 403、AuditLog
  - 输出：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
- `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：schema 可解析
- `passwordHash` 静态不变量：仅存在于 Prisma `User` 模型和 `User` 建表迁移
- `/health` 返回 200；未配置数据库时 `/ready` 返回 503
- 本地临时端口 `8791` 可启动；未登录访问 `/api/navigation?role=ADMIN` 返回 401，认证边界可消费

## 尚未完成（环境缺口）

- PostgreSQL `migrate deploy`：本机无 `psql`，Docker 守护进程不可用，且无受控测试数据库配置；尝试通过 Homebrew 安装 PostgreSQL 时进入源码编译路径，耗时过长后已中断，未作为当前阻塞项。

## 当前跑通口径

代码层 G1 已达到本地可启动、Prisma schema 可校验、可通过隔离 HTTP smoke 跑通完整主链路；完整 PostgreSQL 闭环仍需配置受控测试库后验证。

只有服务无法启动、schema/迁移/代码不一致、登录不可用、核心 CRUD 不可用、明显越权或主链路写操作审计缺失时才判定 `BLOCK`。缺少压测、超时边界、P95 证据和体验细节进入优化清单，不阻止先跑通。

## V2.0 最终版锁定

- 用户已确认 `/Users/dream/Documents/NexFab_CRM交接资料/NexFab_AI外贸CRM系统_开发总提示词_V2.0_合并版.md` 为唯一最终版项目规范。
- 旧提示词、旧导航、旧规划、历史代码注释只作为参考素材；凡与 V2.0 合并版冲突，一律服从 V2.0 合并版。
- 四个 Codex 任务已收到锁版同步：审核支线确认后续按 V2.0 给 `PASS / CONDITIONAL-PASS / BLOCKED`；性能支线已回 `PASS` 并确认只升级真正阻断“先跑通”的性能问题；主线与 QA 支线本轮已完成接收但未返回可见正文，暂不冒充 PASS。
- 后续继续按 `/Users/dream/Documents/NexFab_CRM交接资料/NexFab_V2.0后端复用执行清单.md` 先审计、复用、迁入、补齐当前已有后端，不重复开发平行系统。

## P2 产品 PIM（RUNNABLE-PASS）

- `DATABASE_URL='postgresql://…' npx prisma validate`：通过。
- `npm run test:p2-product`：通过，输出 `{"result":"passed","categories":1,"products":1,"productDocs":1,"auditLogs":7}`，覆盖 manager 写、sales/exec/finance 权限边界与产品资料审计。
- 尚未在受控 PostgreSQL 实库执行本模块迁移与 CRUD smoke。

## P2 报价中心（RUNNABLE-PASS）

- `node --check src/quote-routes.mjs src/server.mjs test/p2-quote-smoke.mjs`：通过。
- `npm run test:p2-quote`：通过，输出 `{"result":"passed","quotes":2,"quoteVersions":2,"auditLogs":12}`。
- `node --check src/quote-engine.mjs src/quote-routes.mjs`：通过。
- `npm run test:p2-quote-rules`：通过，输出 `{"result":"passed","mode":"quote-rules-versioned-readonly","ruleSets":1,"ddpTotal":2886.46,"approvalRequired":true}`。
- 已新增 `QuoteRuleSet` 规则版本模型、迁移 `20260824090000_quote_rule_sets`、`GET/POST /api/quote-rule-sets` 和 `GET /api/quote-rule-sets/:id`。
- `POST /api/quotes/calculate` 已支持 `ruleSetId`：复用持久化规则版本、产品 PIM、客户数据范围和报价中心权限；计算本身仍不创建 `Quote`，不创建 `QuoteVersion`，不写报价业务数据。
- 已覆盖 Excel V2 审计暴露的核心风险：DDP 计算只能接收数值费用项，类似 `物流费用!B22 = DHL` 的文本费用会返回 `400 VALIDATION_ERROR`，不会进入后端求和；低于最低毛利率时返回 `approval.required=true`。
- 已新增 `POST /api/quote-rule-sets/excel-audit` 只读 Excel 审计摘要 API：manager/admin 可执行，sales/finance/exec 403；返回 `PASS / CONDITIONAL-PASS / BLOCKED`、问题清单和规则草稿建议，不创建 `QuoteRuleSet`、不创建 `Quote`、不创建 `QuoteVersion`。
- `npm run test:p2-excel-audit`：通过，输出 `{"result":"passed","mode":"excel-audit-readonly","status":"BLOCKED","blockers":3,"canCreateCleanDraft":true}`。
- 已新增报价版本锁定与低毛利审批最小闭环：`QuoteVersion.lockStatus/lockedAt/lockedById/pdfSnapshot`、`QuoteApproval`、`POST /api/quotes/:quoteId/versions/:versionId/lock`、`GET /api/quotes/:quoteId/approvals`、`POST /api/quote-approvals/:id/decision`。
- `npm run test:p2-quote-lock`：通过，输出 `{"result":"passed","mode":"quote-lock-approval","approvals":1,"lockedVersions":2}`。
- 已新增真实 PDF 二进制渲染与发送留痕最小闭环：`GET /api/quotes/:quoteId/versions/:versionId/pdf` 返回 `application/pdf`，`POST /api/quotes/:quoteId/send` 在 `confirmedExternalSend=true` 时记录人工已发送、更新 Quote 为 `SENT`，并写入 `CommunicationEvent` 和 `AuditLog`；系统本身不调用外部邮件服务。
- `npm run test:p2-quote-send`：通过，输出 `{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`。
- 完整回归链已通过：
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm run test:p2-product`：`{"result":"passed","categories":1,"products":1,"productDocs":1,"auditLogs":7}`
  - `npm run test:p2-quote`：`{"result":"passed","quotes":2,"quoteVersions":2,"auditLogs":12}`
  - `npm run test:p2-quote-rules`：`{"result":"passed","mode":"quote-rules-versioned-readonly","ruleSets":1,"ddpTotal":2886.46,"approvalRequired":true}`
  - `npm run test:p2-excel-audit`：`{"result":"passed","mode":"excel-audit-readonly","status":"BLOCKED","blockers":3,"canCreateCleanDraft":true}`
  - `npm run test:p2-quote-lock`：`{"result":"passed","mode":"quote-lock-approval","approvals":1,"lockedVersions":2}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未在受控 PostgreSQL 实库执行报价迁移与 CRUD smoke；真实外部邮件网关、复杂多级审批、PDF 视觉模板精修仍按后续模块处理。当前已具备可测试的 PDF 二进制响应、人工发送留痕、报价状态更新和沟通时间线闭环。

## P2 订单履约（RUNNABLE-PASS）

- `node --check src/order-routes.mjs src/server.mjs test/p2-order-smoke.mjs`：通过。
- `npm run test:p2-order`：通过，输出 `{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`。
- 完整回归链已通过：
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm run test:p2-product`：`{"result":"passed","categories":1,"products":1,"productDocs":1,"auditLogs":7}`
  - `npm run test:p2-quote`：`{"result":"passed","quotes":2,"quoteVersions":2,"auditLogs":12}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未在受控 PostgreSQL 实库执行订单迁移与 CRUD smoke；按总负责人口径列为后补环境验证，不阻止本地可跑通结论。

## P2 样品管理（RUNNABLE-PASS）

- `node --check src/sample-routes.mjs src/server.mjs src/access.mjs test/p2-sample-smoke.mjs`：通过。
- 已新增 `SampleRequest` 模型、迁移 `20260824130000_sample_requests`、`GET/POST /api/samples`、`GET /api/samples/:id`、`PATCH /api/samples/:id/status`、`POST /api/samples/:id/convert-to-order`。
- 已复用客户数据范围、产品 PIM、销售/经理/管理层角色边界和事务内 `AuditLog`；样品转订单复用现有 `Quote / QuoteVersion / SalesOrder / OrderItem / FulfillmentEvent`，不新建平行订单体系；finance 无样品权限，exec 只读。
- 已回补支线建议：样品转订单现在在同一事务内创建订单、订单明细、履约事件并把样品标记为 `CONVERTED`，降低订单已建但样品未标记的半完成风险。
- `npm run test:p2-sample`：通过，输出 `{"result":"passed","mode":"sample-to-order","samples":1,"status":"CONVERTED","salesOrders":1,"auditLogs":5}`，覆盖销售申请、越权 403、寄送、签收、客户认可反馈、样品转订单、订单明细来自报价快照、重复转单 409、manager 团队查看、exec 只读/写入 403、finance 403。
- 支线结论：审核支线已从 `CONDITIONAL-PASS` 调整为 `PASS`；性能支线给出 `PASS`，两段事务优化项已关闭，仅保留高并发场景样品级幂等键/行锁/条件更新为非阻断后续优化；主线与 QA 支线已接收补充但未返回可见正文，暂不冒充 PASS。
- 完整回归链已通过：报价发送、报价锁定、报价中心、报价规则、Excel 审计、G1 smoke、产品、订单、回款、时间线、RAG 和 Prisma validate。
- 尚未在受控 PostgreSQL 实库执行样品迁移与 CRUD smoke；样品费用和正式发货/回款的更细粒度费用联动留作后续增强。

## P2 财务回款（RUNNABLE-PASS）

- `node --check src/payment-routes.mjs src/order-routes.mjs test/p2-payment-smoke.mjs`：通过。
- `npm run test:p2-payment`：通过，输出 `{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`。
- 完整回归链已通过：
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm run test:p2-product`：`{"result":"passed","categories":1,"products":1,"productDocs":1,"auditLogs":7}`
  - `npm run test:p2-quote`：`{"result":"passed","quotes":2,"quoteVersions":2,"auditLogs":12}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未在受控 PostgreSQL 实库执行回款迁移与 CRUD smoke；复杂汇率仍按后续模块处理。

## P2 外贸单证 / 发票 / 对账（RUNNABLE-PASS）

- `node --check src/trade-document-routes.mjs src/server.mjs src/access.mjs src/memory-test-prisma.mjs`：通过。
- 已新增 `TradeDocument` 模型、迁移 `20260824150000_trade_documents`、`GET /api/trade-documents`、`POST /api/orders/:orderId/documents/generate`、`GET /api/trade-documents/:id`、`POST /api/trade-documents/:id/review`、`GET /api/orders/:orderId/reconciliation`。
- 已复用 `SalesOrder / OrderItem / OrderPayment / Customer / AuditLog`：PI/CI/PL/SC 只能从已确认订单、订单明细和财务确认回款生成快照；金额、币种、客户和明细禁止手工覆盖；已审核通过的单证不能静默覆盖，只能生成新版本。
- `npm run test:p2-trade-document`：通过，输出 `{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`，覆盖 PI/CI/PL 生成、财务审核、销售不可自审、exec 只读、越权 403、手工金额覆盖 400、PI 新版本和全款后对账放行。
- 关键回归已通过：
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-sample`：`{"result":"passed","mode":"sample-to-order","samples":1,"status":"CONVERTED","salesOrders":1,"auditLogs":5}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未在受控 PostgreSQL 实库执行单证迁移与 CRUD smoke；真实单证 PDF/Excel 模板、报关资料、物流提单号、税务/认证字段仍需后续在有来源数据后补，不允许 AI 或人工在单证中伪造来源。

## P2 生产 / 物流 / 发货（RUNNABLE-PASS）

- `node --check src/fulfillment-routes.mjs src/server.mjs src/access.mjs src/memory-test-prisma.mjs test/p2-fulfillment-shipment-smoke.mjs`：通过。
- 已新增 `Shipment` 模型、迁移 `20260824170000_shipments`、`PATCH /api/orders/:orderId/fulfillment/status`、`POST /api/orders/:orderId/shipments`、`GET /api/shipments`、`PATCH /api/shipments/:id/status`。
- 已复用 `SalesOrder / FulfillmentEvent / OrderPayment / TradeDocument / AuditLog`：生产/备货必须已有财务确认回款；待发货必须满足已审核 CI/PL + PI 或 SC + 订单明细 + 全款；发货必须已有运输方式、ETD、ATD，以及跟踪号/订舱号/提单号/柜号中的至少一个。
- `npm run test:p2-fulfillment-shipment`：通过，输出 `{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`，覆盖付款门禁、单证门禁、ready_to_ship、发货字段校验、exec/finance 只读、sales 越权 403、发货后订单状态、签收后订单状态。
- 关键回归已通过：
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-sample`：`{"result":"passed","mode":"sample-to-order","samples":1,"status":"CONVERTED","salesOrders":1,"auditLogs":5}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未在受控 PostgreSQL 实库执行物流迁移与 CRUD smoke；真实物流平台、订舱接口、提单 PDF、自动轨迹抓取和异常预警留作后续外部接入。

## P2 提成 / 佣金（RUNNABLE-PASS）

- `node --check src/commission-routes.mjs src/server.mjs src/access.mjs src/memory-test-prisma.mjs test/p2-commission-smoke.mjs`：通过。
- 已参考历史 `source/src/app/api/commission/route.ts` 的业务口径：默认提成率 1.5%，提成基于已确认回款，潜在提成基于订单总额，按销售聚合，排除取消订单。
- 已新增 `CommissionRecord` 模型、迁移 `20260824190000_commission_records`、`GET /api/commissions`、`POST /api/commission-records/settle`、`GET /api/commission-records`、`GET /api/commission-records/:id`、`POST /api/commission-records/:id/approve`。
- 已复用 `SalesOrder / OrderPayment / Quote / User / AuditLog`：提成报表只读取 `CONFIRMED` 回款；销售只能看本人，经理看团队，finance/exec/admin 看全局；只有 finance/admin 可结算和审批；不手工改订单金额或回款金额。
- `npm run test:p2-commission`：通过，输出 `{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`，覆盖销售/经理/财务/管理层权限、无效提成率 400、销售/经理不能结算、财务结算、销售查看本人记录、财务审批和 AuditLog。
- 关键回归已通过：
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未在受控 PostgreSQL 实库执行提成迁移与 CRUD smoke；多币种汇率折算、退货/退款冲销、阶梯提成和工资系统对接留作后续增强。

## P2 沟通时间线（RUNNABLE-PASS）

- `node --check src/timeline-routes.mjs src/server.mjs test/p2-timeline-smoke.mjs`：通过。
- `npm run test:p2-timeline`：通过，输出 `{"result":"passed","communicationEvents":2,"auditLogs":10}`。
- 完整回归链已通过：
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm run test:p2-product`：`{"result":"passed","categories":1,"products":1,"productDocs":1,"auditLogs":7}`
  - `npm run test:p2-quote`：`{"result":"passed","quotes":2,"quoteVersions":2,"auditLogs":12}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-timeline`：`{"result":"passed","communicationEvents":2,"auditLogs":10}`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未在受控 PostgreSQL 实库执行沟通时间线迁移与 CRUD smoke；真实邮件、WhatsApp、电话或第三方渠道接入不在本轮范围。

## P2 知识库 / RAG 有来源检索（RUNNABLE-PASS）

- `node --check src/knowledge-routes.mjs src/rag-routes.mjs src/server.mjs src/access.mjs src/memory-test-prisma.mjs test/p2-rag-smoke.mjs`：通过。
- 已新增 `KnowledgeDocument`、`KnowledgeChunk` 模型和迁移 `20260824210000_knowledge_base`。
- 已新增 `GET/POST /api/knowledge-documents`、`GET /api/knowledge-documents/:id`、`POST /api/knowledge-documents/:id/review`，并升级 `POST /api/rag/query`：仅检索 `APPROVED` 且未过期的知识片段，回答必须带文件名、版本、标题、段落来源；未命中时明确“不知道”。
- 已复用产品 PIM、客户/商机上下文权限、RAG 安全红线和 AuditLog；知识库维护/审核仅 manager/admin，finance 403，exec 只读；不调用 OpenAI/MCP/向量数据库/外部服务，不读取密钥。
- `npm run test:p2-rag`：通过，输出 `{"result":"passed","mode":"knowledge_base","status":"ANSWERED_WITH_SOURCES","sources":1,"knowledgeDocuments":2,"knowledgeChunks":3}`，覆盖无资料 fallback、知识文档创建、未审核不可引用、人工审核、带来源回答、过期资料不可引用、敏感词 redaction、越权 403。
- 关键回归已通过：
  - `npm run test:p2-commission`：`{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_dev?schema=public' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未接入真实模型网关、向量库、OCR/解析任务和 AI 调用日志；当前为本地关键词检索 + 抽取式来源回答，真实云端模型需单独授权密钥后再接。

## P2 统一 AI Gateway / 调用审计（RUNNABLE-PASS）

- `node --check src/ai-gateway-routes.mjs src/server.mjs src/access.mjs src/memory-test-prisma.mjs test/p2-ai-gateway-smoke.mjs`：通过。
- 已新增 `PromptTemplate`、`AiTask` 模型和迁移 `20260824230000_ai_gateway_tasks`。
- 已新增 `GET /api/ai-gateway/status`、`GET/POST /api/prompt-templates`、`GET /api/prompt-templates/:id`、`POST /api/ai-gateway/run`、`GET /api/ai-tasks`、`GET /api/ai-tasks/:id`。
- 已按 V2.0 明确边界：服务端统一入口；前端永不接收明文 key；本地草稿 `LOCAL_DRAFT` 不调用外部模型，`dataSentToCloud=false`；云端未配置或未授权时返回 `502 AI_GATEWAY_NOT_CONFIGURED`，禁止 `200 + 空结果`；L1 草稿必须人工确认；第一版阻断 L5 自动业务决策。
- 已复用 `User / AuditLog / access.mjs / memory-test-prisma`：Prompt 模板仅 manager/admin 可维护；sales/manager/finance/exec/admin 可按权限使用或查看 AI Gateway；AI 调用写 `AiTask`，包含模块、用途、模型/Prompt 版本、输入摘要、输出、tokens、cost、dataSentToCloud、耗时和操作者；输入摘要会 redaction，不记录明文密钥/secret/token。
- `npm run test:p2-ai-gateway`：通过，输出 `{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`，覆盖 Gateway 状态、Prompt 模板权限、L1 本地草稿、云端未配置 502、失败任务落库、敏感字段 redaction、任务列表范围和 L5 阻断。
- 支线结论：审核支线已给 `PASS`；性能支线已给 `PASS`，仅建议后续列表隐藏完整 input/output、增加 safeSummary 总字节闸门和云端 provider/model allowlist、超时、重试、token/cost 上限；QA 支线完成一轮但未返回可见正文，以本地专项 smoke 和审核/性能结论兜底。
- 关键回归已通过：
  - `npm run test:p2-rag`：`{"result":"passed","mode":"knowledge_base","status":"ANSWERED_WITH_SOURCES","sources":1,"knowledgeDocuments":2,"knowledgeChunks":3}`
  - `npm run test:p2-commission`：`{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未接入真实 OpenAI/Kimi/DeepSeek/Claude/Ollama 调用、流式返回、真实评测执行器、真实费用回传和外部工具调用；这些必须在单独授权密钥、模型供应商和数据出境策略后再接。

## P2 AI 能力契约 / 输出 Schema / 最小评测集（RUNNABLE-PASS）

- `node --check src/ai-gateway-routes.mjs src/memory-test-prisma.mjs test/p2-ai-contract-smoke.mjs`：通过。
- 已新增 `AiOutputSchema`、`AiCapabilityContract`、`PromptEvalSet`、`PromptEvalCase` 模型和迁移 `20260825010000_ai_capability_contracts`，并扩展 `AiTask` 记录 `capabilityCode/capabilityVersion/outputSchemaCode/outputSchemaVersion`。
- 已新增 `GET/POST /api/ai-output-schemas`、`GET /api/ai-output-schemas/:id`、`GET/POST /api/ai-capability-contracts`、`GET /api/ai-capability-contracts/:id`、`GET/POST /api/prompt-eval-sets`、`GET /api/prompt-eval-sets/:id`、`GET/POST /api/prompt-eval-sets/:id/cases`。
- 已按 V2.0 9.3 补齐能力契约字段：场景、输入、权限、输出、校验、落库、人工确认、禁止动作、降级、审计、评测；ACTIVE 能力契约必须绑定 ACTIVE Prompt 与 ACTIVE 输出 Schema；L1-L4 必须保留人工确认或审核策略；至少声明一个禁止动作。
- 已升级 `POST /api/ai-gateway/run`：可通过 `capabilityCode` 调用 ACTIVE 能力契约，自动继承模块、等级、Prompt、输出 Schema；本地草稿输出会按绑定 Schema 校验，失败返回 `502 AI_OUTPUT_SCHEMA_FAILED` 并写失败 `AiTask`，禁止静默写入正式业务表。
- `npm run test:p2-ai-contract`：通过，输出 `{"result":"passed","contracts":2,"outputSchemas":2,"evalCases":2,"aiTasks":2}`，覆盖 finance 无权维护、ACTIVE 契约缺少 Prompt/Schema 400、L1 禁止取消人工确认、评测集与评测用例、评测用例分页、Schema/契约列表摘要、按能力契约运行 Gateway、敏感字段 redaction、Schema 校验失败 502。
- 性能支线提出的两个非阻断边界已处理：`GET /api/prompt-eval-sets/:id/cases` 支持 `page/pageSize/type`，评测集详情只返回 `_count.cases`；`GET /api/ai-output-schemas` 与 `GET /api/ai-capability-contracts` 默认返回摘要，完整 JSON 通过详情接口读取。
- 支线结论：审核支线已给 `PASS`；性能支线在回补分页/摘要优化后已给 `PASS`；QA 支线完成一轮但未返回可见正文，以本地专项 smoke、审核 PASS 和性能 PASS 兜底。
- 关键回归已通过：
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:p2-rag`：`{"result":"passed","mode":"knowledge_base","status":"ANSWERED_WITH_SOURCES","sources":1,"knowledgeDocuments":2,"knowledgeChunks":3}`
  - `npm run test:p2-commission`：`{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未接入真实模型评测执行器、真实费用回传、SSE 流式返回和外部工具调用；这些必须在真实模型供应商、密钥、数据出境策略和测试库授权后再接。供应商/模型白名单和本地限额闸门已在策略模块落地。

## P2 AI 策略 / 模块开关 / 成本限额（RUNNABLE-PASS）

- `node --check src/ai-gateway-routes.mjs src/memory-test-prisma.mjs test/p2-ai-policy-smoke.mjs`：通过。
- 已新增 `AiPolicyRule`、`AiCostLimit` 模型和迁移 `20260825030000_ai_policy_cost_limits`。
- 已新增 `GET/POST /api/ai-policy-rules`、`GET /api/ai-policy-rules/:id`、`GET/POST /api/ai-cost-limits`、`GET /api/ai-cost-limits/:id`。
- 已按 V2.0 补齐 AI 治理闸门：模块策略支持 `maxLevel`、`allowCloud`、`allowedProviders`、`allowedModels`、`blockedActions`、`requireHumanConfirmation`、`dataScopePolicy`；成本限额支持 `period`、`provider/model`、`maxTokens`、`maxCost`、`hardBlock`。
- 已升级 `POST /api/ai-gateway/run`：执行前先评估 ACTIVE 模块策略与成本限额；禁止动作、超等级、未授权云端、供应商/模型不在白名单、token 超限均返回 `403` 并写失败 `AiTask`；所有拦截均 `dataSentToCloud=false`。
- `npm run test:p2-ai-policy`：通过，输出 `{"result":"passed","policyRules":1,"costLimits":1,"aiTasks":4,"failedTasks":3}`，覆盖 finance 无权维护策略/限额、策略列表摘要、成本限额列表、正常本地草稿、禁止动作拦截、云端策略拦截、token 限额拦截和失败任务留痕。
- 支线结论：审核支线已给 `PASS`；性能支线已给 `PASS`，其非阻断建议中的策略/限额列表摘要化已回补；QA 支线完成一轮但未返回可见正文，以本地专项 smoke、审核 PASS 和性能 PASS 兜底。
- 关键回归已通过：
  - `npm run test:p2-ai-contract`：`{"result":"passed","contracts":2,"outputSchemas":2,"evalCases":2,"aiTasks":2}`
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:p2-rag`：`{"result":"passed","mode":"knowledge_base","status":"ANSWERED_WITH_SOURCES","sources":1,"knowledgeDocuments":2,"knowledgeChunks":3}`
  - `npm run test:p2-commission`：`{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未接入真实模型费用回传、真实 token 计费、周期聚合统计、供应商连接器和真实外部工具调用；这些需在真实模型供应商和数据出境策略授权后再接。

## P2 AI 人工确认 / 反馈 / 纠错留痕（RUNNABLE-PASS）

- `node --check src/ai-gateway-routes.mjs src/memory-test-prisma.mjs test/p2-ai-feedback-smoke.mjs`：通过。
- 已新增 `AiFeedback` 模型和迁移 `20260825050000_ai_feedback`。
- 已新增 `GET/POST /api/ai-tasks/:id/feedback`、`GET /api/ai-feedback/:id`，并在 `GET /api/ai-tasks/:id` 返回 `_count.feedbacks`。
- 已按 V2.0 补齐人工确认闭环：AI 输出必须由有权用户明确 `confirmedHumanReview=true` 后才能记录采纳、驳回、纠错或需人工处理；纠错必须保留 `correctedOutput`；驳回必须填写原因；第一版若请求直接写正式业务表会返回 `400 FORMAL_WRITE_NOT_SUPPORTED`。
- 已复用 `AiTask / User / AuditLog / access.mjs / memory-test-prisma`：反馈记录挂在既有 AI 调用审计下，沿用 sales 本人、manager 团队、finance/exec/admin 全局可见口径；每条人工反馈写 `AuditLog(resource=ai_feedback)`。
- `npm run test:p2-ai-feedback`：通过，输出 `{"result":"passed","aiTasks":1,"aiFeedbacks":3,"auditLogs":3}`，覆盖未人工确认 400、正式写入拦截、纠错缺少输出 400、驳回缺少原因 400、采纳、纠错、需人工处理、反馈列表摘要、任务反馈计数和详情读取。
- 支线结论：审核支线已给 `PASS`；性能支线已给 `PASS`，仅建议后续增加 `correctedOutput` 字段级大小/深度限制和高频任务详情计数优化；QA 支线完成一轮但未返回可见正文，以本地专项 smoke、审核 PASS 和性能 PASS 兜底。
- 关键回归已通过：
  - `npm run test:p2-ai-policy`：`{"result":"passed","policyRules":1,"costLimits":1,"aiTasks":4,"failedTasks":3}`
  - `npm run test:p2-ai-contract`：`{"result":"passed","contracts":2,"outputSchemas":2,"evalCases":2,"aiTasks":2}`
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:p2-rag`：`{"result":"passed","mode":"knowledge_base","status":"ANSWERED_WITH_SOURCES","sources":1,"knowledgeDocuments":2,"knowledgeChunks":3}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-commission`：`{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未接入纠错回灌知识库、真实人工审核队列 UI、外部发送执行器和正式业务表回写流程；这些需在真实产品流程和权限策略明确后再接。

## P2 AI/RAG 引用来源留痕（RUNNABLE-PASS）

- `node --check src/rag-routes.mjs src/ai-gateway-routes.mjs src/memory-test-prisma.mjs test/p2-ai-citation-smoke.mjs`：通过。
- 已新增 `AiCitation` 模型和迁移 `20260825070000_ai_citations`。
- 已新增 `GET /api/ai-tasks/:id/citations`、`GET /api/ai-citations/:id`，并在 `GET /api/ai-tasks/:id` 返回 `_count.citations`。
- 已升级 `POST /api/rag/query`：每次 RAG 查询写 `AiTask`，本地关键词 RAG 不调用外部模型且 `dataSentToCloud=false`；命中已审核且未过期知识片段时写 `AiCitation`，无资料或资料不足时写失败 `AiTask` 且引用数为 0，不伪造来源。
- 已复用 `KnowledgeDocument / KnowledgeChunk / AiTask / AuditLog / access.mjs / memory-test-prisma`：引用记录保留 sourceType、sourceId、知识文档、知识片段、文件名、版本、段落 locator、confidence 和来源策略；引用列表分页并返回摘要，详情接口返回完整知识文档/片段上下文。
- `npm run test:p2-ai-citation`：通过，输出 `{"result":"passed","aiTasks":2,"aiCitations":1,"citationSource":"CITE-001-FAQ.md"}`，覆盖已审核资料回答写引用、任务引用计数、引用列表摘要、引用详情、无来源零引用和 AiTask 审计。
- 支线结论：审核支线已给 `PASS`；性能支线已给 `PASS`，仅建议后续数据量上来后补全文/向量检索、productId 下推过滤和 citation 详情 includeContext 开关；QA 支线完成一轮但未返回可见正文，以本地专项 smoke、审核 PASS 和性能 PASS 兜底。
- 关键回归已通过：
  - `npm run test:p2-rag`：`{"result":"passed","mode":"knowledge_base","status":"ANSWERED_WITH_SOURCES","sources":1,"knowledgeDocuments":2,"knowledgeChunks":3}`
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:p2-ai-contract`：`{"result":"passed","contracts":2,"outputSchemas":2,"evalCases":2,"aiTasks":2}`
  - `npm run test:p2-ai-policy`：`{"result":"passed","policyRules":1,"costLimits":1,"aiTasks":4,"failedTasks":3}`
  - `npm run test:p2-ai-feedback`：`{"result":"passed","aiTasks":1,"aiFeedbacks":3,"auditLogs":3}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-commission`：`{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未接入 pgvector、真实模型 RAG、真实引用评分、文档解析/OCR 和引用冲突检测；这些需在真实模型供应商、向量库和文档解析策略授权后再接。

## P2 外部工具调用 / 人工批准台账（RUNNABLE-PASS）

- `node --check src/ai-gateway-routes.mjs src/memory-test-prisma.mjs test/p2-tool-call-smoke.mjs`：通过。
- 已新增 `ToolCall` 模型和迁移 `20260825090000_tool_calls`。
- 已新增 `GET/POST /api/tool-calls`、`GET /api/tool-calls/:id`、`POST /api/tool-calls/:id/confirm`、`POST /api/tool-calls/:id/result`。
- 已按 V2.0 补齐外部动作“草稿 → 人工确认 → 执行 → 结果记录”第一版台账：创建时只登记待确认工具调用；`executeNow/autoExecute` 会返回 `400 TOOL_EXECUTION_NOT_SUPPORTED`；`requiresHumanConfirmation=false` 会返回 `400 HUMAN_CONFIRMATION_REQUIRED`；确认前不能记录执行结果；执行结果必须 `confirmedHumanExecution=true`。
- 已复用 `AiTask / User / AuditLog / access.mjs / memory-test-prisma`：ToolCall 可关联 AiTask，模块必须匹配；sales/manager/admin 可创建或确认，finance/exec 只读；manager 可确认团队销售创建的调用；列表分页并隐藏 inputSummary/executionResult，详情才返回完整台账。
- `npm run test:p2-tool-call`：通过，输出 `{"result":"passed","aiTasks":1,"toolCalls":2,"finalStatus":"EXECUTION_RECORDED","failedStatus":"FAILED"}`，覆盖财务创建 403、禁止自动执行、必须人工确认、关联 AiTask 模块一致、敏感字段 redaction、确认前不能记录结果、确认缺失 400、财务确认 403、manager 确认、人工执行结果记录和失败降级记录。
- 支线结论：审核支线已给 `PASS`；性能支线已给 `PASS`，仅建议后续接真实工具前补最终字节上限、CRITICAL 二次审批、provider/tool allowlist、工具级权限矩阵、幂等键、超时和重试；QA 支线完成一轮但未返回可见正文，以本地专项 smoke、审核 PASS 和性能 PASS 兜底。
- 关键回归已通过：
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:p2-ai-contract`：`{"result":"passed","contracts":2,"outputSchemas":2,"evalCases":2,"aiTasks":2}`
  - `npm run test:p2-ai-policy`：`{"result":"passed","policyRules":1,"costLimits":1,"aiTasks":4,"failedTasks":3}`
  - `npm run test:p2-ai-feedback`：`{"result":"passed","aiTasks":1,"aiFeedbacks":3,"auditLogs":3}`
  - `npm run test:p2-ai-citation`：`{"result":"passed","aiTasks":2,"aiCitations":1,"citationSource":"CITE-001-FAQ.md"}`
  - `npm run test:p2-rag`：`{"result":"passed","mode":"knowledge_base","status":"ANSWERED_WITH_SOURCES","sources":1,"knowledgeDocuments":2,"knowledgeChunks":3}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-commission`：`{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 尚未接入真实邮件、社媒、物流、日历、MCP 或外部连接器；后续接入前必须继续沿用 ToolCall 白名单、人工确认和结果回填台账。

## P2 自动化规则 / 试运行 / 执行日志（RUNNABLE-PASS）

- `node --check src/automation-routes.mjs src/server.mjs src/memory-test-prisma.mjs test/p2-automation-smoke.mjs`：通过。
- 已新增 `AutomationRule`、`AutomationRun` 模型和迁移 `20260825110000_automation_rules`。
- 已新增 `GET/POST /api/automation-rules`、`GET /api/automation-rules/:id`、`PATCH /api/automation-rules/:id/status`、`POST /api/automation-rules/:id/run`、`GET /api/automation-runs`、`GET /api/automation-runs/:id`。
- 已按 V2.0 补齐自动化第一版安全闭环：规则支持 DRAFT/ACTIVE/PAUSED/ARCHIVED；支持 EVENT/SCHEDULE/CONDITION；支持 dry-run、人工覆盖运行、运行日志、retryPolicy、dedupePolicy 和 idempotencyKey 防重复；第一版不直接发送邮件、发布社媒、改价、建单或调用外部连接器。
- 已复用 `User / AuditLog / memory-test-prisma`：manager/admin 可维护规则和运行；sales/finance/exec 可读；列表分页并返回摘要，详情才返回完整 condition/action/input/proposedActions；输入会 redaction。
- `npm run test:p2-automation`：通过，输出 `{"result":"passed","automationRules":1,"automationRuns":2,"dryRunStatus":"DRY_RUN_RECORDED","manualStatus":"MANUAL_OVERRIDE_RECORDED","duplicatePrevented":true}`，覆盖 finance 创建 403、禁止外部执行 action、规则创建、列表摘要、DRAFT dry-run、ACTIVE 启用、人工覆盖缺确认 400、人工覆盖运行、幂等防重复、运行列表摘要、运行详情、规则运行计数、PAUSED 后人工覆盖阻断和 AuditLog。
- 支线结论：审核支线按 V2.0 唯一基准给出 `CONDITIONAL-PASS`，认为未发现阻断“先跑通”的偏离；生产前条件项为 PII 字段加密、PostgreSQL 实库 migrate/smoke、真实外部工具 allowlist/权限/幂等/超时策略。性能支线按 V2.0 唯一基准给出 `PASS`。主线与 QA 支线已接收最终版基准但未返回可见正文，暂不冒充 PASS。
- 关键回归已通过：
  - `npm run test:p2-tool-call`：`{"result":"passed","aiTasks":1,"toolCalls":2,"finalStatus":"EXECUTION_RECORDED","failedStatus":"FAILED"}`
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:p2-ai-policy`：`{"result":"passed","policyRules":1,"costLimits":1,"aiTasks":4,"failedTasks":3}`
  - `npm run test:p2-ai-feedback`：`{"result":"passed","aiTasks":1,"aiFeedbacks":3,"auditLogs":3}`
  - `npm run test:p2-ai-citation`：`{"result":"passed","aiTasks":2,"aiCitations":1,"citationSource":"CITE-001-FAQ.md"}`
  - `npm run test:p2-rag`：`{"result":"passed","mode":"knowledge_base","status":"ANSWERED_WITH_SOURCES","sources":1,"knowledgeDocuments":2,"knowledgeChunks":3}`
  - `npm run test:p2-quote-send`：`{"result":"passed","mode":"quote-pdf-send-record","pdfBytes":1144,"communicationEvents":1,"quoteStatus":"SENT"}`
  - `npm run test:p2-order`：`{"result":"passed","orders":3,"orderItems":3,"fulfillmentEvents":3,"auditLogs":14}`
  - `npm run test:p2-payment`：`{"result":"passed","payments":3,"confirmedPayments":2,"auditLogs":18}`
  - `npm run test:p2-trade-document`：`{"result":"passed","mode":"trade-documents-reconciliation","documents":4,"approved":3,"readyToShip":true,"auditLogs":22}`
  - `npm run test:p2-fulfillment-shipment`：`{"result":"passed","mode":"production-logistics-gates","shipments":1,"shipmentStatus":"DELIVERED","orderFulfillmentStatus":"DELIVERED","fulfillmentEvents":5,"auditLogs":25}`
  - `npm run test:p2-commission`：`{"result":"passed","mode":"commission-confirmed-payments","records":2,"approved":1,"commissionAmount":2.8,"auditLogs":20}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
- 已补第一版站内通知、连接器配置台账和 Webhook 接收台账；尚未接入真实调度器、队列、通知推送 worker、外部连接器执行、重试 worker 或实际 Todo 创建。后续接入前必须继续保持 dry-run、幂等键、人工覆盖、执行日志和连接器降级策略。

## P2 通知 / 连接器 / Webhook 接收台账（RUNNABLE-PASS）

- `node --check src/integration-routes.mjs src/server.mjs src/memory-test-prisma.mjs test/p2-integration-smoke.mjs`：通过。
- 已新增 `Notification`、`IntegrationConnection`、`WebhookEvent` 模型和迁移 `20260825113000_integration_notifications`。
- 已新增 `GET/POST /api/notifications`、`GET /api/notifications/:id`、`PATCH /api/notifications/:id/read`、`GET/POST /api/integration-connections`、`GET /api/integration-connections/:id`、`PATCH /api/integration-connections/:id/status`、`GET/POST /api/webhook-events`、`GET /api/webhook-events/:id`。
- 已按 V2.0 补齐渠道集成层第一版安全台账：站内通知只允许接收人查看和标记已读；连接器只保存配置摘要、`secretRef` 和降级方式，不保存明文密钥；Webhook 第一版只记录接收摘要，不自动处理外部动作；连接器不可用时保留 `MANUAL_ENTRY / CSV_IMPORT / CSV_EXPORT / DRAFT_EXPORT` 降级口径。
- 已复用 `User / AuditLog / memory-test-prisma / AutomationRule / ToolCall` 安全边界：manager/admin 可创建通知、维护连接器和登记 Webhook；exec 可只读连接器与 Webhook；sales/finance 不能维护连接器；通知列表强制 `recipientId = actor.id`，管理员也不能越权查看个人通知。
- `npm run test:p2-integration`：通过，输出 `{"result":"passed","notifications":1,"integrationConnections":1,"webhookEvents":1,"duplicatePrevented":true,"connectionStatus":"ACTIVE"}`，覆盖 finance 创建通知 403、站内通知创建、敏感字段 redaction、通知个人隔离、本人已读、finance 读取连接器 403、明文密钥拒绝、连接器创建、列表摘要隐藏 configSummary/secretRef、状态健康检查、sales 登记 Webhook 403、禁止自动处理、Webhook 接收、幂等防重复、列表摘要和详情。
- 支线结论：审核支线按 V2.0 唯一基准给出 `PASS`；性能支线给出 `PASS`，其关于 Webhook 幂等命中响应摘要化的建议已回补，剩余 safeSummary 最终字节上限、并发唯一冲突捕获为非阻断优化；QA 支线完成但无可见正文，以本地专项 smoke、审核 PASS 和性能 PASS 兜底。
- 关键回归已通过：
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma generate`：通过，Prisma Client 已生成。
  - `npm run test:p2-automation`：`{"result":"passed","automationRules":1,"automationRuns":2,"dryRunStatus":"DRY_RUN_RECORDED","manualStatus":"MANUAL_OVERRIDE_RECORDED","duplicatePrevented":true}`
  - `npm run test:p2-tool-call`：`{"result":"passed","aiTasks":1,"toolCalls":2,"finalStatus":"EXECUTION_RECORDED","failedStatus":"FAILED"}`
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
- 尚未接入真实邮件、社媒、物流、日历、MCP、外部 Webhook 验签、通知推送 worker 或连接器执行器；这些必须在单独授权后继续沿用 `secretRef`、allowlist、人工确认、幂等、超时、重试和失败降级台账。

## P2 工作台 / 个人 Todo / Memo（RUNNABLE-PASS）

- `node --check src/dashboard-routes.mjs src/server.mjs src/memory-test-prisma.mjs test/p2-dashboard-smoke.mjs`：通过。
- 未新增模型或迁移；复用 V2.0 已存在的 `Todo`、`Memo`，并聚合 `QuoteApproval`、`Notification`、`ToolCall`、`SampleRequest`、`OrderPayment`、`AutomationRun`、`WebhookEvent` 等既有模块。
- 已新增 `GET /api/dashboard`、`GET/POST /api/todos`、`GET/PATCH /api/todos/:id`、`GET/POST /api/memos`、`GET/PATCH /api/memos/:id`，并让 `GET /api/dashboard` 从原本的 planned 501 变为可运行接口。
- 已按 V2.0 补齐“工作台必须可行动，不是展示墙”的第一版：返回个人待办、未读通知、报价审批队列、待确认工具动作、样品事项、待确认回款、自动化运行记录、Webhook 风险和个人备忘摘要；当前为 `LOCAL_SUMMARY_ONLY`，不调用 AI、不外发数据、不自动改写业务数据。
- 已按 V2.0 个人数据红线强制隔离：`Todo/Memo` 查询固定 `userId = session.user.id`；管理员也不能越权查看或修改他人的个人待办/备忘；写入和更新均写 `AuditLog`。
- `npm run test:p2-dashboard`：通过，输出 `{"result":"passed","todos":1,"memos":1,"unreadNotifications":1,"dashboardMode":"LOCAL_SUMMARY_ONLY"}`，覆盖 dashboard 不再 501、非法 range 400、个人 Todo 创建/列表/完成、个人 Memo 创建/更新、管理员查看他人 Todo/Memo 403、通知进入工作台摘要且不暴露 metadata、AuditLog。
- 支线结论：审核支线按 V2.0 唯一基准给出 `PASS`；性能支线给出 `PASS`，仅建议后续补 `Todo(userId, doneAt, dueAt)`、`Memo(userId, updatedAt)` 组合索引，并为 dashboard 全局计数增加时间窗口或角色可见范围；QA 支线完成但无可见正文，以本地专项 smoke、审核 PASS 和性能 PASS 兜底。
- 关键回归已通过：
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
  - `npm run test:p2-integration`：`{"result":"passed","notifications":1,"integrationConnections":1,"webhookEvents":1,"duplicatePrevented":true,"connectionStatus":"ACTIVE"}`
  - `npm run test:p2-automation`：`{"result":"passed","automationRules":1,"automationRuns":2,"dryRunStatus":"DRY_RUN_RECORDED","manualStatus":"MANUAL_OVERRIDE_RECORDED","duplicatePrevented":true}`
  - `npm run test:p2-tool-call`：`{"result":"passed","aiTasks":1,"toolCalls":2,"finalStatus":"EXECUTION_RECORDED","failedStatus":"FAILED"}`
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
- 尚未接入 AI 晨会简报、真实经营分析、AnalyticsAlert、ReportSnapshot、AnalyticsMetricsCache 或 NL2SQL；这些属于后续增强，不能因此重做当前工作台/Todo/Memo 底座。

## P2 获客 / 线索 / 询盘（RUNNABLE-PASS）

- `node --check src/acquisition-routes.mjs src/server.mjs src/memory-test-prisma.mjs test/p2-acquisition-smoke.mjs`：通过。
- 已参考历史 `nexfab-crm-from-zai/source/src/app/api/inquiries` 的询盘口径，但没有整包迁移；当前实现按 V2.0 重建为轻量 Lead + Inquiry，并复用现有 `Customer / Opportunity / User / AuditLog`。
- 已新增 `Lead`、`LeadFollowUp`、`Inquiry`、`InquiryItem`、`ChannelMessage` 模型和迁移 `20260825120000_acquisition_leads_inquiries`。
- 已新增 `GET/POST /api/leads`、`GET /api/leads/:id`、`POST /api/leads/:id/status`、`POST /api/leads/:id/assign`、`GET/POST /api/leads/:id/follow-ups`、`POST /api/leads/:id/convert`、`GET/POST /api/inquiries`、`GET /api/inquiries/:id`、`POST /api/inquiries/:id/status`、`POST /api/inquiries/:id/items`、`POST /api/inquiries/:id/messages`。
- 已按 V2.0 补齐第一版获客闭环：Lead 是轻量线索，不强制关联客户；线索支持来源、渠道、国家、语言、产品兴趣、采购身份、负责人、状态、优先级、跟进、分配和转客户；转客户/商机时复用现有 `Customer / Opportunity`，不新建平行客户/商机。
- 已按 V2.0 询盘结构化要求补齐第一版 Inquiry：支持 subject/content、requirements、missingFields、items、ChannelMessage、`aiExtracted` 标记；当前只记录人工或已确认提取结果，不调用模型、不自动写报价。
- 已补人工查重边界：同名客户存在时，`POST /api/leads/:id/convert` 会返回 `409 DUPLICATE_CHECK_REQUIRED`，必须 `duplicateCheckConfirmed=true` 或指定现有客户后才能转化。
- `npm run test:p2-acquisition`：通过，输出 `{"result":"passed","leads":2,"inquiries":1,"customers":2,"opportunities":1,"inquiryItems":2}`，覆盖 finance 访问线索 403、销售创建线索、经理看团队线索、admin 创建公海线索、销售不能看未分配线索、经理分配、线索跟进、询盘创建、items、channel messages、线索状态进入 INQUIRY、同名客户转化 409、人工确认转客户/商机、重复转化阻断和 AuditLog。
- 关键回归已通过：
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：`The schema at prisma/schema.prisma is valid 🚀`
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma generate`：通过，Prisma Client 已生成。
  - `npm run test:smoke`：`{"result":"passed","customers":2,"contacts":1,"opportunities":1,"followUps":1,"auditLogs":10}`
  - `npm run test:p2-dashboard`：`{"result":"passed","todos":1,"memos":1,"unreadNotifications":1,"dashboardMode":"LOCAL_SUMMARY_ONLY"}`
  - `npm run test:p2-quote-lock`：`{"result":"passed","mode":"quote-lock-approval","approvals":1,"lockedVersions":2}`
  - `npm run test:p2-ai-gateway`：`{"result":"passed","aiTasks":2,"promptTemplates":1,"cloudFailureStatus":502,"dataSentToCloud":false}`
  - `npm run test:p2-integration`：`{"result":"passed","notifications":1,"integrationConnections":1,"webhookEvents":1,"duplicatePrevented":true,"connectionStatus":"ACTIVE"}`
  - `npm run test:p2-tool-call`：`{"result":"passed","aiTasks":1,"toolCalls":2,"finalStatus":"EXECUTION_RECORDED","failedStatus":"FAILED"}`
  - `npm run test:p2-automation`：`{"result":"passed","automationRules":1,"automationRuns":2,"dryRunStatus":"DRY_RUN_RECORDED","manualStatus":"MANUAL_OVERRIDE_RECORDED","duplicatePrevented":true}`
  - `npm test`：`Phase 1 security, navigation, and scope checks passed.`
- 尚未接入 CSV/Excel 导入、网站表单真实入口、社媒 API、展会名片 OCR、CustomerFingerprint 指纹库、AI 询盘抽取执行器或线索评分；这些属于后续增强，不能因此重做当前 Lead/Inquiry/CRM 复用底座。

## P3 工具中心六项最小闭环（RUNNABLE-PASS）

- 新增工具中心独立后端路由 `src/tools-routes.mjs`，复用现有 Customer、Opportunity、CustomerFingerprint、AuditLog、quote-engine 汇率口径和旧 GoodJob `followup-copy` 本地话术模板思路。
- 覆盖六项：`POST /api/tools/ocr`、`POST /api/tools/website-link`、`GET /api/tools/fx`、`POST /api/tools/dedupe`、`POST /api/tools/followup-copy`、`GET /api/tools/hs`。
- 前端接入：`frontend/src/components/p3-tools-center-view.tsx` 接入六项工具 API，`crm-shell.tsx` 将工具中心全部路由到该视图，`api.ts/types.ts` 补齐 API wrapper 和类型。
- 边界：OCR 为 dry-run / 人工文本解析，不接真实 OCR；汇率和 HS 为本地参考，不替代正式财务汇率版本或海关归类；话术为本地模板草稿，不调用真实 AI；客户去重复用现有指纹范围过滤。
- 验证：
  - `node --check src/tools-routes.mjs && node --check src/server.mjs && node --check test/p3-tools-smoke.mjs`：通过。
  - `npm run test:p3-tools`：通过，输出 `{"result":"passed","mode":"p3-tools-center","fxConverted":785,"hsMatches":1,"hiddenDedupe":1,"auditLogs":10}`。
  - `npm run test:p2-acquisition`：通过。
  - `npm run test:smoke`：通过。
  - `npm test`：通过，输出 `Phase 1 security, navigation, and scope checks passed.`。
  - `DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/nexfab_test' npx prisma validate`：通过。
  - `frontend npm run typecheck`：通过。
  - `frontend npm run build`：通过。
