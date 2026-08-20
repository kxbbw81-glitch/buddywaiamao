# NexFab AI CRM

面向外贸团队的 AI 驱动 CRM。系统把线索、客户、询盘、商机、报价、样品、订单、单证、物流、收款和售后复购串成可追踪的业务闭环。

原始 V1.0 的目标很直接：**让 AI 承担重复劳动，让一个业务员能服务更多客户和商机。**

> AI 功能需要使用方自行接入并付费购买第三方大模型服务；仓库不提供免费额度或可用 API Key。AI 的输出是草稿、建议和风险提示，正式报价、订单、单证、收款及对外发送内容必须由人工确认。

## 传统 CRM 与 AI CRM

| 场景 | 传统 CRM | NexFab AI CRM |
| --- | --- | --- |
| 客户管理 | 保存资料、分配客户、查看报表 | 沉淀客户画像、历史询盘、报价、订单与跟进上下文 |
| 询盘回复 | 人工阅读、翻译、撰写邮件 | AI 辅助理解、翻译、提取需求和生成回复草稿 |
| 报价与跟进 | 查历史价、手工计算、靠记忆推进 | 结合历史记录给出参考，提醒沉默客户和逾期动作 |
| 订单与单证 | 人工推进状态，资料容易遗漏 | 以订单、单证、物流、回款的状态校验减少漏项 |
| 经营管理 | 事后查看统计报表 | 通过数据大屏、客户地图、漏斗和风险提示辅助判断 |

传统 CRM 更像结构化台账；NexFab AI CRM 更像了解外贸流程的业务副手。它不代替业务决策，而是先完成整理、草拟、分析和提醒，再由人审核执行。

## OPC / 超级个体场景

OPC（One Person Company）或超级个体，指核心经营者借助 AI、自动化工具和 SaaS 系统，完成过去需要小团队协作的工作。外贸天然跨语言、跨时区、跨平台，小团队常由同一人兼顾开发、报价、跟单和催款，正是这类系统最有价值的场景。

NexFab AI CRM 在其中承担六个角色：

- 客户中枢：统一沉淀客户、联系人、国家、等级和历史行为。
- 销售中枢：把询盘、商机、跟进、报价和订单连成连续流程。
- 知识中枢：让产品资料、历史报价和客户偏好成为可复用上下文。
- 执行中枢：在同一系统完成客户维护、回复草拟、报价准备与内容排期。
- 风控中枢：通过订单、单证、物流和回款校验提示关键缺项。
- 管理中枢：用大屏、地图和分析看板快速掌握市场、漏斗和风险。

目标不是增加复杂流程，而是让少数人具备更稳定的外贸执行力。

## 核心能力

- 客户、联系人、线索、询盘、商机与跟进记录管理。
- 报价、样品、合同订单、单证、物流、收款和售后复购闭环。
- 工作台、数据分析、数据大屏、客户地图与社媒运营。
- 角色权限、活动审计、状态流转、订单里程碑与业务校验。
- AI 助手、客户洞察、询盘理解、邮件草拟、报价建议、市场分析和内容建议。

## AI 使用与费用

AI 服务由使用方自行选择并付费，例如 OpenAI、Moonshot / Kimi、DeepSeek、通义千问、智谱 AI 或兼容接口服务。价格、可用性、模型效果和地区访问规则均以服务商实际政策为准。

建议通过服务器环境变量配置：

```bash
AI_PROVIDER=your-provider
AI_BASE_URL=https://your-provider-compatible-endpoint/v1
AI_MODEL=your-model
AI_API_KEY=your-paid-api-key
```

AI 可以做翻译、摘要、信息提取、回复草稿、价格参考和风险提示；不得自动发送正式报价、确认订单、审核单证、批准财务动作或替代人工承诺交期。

## 技术栈

- Next.js 16、React 19、TypeScript、Tailwind CSS 4。
- Prisma ORM 与 SQLite 默认本地数据库。
- Radix UI、Lucide、TanStack Query、Zustand、Recharts、Framer Motion。
- Docker / Docker Compose、Nginx 配置示例与 Next.js standalone 构建。

## 本地运行

```bash
pnpm install
```

创建本地 `.env`：

```bash
DATABASE_URL="file:./db/custom.db"
```

初始化数据库并启动：

```bash
pnpm db:generate
pnpm db:push
pnpm dev
```

默认访问地址为 `http://localhost:3000`。

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

每次发布前建议执行：

```bash
pnpm prisma format
pnpm prisma validate
pnpm prisma generate
pnpm exec tsc --noEmit --pretty false
git diff --check
pnpm build
```

涉及页面交互的版本还应检查工作台、客户详情、询盘、报价、订单、收款、数据分析、权限可见性及浏览器 console。

## 优化过程

项目从 V4.1 测试策划持续优化，主线包含：

- 业务模块补齐：导入、样品、单证、生产、物流、社媒和报价转订单。
- 稳定性修复：空引用、数值类型、上传、PDF、通知、线索和社媒交互等问题。
- 安全与边界：权限范围、审计、上传安全、AI 草稿与人工确认、状态机校验。
- 外贸闭环：报价过期与低毛利审批、订单明细冻结、收款同步、单证审核和里程碑校验。
- 销售经营：售后复购、商机、统一跟进、商机转报价、报价转订单、订单到物流与收款。

完整记录请参阅：

- `reports/NexFab_CRM_完整优化过程_测试策划至V7.28_20260820.md`
- `updates/CHANGELOG.md`

## 安全与仓库规则

- 不提交 `.env`、真实 API Key、token、密码、数据库、日志、缓存或构建产物。
- 不将真实客户联系方式、订单、合同、单证和财务数据提交到公开仓库。
- 生产环境使用 HTTPS、强密码、备份与密钥轮换；密钥一旦在聊天、日志、截图或 Git 历史中暴露，应立即撤销并重建。

## 目录概览

```text
src/       应用、API、业务组件、状态和工具函数
prisma/    数据模型与种子脚本
reports/   测试与版本优化报告
updates/   版本变更记录
deploy/    部署脚本与反向代理配置
tests/     运行时验证脚本
```

## 使用说明

本仓库是 NexFab AI CRM 的源码与部署基线。商用前应按实际团队补充许可证、隐私政策、AI 服务商合规说明、备份恢复流程及运维手册。
