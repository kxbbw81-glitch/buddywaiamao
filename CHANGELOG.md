# NexFab AI CRM 更新日志
## V7.29 - 单证审核与发送硬边界（2026-08-20）

### 本次定位
- 对照 V4.1「AI/系统生成的单证必须人工确认」原则，补齐单证草稿可被直接审核/发送的问题。
- V7.27 已让单证草稿携带缺失字段清单，V7.28 已要求订单发货前必须有已审核关键单证；本轮防止“空审核”绕过订单发货校验。

### 新增与优化
- 新增 `src/lib/document-review.ts`，统一校验单证状态 `draft / approved / sent`。
- `PUT /api/documents/[id]` 状态更新接入审核/发送硬边界。
- 单证审核前必须有单证编号、有效 JSON 内容，并且 `meta.missingFields` 中 required 必填缺失字段必须清空。
- recommended 建议字段不阻断审核，但会作为 warning 返回。
- 单证发送前必须先处于 `approved`，禁止从草稿直接标记为 `sent`。
- 审核/发送被拦截或成功都会写入审计日志。
- 单证列表的单个发送、批量审核、批量发送会展示后端返回的具体错误原因。

### 验证
- `pnpm prisma format`：通过
- `pnpm prisma validate`：通过
- `pnpm prisma generate`：通过
- `pnpm exec tsc --noEmit --pretty false`：通过
- `git diff --check`：通过
- `pnpm build`：通过，生产构建生成 64 个页面/API 路由

### 部署备注
- 本轮无数据库结构变更。
- 后续建议补单证内容编辑/缺失字段确认页面，便于业务员在 UI 内完成补齐。
## V7.28 - 订单待发货/发货/完成关键状态硬校验（2026-08-20）

### 本次定位
- 对照 V4.1「订单状态跟踪、单证校验、物流发货、收款核销」要求，补齐订单关键状态不能随意推进的问题。
- 原系统已有基础状态机，但缺少 ready/shipped/completed 前的业务资料校验。

### 新增与优化
- 新增 `src/lib/order-milestones.ts`，集中管理订单关键里程碑校验。
- `PUT /api/orders/[id]` 更新状态时接入硬校验，失败时返回具体缺失项并写入审计日志。
- 进入 `ready` 前必须具备已审核/已发送的 CI、PL，并且 PI 或 SC 至少一份已审核/已发送，同时订单必须有明细。
- 进入 `shipped` 前必须具备物流记录、运输方式、跟踪号/订舱号/提单号/柜号之一，以及 ETD 或 ATD。
- 进入 `completed` 前必须满足关键单证、物流发货和订单全额回款。
- 订单详情状态按钮和订单看板拖拽失败时，展示后端返回的具体原因。

### 验证
- `pnpm prisma format`：通过
- `pnpm prisma validate`：通过
- `pnpm prisma generate`：通过
- `pnpm exec tsc --noEmit --pretty false`：通过
- `git diff --check`：通过
- `pnpm build`：通过，生产构建生成 64 个页面/API 路由

### 部署备注
- 本轮无数据库结构变更。
- 后续建议补“单证 approved 前缺失字段必须清空”和“未审核草稿禁止导出/发送正式文件”。
## V7.27 - 外贸单证草稿生成与人工审核边界（2026-08-20）

### 本次定位
- 对照 V4.1「合同/订单 → 单证生成 → 发货跟踪」流程，补齐订单后续单证类型和人工审核边界。
- 原生成接口只支持 CI/PL/BL/CO，前端入口只开放 CI/PL；本轮扩展到 7 类外贸单证。

### 新增与优化
- 新增 `src/lib/document-drafts.ts`，将单证草稿生成规则模块化。
- `/api/documents/generate` 支持 `CI / PL / PI / SC / DN / BL / CO`。
- 新增 Proforma Invoice、Sales Contract、Delivery Note 草稿生成。
- 每份生成内容都带 `meta.reviewRequired=true`、`reviewStatus=pending_manual_review`、`missingFields` 与数据来源说明。
- PL 不再使用固定假重量/假箱规；产品或物流缺失字段会保留为空并提示人工补齐。
- 单证详情页新增“待人工审核”提示和缺失字段标签。
- 生成单证草稿后写入 `Activity`，记录订单号、审核要求和缺失字段数量。
- 前端生成入口、筛选器、手工创建类型补充 `SC`、`DN`。

### 验证
- `pnpm prisma format`：通过
- `pnpm prisma validate`：通过
- `pnpm prisma generate`：通过
- `pnpm exec tsc --noEmit --pretty false`：通过
- `git diff --check`：通过
- `pnpm build`：通过，生产构建生成 64 个页面/API 路由

### 部署备注
- 本轮无数据库结构变更。
- 下一步建议补“未审核单证禁止导出/发送正式文件”的强约束。
## V7.26 - 报价转订单与商机赢单闭环（2026-08-20）

### 本次定位
- 对照 V4.1「报价单生成 → 客户确认 → 合同/订单」流程，补齐订单成立后商机状态不同步的问题。
- V7.25 已完成“商机 → 报价”，本轮继续补“报价 → 订单 → 商机赢单 → 跟进沉淀”。

### 新增与优化
- 新增 `src/lib/sales-workflow.ts`，统一封装报价转订单后的成交闭环逻辑。
- `POST /api/quotations/[id]/convert-to-order` 改为事务内创建订单、转换报价、关闭商机、写入活动记录。
- `POST /api/orders` 在传入 `quotationId` 时补充报价权限校验、有效期校验、状态校验、重复订单拦截。
- 订单从报价创建但未传明细时，自动复制报价明细到订单明细，保证订单快照完整。
- 报价绑定商机时，订单成立后自动将商机推进为 `won`，概率置为 100，并写入 `closedAt`、`lastFollowUpAt`。
- 自动写入 `Activity` 与统一 `FollowUp(order_follow_up)`，客户/商机详情可沉淀成交节点。

### 验证
- `pnpm prisma format`：通过
- `pnpm prisma validate`：通过
- `pnpm prisma generate`：通过
- `pnpm exec tsc --noEmit --pretty false`：通过
- `git diff --check`：通过
- `pnpm build`：通过，生产构建生成 64 个页面/API 路由

### 部署备注
- 本轮无新增数据库字段。
- 若生产环境尚未同步 V7.22/V7.25 的 schema，正式部署前仍需备份 SQLite 并执行 `pnpm prisma db push`。
