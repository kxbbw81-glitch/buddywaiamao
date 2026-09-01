# GoodJob 1.4.8 Agent Skills 与经营资料库模块提取说明

提取来源：Gitee `sendoh-huang/GoodJob`，提交 `9e4210cd9b58bff89c7a2e51b16fa0263cd3ba15`。

本目录用于后续把 GoodJob 1.4.8 的 Agent Skills、Agent 学习中心和经营资料库能力合并到当前 NexFab/GoodJob 改造版。当前只是提取包，不代表已经合并进生产主站。

## 1. 已提取内容

### Agent Skills 文件模块

位置：`agent-skills/`

共 6 个模块：

| 模块 ID | 名称 | 作用 | 关联页面/业务 |
|---|---|---|---|
| `system-overview` | GoodJob CRM 系统介绍 | 让 Agent 理解系统模块、业务对象、权限边界和通用完成标准 | 全系统 |
| `consultation` | Kevin 系统咨询与业务答疑 | 回答功能、字段、流程、规则和使用方式，不执行站内操作 | 全系统 |
| `prospecting` | 自动获客闭环 | 搜客目标、数据源搜索、清洗、候选复核、导入线索 | 自动获客、搜客清单 |
| `customer-lifecycle` | 客户与商机闭环 | 线索、客户、跟进、待办、商机查询创建与推进 | 客户、线索、商机、提醒 |
| `outreach` | 开发信与客户触达 | 基于真实资料生成/发送开发信或 Communication 消息 | 开发信、WhatsApp、客户 |
| `trade-documents` | 贸易单据制作与交付 | 基于客户和商机生成 PI/CI、审批、导出单据 | 单据平台、商机、客户 |

每个模块包含：

- `skill.json`：模块元数据、触发词、关键词、适用页面、工具引用。
- `SKILL.md`：Agent 执行说明和业务约束。

### Agent Knowledge 经营知识文件

位置：`agent-knowledge/`

共 10 个系统知识文档：

| 文件 | 标题 | 类型 | 业务模块 |
|---|---|---|---|
| `00-system-contract.json` | Agent 系统边界与执行原则 | policy | agent |
| `10-customers.json` | 客户管理与客户全景 | module | customers |
| `11-customer-pool.json` | 客户公池释放与领取 | workflow | customer-pool |
| `20-leads.json` | 线索管理与转化 | module | leads |
| `30-prospecting.json` | 自动获客与搜客任务 | workflow | lead-finder |
| `40-development-email.json` | AI 开发信草稿、编辑与发送 | workflow | development-email |
| `50-communication.json` | Communication 会话与 WhatsApp | module | whatsapp |
| `60-background-research.json` | AI 背调与证据使用 | workflow | ai-research |
| `70-navigation.json` | CRM 页面能力与意图路由 | workflow | agent |
| `80-operation-contract.json` | CRM Agent 操作契约 | policy | agent |

这些文件不是普通文案，它们会被后端加载为系统级知识，用于 Agent 判断权限、页面路由、执行边界、完成标准和失败案例。

### 后端运行时

已单独提取：

- `agent-skills.runtime.ts`
- `agent-knowledge.runtime.ts`

对应原始代码：

- `backend/src/agent-skills.ts`
- `backend/src/agent-knowledge.ts`

主要能力：

- 读取 `agent-skills/*/skill.json` 和 `SKILL.md`
- 根据用户目标、当前页面、关键词、业务域匹配 Skill
- 读取 `agent-knowledge/*.json`
- 支持系统知识、团队知识、蒸馏打法三类知识来源
- 支持知识草稿、审核、发布、归档
- 提供 Agent 目标诊断时的 Skill + Knowledge 匹配结果

### 后端接口依赖

需要合并的接口位于新版 `backend/src/server.ts`：

| 接口 | 作用 |
|---|---|
| `GET /api/agent/skills` | 获取 Skill 列表 |
| `GET /api/agent/skills/:id` | 获取单个 Skill 详情 |
| `POST /api/agent/tuning/inspect` | 输入业务目标，诊断匹配的 Skill/Knowledge/授权边界 |
| `GET /api/agent/knowledge/overview` | 获取学习中心统计 |
| `GET /api/agent/knowledge/documents` | 获取知识文档列表 |
| `GET /api/agent/knowledge/search` | 测试知识检索 |
| `POST /api/agent/knowledge/documents` | 新增团队知识草稿 |
| `PATCH /api/agent/knowledge/documents/:id` | 修改团队知识 |
| `POST /api/agent/knowledge/documents/:id/:action` | 提交审核、发布、归档 |

### 前端页面依赖

新版前端 `frontend/src/prototype-api.ts` 中相关页面/模块：

| 页面 ID | 页面名 | 说明 |
|---|---|---|
| `knowledge` | 资料维护 | 原有资料库/文件资料管理 |
| `product-knowledge` | 产品知识库 | 产品资料卡、卖点、FAQ、认证、报价提示 |
| `knowledge-ai` | 资料问答 | 基于产品/资料库的 AI 问答 |
| `agent-skills` | Agent Skills | Skill 列表、详情、调教诊断、Agent 学习中心入口 |

相关前端函数包括：

- `loadAgentSkills`
- `renderAgentSkillList`
- `renderAgentSkillDetail`
- `inspectAgentTuning`
- `loadAgentKnowledge`
- `openAgentKnowledgeCenter`
- `openAgentKnowledgeEditor`
- `testAgentKnowledgeRetrieval`
- `renderKnowledge`
- `renderProductKnowledge`
- `askKnowledgeAi`

## 2. 能否全部提取

可以全部提取，已经完成文件级提取。

但要完整合并到当前优化版，不能只复制 `agent-skills` 文件夹。需要分三步：

1. 先合并纯文件：`agent-skills/`、`agent-knowledge/`。
2. 再合并后端运行时：`agent-skills.ts`、`agent-knowledge.ts`、相关类型、store 字段和接口。
3. 最后合并前端页面：`agent-skills` 页面、`Agent 学习中心` 弹窗、`产品知识库`、`资料问答`。

## 3. 合并风险

当前 Gitee 1.4.8 与我们改造版存在核心冲突，尤其是：

- `backend/src/server.ts`
- `backend/src/types.ts`
- `backend/src/store.ts`
- `backend/src/mysql-store.ts`
- `frontend/src/prototype-api.ts`

所以建议不要直接覆盖。应按模块拆分合并。

## 4. 建议合并顺序

第一步：合并 `agent-skills/` 与 `agent-knowledge/` 文件目录。

第二步：只接入只读能力：

- Skill 列表
- Skill 详情
- 系统知识列表
- 知识检索测试
- Agent 目标诊断

第三步：再开放团队知识写入能力：

- 新增草稿
- 提交审核
- 发布
- 归档

第四步：接入 AI 执行：

- 根据 Skill + Knowledge 生成计划
- 根据权限边界判断是否可执行
- 外部发送、删除、释放客户等高风险动作继续要求确认

## 5. 第一版建议

第一版只做“经营资料库 + Agent Skills 只读预览”最稳。

页面上可以先放：

- Agent Skills 列表
- Skill 详情
- 经营知识库列表
- 经营知识详情
- 目标输入框：输入“帮我生成 PI / 找客户 / 写开发信”，系统返回匹配到的 Skill、知识、风险等级

暂时不要让 Agent 自动写入客户、发送邮件或修改商机，等只读检索稳定后再开放。
