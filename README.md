# NexFab AI CRM

NexFab AI CRM 是面向外贸团队的业务管理系统。它将线索、客户、询盘、商机、报价、样品、订单、单证、物流、收款和售后复购连接为一条可跟进、可复盘的业务链路。

> AI 功能需由使用方自行接入并付费购买第三方大模型服务。本仓库不提供免费额度或 API Key。AI 仅用于草拟、分析和提示；正式报价、订单、单证、收款及对外发送内容必须人工确认。

## 系统解决什么

外贸业务中的客户资料、邮件、报价和订单经常分散在 Excel、聊天工具和个人电脑中，容易出现客户漏跟、报价难追溯、订单资料不完整、回款状态不清晰等问题。

本系统以以下主链路统一承载这些数据：

```text
线索 -> 客户 / 联系人 -> 询盘 -> 商机 -> 跟进 -> 报价 -> 样品
     -> 合同订单 -> 单证 / 物流 -> 收款 -> 售后复购
```

## 传统 CRM 与 AI CRM

| 场景 | 传统 CRM | NexFab AI CRM |
| --- | --- | --- |
| 客户与过程 | 保存资料、记录跟进、查看报表 | 将客户、询盘、报价、订单和跟进上下文连成业务记录 |
| 询盘与报价 | 人工阅读、翻译、查历史价和撰写邮件 | AI 辅助提取需求、生成回复草稿、提供价格参考和风险提示 |
| 订单与管理 | 靠人工推进订单、单证、物流和回款 | 以状态校验、数据分析、客户地图和大屏减少漏项并展示风险 |

传统 CRM 侧重记录与管理；本系统在此基础上让 AI 参与重复的信息整理和业务辅助，但最终决策始终由人完成。

## 已有业务模块

- 销售前端：工作台、目标线索、客户、联系人、询盘、商机、统一跟进记录。
- 成交与履约：产品资料、报价、样品、合同订单、单证、物流、收款、售后复购。
- 经营管理：数据分析、数据大屏、客户地图、社媒运营、活动记录。
- 管控能力：角色权限、审计记录、状态流转、低毛利审批、报价有效期与订单里程碑校验。
- AI 辅助：客户洞察、询盘理解、邮件草拟、翻译、报价建议、市场分析和社媒内容建议。

## OPC / 超级个体场景

对于一人公司或小型外贸团队，同一人往往要兼顾获客、回复、报价、跟单和催款。NexFab AI CRM 用统一客户档案、业务时间线、流程提醒和 AI 草稿减少重复操作，让小团队也能稳定管理更多客户和商机。

## AI 服务与边界

可接入 OpenAI、Moonshot / Kimi、DeepSeek、通义千问、智谱 AI 或其他兼容接口；相关调用费用、可用性和服务条款以服务商实际规则为准。

建议使用服务器环境变量配置：

```bash
AI_PROVIDER=your-provider
AI_BASE_URL=https://your-provider-compatible-endpoint/v1
AI_MODEL=your-model
AI_API_KEY=your-paid-api-key
```

AI 可以翻译、总结、提取信息、草拟回复、提供价格参考和风险提示；不得自动发送报价、确认订单、审核单证、批准财务动作或承诺交期。

## 技术栈

Next.js 16、React 19、TypeScript、Tailwind CSS 4、Prisma、SQLite、Radix UI、TanStack Query、Zustand、Recharts、Docker / Docker Compose 和 Next.js standalone 构建。

## 本地运行

```bash
pnpm install
```

创建 `.env`：

```bash
DATABASE_URL="file:./db/custom.db"
```

初始化并启动：

```bash
pnpm db:generate
pnpm db:push
pnpm dev
```

默认访问 `http://localhost:3000`。

## 常用命令

```bash
pnpm dev                 # 开发服务
pnpm build               # 生产构建
pnpm start               # 启动生产构建
pnpm lint                # ESLint 检查
pnpm db:generate         # 生成 Prisma Client
pnpm db:push             # 推送 schema 到数据库
pnpm deploy:docker       # Docker 部署
pnpm deploy:docker:nginx # Docker + Nginx 部署
```

## 发布验证

```bash
pnpm prisma format
pnpm prisma validate
pnpm prisma generate
pnpm exec tsc --noEmit --pretty false
git diff --check
pnpm build
```

涉及页面交互的版本，还应检查客户详情、询盘、报价、订单、收款、数据分析、权限可见性和浏览器 console。

## 版本优化记录

V4.1 之后的优化覆盖业务模块补齐、稳定性修复、权限与审计、AI 人工确认边界、报价/订单/单证/收款闭环，以及售后复购和商机管理。

- 完整过程：`reports/NexFab_CRM_完整优化过程_测试策划至V7.28_20260820.md`
- 版本变更：`updates/CHANGELOG.md`

## 仓库安全

不要提交 `.env`、API Key、token、密码、数据库、日志、构建缓存、真实客户信息、订单、合同、单证或财务数据。生产环境请使用 HTTPS、定期备份和密钥轮换。

## 目录

```text
src/       应用、API、业务组件、状态和工具函数
prisma/    数据模型与种子脚本
reports/   测试与版本优化报告
updates/   版本变更记录
deploy/    部署脚本与反向代理配置
```
