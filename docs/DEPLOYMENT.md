# NexFab AI CRM V2.0 部署与运维说明

> 阶段 0 文档。本文只描述部署策略，不代表本轮已执行部署。

## 1. 当前可运行方式

当前仓库后端位于：

```bash
/private/tmp/nexfab-crm-v2-deploy.f8549e/backend
```

本地开发：

```bash
cd backend
npm ci
npm run start
```

必要环境变量：

- `DATABASE_URL`：PostgreSQL 连接串。
- `SESSION_SECRET`：至少 32 字符。
- `PII_ENCRYPTION_KEY`：用于 P0 PII AES-256-GCM 加密；必须在数据库迁移和历史数据 backfill 前固定并安全备份。
- AI/连接器密钥：仅在授权后以环境变量或安全配置注入，不提交仓库。

## 2. 健康检查

- `GET /health`：进程健康与配置摘要。
- `GET /ready`：数据库与会话密钥满足时才返回 200。

## 3. 当前验证命令

```bash
cd backend
npm test
npm run test:smoke
npm run test:p2-acquisition
npm run test:p2-quote-send
npm run test:p2-sample
npm run test:p2-order
npm run test:p2-payment
npm run test:p2-trade-document
npm run test:p2-fulfillment-shipment
DATABASE_URL='postgresql://user:pass@127.0.0.1:5432/nexfab_test' ./node_modules/.bin/prisma validate
```

## 4. 生产发布门禁

生产动作必须单独授权，至少包括：

1. 冻结待迁移数据来源并记录指纹。
2. 备份生产数据库与当前 release。
3. 在受控测试库执行 migration / seed / E2E；PII migration 后先 dry-run `npm run p0:pii-backfill`，核对汇总，再显式执行 `npm run p0:pii-backfill -- --apply`。
4. 创建正式管理员并完成真实登录验收。
5. 执行生产部署、健康检查、业务 smoke、回滚方案确认。

## 4.1 P2 隔离基础设施验收

该验收只允许使用专用本地或 CI 测试数据库，数据库名必须以 `nexfab_p2_verify` 开头；脚本会拒绝其他目标，不能替代生产发布门禁。

```bash
# 在已启动的本地 PostgreSQL 16 + pgvector 和 Redis 7 测试环境中执行
DATABASE_URL='postgresql://.../nexfab_p2_verify?schema=public' npx prisma migrate deploy
DATABASE_URL='postgresql://.../nexfab_p2_verify?schema=public' npm run p2:pgvector-preflight
NEXFAB_REAL_DB_E2E=true REDIS_URL='redis://127.0.0.1:6379' DATABASE_URL='postgresql://.../nexfab_p2_verify?schema=public' npm run test:p2-postgres-e2e
```

该 E2E 覆盖：数据库就绪、迁移、pgvector/HNSW 预检、审核知识库 RAG 引用、真实 Redis/BullMQ 异步任务、SSE 终态以及“未向云端发送数据”审计。测试结束后必须停掉临时容器或销毁测试库。

## 4.2 受控 PostgreSQL 备份

备份只能由运行环境中的 `pg_dump` 执行，并且必须显式指定输出目录和确认值；脚本会拒绝根目录、覆盖已有文件和未确认调用。它不会通过 API 自动运行。

```bash
NEXFAB_BACKUP_CONFIRM=CREATE_BACKUP \
NEXFAB_BACKUP_DIR=/opt/nexfab-ai-crm/backups \
DATABASE_URL='postgresql://...' \
npm run p3:backup-postgres
```

每次备份会生成 custom-format `.dump` 和对应 SHA-256 manifest。恢复前应先在隔离库验证 `pg_restore --clean --if-exists --no-owner`，不得直接覆盖生产数据库。

2026-08-26 已在隔离 PostgreSQL 16 + pgvector 环境完成一次演练：迁移后的专用测试库经 custom-format `pg_dump` 备份，再恢复到新的空数据库；恢复后用户记录 2 条、知识库文档 1 条，`vector` 扩展和 `KnowledgeChunk_embedding_hnsw_idx` 索引均存在。该演练不涉及生产数据、生产主机或发布动作。

## 4.3 P3 隔离性能基线

`test:p3-performance-local` 只允许专用本地数据库，创建 300 条客户夹具并测量导航、工作台和管理员运行状态接口各 30 次请求的 P50/P95。默认本地 P95 上限为 1000ms；它是回归护栏，不等同于生产 P95 或慢查询验收。

```bash
NEXFAB_P3_PERF_LOCAL=true \
NEXFAB_P3_LOCAL_P95_MAX_MS=1000 \
DATABASE_URL='postgresql://.../nexfab_p3_perf?schema=public' \
npm run test:p3-performance-local
```

## 5. 目标部署

P2/P3 目标为 Docker Compose：

```text
app + worker + postgres + redis + minio + ollama
```

当前不得直接跳到目标架构；必须经过 P0/P1 后再按 P2 迁库门禁推进。

## 6. 回滚原则

- 每次生产变更前必须有数据库备份、release 备份、回滚命令和停止条件。
- 报价、订单、收款、单证、审计等核心数据不得无备份直接迁移或覆盖。
## 生产 Redis/BullMQ 与本机监控

生产环境必须配置本机或受控网络可达的 Redis，并在仅服务器可读的环境文件中设置：

```bash
NODE_ENV=production
AI_QUEUE_REDIS_URL=redis://127.0.0.1:6379
```

部署脚本会安装版本化的后端 systemd 单元，并启用 `nexfab-healthcheck.timer`。该定时器每五分钟只读检查 Redis、后端、前端、Nginx 与 `/ready` 返回的 BullMQ 状态；失败会保留在 systemd/journal 中。它不会发送邮件、社媒或任何外部告警。发布后应执行 `systemctl start nexfab-healthcheck.service`，并确认 `systemctl is-active nexfab-healthcheck.timer` 与 `systemctl --failed`。
