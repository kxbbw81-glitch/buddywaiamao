# NexFab AI CRM V2.0 P0 基础平台证据

> 状态：M1 候选。本文只记录 P0 基础平台本地实现与验证，不代表生产部署完成。

## 1. P0 现状

| 项目 | 结论 | 证据 |
| --- | --- | --- |
| 正式前端工程 | 已新增 | `frontend/`，Next.js + TypeScript + Tailwind + shadcn/ui 基础组件 |
| UI 参考 | 已按真实 HTML 抽取核心视觉 | `/Users/dream/Documents/NexFab_CRM交接资料/NexFab_导航优化预览0821版本.html` |
| 后端 API 消费 | 已接入 | `frontend/src/app/api/backend/[...path]/route.ts` 同源代理到现有 backend |
| 五角色认证 | 已验证 | `frontend/test/p0-platform-integration.mjs` |
| 后端动态导航 | 已验证 | sales/manager/finance/exec/admin 分别返回不同模块数 |
| 角色工作台 | 已验证 | `/api/dashboard` 返回 9 个指标，`noExternalSideEffects=true` |
| RBAC / 越权 | 已验证 | finance 访问 CRM 403，sales 访问 admin 客户 403 |
| PII 静态加密 | 已补齐并验证 | `backend/src/pii.mjs`、`test:p0-pii-encryption` |
| 统一错误 / 参数校验 | 已复用 | 401/400/403 smoke 覆盖 |
| 审计日志 | 已复用并增强 | 联系人/线索审计只记录 PII 摘要，不记录明文 |

## 2. 前端文件/依赖

- `frontend/package.json`
- `frontend/src/app/page.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/app/api/backend/[...path]/route.ts`
- `frontend/src/components/crm-shell.tsx`
- `frontend/src/components/dashboard-view.tsx`
- `frontend/src/components/login-form.tsx`
- `frontend/src/components/ui/*`
- `frontend/test/p0-ui-contract.mjs`
- `frontend/test/p0-platform-integration.mjs`

依赖：`next`、`react`、`typescript`、`tailwindcss`、`@radix-ui/react-slot`、`class-variance-authority`、`lucide-react`。

## 3. 后端复用映射

| 前端能力 | 消费 API | 后端文件 |
| --- | --- | --- |
| 登录 | `POST /api/auth/login` | `backend/src/server.mjs`、`security.mjs` |
| 会话 | `GET /api/auth/session` | `server.mjs`、`security.mjs` |
| 角色导航 | `GET /api/navigation` | `navigation.mjs` |
| 工作台 | `GET /api/dashboard` | `dashboard-routes.mjs` |
| 客户越权验证 | `GET /api/customers/:id` | `crm-routes.mjs`、`access.mjs` |
| PII 加密 | 联系人/线索写入链路 | `pii.mjs`、`crm-routes.mjs`、`acquisition-routes.mjs` |

## 4. 五角色联调证据

`npm run test:p0-platform` 输出：

```json
{
  "result": "passed",
  "mode": "p0-platform-integration",
  "unauth": 401,
  "roles": [
    { "role": "SALES", "modules": 10, "subs": 39, "metrics": 9 },
    { "role": "MANAGER", "modules": 12, "subs": 43, "metrics": 9 },
    { "role": "FINANCE", "modules": 6, "subs": 26, "metrics": 9 },
    { "role": "EXEC", "modules": 12, "subs": 43, "metrics": 9 },
    { "role": "ADMIN", "modules": 13, "subs": 47, "metrics": 9 }
  ],
  "financeCrm": 403,
  "invalidDashboardRange": 400,
  "salesOverreach": 403
}
```

## 5. PII 验证证据

`npm run test:p0-pii-encryption` 输出：

```json
{
  "result": "passed",
  "mode": "p0-pii-encryption",
  "contacts": 1,
  "leads": 1,
  "encryptedFields": 4,
  "fingerprintEmailEncrypted": true,
  "aiRedaction": true
}
```

## 6. 已通过命令

- `backend/npm test`
- `backend/npm run test:smoke`
- `backend/npm run test:p0-pii-encryption`
- 全部 24 个 `backend/npm run test:p2-*`
- `backend/prisma validate`
- `frontend/npm run test:p0-ui-contract`
- `frontend/npm run test:p0-platform`
- `frontend/npm run typecheck`
- `frontend/npm run lint`
- `frontend/npm run build`

## 7. P0 尚未虚报完成的点

- SQLite + systemd 可运行底座仍需按最终部署口径确认：当前代码主数据库口径仍是 Prisma + PostgreSQL，SQLite 只能作为旧库/迁移来源或需单独兼容方案。
- 正式生产环境变量、真实域名、服务文件、Nginx、备份回滚未执行；本轮禁止部署。
- 前端业务详情页仍是 P0 骨架与入口占位，后续 P1 按模块接入现有 API。
