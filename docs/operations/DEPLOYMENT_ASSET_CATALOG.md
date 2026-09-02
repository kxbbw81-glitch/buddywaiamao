# NexFab 发布与复用资料库

## 使用边界

- **唯一代码目标**：`nexfab-ai-crm-final`。
- **唯一线上入口**：`/new`。
- **唯一 Git 远端**：`https://github.com/kxbbw81-glitch/nexfab-ai-crm-.git`。
- 本资料库只保存无凭据的部署、验证和复用证据；不收录 `.env`、数据库、客户数据、token、密码或 API Key。
- 历史项目只能作为点读复用来源，不可整体覆盖当前代码目标，也不可作为发布源。

## 资产目录

| 类型 | 路径 | SHA-256 / 标识 | 用途 |
| --- | --- | --- | --- |
| 当前发布代码 | `.` | `DIRECTORY` | 唯一可写代码与发布基线；线上入口固定为 /new。 |
| 当前部署资产 | `Dockerfile` | `eac58c05927db6cbf8d4b77030a9e2e7a3abfd299ff5e38b64a8425083405703` | 根应用容器构建。 |
| 当前部署资产 | `docker-compose.yml` | `c043e0e9747d6a14d0bc55d25603c27b05b61654ae13ed4feb08fb8928edcae3` | CRM、Nginx 与数据卷编排。 |
| 当前部署资产 | `deploy/deploy.sh` | `0b0d26b9f41d7305892ac04a3c3573237a3836413c1733c6cce9543e75739a74` | 部署脚本；执行前须独立审核并配置环境变量。 |
| 当前部署资产 | `deploy/nginx.conf` | `709d823ece1a9f0209cf13d58e1172230bd97fdfeee6a235fac23d7739d0ab6c` | Nginx 反向代理；根路径跳转 /new。 |
| 当前部署资产 | `next.config.ts` | `ade2b4a2427d84b8d1fa60e1fff98cfa30ab270dba7febbf456428a8efa95a77` | Next.js standalone 与 /new basePath。 |
| 已收录复用证据 | `docs/reference/release-backend/README.md` | `da0b4f67049415cb95724b2a0278196e6083c9f8262a5700519930100ca1eb45` | 已验证后端能力/API/边界的只读参考，非当前根应用的自动发布件。 |
| 已收录复用证据 | `docs/reference/release-backend/VALIDATION.md` | `2b1e1214c9d8feeb6a52228fa2314b79474d747e107d06948e41a10c65751c67` | 后端 smoke、E2E 与后续环境缺口的验证证据。 |
| 已收录修复台账 | `docs/reference/ZCODE_修复交付_README_20260830.md` | `56ddb206162cf452c4107285b4e65783319c0a2957a1180daa0269d04fa627b4` | 75+ 后端与23项前端修复索引，避免重复修复。 |

## 发布前最小核对

1. 确认 `git remote get-url origin` 等于唯一 Git 远端。
2. 仅从当前代码目标构建；不得从历史 GoodJob、AICRM-good 或临时审计目录构建。
3. 确认 `next.config.ts` 的 `basePath` 为 `/new`，Nginx 根路径仅跳转至 `/new`。
4. 部署前由运行环境注入数据库、会话、加密和 AI 配置；这些值不得进入仓库或本资料库。
5. 先运行构建、数据库迁移/校验和登录、RBAC、报价到履约的回归测试，再进行单独授权的上线。

## 当前复用结论

已验证后端资料已收录为证据，用于按模块选择性迁移/复用：认证与数据范围、报价规则与审批、样品转订单、回款、单证、物流、AI治理及审计。它们与当前 Next.js 根应用为不同实现树；任何迁移必须逐接口、逐模型、逐测试验证，禁止整包复制。
