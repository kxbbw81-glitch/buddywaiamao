# NexFab AI CRM V2.0 文档变更记录

## 2026-08-26 — P3-B 社媒获客助手：草稿、审核与线索转化

- 新增 `SocialAccount`、`SocialPost`、`SocialInteraction` 数据模型和 PostgreSQL migration；复用既有 `IntegrationConnection`、Lead、PII 加密、重复客户检查、审计日志与角色权限，不重建 CRM 后端。
- 新增社媒账号台账、平台内容草稿、提交审核、主管/管理员人工通过、人工发布结果登记、互动意图登记与人工转 CRM 线索 API；所有接口均不调用外部平台。
- 新增正式前端社媒运营页，入口为“获客中心 / 社媒运营”，可操作草稿、审核队列、互动登记和人工转线索。
- 增加 `test:p3-social-acquisition`：覆盖财务越权、草稿→审核→人工发布记录、互动意图→CRM 线索以及审计；验证结果为 `externalCalls: 0`。
- 平台 API、账号凭据、自动发布、自动私信、群发和未授权数据采集仍未实现，必须保持人工确认和独立授权。

## 2026-08-26 — P3-C 邮件与渠道草稿：复用沟通时间线

- 新增 `outbound-draft-routes.mjs`，直接复用 `CommunicationEvent` 保存 EMAIL 类型的渠道草稿、审核状态、人工发送结果和审计记录；不新增重复的邮件表或邮件服务器。
- 正式前端“沟通中心 / 邮件管理”已接入草稿创建、提交审核、人工通过和人工发送结果回填。
- `test:p3-outbound-draft` 已覆盖财务越权、草稿到审核到结果回填、沟通时间线落库和零外部调用。
- SMTP/IMAP、真实 B2B 渠道、凭据和自动发送仍未接入，后续只能在独立授权后实现。

## 2026-08-26 — P3-D 经营快照与规则预警（第一批）

- 新增受限只读 `/api/analytics/operations-report`：复用工作台的角色数据范围、业务累计指标和确定性规则，返回不含 PII 的经营快照与人工复核预警。
- “洞察中心 / 数据分析”已接入正式前端。财务与销售角色不能越权读取团队/全局经营分析。
- `test:p3-analytics-report` 已覆盖角色拒绝、团队范围、只读数据来源和零外部副作用。
- 补充经理测试会话的本地浏览器验收：社媒运营、邮件管理、数据分析三个动态导航入口均成功加载正式页面。
- 客户流失概率、销售预测、自由 SQL/NL2SQL、自动报告推送仍未实现；它们需要足够历史数据、评测集和独立授权，不能用当前统计代替。

## 2026-08-26 — P3 工程化第一批：PWA、移动端和 CI

- 新增 PWA manifest、图标与只注册不缓存业务数据的 service worker；不会缓存登录会话、客户资料或 `/api` 响应。
- CRM 壳层新增移动端导航抽屉与 `100dvh` 容器，保留桌面端导航结构和既有业务前端。
- 新增管理员只读运行状态 API 与系统管理状态卡：仅管理员可读取数据库探针、队列后端、脱敏配置、进程资源和备份门禁状态。
- 新增 `p3:backup-postgres`：仅显式确认、绝对输出目录且不覆盖已有文件时才调用 `pg_dump`；生成 SHA-256 manifest，不提供 API 自动执行入口。
- 新增隔离 PostgreSQL 性能基线：300 条客户夹具下，导航 P95 2.3ms、工作台 P95 11.8ms、管理员状态 P95 3.2ms；该结果仅用于本地回归，不替代生产 P95。
- 修复 `dashboard-routes` 中普通 Promise 误传 Prisma 批量事务的问题；该问题只会在真实 PostgreSQL 暴露，现已由真实性能基线覆盖。
- 新增 `.github/workflows/ci.yml`，仅在 push/PR 执行后端/前端测试与 schema 验证；不含部署、生产密钥或外部连接器动作。
- CI 新增隔离的 PostgreSQL 16 + pgvector、Redis 7 基础设施 E2E job，只针对临时服务执行 migration、pgvector 预检和 P2 队列/SSE/RAG 验收；不连接生产数据库。
- 验证通过：`test:p3-pwa-contract`、前端 typecheck/lint/build、管理员状态后端与前端同源集成、备份拒绝误执行测试、隔离 PostgreSQL 的 `pg_dump`→新库恢复演练，以及 P0/P1/P2 前端集成回归。
- 补充 390px 视口本地浏览器验收：移动抽屉默认隐藏在屏外，打开后可进入系统管理，选择菜单后自动收起并显示管理员状态卡。
- 待独立门禁：真实设备 UI 验收、生产 P95/慢查询、备份监控告警、发布与外部连接器授权。

## 2026-08-25 — P2 AI 队列、SSE 与 pgvector 迁库门禁

- 复用既有 `AiTask`、AI Gateway、RAG、能力契约、策略、审计和 ToolCall 模型，未新增平行业务后端。
- 新增 Redis/BullMQ 优先的 AI 异步队列、任务 SSE 状态流和前端同源事件消费；生产没有 Redis 时明确拒绝异步任务，开发/测试内存回退会标记为非生产就绪。
- 新增前端代理实际 SSE 集成验收：入队后通过 `/api/backend` 收到 `QUEUED`/`SUCCEEDED` 终态，且 SSE 禁止缓存头得到保留。
- 新增 pgvector migration、`KnowledgeChunk.embedding vector(1536)`、cosine HNSW 索引、只读预检脚本和迁移契约测试。
- 验证通过：P2 AI/RAG/策略/契约/引用/ToolCall/连接器/自动化/看板全部后端 smoke、`test:p2-ai-async-sse`、前端 typecheck/lint/build/P2 集成、Prisma validate 和迁移契约。
- 已在隔离本地 PostgreSQL 16 + pgvector 与 Redis 7 测试容器执行 25 条迁移、pgvector 预检和真实 DB E2E：`/ready` 200、RAG 引用、SSE 终态、`bullmq-redis` 队列均通过；测试容器和运行时已回收。
- 未执行部署、Git 写操作或真实模型/连接器调用；真实模型与连接器仍须授权后另行接入。

## 2026-08-25 — 阶段 0 审计与规划文档

- 新增 `PROJECT_PLAN.md`：确认 V2.0 完整阶段目标，不再把最小链路作为终点。
- 新增 `ARCHITECTURE.md`：梳理当前后端模块、API 边界、当前部署边界和目标架构。
- 新增 `DATA_MODEL.md`：按当前 Prisma schema 整理核心模型与主链路关系。
- 新增 `ROADMAP.md`：拆分 P0/P1/P2/P3 工作包、依赖、验收与发布里程碑。
- 新增 `DEPLOYMENT.md`：记录当前本地运行、验证命令、生产发布门禁、目标部署与回滚原则。
- 新增 `QUOTE_ENGINE.md`：整理 Excel V2 报价风险、当前可复用报价实现和后续报价规则工作包。
- 新增 `AI_GOVERNANCE.md`：整理 AI Gateway、RAG、人工确认、ToolCall 和后续 P2 AI 治理工作包。

本次只做阶段 0 文档和审计，不执行部署、不写生产库、不提交/推送。

## 2026-08-25 — 阶段 0 补齐 V2 指定文档入口

- 新增 `REUSE_MATRIX.md`：汇总当前发布仓库与交接 backend 的复用/改造/新建/暂缓矩阵。
- 新增 `QUOTATION_V2_AUDIT.md`、`QUOTATION_RULES.md`、`QUOTATION_MIGRATION.md`：补齐报价审计、规则和迁移治理入口。
- 新增 `PROMPT_REGISTRY.md`、`AI_CAPABILITY_CONTRACTS.md`、`AI_EVALS.md`：补齐 AI Prompt、能力契约与评测入口。
- 新增 `INTEGRATIONS.md`：补齐通知、连接器、Webhook 和 ToolCall 治理入口。

本次仍只做阶段 0 文档补齐，不部署、不 SSH、不写生产库、不执行 Git 写操作。


## 2026-08-25 — 阶段 0 独立验证证据与真实缺口收口

- 记录正确基线 backend 独立验证结果：`npm test`、`npm run test:smoke`、全部 24 个 `npm run test:p2-*` 均通过。
- 在 `REUSE_MATRIX.md` 中补充阶段0验证证据，确认当前后端主链路和 P2 smoke 具备复用基础。
- 明确 smoke 通过不等于 P0-P3 全部完成；当前真实缺口为正式 Next.js 前端、P0 PII 加密复核、正式模板导入、PostgreSQL + pgvector、BullMQ、SSE、真实模型/连接器授权和 P3 工程化。
- 下一步优先启动 P0 工单：正式 Next.js 前端工程骨架 + API 契约联调 + PII 加密/脱敏复核。

本次仍只做阶段 0 文档收口，不部署、不 SSH、不写生产库、不执行 Git 写操作。


## 2026-08-25 — P0 基础平台 M1 候选

- 新增正式 `frontend/` 工程：Next.js + TypeScript + Tailwind + shadcn/ui 基础组件，按真实 `NexFab_导航优化预览0821版本.html` 抽取顶栏、侧栏、展开菜单、AI 助手入口和工作台基础视觉。
- 新增前端同源代理 `frontend/src/app/api/backend/[...path]/route.ts`，只消费现有 backend API，不重造 CRM 业务规则。
- 新增前端契约和平台联调测试：`test:p0-ui-contract`、`test:p0-platform`。
- 新增 P0 PII 静态加密：`backend/src/pii.mjs`、`Contact/Lead` 密文字段与 HMAC 索引、迁移 `20260825140000_pii_encryption`、`test:p0-pii-encryption`。
- 更新 EMAIL/PHONE 客户指纹为 HMAC 索引 + 脱敏展示，避免把查重表当成第二份明文 PII。
- 更新 AI Gateway 摘要脱敏，邮箱/电话/token/key 不回显；同步更新 ToolCall smoke 断言。
- 完整回归通过：`npm test`、`test:smoke`、`test:p0-pii-encryption`、24/24 `test:p2-*`、`prisma validate`、前端 `typecheck/lint/build`、P0 平台联调。

本次不部署、不 SSH、不写生产库、不执行 Git 写操作。

## 2026-08-25 — P1.1 无 AI 外贸闭环：获客到客户跟进正式前端接入

- 新增 `frontend/src/components/p1-acquisition-crm-view.tsx`，完成线索/询盘、客户查重、人工确认转客户/商机、客户/联系人、商机跟进的正式前端闭环页面。
- 更新 `frontend/src/components/crm-shell.tsx`，将动态导航中的获客中心、客户档案、销售管道、跟进任务、客户去重入口接入 P1.1 页面。
- 扩展 `frontend/src/lib/api.ts` 与 `frontend/src/lib/types.ts`，只通过 `/api/backend` 代理消费现有后端 API，不新增平行后端模型。
- 新增 `frontend/test/p1-acquisition-crm-integration.mjs` 和 `npm run test:p1-acquisition-crm`，验证正式前端代理到后端的 P1.1 主链路。
- 验证通过：前端 `typecheck/lint/build`、`test:p0-ui-contract`、`test:p0-platform`、`test:p1-acquisition-crm`；后端 `npm test`、`test:smoke`、`test:p2-acquisition`。
- 明确缺口：`POST /api/leads/import` 后端未实现，作为后续模板/导入小闭环处理；本轮不扩散。

本次不部署、不 SSH、不写生产库、不执行 Git 写操作。

## 2026-08-25 — P1.2 无 AI 外贸闭环：产品与确定性报价正式前端接入

- 新增 `frontend/src/components/p1-product-quote-view.tsx`，完成产品分类/产品创建、产品资料状态、确定性报价计算、费用/成本/毛利展示、报价创建、版本锁定/审批、PDF 获取、人工确认发送留痕入口。
- 更新 `frontend/src/components/crm-shell.tsx`，将产品库（PIM）、快速报价、报价管理入口接入 P1.2 页面。
- 扩展 `frontend/src/lib/api.ts` 和 `frontend/src/lib/types.ts`，覆盖产品、资料、报价计算、快速报价、报价版本、锁定、PDF、发送留痕等 API；继续走 `/api/backend` 同源代理。
- 新增 `frontend/test/p1-product-quote-integration.mjs` 与 `npm run test:p1-product-quote`，覆盖产品 → 报价计算 → 创建报价 → 未锁 PDF 阻断 → 锁定 → PDF → 未确认发送阻断 → 人工确认发送 → 权限拒绝。
- 验证通过：前端 `typecheck/lint/build`、`test:p0-ui-contract`、`test:p0-platform`、`test:p1-acquisition-crm`、`test:p1-product-quote`；后端 `test:p2-product`、`test:p2-quote`、`test:p2-quote-rules`、`test:p2-quote-lock`、`test:p2-quote-send`。

本次不进入 P1.3，不部署、不 SSH、不写生产库、不执行 Git 写操作。

## 2026-08-25 — P1.3 无 AI 外贸闭环：样品到履约物流正式前端接入

- 新增 `frontend/src/components/p1-fulfillment-flow-view.tsx`，完成样品创建/状态/反馈/转订单、报价转订单、订单门禁、回款登记与财务确认、PI/CI/PL/SC 生成审核、生产/待发货/物流/签收的正式前端闭环。
- 更新 `frontend/src/components/crm-shell.tsx`，将样品管理、合同订单、生产跟踪、物流管理、单证管理、财务订单与回款入口接入 P1.3 页面。
- 扩展 `frontend/src/lib/api.ts` 与 `frontend/src/lib/types.ts`，覆盖样品、订单、回款、单证、对账、履约、物流等 API 与类型；继续复用 `/api/backend` 同源代理和现有后端业务规则。
- 新增 `frontend/test/p1-fulfillment-flow-integration.mjs` 与 `npm run test:p1-fulfillment-flow`，覆盖样品/报价起点 → 订单 → 财务确认 → PI/CI/PL → 履约/发货/签收，以及 `SAMPLE_FEEDBACK_REQUIRED`、`FULFILLMENT_GATE_BLOCKED`、`DOCUMENT_SOURCE_LOCKED` 和多角色越权拒绝。
- 验证通过：前端 `typecheck/lint/build`、`test:p0-ui-contract`、`test:p0-platform`、`test:p1-acquisition-crm`、`test:p1-product-quote`、`test:p1-fulfillment-flow`；后端 `test:p2-sample`、`test:p2-order`、`test:p2-payment`、`test:p2-trade-document`、`test:p2-fulfillment-shipment`。
- 保留既有后端口径：样品 7 个写入状态 + 前端 10 个业务里程碑展示；质检暂由 `READY_TO_SHIP` 门禁说明承载；报价重复转订单维持现有后端允许行为，未在本轮改业务规则。

本次不进入 AI/RAG、P1.4 导入/看板，不部署、不 SSH、不写生产库、不执行 Git 写操作。

## 2026-08-25 — P1.4 标准模板、导入与基础经营看板后端/API 收口

- 新增 `backend/src/import-template-routes.mjs`，提供五类标准模板：线索、客户、产品、供应商/成本、报价规则；模板只含列名、字段说明和校验约束，不含业务样例数据。
- 新增统一导入入口 `/api/import/customers`、`/api/import/products`、`/api/import/supplier-costs`、`/api/import/quote-rules`，并保留 `/api/import/leads` 通用入口；总控版 `/api/leads/import` 不被新路由抢占。
- 导入统一采用 `dryRun` 预览 + `confirmImport=true` 正式确认；dryRun 不写业务数据，正式导入复用现有 Customer/Product/QuoteRuleSet/Product.costVersions 模型。
- 导入冲突报告只返回当前 actor 可见范围内的重复候选，不返回隐藏客户 ID、`hiddenCount` 或不可见重复存在信号；PII 继续密文/哈希存储，审计不回显明文邮箱/电话。
- 更新 `backend/src/dashboard-routes.mjs`，在工作台摘要基础上新增 `business` 累计业务概览：漏斗、报价/订单/回款、履约运营、风险队列；口径明确为 `CURRENT_CUMULATIVE_OVERVIEW`。
- 更新 `frontend/src/lib/api.ts` 与 `frontend/src/lib/types.ts`，补齐模板导入和经营看板数据类型；前端新增 `xlsx` 依赖供 P1.4 独立前端支线本地解析 Excel。
- 验证通过：`test:p1-import-templates`、`test:p1-lead-import`、`test:p2-dashboard`、`npm test`、`test:smoke`、报价/订单/回款/单证/履约相关 P2 回归、前端 `typecheck/lint/build`、P0/P1.1/P1.2/P1.3 集成回归、`prisma validate`。

本次收到总控分工后已冻结 `frontend/src/components/p1-import-dashboard-view.tsx` 和 P1.4 专项前端测试文件；不部署、不 SSH、不写生产库、不执行 Git 写操作。
