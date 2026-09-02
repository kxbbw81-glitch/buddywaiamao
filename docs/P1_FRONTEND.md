# NexFab AI CRM V2.0 P1 正式前端接入记录

> 当前范围：P1.1「线索/询盘 → 客户/联系人/跟进」。本文件记录正式前端如何复用现有后端能力，不代表 P1 全部完成。

## P1.1 结论

- 状态：M1.1 候选，已完成可演示、可测试的正式前端闭环。
- 原则：只消费现有 backend API，不新增平行业务模型，不重写后端/Prisma/权限/审计规则。
- UI 基准：继续沿用真实导航预览 HTML 的左侧导航、卡片化、紧凑表单和状态提醒风格。

## 复用 API / 后端文件

| 前端动作 | API | 复用后端 |
| --- | --- | --- |
| 创建/列表线索 | `GET/POST /api/leads` | `backend/src/acquisition-routes.mjs` |
| 线索跟进 | `GET/POST /api/leads/:id/follow-ups` | `backend/src/acquisition-routes.mjs` |
| 创建/列表询盘 | `GET/POST /api/inquiries` | `backend/src/acquisition-routes.mjs` |
| 询盘商品/消息/状态 | `/api/inquiries/:id/items`、`/messages`、`/status` | `backend/src/acquisition-routes.mjs` |
| 客户列表/创建 | `GET/POST /api/customers` | `backend/src/crm-routes.mjs` |
| 联系人创建 | `POST /api/customers/:id/contacts` | `backend/src/crm-routes.mjs` |
| 商机创建/列表 | `GET/POST /api/opportunities` | `backend/src/crm-routes.mjs` |
| 商机跟进 | `POST /api/opportunities/:id/follow-ups` | `backend/src/crm-routes.mjs` |
| 客户指纹查重 | `POST /api/tools/dedupe` | `backend/src/customer-fingerprint.mjs` |

## 前端改动

- `frontend/src/components/p1-acquisition-crm-view.tsx`
  - 新增 P1.1 业务闭环页面。
  - 覆盖线索录入、询盘登记、查重、人工确认转客户/商机、客户/联系人维护、商机跟进。
- `frontend/src/components/crm-shell.tsx`
  - 将动态导航中的获客、客户档案、销售管道、跟进任务、客户去重入口接入 P1.1 页面。
- `frontend/src/lib/api.ts`
  - 扩展 acquisition / CRM API client，仍走 `/api/backend` 同源代理。
- `frontend/src/lib/types.ts`
  - 增加 P1.1 页面需要的 Lead、Inquiry、Customer、Contact、Opportunity、FollowUp、Dedupe 类型。
- `frontend/test/p1-acquisition-crm-integration.mjs`
  - 新增前端代理集成 smoke，验证正式前端 API 代理可跑通 P1.1 主链路。
- `frontend/package.json`
  - 新增 `test:p1-acquisition-crm`。

## 已验证命令

```bash
cd /private/tmp/nexfab-crm-v2-deploy.f8549e/frontend
npm run typecheck
npm run lint
npm run build
npm run test:p0-ui-contract
npm run test:p0-platform
npm run test:p1-acquisition-crm

cd /private/tmp/nexfab-crm-v2-deploy.f8549e/backend
npm test
npm run test:smoke
npm run test:p2-acquisition
```

关键输出：

```json
{"result":"passed","mode":"p1-acquisition-crm-frontend","leadStatus":"CONVERTED","inquiryStatus":"QUOTING","dedupe":true,"followUps":1,"financeLeads":403}
```

## 本轮明确不处理的 P1 后续缺口

- `POST /api/leads/import` 当前只在 API contract 中出现，后端 `acquisition-routes.mjs` 未实现，会回落 501；归入后续“模板/导入”独立小闭环。
- 报价、样品、订单、回款、生产物流、单证的正式前端详情页尚未在 P1.1 范围内接入。
- 本轮不部署、不 SSH、不写生产库、不执行 Git 写操作。

---

## P1.2 产品与确定性报价正式前端接入

> 当前范围：产品列表/创建、产品资料状态、快速报价规则预览、报价版本、锁定/审批、PDF 获取、人工确认发送。未进入 AI/RAG、样品、订单、回款、单证范围。

### P1.2 结论

- 状态：M1.2 候选，已完成可演示、可测试的正式前端闭环。
- 原则：只消费现有 backend API，不新增产品/报价平行模型，不在前端内置固定产品、客户、价格或行业样例。
- 业务计算：费用、成本、毛利、币种、贸易术语、低毛利审批、PDF 锁定、发送留痕均由后端确定性规则校验。

### 复用 API / 后端文件

| 前端动作 | API | 复用后端 |
| --- | --- | --- |
| 产品分类列表/创建 | `GET/POST /api/product-categories` | `backend/src/product-routes.mjs` |
| 产品列表/创建 | `GET/POST /api/products` | `backend/src/product-routes.mjs` |
| 产品资料状态 | `GET/POST /api/products/:id/docs` | `backend/src/product-routes.mjs` |
| 客户选择 | `GET /api/customers` | `backend/src/crm-routes.mjs` |
| 确定性报价计算 | `POST /api/quotes/calculate` | `backend/src/quote-routes.mjs`、`backend/src/quote-engine.mjs` |
| 快速报价 | `POST /api/quotes/quick` | `backend/src/quote-routes.mjs` |
| 报价列表/详情/版本 | `GET /api/quotes`、`GET /api/quotes/:id/versions` | `backend/src/quote-routes.mjs` |
| 锁定/审批 | `POST /api/quotes/:id/versions/:versionId/lock` | `backend/src/quote-routes.mjs` |
| PDF 获取 | `GET /api/quotes/:id/versions/:versionId/pdf` | `backend/src/quote-pdf.mjs` |
| 人工确认发送 | `POST /api/quotes/:id/send` | `backend/src/quote-routes.mjs` |

### 前端改动

- `frontend/src/components/p1-product-quote-view.tsx`
  - 新增产品与确定性报价页面。
  - 支持产品分类、产品、资料状态、报价计算、创建报价、锁定/审批、PDF、人工发送留痕。
- `frontend/src/components/crm-shell.tsx`
  - 将 `产品知识库 / 产品库（PIM）`、`报价中心 / 快速报价`、`报价中心 / 报价管理` 接入 P1.2 页面。
- `frontend/src/lib/api.ts`
  - 扩展产品、报价、PDF 二进制获取等 API client，仍走 `/api/backend` 同源代理。
- `frontend/src/lib/types.ts`
  - 增加 Product、ProductDoc、Quote、QuoteVersion、QuoteCalculationResult 等类型。
- `frontend/test/p1-product-quote-integration.mjs`
  - 新增前端代理集成 smoke，覆盖产品 → 报价计算 → 创建报价 → 未锁 PDF 阻断 → 锁定 → PDF → 未确认发送阻断 → 人工确认发送 → 权限拒绝。
- `frontend/package.json`
  - 新增 `test:p1-product-quote`。

### 已验证命令

```bash
cd /private/tmp/nexfab-crm-v2-deploy.f8549e/frontend
npm run typecheck
npm run lint
npm run build
npm run test:p0-ui-contract
npm run test:p0-platform
npm run test:p1-acquisition-crm
npm run test:p1-product-quote

cd /private/tmp/nexfab-crm-v2-deploy.f8549e/backend
npm run test:p2-product
npm run test:p2-quote
npm run test:p2-quote-rules
npm run test:p2-quote-lock
npm run test:p2-quote-send
```

关键输出：

```json
{"result":"passed","mode":"p1-product-quote-frontend","productDocs":1,"tradeTerm":"DDP","ddpTotal":897.76,"quoteStatus":"SENT_RECORDED","pdfBytes":1161,"financeProducts":403,"financeCalculate":403,"salesProductWrite":403}
```

### 本轮明确不处理的后续项

- 不进入 P1.3 样品/订单/回款/单证。
- 不接 AI/RAG、真实模型、连接器。
- 不部署、不 SSH、不写生产库、不执行 Git 写操作。

---

## P1.3 样品 → 订单 → 回款 → 单证 → 生产/物流正式前端接入

> 当前范围：样品创建、样品进度、反馈、转订单；报价转订单；收款登记与财务确认；PI/CI/PL/SC 生成与审核；订单门禁、生产/备货、待发货、发货与签收。未进入 AI/RAG、P1.4 导入/看板、后端架构重写。

### P1.3 结论

- 状态：M1.3 候选，已完成可演示、可测试的无 AI 履约闭环前端。
- 原则：只消费现有 backend API 与既有业务规则，不新增平行模型，不复制交接 backend，不在前端硬编码客户/产品/价格样例。
- 业务门禁：样品反馈、回款确认、单证审核、发货必填信息、越权拒绝等均由后端返回确定性错误，前端只负责展示与引导。

### 复用 API / 后端文件

| 前端动作 | API | 复用后端 |
| --- | --- | --- |
| 样品列表/创建 | `GET/POST /api/samples` | `backend/src/sample-routes.mjs` |
| 样品状态/反馈 | `PATCH /api/samples/:id/status` | `backend/src/sample-routes.mjs` |
| 样品转订单 | `POST /api/samples/:id/convert-to-order` | `backend/src/sample-routes.mjs`、既有 `SalesOrder/OrderItem/FulfillmentEvent` |
| 报价转订单 | `POST /api/orders/from-quote/:quoteId` | `backend/src/order-routes.mjs` |
| 订单列表/详情/门禁 | `GET /api/orders`、`GET /api/orders/:id`、`GET /api/orders/:id/gate` | `backend/src/order-routes.mjs` |
| 回款登记/财务确认 | `POST /api/payments`、`POST /api/payments/:id/confirm` | `backend/src/payment-routes.mjs` |
| PI/CI/PL/SC 生成与审核 | `POST /api/orders/:id/documents/generate`、`POST /api/trade-documents/:id/review` | `backend/src/trade-document-routes.mjs` |
| 对账/发货准备 | `GET /api/orders/:id/reconciliation` | `backend/src/trade-document-routes.mjs` |
| 生产/待发货/物流/签收 | `PATCH /api/orders/:id/fulfillment/status`、`POST /api/orders/:id/shipments`、`PATCH /api/shipments/:id/status` | `backend/src/fulfillment-shipment-routes.mjs` |

### 前端改动

- `frontend/src/components/p1-fulfillment-flow-view.tsx`
  - 新增 P1.3 履约闭环页面，覆盖样品、订单、回款、单证、生产/物流与 10 个业务里程碑展示。
  - 所有写操作带 loading 禁用，后端 400/403/409 等业务错误以可读提示展示。
- `frontend/src/components/crm-shell.tsx`
  - 将动态导航中的样品管理、合同订单、生产跟踪、物流管理、单证管理、财务订单与回款入口接入 P1.3 页面。
- `frontend/src/lib/api.ts`
  - 扩展样品、订单、回款、单证、对账、履约与物流 API client，继续走 `/api/backend` 同源代理。
- `frontend/src/lib/types.ts`
  - 增加 SampleRequest、SalesOrder、OrderPayment、TradeDocument、ReconciliationResult、Shipment 等类型。
- `frontend/test/p1-fulfillment-flow-integration.mjs`
  - 新增 P1.3 前端代理集成 smoke，覆盖样品/报价起点到订单、财务确认、PI/CI/PL、生产发货签收、越权与门禁阻断。
- `frontend/package.json`
  - 新增 `test:p1-fulfillment-flow`。

### 已验证命令

```bash
cd /private/tmp/nexfab-crm-v2-deploy.f8549e/frontend
npm run typecheck
npm run lint
npm run build
npm run test:p0-ui-contract
npm run test:p0-platform
npm run test:p1-acquisition-crm
npm run test:p1-product-quote
npm run test:p1-fulfillment-flow

cd /private/tmp/nexfab-crm-v2-deploy.f8549e/backend
npm run test:p2-sample
npm run test:p2-order
npm run test:p2-payment
npm run test:p2-trade-document
npm run test:p2-fulfillment-shipment
```

关键输出：

```json
{"result":"passed","mode":"p1-fulfillment-flow-frontend","sampleStatus":"CONVERTED","orderFulfillmentStatus":"DELIVERED","paymentStatus":"CONFIRMED","documentsApproved":3,"reconciliationReady":true,"shipmentStatus":"DELIVERED","blocks":["SAMPLE_FEEDBACK_REQUIRED","FULFILLMENT_GATE_BLOCKED","DOCUMENT_SOURCE_LOCKED"],"denied":{"execSampleWrite":403,"financeSamples":403,"salesConfirm":403,"execGenerate":403,"financeShipmentWrite":403}}
```

### 本轮保留的产品/后端口径

- 样品后端目前支持 7 个写入状态，前端展示 10 个业务里程碑；未伪造后端不存在的状态。
- 质检在当前后端由 `READY_TO_SHIP` 门禁与说明承载，未新增独立 `QCInspection` 平行模型。
- 现有 `POST /api/orders/from-quote/:quoteId` 允许同一报价生成多个订单；P1.3 测试遵循既有 `test:p2-order` 口径。若产品要求“一报价只转一次订单”，应作为单独后端规则变更提交门禁。
- 本轮不部署、不 SSH、不写生产库、不执行 Git 写操作。

---

## P1.4 标准模板、导入与基础经营看板

> 当前范围：标准模板、CSV/Excel 导入前置能力、导入冲突/错误报告、基础经营看板。禁止进入 AI/RAG、P2/P3 性能改造、部署和 Git 写操作。

### P1.4 复用审计结论

- `POST /api/leads/import` 已由总控补齐 `dryRun` 与 `confirmImport`，并保留 PII 加密、RBAC、去重和审计边界；本轮不覆盖 `backend/src/acquisition-routes.mjs` 与 `backend/test/p1-lead-import-smoke.mjs`。
- `POST /api/quote-rule-sets/excel-audit` 已可复用为 Excel V2 脏数据只读审计，不会写入 QuoteRuleSet/Quote/QuoteVersion。
- `GET /api/dashboard` 已可复用为工作台摘要；本轮补充业务累计概览字段，前端必须标注“当前累计概览”，不得把 `today/7d/30d` 显示为真实日期窗口统计。
- 产品、客户、报价规则既有后端模型继续复用；供应商/成本当前没有独立 `Supplier` 模型，按 `Product.costVersions` JSON 做成本来源更新，不新建平行供应商模型。

### P1.4 后端/API 增量

- 新增 `backend/src/import-template-routes.mjs`
  - `GET /api/import/templates`：返回当前角色可访问的模板列表。
  - `GET /api/import/templates/:type`：返回单类模板字段、校验约束、空白 CSV 表头与字段说明 CSV；模板只含列名/说明/约束，不含业务样例数据。
  - `POST /api/import/leads`：通用导入入口的线索 dryRun/confirm 版本；正式前端线索导入仍可直接调用总控版 `POST /api/leads/import`。
  - `POST /api/import/customers`：客户 + 首要联系人导入，dryRun 不写库，正式导入写 Contact PII 密文与 CustomerFingerprint。
  - `POST /api/import/products`：产品导入，复用 Product/ProductCategory，不内置固定商品。
  - `POST /api/import/supplier-costs`：供应商/成本导入，更新 `Product.costVersions.suppliers[]` 与 current 成本，不新增 Supplier 表。
  - `POST /api/import/quote-rules`：报价规则导入，复用 QuoteRuleSet 与 `quoteRules()` 校验。
- 更新 `backend/src/server.mjs`
  - 接入 `handleImportTemplateRoute`，且不抢占总控版 `/api/leads/import`。
- 更新 `backend/src/dashboard-routes.mjs`
  - 在原有 metrics/actionCards 基础上新增 `business`：funnel、revenue、operations、risks。
  - 明确 `business.mode = CURRENT_CUMULATIVE_OVERVIEW`，并返回口径说明。
- 更新 `frontend/src/lib/api.ts` 与 `frontend/src/lib/types.ts`
  - 增加 ImportTemplate、ImportReport、DashboardBusinessOverview 等 API 类型。
- `frontend/package.json`
  - 增加 `xlsx`，用于后续 P1.4 前端支线在浏览器本地解析 Excel；解析结果仍必须先走后端 dryRun。

### 数据范围与安全口径

- 所有导入写入均需 `dryRun=false + confirmImport=true`；缺少确认返回 400。
- dryRun 只生成预览/冲突/错误报告，不写业务模型、不写审计业务创建记录。
- 冲突报告只基于 actor 可见客户范围返回候选，不返回隐藏客户 ID、`hiddenCount` 或任何不可见重复存在信号。
- 线索/客户联系人 PII 正式导入后以密文/哈希存储，报告和审计不回显明文邮箱/电话。
- 财务等无权角色对获客/产品/报价规则导入返回 403；销售不可导入产品或报价规则。

### 已验证命令

```bash
cd /private/tmp/nexfab-crm-v2-deploy.f8549e/backend
npm run test:p1-import-templates
npm run test:p1-lead-import
npm run test:p2-dashboard
npm test
npm run test:smoke
npm run test:p2-product
npm run test:p2-quote
npm run test:p2-quote-rules
npm run test:p2-excel-audit
npm run test:p2-order
npm run test:p2-payment
npm run test:p2-trade-document
npm run test:p2-fulfillment-shipment
DATABASE_URL='postgresql://user:pass@127.0.0.1:5432/nexfab_test' npx prisma validate

cd /private/tmp/nexfab-crm-v2-deploy.f8549e/frontend
npm run typecheck
npm run lint
npm run build
npm run test:p0-ui-contract
npm run test:p0-platform
npm run test:p1-acquisition-crm
npm run test:p1-product-quote
npm run test:p1-fulfillment-flow
```

关键输出：

```json
{"result":"passed","mode":"p1-import-templates","templates":5,"leads":1,"customers":2,"products":1,"quoteRules":1}
{"result":"passed","mode":"p1-lead-import","created":3,"importAudits":3}
{"result":"passed","todos":1,"memos":1,"unreadNotifications":1,"dashboardMode":"LOCAL_SUMMARY_ONLY"}
{"result":"passed","mode":"p0-platform-integration","unauth":401,"roles":[{"role":"SALES","modules":10,"subs":39,"metrics":9},{"role":"MANAGER","modules":12,"subs":43,"metrics":9},{"role":"FINANCE","modules":6,"subs":26,"metrics":9},{"role":"EXEC","modules":12,"subs":43,"metrics":9},{"role":"ADMIN","modules":13,"subs":47,"metrics":9}],"financeCrm":403,"invalidDashboardRange":400,"salesOverreach":403}
{"result":"passed","mode":"p1-fulfillment-flow-frontend","sampleStatus":"CONVERTED","orderFulfillmentStatus":"DELIVERED","paymentStatus":"CONFIRMED","documentsApproved":3,"reconciliationReady":true,"shipmentStatus":"DELIVERED"}
```

### 协调说明

- 收到总控分工后，已冻结 `frontend/src/components/p1-import-dashboard-view.tsx` 和 P1.4 专项前端测试文件，不再修改。
- 该分工前已触及 P1.4 前端页面入口与 `dashboard-view`，需由门禁/总控协调是否保留、覆盖或由独立前端支线接管。
- 本轮不部署、不 SSH、不写生产库、不执行 Git 写操作。
