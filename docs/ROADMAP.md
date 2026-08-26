# NexFab AI CRM V2.0 路线图与工作包

## 阶段 0：审计与规划

| 工作包 | 内容 | 依赖 | 验收 |
| --- | --- | --- | --- |
| 0.1 仓库审计 | 确认正确仓库、基线、依赖、测试、文档 | 当前工作树 | `git status` 干净，HEAD 正确 |
| 0.2 复用矩阵 | 对照交接 backend 17 个能力块 | 交接 backend 可读 | 输出可复用/需改造/需新建/暂缓矩阵 |
| 0.3 Excel V2 审计 | 读取现有 Excel V2 审计说明 | 审计文档可访问 | 不硬编码单元格，形成报价抽象原则 |
| 0.4 文档基线 | 形成 PROJECT_PLAN/ARCHITECTURE/DATA_MODEL/ROADMAP/DEPLOYMENT/CHANGELOG/QUOTE/AI 文档 | docs 目录 | 不覆盖有效内容，补齐阶段路线 |

## P0：基础平台

| 工作包 | 当前状态 | 依赖 | 验收 |
| --- | --- | --- | --- |
| 五角色 RBAC / 会话 | 已有后端实现 | `security/access/navigation/server` | `npm test` |
| 后端动态导航 | 已有 `/api/navigation` | 登录会话 | `npm test`、`test:smoke` |
| 工作台 / Todo / Memo | 已有本地摘要 | `dashboard-routes` | `test:p2-dashboard` |
| Next.js 前端骨架 | 已有，待五角色浏览器联调 | `/api/navigation`、`/api/dashboard` | `frontend` typecheck/build + 五角色登录验收 |
| PII 加密层 | 已实现，待生产受控 backfill | `CustomerFingerprint`、AI redaction | `test:p0-pii*`；发布前备份、dry-run、`--apply` 汇总核验 |
| 统一错误与日志 | 已有基本 `HttpError` + `AuditLog` | 各 route | 写操作审计、越权 403 |
| SQLite/systemd 可运行说明 | 文档化，不在本工作树部署 | 部署授权 | `docs/DEPLOYMENT.md` |

## P1：无 AI 外贸全闭环

| 工作包 | 当前状态 | 依赖 | 验收 |
| --- | --- | --- | --- |
| 产品/资料 | 已有 | P0 权限 | `test:p2-product` |
| 客户/联系人/商机/跟进 | 已有 | P0 权限 | `test:smoke` |
| 线索/询盘/公海/查重 | 已有闭环；线索批量行导入已补齐，公海自动回收规则需后续增强 | P0 权限 | `test:p2-acquisition`、`test:p1-lead-import` |
| 报价/审批/PDF/发送 | 已有核心闭环 | 产品/客户 | `test:p2-quote*` |
| 样品/样品跟进/转订单 | 已有 | 报价/产品/客户 | `test:p2-sample` |
| 订单/收款 | 已有 | 报价/样品 | `test:p2-order`、`test:p2-payment` |
| 单证/生产/物流/签收 | 已有核心门禁 | 订单/回款 | `test:p2-trade-document`、`test:p2-fulfillment-shipment` |
| 经营看板 | 已有本地摘要；经营分析可增强 | P0 数据 | `test:p2-dashboard` |
| 模板导入 | Excel 只读审计已有；正式导入模板需补 | 产品/报价规则 | `test:p2-excel-audit` + 后续导入测试 |

## P2：AI Gateway / RAG / 队列 / 流式 / 迁库

| 工作包 | 当前状态 | 依赖 | 验收 |
| --- | --- | --- | --- |
| AI Gateway | 已有本地草稿与云端失败审计 | P0 权限 | `test:p2-ai-gateway` |
| 能力契约 / Prompt / Eval | 已有 | AI Gateway | `test:p2-ai-contract` |
| AI 策略 / 成本限额 | 已有 | AI Gateway | `test:p2-ai-policy` |
| 人工确认 / 纠错 | 已有 | AI Gateway | `test:p2-ai-feedback` |
| RAG 来源引用 | 已有关键词/来源闭环 | 知识库 | `test:p2-rag`、`test:p2-ai-citation` |
| ToolCall / 连接器台账 | 已有人工批准台账 | AI Gateway | `test:p2-tool-call`、`test:p2-integration` |
| PostgreSQL + pgvector | 已补 migration、HNSW 索引、只读预检和仅限本地测试库的真实 DB E2E | PostgreSQL 16 + pgvector 测试库 | `prisma migrate deploy` + `p2:pgvector-preflight` + `test:p2-postgres-e2e` PASS |
| BullMQ / SSE | 已实现 Redis/BullMQ 优先队列、开发/测试内存回退、SSE 与同源前端消费 | Redis | `test:p2-ai-async-sse` + 前端异步 SSE 集成 PASS；生产无 Redis 必须显式 503 |
| 真实模型 | 待模型供应商、模型名、密钥与费用上限授权 | 授权密钥 | 不泄露密钥，失败显式记录 |

## P3：高级智能与工程化

| 工作包 | 当前状态 | 依赖 | 验收 |
| --- | --- | --- | --- |
| 社媒获客助手 | 已完成账号台账、内容草稿、审核、人工发布登记、互动意图和转 CRM 线索；真实平台后置 | 授权连接器 | `test:p3-social-acquisition` PASS；人工确认发送 |
| 邮件与渠道草稿 | 已复用沟通时间线完成草稿、审核、人工发送结果回填；真实渠道后置 | 授权连接器 | `test:p3-outbound-draft` PASS；无自动发送 |
| 经营快照 / 规则预警 | 已完成只读、角色范围内的经营快照与确定性规则预警；流失预测、受限 NL2SQL、自动推送报告待数据/评测/授权 | 历史数据、权限、评测集 | `test:p3-analytics-report` PASS；不越权、不暴露 PII |
| PWA / 移动端 | 已完成无业务缓存的 PWA 安装入口、移动端导航抽屉；待真实设备验收 | 正式前端 | `test:p3-pwa-contract` + 核心页面真实设备可用 |
| 性能 / 缓存 / 索引 | 已有 300 条客户夹具的隔离本地 P95 基线；生产性能仍待真实数据量证据 | 真实数据量 | `test:p3-performance-local` + 生产 P95/慢查询证据 |
| CI / 发布 / 备份监控 | 已加入仅测试 CI、管理员只读运行状态和显式确认的备份命令；已在隔离 PostgreSQL 完成 `pg_dump` 到新库恢复演练；自动发布和监控告警待发布授权 | GitHub、运行环境 | 可回滚、可审计 |

## 发布里程碑

1. M0：阶段 0 文档与复用矩阵审核通过。
2. M1：P0 安全与运行底座通过。
3. M2：P1 无 AI 外贸闭环通过 27 条验收中非 AI 条款。
4. M3：P2 AI/RAG/迁库门禁通过。
5. M4：P3 高级智能与工程化上线前验收。
