# NexFab AI CRM V2.0 架构说明

> 阶段 0 文档。不得把目标架构误标为当前已完成事实。

## 1. 当前仓库结构

```text
/private/tmp/nexfab-crm-v2-deploy.f8549e
├── backend/                 # 当前可运行后端基线
│   ├── src/                 # 模块化单体路由、权限、AI/RAG/报价等能力
│   ├── prisma/              # PostgreSQL Prisma schema 与 migrations
│   └── test/                # 模块级 smoke / 权限 / 审计测试
├── docs/                    # V2.0 需求、复用清单和阶段文档
└── frontend-preview/        # 静态前端预览，不等同正式新前端
```

## 2. 当前后端模块映射

| V2 模块 | 当前实现文件 | 当前状态 |
| --- | --- | --- |
| 认证 / 会话 / 导航 | `backend/src/security.mjs`、`backend/src/navigation.mjs`、`backend/src/server.mjs` | 可复用 |
| RBAC / 数据范围 | `backend/src/access.mjs` | 可复用 |
| 工作台 / Todo / Memo | `backend/src/dashboard-routes.mjs` | 可复用 |
| 客户 / 联系人 / 商机 / 跟进 | `backend/src/crm-routes.mjs` | 可复用 |
| 获客 / 线索 / 询盘 / 指纹查重 | `backend/src/acquisition-routes.mjs`、`backend/src/customer-fingerprint.mjs` | 可复用 |
| 产品 PIM / 产品资料 | `backend/src/product-routes.mjs` | 可复用 |
| 报价 / 规则 / PDF / 发送留痕 | `backend/src/quote-routes.mjs`、`backend/src/quote-engine.mjs`、`backend/src/quote-pdf.mjs`、`backend/src/quote-excel-audit.mjs` | 可复用 |
| 样品 | `backend/src/sample-routes.mjs` | 可复用 |
| 订单履约 | `backend/src/order-routes.mjs` | 可复用 |
| 收款 | `backend/src/payment-routes.mjs` | 可复用 |
| 单证 / 对账 | `backend/src/trade-document-routes.mjs` | 可复用 |
| 生产 / 物流 / 发货 | `backend/src/fulfillment-routes.mjs` | 可复用 |
| 提成 | `backend/src/commission-routes.mjs` | 可复用 |
| 沟通时间线 | `backend/src/timeline-routes.mjs` | 可复用 |
| 知识库 / RAG | `backend/src/knowledge-routes.mjs`、`backend/src/rag-routes.mjs` | 可复用，真实向量库后置 |
| AI Gateway / 契约 / 策略 / 反馈 / 工具调用 | `backend/src/ai-gateway-routes.mjs` | 可复用，真实模型后置 |
| 自动化 / 通知 / 连接器 / Webhook | `backend/src/automation-routes.mjs`、`backend/src/integration-routes.mjs` | 可复用，真实连接器后置 |
| PostgreSQL 迁移/彩排工具链 | 当前发布基线未纳入 | P2/P3 前置门禁时从交接 backend 最小迁入 |

## 3. API 设计原则

- 前端只使用后端 API 契约，不绕过 RBAC / 数据范围。
- 导航由 `GET /api/navigation` 返回，生产角色由登录身份决定。
- 所有写操作必须经过后端角色、数据范围、状态机和审计校验。
- AI 对外动作走“草稿 → 人工确认 → 执行/记录 → 审计”，禁止 L5 自动业务决策。

## 4. 当前部署边界

当前阶段只维护源码基线与本地验证，不代表生产部署。生产部署必须另走授权、备份、回滚和验收门禁。

## 5. 目标架构

P2/P3 后目标为 Docker Compose 多容器：

```text
app + worker + PostgreSQL 16 + pgvector + Redis/BullMQ + MinIO + Ollama/云端模型配置
```

当前不得为了目标架构过早拆微服务；优先保持模块化单体。
