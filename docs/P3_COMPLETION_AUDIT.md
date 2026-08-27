# NexFab CRM V2.0 P3 完成度审计

> 审计日期：2026-08-26
> 范围：当前本地工作树；不代表生产发布结论。

## 结论

## 2026-08-27 生产化补充证据

- 生产已启用本机 Redis 7 与 `AI_QUEUE_REDIS_URL`；`/new/api/backend/ready` 返回 `backend=bullmq-redis`、`productionReady=true`、`fallback=false`。
- 已提交一次不带业务数据、不调用云端模型的 BullMQ 发布检查任务，结果为入队接受且 Worker 消费成功。AI 仍保持 disabled，未发送任何数据到云端。
- 已发布 `nexfab-healthcheck.timer`：每五分钟检查 Redis、后端、前端、Nginx 和 `/ready` 的队列状态；手动触发的 systemd 退出结果为 success。它只记录服务器本机日志，不会向外部渠道发送告警。
- 性能支线对公网各 10 次只读采样后，主控补充各 30 次只读采样：`/new` P95 81.1ms，`/new/api/backend/ready` P95 86.7ms，`/new/api/backend/health` P95 81.5ms；当前没有生产性能 P0。
- 生产数据库当前只有 1 个用户与 23 条审计记录，Customer、Lead、Quote、SalesOrder 均为 0；`log_min_duration_statement=-1`，未启用 `pg_stat_statements`。因此上述仅是空库生产基线，不可替代真实业务数据量的慢查询/容量验收。
- 后端所有无需专用本地数据库的 P0/P1/P2/P3 测试与前端 lint、typecheck、production build、P0-P3 合同/集成测试均通过。`p2-postgres-e2e` 与 `p3-performance-local` 仍只允许受控的本地专用测试库，不能用生产库替代。
- 真实移动设备验收仍需在实际设备上完成；自动 PWA 合同和移动导航前端测试已通过，浏览器自动化连接超时没有产生页面变更。

P3 的本地工程化、社媒草稿、渠道草稿和受限经营分析已经实现并通过相应自动化验证。真实模型、第三方平台、生产数据库、真实设备和发布动作仍是独立授权门禁，不能被本地测试替代。

本地浏览器验收已使用经理测试会话完成：`获客中心 / 社媒运营`、`沟通中心 / 邮件管理`、`数据洞察 / 数据分析` 均可由动态导航进入并成功加载对应正式前端页面。该验收使用临时内存后端，结束后已关闭。

2026-08-26 已完成一次与 CI 对齐的本地回归：后端 P0/P1/P2/P3 测试、前端 typecheck/lint/P0 合同/P3 PWA 与社媒合同、前端 production build、`git diff --check` 全部通过。该结果证明当前工作树的本地一致性，不替代 CI 平台执行、生产环境验收或外部接口授权。

| 工作包 | 本地结论 | 主要证据 | 仍需门禁 |
| --- | --- | --- | --- |
| P3-A 工程化 | PASS | PWA/移动端、CI、`ops-routes`、本地 P95、备份恢复演练 | 真机、生产 P95、监控告警、发布回滚 |
| P3-B 社媒获客 | PASS（无外部平台） | `social-routes.mjs`、`test:p3-social-acquisition`、真实 PostgreSQL migration 演练 | 官方 API、账号授权、人工发布流程验收 |
| P3-C 邮件/渠道草稿 | PASS（仅人工结果留痕） | `outbound-draft-routes.mjs`、`test:p3-outbound-draft` | SMTP/IMAP/B2B 授权、人工实际发送验收 |
| P3-D 经营快照 | PASS（确定性规则） | `analytics-routes.mjs`、`test:p3-analytics-report` | 历史数据质量、预测评测、自动报告授权 |

## P3-A：工程化与可运行性

- PWA service worker 不缓存 CRM API 或业务数据；移动端使用导航抽屉。
- CI 只运行测试与临时基础设施 E2E；没有部署、生产密钥或外部连接器步骤。
- 管理员运行状态只返回脱敏指标，备份必须显式确认。
- 隔离 PostgreSQL 的 custom-format 备份已恢复到新库，恢复后 pgvector 与 HNSW 索引均存在。

## P3-B：社媒获客助手

- `SocialAccount` 只引用现有 `IntegrationConnection`，不保存凭据。
- `SocialPost` 仅支持草稿、审核和人工发布结果登记；没有平台 API 调用路径。
- `SocialInteraction` 可标注意图并人工转为既有 Lead；复用 PII 加密与重复客户复核。
- 禁止自动发布、私信、评论回复、群发和未授权采集。

## P3-C：邮件与渠道草稿

- 草稿复用 `CommunicationEvent`，未新建重复邮件业务表。
- 状态严格为 `DRAFT → IN_REVIEW → APPROVED → SENT_RECORDED`。
- 最终状态仅表示人工已在外部渠道完成动作后的回填，不表示系统代发。

## P3-D：经营分析、活跃度与阶段权重

- 经营报告仅面向经理、管理层、管理员，且只按当前角色的客户/商机范围统计。
- 客户活跃度只依据沟通时间线，输出匿名客户 ID、最后活动和复核状态，不输出姓名或 PII。
- 销售预测按商机阶段权重汇总并按币种拆分；它不是 AI 预测或营收承诺。
- 原始 SQL、自由 NL2SQL、自动决策、自动报告推送均未开放。

## 未完成且不得绕过的发布门禁

1. 真实模型供应商、模型名称、费用上限、云端数据范围与密钥授权。
2. 邮箱、社媒、B2B、物流等外部平台的官方接口和账号授权。
3. 生产 PostgreSQL/Redis/对象存储配置、数据迁移窗口、备份、灰度和回滚。
4. 真实设备验收、真实数据量 P95/慢查询证据、监控告警。
5. 预测/流失模型的历史数据、评测集、偏差检查与项目负责人批准。

在上述门禁完成前，P3 只能标记为“本地验收通过，等待授权发布”，不能标记为生产完成。

## 本期范围确认后的收口

2026-08-26 已确认：本期不需要 AI 供应商/云端处理；邮件、社媒、B2B、物流只保留接入口。因此前述第 1、2 项不是当前版本的阻塞项，而是后续独立接入门禁。当前版本维持 `dataSentToCloud=false`、无真实外部调用、人工确认和手工降级。
