# NexFab CRM V2.0 账号接力交接记录（2026-08-26）

> 目的：账号切换时以本文件、生产 release、数据库备份和 Git 基线为准；不要以单个 Codex 对话历史作为唯一事实来源。

## 当前可用生产状态（已核验）

- 地址：`http://47.98.101.249/` 会落到 `http://47.98.101.249/new`；`/new` 返回 200，页面标题为 `NexFab AI 外贸 CRM`。
- 保留旧版：`http://47.98.101.249/original/` 返回 200。
- 后端：`GET /new/api/backend/ready` 返回 200，`database=session=configured`，AI 当前为 disabled（符合未授权外部模型的规则）。
- 当前 release：`/opt/nexfab-ai-crm/releases/20260826152935-v2-current`，`/opt/nexfab-ai-crm/current` 指向该目录。
- 运行服务：`nexfab-ai-crm` 与 `nexfab-v2-frontend` 为 active；旧根站 `goodjob-crm` 为 inactive；保留版 `goodjob-crm-original` 为 active。

## 数据与回滚事实

- 新 V2 数据库：PostgreSQL `nexfab_v2`；已应用 PII、pgvector、社媒获客三项新 migration。
- 历史 GoodJob 数据库未删除：MySQL `goodjob_crm`、`goodjob_crm_new`、`goodjob_crm_original` 均仍存在；其中 `/original` 使用独立保留版。
- 本次 release 的可恢复备份：`/opt/nexfab-ai-crm/backups/20260826152935-v2-current`。同目录还保留多个部署过程备份，不能擅自清理。
- 旧根站已停用而非物理删除；如果需要迁移历史 GoodJob 业务数据，必须单列“数据迁移”任务，不能把它误认为本次 V2 部署自动完成的内容。

## 代码与发布基线

- 唯一 GitHub V2 基线：`https://github.com/kxbbw81-glitch/nexfab-ai-crm-` 的 `main`，基线 commit 为 `a01389c0d62f7c33552774cdd0f60142cf46ec86`。
- 正确候选工作树：`/private/tmp/nexfab-crm-v2-deploy.f8549e`。
- 本地已形成 V2.0 发布提交 `59d0986` 与部署脚本修复 `b546917`；本机到 GitHub 当前连接超时，远端同步需恢复网络后重试。不得用另一个不带尾部连字符的仓库或历史 `source` 工作树替代它。
- 已部署 release 不保留 `.git` 元数据；生产事实需由 release 路径、systemd、Nginx、数据库 migration 和备份目录交叉确认。

## 已有阶段证据（本地源码内）

- P1 前端闭环：`docs/P1_FRONTEND.md` 与各 `test:p1-*` 测试记录了线索、报价、样品→订单→回款→单证→物流的通过与 RBAC 阻断证据。
- P2：`docs/PROJECT_PLAN.md`、`docs/AI_GOVERNANCE.md`、`backend/test/p2-postgres-e2e.mjs` 记录了隔离 PostgreSQL + pgvector、Redis/BullMQ、SSE、RAG 的测试边界；真实模型和外部工具仍未授权，不得自行接入。
- P3：`docs/P3_COMPLETION_AUDIT.md`、`docs/DEPLOYMENT.md` 记录性能、备份与发布前约束。

## 本次交接已消除的增量差异

- `Agent 学习中心 / 资料问答` 前端组件已通过前后端回归并纳入 `20260826152935` 生产 release；服务与公网 `/new` 已复验。
- 部署脚本已修复 Nginx 软链重复创建问题，后续可重复执行；不要恢复为非覆盖式 `ln -s`。

## 下一账号的固定顺序

1. 先读取本文件，并只读核验 `/new`、`/original`、`/ready`、release 指针和四个服务状态。
2. 冻结正在运行的支线候选，要求每条给出修改文件、测试命令与 PASS/CONDITIONAL-PASS/BLOCKED。
3. 网络恢复后先把 `59d0986`、`b546917` 及后续交接记录推送到带尾部连字符的唯一仓库。
4. 下一轮阿里云变更前，先在正确工作树完成门禁；部署前备份、部署后复验本文件中的四项生产检查。

## 禁止误操作

- 不删除 `/original`、`goodjob_crm_original` 或任何 `/opt/nexfab-ai-crm/backups/*`。
- 不向 `nexfab-ai-crm`（无尾部连字符）推送 V2 候选。
- 不把 AI disabled 当故障：未完成供应商、费用和云端处理授权前，保持禁用。
