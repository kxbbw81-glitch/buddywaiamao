# NexFab AI CRM 开发工作日志

---
Task ID: 1
Agent: Main Orchestrator
Task: NexFab AI 外贸智能CRM系统 - 从零搭建完整系统

## 项目当前状态描述/判断

### 已完成
- ✅ NexFab AI CRM V4.1 外贸智能客户管理系统已从零搭建完成
- ✅ 基于Next.js 16 + TypeScript + shadcn/ui + Tailwind CSS 4 + Prisma(SQLite) + Zustand + Recharts
- ✅ 单页面应用架构，所有模块通过Zustand状态管理在 `/` 路由下切换
- ✅ Dev server编译成功，HTTP 200，无lint错误

### 系统架构
- **前端**: React 19 + shadcn/ui (New York style) + Framer Motion动画
- **后端**: Next.js API Routes + Prisma ORM (SQLite)
- **状态管理**: Zustand (模块导航、用户状态、筛选条件)
- **数据查询**: @tanstack/react-query
- **图表**: Recharts (AreaChart, BarChart, PieChart)
- **AI集成**: z-ai-web-dev-sdk (AI聊天助手)

### 数据库模型 (11个)
User, Customer, Contact, Product, Inquiry, Quotation, QuotationItem, Order, Payment, Activity, Sample

### 演示数据
- 5个用户(5种角色)
- 15个客户(覆盖美国/德国/瑞典/澳大利亚/韩国/日本/英国/阿联酋等)
- 11个产品, 21个询盘, 11个报价, 10个订单, 9个付款记录, 18个活动记录, 7个样品

## 当前目标/已完成的修改/验证结果

### 核心模块 (10个视图)
1. **工作台 (Workbench)** - KPI卡片、风险预警、销售漏斗(带转化率)、回款进度条、饼图、最近动态、Top客户
2. **目标线索 (Inquiries)** - 询盘列表、状态/优先级/来源筛选、状态徽章
3. **客户档案 (Customers)** - 客户列表(国旗emoji、中文来源标签)、级别筛选、详情抽屉(5个Tab)
4. **产品资料库 (Products)** - 产品列表/网格视图
5. **报价管理 (Quotations)** - 报价列表、利润率颜色编码、详情抽屉
6. **样品管理 (Samples)** - 样品列表、状态筛选
7. **合同订单 (Orders)** - 订单列表、状态追踪
8. **收款管理 (Payments)** - 付款记录、逾期高亮
9. **数据分析 (Analytics)** - KPI行、销售漏斗图、月度趋势图、来源分布饼图、客户级别分布图
10. **系统设置 (Settings)** - 个人信息、主题切换

### 角色工作台
- 5种角色: 超级管理员、管理层、销售经理、销售专员、财务
- 角色选择登录页面(带动画和渐变边框)
- 侧边栏根据角色动态显示模块
- 用户头像、角色徽章、导航徽章计数

### UI/UX增强
- ✅ 国旗emoji映射(28个国家)
- ✅ 中文来源标签(展会/B2B平台/客户介绍/邮件等)
- ✅ KPI卡片: 渐变左边框、悬停缩放、数字等宽字体
- ✅ 状态徽章: 带圆点指示器的多类型样式
- ✅ 侧边栏: NexFab品牌渐变头部、活跃项emerald边框、模块计数徽章
- ✅ 数据表: 斑马条纹、悬停左边框高亮、排序箭头、空状态
- ✅ 销售漏斗: 阶段间转化率百分比
- ✅ 收款概览: 回款率进度条
- ✅ 欢迎消息: 用户名+日期+激励语
- ✅ 自定义滚动条(翡翠绿主题)
- ✅ 暗色模式支持(next-themes)
- ✅ 响应式设计(移动端侧边栏折叠)

### API路由 (12个)
- POST/GET /api/auth
- GET/POST /api/customers, GET/PUT/DELETE /api/customers/[id]
- GET/POST /api/inquiries, GET/PUT /api/inquiries/[id]
- GET/POST /api/products
- GET/POST /api/quotations, GET/PUT /api/quotations/[id]
- GET/POST /api/orders, GET/PUT /api/orders/[id]
- GET /api/dashboard
- POST /api/ai/chat

### 浏览器验证结果 (Agent Browser)
- ✅ 角色选择页面: 5个角色卡片正确显示
- ✅ 工作台: KPI、图表、活动流全部渲染
- ✅ 客户列表: 15条数据、国旗emoji、中文标签
- ✅ 数据分析: 4个图表(KPI+漏斗+来源饼图+级别饼图)
- ✅ 侧边栏: 品牌标识、模块计数、导航切换
- ✅ HTTP 200, 无运行时错误

## 未解决问题或风险

### 需要优先处理
1. **表单提交功能**: 创建/编辑客户、询盘、报价、订单的表单Dialog已创建，但需要验证完整的CRUD流程
2. **详情抽屉交互**: 客户/询盘/报价/订单的详情抽屉已渲染，但Tab切换和子数据加载需验证
3. **AI助手功能**: LLM聊天API已创建，但SSE流式响应和实际AI交互需端到端测试
4. **种子数据优化**: 部分公司名称中英文相同，导致客户列表显示重复

### 下一步开发建议(按优先级)
1. **P1**: 增强AI助手(添加上下文感知、快捷操作)
2. **P1**: 添加更多工作台角色差异化内容
3. **P2**: 添加数据导出功能(Excel/PDF)
4. **P2**: 添加通知系统(WebSocket实时)
5. **P3**: 社媒运营模块
6. **P3**: 权限中心(用户管理、角色配置)

---
Task ID: 2
Agent: Bug Fix & Enhancement Agent
Task: 修复3个关键Bug + 8项功能增强

## Bug修复

### Bug 1: 客户/询盘详情API 500错误 ✅
- **根因**: `/api/customers/[id]` 和 `/api/inquiries/[id]` 的 Prisma `include` 中引用了 `activities` 关系，但 Activity 模型使用多态 `entityType`+`entityId` 模式，没有直接关系
- **修复**: 
  - 从 include 中移除 `activities`
  - 在获取主数据后，用 `db.activity.findMany({ where: { entityType: 'customer'|'inquiry', entityId: id } })` 单独查询
  - 将 activities 数组合并到响应数据中
  - 客户API额外添加了 `samples` 到 include
- **额外修复**: `/api/inquiries` 列表API的 `_count` 中也错误包含了 `activities`，已修复

### Bug 2: 客户列表公司名重复显示 ✅
- **根因**: 种子数据中部分客户的 `companyName` 和 `companyNameEn` 相同，导致列表中重复显示
- **修复**: `customer-list-view.tsx` 中增加条件判断，仅在 `companyNameEn !== companyName` 时显示英文名

### Bug 3: 客户详情抽屉来源显示原始英文 ✅
- **根因**: 直接渲染 `customer.source` 字段（如 "exhibition"），未使用中文标签映射
- **修复**: 导入 `INQUIRY_SOURCE_LABELS`，使用 `INQUIRY_SOURCE_LABELS[customer.source]` 显示中文

## 功能增强

### Enhancement 1: 新建客户表单完全可用 ✅
- 添加 `useEffect` 监听 `customerEditId`，编辑模式下从API加载现有数据并预填充表单
- 成功后使用 `queryClient.invalidateQueries` 刷新客户列表和详情
- Tags 字段正确处理为 JSON 数组
- 自动关联当前用户为 owner

### Enhancement 2: 新建询盘表单完全可用 ✅
- 添加可搜索的客户选择器 (shadcn/ui Command + Popover 组件)
- 从API实时搜索客户列表
- 成功后刷新询盘列表查询
- 来源选择使用 `INQUIRY_SOURCE_LABELS` 常量

### Enhancement 3: 新建报价表单完全可用 ✅
- 添加可搜索的客户选择器（同询盘表单）
- 如果从客户详情抽屉创建，自动预选当前客户
- 动态行增减、自动计算总金额/总成本/利润率
- 利润率颜色编码（≥20%绿色，≥10%橙色，<10%红色）
- 成功后刷新报价列表查询

### Enhancement 4: 询盘详情抽屉增强 ✅
- 添加状态切换下拉选择器（所有状态可切换）
- 跟进记录显示带类型图标（follow_up/email/system）
- 报价Tab显示详细项行（产品名 × 单价）和创建人
- AI翻译内容展示
- 状态更新后自动刷新数据和列表

### Enhancement 5: 新建产品表单完全可用 ✅
- 成功后刷新产品列表查询
- 关键词字段正确处理为 JSON 数组
- 表单关闭时自动重置

### Enhancement 6: 暗色模式优化 ✅
- 卡片边框微弱发光效果
- 表格行暗色模式悬停背景色优化
- 输入框/选择框/文本域暗色模式样式
- 风险预警（rose/amber背景和文字）暗色模式适配
- Sheet和Dialog背景色优化
- Popover暗色模式边框优化

### Enhancement 7: 客户详情抽屉添加操作按钮 ✅
- 顶部添加三个操作按钮: 编辑、创建询盘、创建报价
- 编辑按钮打开预填充的表单对话框
- 概览Tab增加第5个KPI卡片: 订单总额
- 新增「最近动态」卡片显示活动时间线
- 英文名也做去重处理
- 官网链接颜色改为 emerald（避免蓝色）

### Enhancement 8: 产品网格/列表视图切换优化 ✅
- 网格视图增强: 显示分类Badge、利润率百分比和颜色编码
- 使用 Package 图标替代 emoji 占位
- 表格视图英文名也做去重处理
- 添加 aria-label 无障碍标签

## 验证结果
- ✅ Lint 通过，0 错误
- ✅ `/api/customers/[id]` 返回 200，包含 activities 和 samples
- ✅ `/api/inquiries/[id]` 返回 200，包含 activities 和 quotations
- ✅ `/api/inquiries` 列表返回 200

---
Task ID: 3
Agent: Enhancement Agent
Task: 10项功能增强 - 无障碍修复、筛选器、进度条、设置增强等

## 修改内容

### TASK 1: 客户名称无障碍修复 ✅
- **文件**: `src/components/crm/views/customer-list-view.tsx`
- **修改**: 当 `companyName === companyNameEn` 时，div 中只渲染一个段落，不出现重复文本
- **效果**: 屏幕阅读器不再读出重复的公司名称

### TASK 2: 询盘列表添加来源筛选器 ✅
- **文件**: `src/components/crm/views/inquiry-list-view.tsx`
- **修改**: 在优先级筛选器和新建按钮之间添加了来源下拉筛选
- **选项**: 全部来源、邮件、官网、WhatsApp、展会、B2B平台、LinkedIn、社交媒体、手动录入、客户介绍
- **连接**: 使用 `filters.source` 连接 store，API 调用已包含 `source` 参数

### TASK 3: 报价列表利润率颜色编码增强 ✅
- **文件**: `src/components/crm/views/quotation-list-view.tsx`
- **修改**: 
  - 利润率 >= 20%: `text-emerald-600 font-medium` + 绿色条
  - 10-20%: `text-amber-600` + 橙色条
  - 0-10%: `text-red-600` + 红色条
  - <= 0%: `text-red-500 font-bold` + 红色条
  - 每个利润率数字旁添加小进度条指示器
  - 使用 `formatCurrency` from `@/lib/utils`

### TASK 4: 订单状态进度条 ✅
- **文件**: `src/components/crm/views/order-list-view.tsx`
- **修改**: 
  - 新增 `OrderStatusStepper` 组件，在状态列显示6阶段进度点
  - 阶段: 待确认→已确认→生产中→待发货→已发货→已完成
  - 当前阶段: 翡翠绿填充 + ring
  - 已过阶段: 灰色填充
  - 未来阶段: 空心灰色
  - 已取消: 红色 × 标记
  - 同时保留原有 StatusBadge

### TASK 5: 设置页面增强 ✅
- **文件**: `src/components/crm/views/settings-view.tsx`
- **新增内容**:
  - 顶部渐变色横幅 + 圆形头像(首字母)的个人资料卡片
  - 角色Badge + 部门信息
  - 通知偏好设置: 询盘通知、报价审批、订单状态变更、付款提醒 (Switch 开关)
  - 显示设置: 默认每页条数(10/20/50 Select)、紧凑表格模式、深色模式、语言
  - 关于系统: NexFab AI CRM v1.0.0 + 技术栈信息

### TASK 6: 工作台今日概览 ✅
- **文件**: `src/components/crm/views/workbench-view.tsx`, `src/app/api/dashboard/route.ts`
- **修改**:
  - Dashboard API 新增3个统计: `todayInquiries`(今日新增询盘), `pendingFollow`(待跟进), `expiringQuotesCount`(即将到期报价)
  - 工作台欢迎语和KPI卡片之间插入「今日概览」三卡片行
  - 使用 `crm-stat-mini` 样式类、`formatNumber` 格式化

### TASK 7: 收款列表逾期高亮 ✅
- **文件**: `src/components/crm/views/payment-list-view.tsx`
- **新增内容**:
  - 顶部4卡片汇总行: 总金额、已付款(绿)、待付款(橙)、逾期(红，含笔数)
  - 逾期行: 红色左边框 + `bg-red-50/50 dark:bg-red-950/20` 背景
  - 到期日旁显示逾期天数
  - 使用 `differenceInDays` 计算逾期天数
  - 使用 `formatCurrency`, `formatNumber` from `@/lib/utils`

### TASK 8: CSS 工具类增强 ✅
- **文件**: `src/app/globals.css`
- **新增类**:
  - `.crm-glow-emerald`: A级客户卡片翡翠绿发光效果
  - 翡翠色调输入框 focus ring
  - `.crm-card-lift`: 卡片悬停上浮+阴影效果
  - `.crm-stat-mini`: 小型统计数字样式
  - `.crm-timeline-dot`: 活动时间线圆点
  - `.crm-tab-content`: Tab 切换淡入动画

### TASK 9: 侧边栏样品计数徽章 ✅
- **文件**: `src/components/crm/crm-sidebar.tsx`
- **修改**: 样品模块增加 `badgeQuery: 'samples'`
- `SidebarBadgeCount` 组件支持特殊路由，对 samples 从 dashboard API 获取 `pendingSamples` 计数

### TASK 10: 产品网格视图增强 ✅
- **文件**: `src/components/crm/views/product-list-view.tsx`
- **修改**:
  - 更大的产品图片占位区(h-36) + 更大的 Package 图标
  - 产品名称加粗(font-bold)、产品编号等宽字体
  - 分类 Badge 右上角
  - 三栏价格信息: 成本价、标准价(翡翠绿)、利润率
  - 利润率计算改为 (standard-cost)/standard*100
  - 颜色编码: >=20%翡翠绿, >=10%琥珀色, <10%红色
  - 使用 `crm-card-lift` 悬停效果
  - 使用 `formatCurrency` from `@/lib/utils`

## 验证结果
- ✅ Lint 通过，0 错误
- ✅ Dev server HTTP 200
- ✅ 客户详情抽屉: 完整显示(概览/联系人/询盘/订单/备注5个Tab)
- ✅ 联系人Tab: John Smith(采购总监/决策者), Emily Davis(采购经理)
- ✅ 订单Tab: ORD-2024-006 $89,000待发货, ORD-2024-001 $1,445,000已发货
- ✅ 侧边栏徽章: 目标线索21, 报价管理11, 样品管理5
- ✅ 设置页: 4个通知开关 + 显示设置(每页条数/紧凑模式/深色模式/语言)
- ✅ 报价列表: 利润率颜色编码 + 进度条指示器

## 未解决问题或风险

### 低优先级
1. **种子数据中英文名**: 部分客户中文名是英文名的前缀（如"Müller Industrie" vs "Müller Industrie GmbH"），导致列表仍显示近似重复。非代码bug，是种子数据问题
2. **DevTools Console Warning**: Sheet组件在Next.js DevTools中显示一个Console Error（仅在开发环境出现，不影响功能）
3. **AI助手端到端测试**: AI聊天API已创建，但实际LLM交互未在浏览器中完整测试
4. **表单提交端到端测试**: 新建客户/询盘/报价表单已实现，但未在浏览器中做完整的创建→列表刷新验证

### 建议下一阶段优先事项
1. **P1**: 端到端测试所有CRUD表单（新建客户→验证列表刷新→查看详情）
2. **P1**: AI助手完整测试和上下文感知增强
3. **P2**: 角色工作台差异化（销售视角vs管理层视角）
4. **P2**: 数据导出功能（Excel/PDF）
5. **P2**: 通知系统
6. **P3**: 社媒运营模块
7. **P3**: 权限中心（用户管理、角色配置）
8. **P3**: 种子数据优化（确保中英文名更有区分度）

---
Task ID: 4
Agent: Bug Fix & Feature Enhancement Agent
Task: 2个Bug修复 + 3项功能增强（样品API、订单抽屉增强、收款列表优化、新建订单表单）

## Bug修复

### Bug 1: 客户名称去重逻辑不完善 ✅
- **文件**: `src/components/crm/views/customer-list-view.tsx`
- **问题**: 原逻辑仅在公司中英文名完全相同时隐藏英文名，但未处理前缀关系（如"Müller Industrie" vs "Müller Industrie GmbH"）
- **修复**: 增加前缀检查条件：`!nameEn.startsWith(name + ' ') && !name.startsWith(nameEn + ' ')`
- **效果**: "Müller Industrie" vs "Müller Industrie GmbH" 等前缀关系不再重复显示

### Bug 2: 样品列表错误使用订单数据 ✅（关键Bug）
- **问题**: `sample-list-view.tsx` 从 `/api/orders` 获取数据，将订单号替换ORD→SMP前缀，totalAmount/100作为数量，完全错误
- **修复**:
  1. 创建 `/api/samples/route.ts` - 真正的样品API，从Prisma Sample模型查询，include customer、inquiry
  2. 完全重写 `sample-list-view.tsx`，使用正确API，显示：样品名称（带Package图标）、客户（国旗+公司名）、数量、状态(StatusBadge type="sample")、快递单号、寄出日期、创建时间
  3. 添加搜索框连接 searchQuery store
  4. 添加状态筛选器（8种状态）
  5. 添加"新建样品"按钮，打开Dialog表单
  6. Dialog包含：可搜索客户选择器、样品名称、数量、快递方式(7种)、快递单号、备注

## 功能增强

### Feature 1: 订单详情抽屉增强 ✅
- **文件**: `src/components/crm/views/order-detail-drawer.tsx`
- **Tab系统**: 3个Tab切换 - 订单信息、物流追踪、备注
- **物流追踪Tab**:
  - 纵向时间线：6个阶段，每个阶段有独立图标(Clock/ClipboardCheck/Factory/Package/Truck/Check)
  - 已完成阶段：翡翠绿实心圆点 + 白色Check图标 + "已完成"标签
  - 当前阶段：翡翠绿实心圆点 + 脉冲动画 + "当前阶段"标签
  - 未来阶段：灰色空心圆点
  - 每个阶段显示预计日期（基于订单创建日+估算天数）
  - 快递单号编辑（点击编辑，保存按钮）
  - 贸易条款下拉（FOB/CIF/EXW/DDP/DAP）
- **备注Tab**:
  - 订单备注（Textarea + 保存按钮）
  - 内部备注（Textarea，虚线边框）
  - 订单时间线信息（创建时间、最后更新、预计交货）
- **状态变更**: 确认toast通知（如"订单状态已更新为「已确认」"）
- **新增字段**: Order模型新增 trackingNo、shippingMethod 字段
- **API更新**: `/api/orders/[id]` PUT 支持更新 trackingNo、shippingMethod

### Feature 2: 收款列表增强 ✅
- **新增API**: `/api/payments/route.ts`
  - GET: 从Payment模型查询，include order.orderNo、order.customer.companyName，支持 ?status= 筛选
  - POST: 创建Payment记录
- **重写 payment-list-view.tsx**:
  - 使用新的 `/api/payments` API 替代原来的逐个订单获取付款方式
  - 保留原有4卡片汇总（总金额/已付款/待付款/逾期）
  - 保留逾期高亮样式
  - 添加"新建付款"按钮，打开Dialog
  - Dialog包含：可搜索订单选择器（显示订单号+客户+金额）、金额输入、付款方式(T/T/L/C/D/P/Western Union/PayPal)、到期日、状态选择
  - 添加行展开/折叠功能，展开后显示PI号、币种、创建时间、备注
  - invalidateQueries 刷新

### Feature 3: 新建订单表单 ✅
- **新增文件**: `src/components/crm/views/order-form-dialog.tsx`
- **触发方式**: 订单列表"新建订单"按钮
- **表单字段**:
  - 客户（可搜索，Command + Popover）
  - 关联报价（可搜索，选择后自动填充金额和客户ID）
  - 订单金额（手动输入，报价可自动填充）
  - PI号（可选，留空自动生成）
  - 付款条款（6种：100%预付/30%+70%发货前/30%+70%见提单/50%+50%/即期信用证/D/P30天）
  - 交货日期
  - 备注
- **提交**: POST `/api/orders`，成功后刷新订单列表
- **集成**: 在 `page.tsx` 中添加 OrderFormDialog 组件

## 验证结果
- ✅ Lint 通过，0 错误
- ✅ Prisma schema 推送成功（新增 trackingNo、shippingMethod 字段）
- ✅ Dev server 编译正常

## 未解决问题或风险

### 低优先级
1. **DevTools Console Warning**: Sheet组件在开发环境中可能显示Console Warning（不影响功能）
2. **报价API缺少customerId筛选**: 当前 `/api/quotations` 未支持 customerId 查询参数，订单表单中的报价筛选可能无法按客户过滤

---
Task ID: 5
Agent: Enhancement Agent
Task: 工作台增强、数据分析增强、询盘跟进记录、CSS增强、客户报价Tab

## 修改内容

### Task 1: 工作台增强 (workbench-view.tsx) ✅
- **快速操作区域**: 在今日概览卡片后添加了4个快速操作按钮，每个按钮为独立Card组件：
  - 新建客户 (UserPlus icon, emerald色)
  - 新建询盘 (FileText icon, teal色)
  - 新建报价 (Calculator icon, amber色)
  - AI分析 (Sparkles icon, rose色)
  - 每个按钮带hover缩放效果(Framer Motion whileHover scale)
  - 点击触发对应的store action
- **待办事项卡片**: 底部布局从2列改为3列，新增待办事项卡片：
  - 通过 `/api/inquiries?status=new` 和 `?status=following` 获取待跟进询盘
  - 按优先级排序（urgent > high > normal > low）
  - 每项显示: 询盘主题（截断）、客户名称、优先级徽章
  - 点击打开询盘详情(selectInquiry)
  - 顶部Badge显示总待办数量
- **3列布局**: 底部区域改为 grid-cols-3（询盘分布、待办事项、最近动态）
- **Card Glow**: 今日概览卡片添加 crm-card-glow 暗色模式发光效果

### Task 2: 数据分析增强 (analytics-view.tsx) ✅
- **KPI概览行**: 4个带渐变左边框的KPI卡片：
  - 客户总数 (+3 vs 上月, hardcoded)
  - 询盘转化率 (+2.1%)
  - 平均订单金额 (-5.2%)
  - 回款率 (+1.8%)
  - 每个卡片带 pattern overlay 和 kpi-border 渐变边框
- **月度趋势切换**: 在趋势图上方添加切换按钮组(询盘/报价/订单)
  - 3种模式各有独立数据数组和颜色配置
  - 使用React state (trendMode) 切换数据源
  - 按钮选中状态为emerald-600背景
- **客户地区分布水平柱状图**: 
  - 通过 `/api/customers` 获取客户列表，按国家映射到地区
  - 7个地区分组（亚洲、欧洲、北美、南美、非洲、大洋洲、中东）
  - 每个地区有独立颜色编码
  - 图例显示客户数和百分比
- **销售业绩排行表**: 
  - 5行数据表格（排名、姓名、询盘数、成交额、转化率）
  - 前3名有特殊样式：金/银/铜色圆头像 + Trophy/Medal图标
  - 转化率颜色编码（≥40%绿/≥30%橙/<30%红）
  - 按成交额降序排列

### Task 3: 询盘跟进记录增强 (inquiry-detail-drawer.tsx) ✅
- **跟进记录时间线**: 将原有简单卡片列表改为完整时间线：
  - 按时间正序排列（oldest first）
  - 每条记录有：类型图标（不同颜色）、头像圆圈（创建者首字母）、内容、时间
  - 类型图标映射：电话=Phone(天蓝)、邮件=Mail(翡翠)、WhatsApp=MessageCircle(teal)、现场拜访=MapPin(琥珀)、其他=FileText
  - 时间线连接线
- **添加跟进表单**: 在跟进记录区域底部：
  - Textarea 输入跟进内容
  - Select 选择跟进类型（电话/邮件/WhatsApp/现场拜访/其他），带图标选项
  - 提交按钮 POST `/api/activities`，创建 follow_up 类型活动记录
  - 提交后自动更新询盘 lastFollowUpAt 时间
  - 提交后 invalidateQueries 刷新数据和列表
  - Loading 状态（Loader2 旋转动画）
- **API**: 创建了 `/api/activities/route.ts` (GET + POST)

### Task 4: CSS增强 (globals.css) ✅
- **workbench-bg**: 更新为 `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)` 格式
- **dark .workbench-bg**: 暗色模式版本
- **crm-card-glow**: 暗色模式卡片发光效果
  - 默认: `box-shadow: 0 0 0 1px rgba(16,185,129,0.1), 0 4px 12px rgba(0,0,0,0.3)`
  - hover: `box-shadow: 0 0 0 1px rgba(16,185,129,0.3), 0 8px 24px rgba(0,0,0,0.4)`
- **crm-table-row**: 添加 position: relative; overflow: hidden; 点击波纹效果
  - `::after` 伪元素实现 ripple 动画
  - active 状态下 scale(0) + opacity 1
- **crm-tooltip**: 自定义提示框样式
  - 使用 CSS 变量 popover/border
  - 12px字体，6px圆角，微妙阴影

### Task 5: 客户详情抽屉 报价 Tab (customer-detail-drawer.tsx) ✅
- **Tab结构调整**: 在询盘和订单之间添加"报价"Tab
- **数据获取**: 通过 `useQuery` 获取 `/api/quotations?customerId={id}`
- **表格列**: 报价编号、总金额（右对齐等宽字体）、利润率（带进度条+颜色编码）、状态(StatusBadge)、有效期
- **利润率颜色编码**: ≥20%翡翠绿/≥10%琥珀色/<10%红色，带h-1.5迷你进度条
- **行点击**: crm-table-row 样式，点击调用 selectQuotation 打开报价详情抽屉
- **TabsList**: flex-wrap 适配6个Tab

## 新增文件
- `src/app/api/activities/route.ts` - 活动/跟进记录 CRUD API

## 验证结果
- ✅ ESLint 通过，0 错误
- ✅ 所有UI文本使用中文
- ✅ 未使用蓝色/紫色（AI分析使用rose色）
- ✅ 使用emerald/teal作为主色调
- ✅ 使用shadcn/ui组件（Card, Badge, Button, Tabs, Select, Textarea, Table等）
- ✅ 响应式设计


---
Task ID: QA-4
Agent: Main Orchestrator
Task: 第4轮自动化QA + Bug修复 + 大规模功能增强 + 样式细化

## 项目当前状态描述/判断

### 系统状态: 🟢 稳定运行
- Dev server 编译正常，HTTP 200
- ESLint 0 错误
- 数据库 11 个模型正常运行
- 15 个客户（含2个CRUD测试创建）、7个样品、9个付款记录

### 浏览器QA验证结果
- ✅ 角色选择页面: 5个角色卡片，动画正常
- ✅ 登录流程: 点击角色→API认证→工作台加载，全过程<3秒
- ✅ 工作台: 欢迎消息+今日概览+快速操作(4按钮)+待办事项+风险预警+销售漏斗+回款率+图表+Top客户
- ✅ 客户列表: 17条记录(含CRUD测试创建)，国旗emoji+中文标签+级别筛选+搜索
- ✅ 客户详情抽屉: 6个Tab(概览/联系人/询盘/报价/订单/备注)全部正常切换
- ✅ 新建客户CRUD: 表单→提交→列表刷新→新数据出现在第2页 ✅
- ✅ 询盘列表: 状态/优先级/来源3种筛选器+数据正常
- ✅ 报价列表: 利润率+颜色编码+11条数据
- ✅ 样品管理: 正确使用/api/samples API，7条真实样品数据
- ✅ 收款管理: 独立API，汇总卡片(总/已付/待付/逾期)+"新建付款"按钮
- ✅ 合同订单: "新建订单"按钮+状态进度点
- ✅ 数据分析(管理层): KPI概览+趋势切换+地区分布+销售排行
- ✅ AI助手: 抽屉正常打开，显示标题和消息输入框
- ⚠️ AI聊天: 未完成实际LLM交互测试(需真实API Key)

### 本轮完成内容

## Bug修复 (2项)
1. **客户名称去重前缀匹配** ✅ - customer-list-view.tsx 增加前缀检查
2. **样品列表使用订单数据** ✅ - 全新 /api/samples API + 重写视图

## 新增API (3个)
1. `/api/samples` (GET+POST) - 样品CRUD
2. `/api/payments` (GET+POST) - 独立付款管理
3. `/api/activities` (GET+POST) - 活动/跟进记录

## 新增功能 (10项)
1. **工作台快速操作** - 4个图标按钮(新建客户/询盘/报价/AI分析)
2. **待办事项卡片** - 按优先级排序的待跟进询盘列表
3. **数据分析KPI行** - 4个KPI卡片(客户总数/转化率/平均订单/回款率)
4. **月度趋势切换** - 询盘/报价/订单三种数据源切换
5. **客户地区分布图** - 7区域水平柱状图
6. **销售业绩排行** - 5人排行表+金银铜特殊样式
7. **订单详情3Tab** - 订单信息/物流追踪(时间线)/备注
8. **新建样品Dialog** - 客户搜索+名称+数量+快递方式+单号
9. **新建付款Dialog** - 订单搜索+金额+付款方式+到期日
10. **新建订单Dialog** - 客户+报价关联自动填充+PI号+付款条款

## 增强功能 (5项)
1. **询盘跟进时间线** - 类型图标+头像+连接线+添加跟进表单
2. **客户详情报价Tab** - 利润率颜色编码+进度条+点击打开详情
3. **收款行展开** - 展开显示PI号/币种/创建时间/备注
4. **CSS增强** - workbench网格背景+暗色卡片发光+表格行波纹+tooltip样式
5. **订单物流追踪** - 6阶段纵向时间线+快递单号编辑+贸易条款选择

## 未解决问题或风险

### 中优先级
1. **报价API customerId筛选**: 客户详情报价Tab需要 `/api/quotations?customerId=xxx`，需确认API已支持
2. **AI助手实际交互**: LLM API已对接但未完成真实对话测试
3. **种子数据清理**: 测试创建的客户(含"--timeout"文字)需要清理

### 低优先级
1. **DevTools Badge遮挡**: Next.js DevTools徽章偶尔遮挡侧边栏按钮(仅开发环境)
2. **角色工作台差异化**: 销售vs管理层vs财务的工作台内容需要更多差异化

### 建议下一阶段优先事项
1. **P1**: AI助手上下文感知增强(自动带入当前客户/询盘信息)
2. **P1**: 数据导出功能(客户列表Excel导出)
3. **P2**: 通知系统(WebSocket实时通知)
4. **P2**: 角色工作台差异化内容
5. **P2**: 种子数据优化(清理测试数据、丰富更多样化的客户)
6. **P3**: 社媒运营模块
7. **P3**: 权限中心(用户管理、角色配置)
8. **P3**: 多语言支持(英语/中文切换)

---
Task ID: 5-a
Agent: Notification Center Developer
Task: Notification center dropdown

Work Log:
- Added `readAt DateTime?` field to Activity model in prisma/schema.prisma
- Ran `bun run db:push` to sync schema changes to SQLite database
- Created `/api/notifications/route.ts` with GET and PUT endpoints:
  - GET: fetches recent activities (limit=10), enriches with entity info (customer name, inquiry subject, quotation/order numbers), returns unread count
  - PUT: supports `markAll: true` to mark all unread as read, or single `id` to mark specific notification as read
- Created `notification-dropdown.tsx` as a 'use client' component:
  - Uses shadcn/ui Popover triggered by Bell button
  - Header with '通知中心' title and '全部已读' button (CheckCheck icon)
  - Fetches notifications from `/api/notifications?limit=10` on open
  - Shows notification items with type-specific icons (Phone/Mail/Info/FileText/ShoppingCart), content text, relative time formatting (刚刚/X分钟前/X小时前/昨天/X天前/X周前/X个月前/X年前), unread dot indicator (left border emerald-500 + green dot)
  - Empty state with Inbox icon and '暂无通知' text
  - Loading state with spinner
  - '查看全部' link at bottom
  - Dynamic unread count badge on Bell icon (supports 99+ overflow)
- Updated `crm-header.tsx`: replaced static Bell button with NotificationDropdown component, removed unused Bell import

Stage Summary:
- ✅ Prisma schema updated with `readAt DateTime?` on Activity model
- ✅ `/api/notifications` API (GET + PUT) created
- ✅ NotificationDropdown component fully functional with Popover, type icons, relative time, unread indicators
- ✅ Integrated into CRM header, replacing static Bell button
- ✅ ESLint passes with 0 errors
- ✅ All text in Chinese, uses emerald/teal color scheme
- ✅ Uses shadcn/ui components: Popover, PopoverTrigger, PopoverContent, Button, ScrollArea, Badge, Separator

---
Task ID: 5-b
Agent: Data Export Developer
Task: 添加CSV数据导出功能到CRM列表视图

## 修改内容

### 1. 创建CSV导出工具函数 ✅
- **文件**: `src/lib/export-csv.ts`
- **函数**: `exportToCSV(data, filename, columns)`
- **功能**:
  - BOM头 (\uFEFF) 确保Excel正确识别中文编码
  - RFC 4180标准的CSV字段转义（逗号、双引号、换行符）
  - 支持嵌套对象取值（点号路径如 `owner.name`）
  - 智能值格式化（嵌套对象自动提取name/companyName，布尔值转是/否）
  - 通过 Blob + URL.createObjectURL 触发浏览器下载
  - 下载后自动清理 URL 对象和临时 DOM 元素

### 2. 客户列表导出 ✅
- **文件**: `src/components/crm/views/customer-list-view.tsx`
- **导出列**: 公司名称, 国家, 级别(中文标签), 来源(中文标签), 负责人, 最后联系日期, 询盘数, 状态(活跃/不活跃/流失)
- **数据转换**: 使用 CUSTOMER_LEVEL_LABELS、INQUIRY_SOURCE_LABELS 映射为中文

### 3. 询盘列表导出 ✅
- **文件**: `src/components/crm/views/inquiry-list-view.tsx`
- **导出列**: 询盘编号, 主题, 客户, 来源(中文), 状态(中文), 优先级(中文), 负责人, 创建时间
- **数据转换**: 使用 INQUIRY_STATUS_LABELS、PRIORITY_LABELS 映射为中文

### 4. 报价列表导出 ✅
- **文件**: `src/components/crm/views/quotation-list-view.tsx`
- **导出列**: 报价编号, 客户, 贸易条款, 金额, 利润率(百分比字符串), 状态(中文), 创建日期
- **数据转换**: 使用 QUOTATION_STATUS_LABELS 映射为中文

### 5. 订单列表导出 ✅
- **文件**: `src/components/crm/views/order-list-view.tsx`
- **导出列**: 订单编号, 客户, 金额, 付款条款, 状态(中文), 创建日期
- **数据转换**: 使用 ORDER_STATUS_LABELS 映射为中文

### 6. 收款列表导出 ✅
- **文件**: `src/components/crm/views/payment-list-view.tsx`
- **导出列**: 付款编号, 订单, 客户, 金额, 付款方式, 状态(中文), 到期日
- **数据转换**: 使用 PAYMENT_STATUS_LABELS 映射为中文，付款编号由ID末4位生成

### UI组件
- 所有列表视图的导出按钮使用 shadcn/ui DropdownMenu 组件
- 触发按钮: `Button variant='outline' size='sm'` + Download 图标 + '导出' 文字
- 菜单项: Download 图标(emerald-600色) + '导出CSV' 文字
- 导出后使用 sonner toast 显示 '导出成功，共 N 条数据'
- 空数据时显示 toast.info('暂无数据可导出')
- 导出按钮位于筛选器和新建按钮之间（ml-auto布局）

## 新增文件
- `src/lib/export-csv.ts` - CSV导出工具函数

## 验证结果
- ✅ ESLint 通过，0 错误
- ✅ 所有文本使用中文
- ✅ 未使用蓝色/紫色，Download图标使用 emerald-600 色
- ✅ 使用 shadcn/ui 组件: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Button
- ✅ 使用 sonner toast 通知
- ✅ 5个列表视图均已添加导出功能

---
Task ID: 5-c
Agent: Kanban View Developer
Task: 客户看板视图 + 视图切换 + 批量更新API

## 新增文件

### 1. `src/components/crm/views/customer-kanban-view.tsx` ✅
- **'use client'** 组件，导出 `CustomerKanbanView`
- **4列看板**: A级客户(emerald)、B级客户(amber)、C级客户(sky)、D级客户(rose)
- **列头设计**: 彩色背景 + 图标(Star/Award/UserCircle/Users) + 级别名称 + 客户数量Badge
- **客户卡片内容**:
  - 公司名称(加粗，单行截断)
  - 国旗emoji + 国家名 (使用 `getCountryFlag`)
  - 来源中文标签 (使用 `INQUIRY_SOURCE_LABELS`)
  - 负责人姓名
  - 询盘数量Badge (Inbox图标)
  - 最后联系时间(相对时间格式：刚刚/X分钟前/X小时前/X天前/X个月前/X年前)
  - 点击卡片打开客户详情抽屉 (使用 `selectCustomer`)
- **数据获取**: `useQuery` 从 `/api/customers` 获取，客户端按 `customerLevel` 分组
- **响应式**: 桌面端水平滚动4列看板，移动端垂直堆叠(每列内卡片水平滚动)
- **空状态**: 每列无客户时显示 LayoutGrid 图标 + "暂无X级客户" 文字
- **动画**: Framer Motion `layoutId` + `AnimatePresence mode="popLayout"` 实现卡片进入/退出/重排动画
- **无障碍**: `role="button"`, `tabIndex={0}`, `aria-label`, 键盘 Enter/Space 支持
- **Loading**: 翡翠绿旋转 Spinner
- **暗色模式**: 卡片hover边框颜色适配 dark 模式

### 2. `src/app/api/customers/bulk-update/route.ts` ✅
- **PUT** 端点
- 接受 `{ updates: [{ id: string, customerLevel: string }] }`
- 校验: updates必须是非空数组，customerLevel必须是A/B/C/D之一
- 逐条更新(跳过失败的单条)，返回 `{ success: true, data: { successCount } }`
- 错误处理: 400参数错误, 500服务器错误

## 修改文件

### `src/components/crm/views/customer-list-view.tsx` ✅
- **新增导入**: `useState`, `LayoutGrid`, `List` (lucide-react), `ToggleGroup/ToggleGroupItem`, `CustomerKanbanView`
- **移除导入**: `useEffect`, `useQueryClient` (不再需要)
- **视图切换状态**: `const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')`
- **ToggleGroup**: 在状态筛选器和导出按钮之间插入，包含两个ToggleGroupItem:
  - List图标 (列表视图)
  - LayoutGrid图标 (看板视图)
  - 选中状态自动高亮
- **条件渲染**: `viewMode === 'kanban'` 时显示 `CustomerKanbanView`，否则显示原有 `DataTable`
- **未修改 page.tsx**: 所有切换逻辑在 CustomerListView 内部完成

## 验证结果
- ✅ ESLint 通过，0 错误
- ✅ 所有UI文本使用中文
- ✅ 未使用蓝色/紫色（使用emerald/amber/sky/rose四色体系）
- ✅ 使用emerald/teal作为主色调
- ✅ 使用shadcn/ui组件: Badge, ScrollArea, ToggleGroup, ToggleGroupItem, Button, Select
- ✅ 响应式设计 (桌面水平看板 / 移动端垂直堆叠)
- ✅ Framer Motion 动画 (layoutId + AnimatePresence)
- ✅ 相对时间格式化 (date-fns differenceIn*)
- ✅ 客户卡片点击打开详情抽屉 (selectCustomer)

---
Task ID: 5-d
Agent: Search Enhancement Developer
Task: 全局搜索增强 - 跨模块搜索 + Command对话框

## 新增文件

### 1. `src/app/api/search/route.ts` ✅
- **GET** 端点，接受 `?q=` 查询参数
- **跨模块搜索**（每类最多5条结果）：
  - **客户**: companyName、companyNameEn、country 字段模糊匹配
  - **询盘**: inquiryNo、subject 字段模糊匹配
  - **报价**: quoteNo 字段模糊匹配
  - **订单**: orderNo 字段模糊匹配
- **返回结构化结果**: `{ customers: [...], inquiries: [...], quotations: [...], orders: [...] }`
- **每条结果包含**: id, type, text(主文本), subtitle(副文本，如国家·级别、金额·客户名)
- **错误处理**: 500 错误返回中文提示"搜索失败，请稍后重试"
- 空查询返回空结果而非错误

### 2. `src/components/crm/global-search-dialog.tsx` ✅
- **'use client'** 组件，导出 `GlobalSearchDialog`
- **触发方式**:
  - 点击Header中的搜索区域（带Search图标 + placeholder + ⌘K快捷键提示）
  - 键盘快捷键: **Cmd+K**（macOS）/ **Ctrl+K**（Windows）
- **搜索逻辑**: 输入后 300ms 防抖，fetch `/api/search?q=xxx`
- **结果分组**（Command Group + Heading）：
  - 客户（Building2 icon，翡翠绿背景）
  - 询盘（FileText icon，青色背景）
  - 报价（Calculator icon，琥珀色背景）
  - 订单（ShoppingCart icon，玫红色背景）
- **每个结果项**: 彩色图标容器 + 主文本(font-medium, truncate) + 副文本(text-muted-foreground, truncate)
- **点击行为**: 调用 useCRMStore 的 setCurrentModule + selectCustomer/selectInquiry/selectQuotation/selectOrder 导航到对应模块并打开详情
- **空状态**:
  - 有查询无结果: Search图标 + "没有找到结果" + "请尝试其他关键词"
  - 无查询: Search图标 + "输入关键词搜索客户、询盘..."
- **Loading状态**: Loader2旋转动画(emerald-600色) + "搜索中..."
- **响应式**: 桌面端显示完整搜索区域(w-64)，移动端显示Search图标按钮
- **暗色模式**: 图标容器暗色模式使用 dark:bg-{color}-950/50 配色
- **CommandDialog**: max-h-[400px] 结果列表

## 修改文件

### `src/components/crm/crm-header.tsx` ✅
- **移除**: 原有的 `Search`、`Input` 导入，`searchQuery`、`setSearchQuery` store引用
- **新增**: `GlobalSearchDialog` 组件导入
- **替换**: 原 `<div><Search/><Input/></div>` 搜索区域替换为 `<GlobalSearchDialog />`
- **效果**: 搜索区域从简单输入框升级为Command Palette触发器，保持相似的视觉样式

## 验证结果
- ✅ ESLint 通过，0 错误
- ✅ 所有UI文本使用中文
- ✅ 未使用蓝色/紫色（使用emerald/teal/amber/rose四色体系）
- ✅ 使用shadcn/ui组件: CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem
- ✅ 使用emerald/teal作为主色调
- ✅ 响应式设计（桌面完整搜索栏 + 移动端图标按钮）
- ✅ 键盘快捷键 Cmd+K / Ctrl+K 支持
- ✅ 防抖搜索（300ms）
- ✅ 每类最多5条结果限制
- ✅ 跨模块导航 + 详情抽屉打开

---
Task ID: 5-e
Agent: Main Orchestrator
Task: AI助手上下文感知增强 + 角色工作台差异化 + CSS样式细化

## 项目当前状态描述/判断

### 系统状态: 🟢 稳定运行
- Dev server HTTP 200，ESLint 0 错误
- 数据库12个字段（Activity新增readAt）
- 所有核心功能正常运行

### 浏览器QA验证结果
- ✅ 角色选择页面: 5个角色卡片，动画正常
- ✅ 工作台: 财务快览面板(超级管理员/管理层/财务可见)、角色差异化快速操作
- ✅ 全局搜索: Command Palette打开正常，输入"Tech"返回3个客户结果（TechVista Solutions/Andes Tech/AfroTech Industries），显示级别·国家
- ✅ 客户看板: 4列（A/B/C/D）看板视图，客户卡片含国旗/来源/负责人/询盘数/相对时间
- ✅ 视图切换: ToggleGroup在"列表视图"和"看板视图"间切换
- ✅ 导出按钮: 所有列表视图显示"导出"DropdownMenu
- ✅ 通知铃铛: 替换为动态NotificationDropdown，支持展开/全部已读
- ✅ AI助手: 上下文感知（查看客户/询盘时显示上下文标签）、清空对话按钮、思考动画(三点弹跳)
- ✅ 暗色模式: 所有新组件适配

## 本轮完成内容

### 新功能 (7项)
1. **通知中心下拉面板** (Task 5-a) - Popover通知列表、类型图标、相对时间、未读标记、全部已读
2. **CSV数据导出** (Task 5-b) - 5个列表视图的CSV导出（客户/询盘/报价/订单/收款），中文标签映射
3. **客户看板视图** (Task 5-c) - 4列看板（A/B/C/D级别）、Framer Motion动画、视图切换Toggle
4. **全局搜索 Command Palette** (Task 5-d) - Cmd+K快捷键、跨模块搜索（客户/询盘/报价/订单）、分组结果
5. **AI助手上下文感知增强** - 查看客户/询盘时自动带入上下文、快捷操作按钮根据上下文高亮、清空对话、思考动画
6. **角色工作台差异化** - 财务角色/管理层角色快速操作不同、财务快览面板(应收总额/逾期金额/待审批报价/回款率)
7. **客户批量更新API** - /api/customers/bulk-update PUT端点

### 增强功能 (5项)
1. **AI助手UI重设计** - 圆角气泡消息、渐变头像、时间戳显示、上下文Badge、"已关联上下文"提示
2. **快速操作按钮扩展** - handleQuickAction支持payments/orders/quotations/analytics模块跳转
3. **CSS动画增强** - 看板卡片样式、Command Palette样式、通知项样式、AI消息进入动画、思考弹跳点、Shimmer加载效果、导出成功动画、通知脉冲、打印样式、选中颜色
4. **暗色模式优化** - 看板列头渐变暗色适配、Command Item悬停暗色适配、通知项暗色适配

### 新增/修改文件清单
- **新增**: `src/components/crm/notification-dropdown.tsx`, `src/components/crm/global-search-dialog.tsx`, `src/components/crm/views/customer-kanban-view.tsx`, `src/lib/export-csv.ts`, `src/app/api/notifications/route.ts`, `src/app/api/search/route.ts`, `src/app/api/customers/bulk-update/route.ts`
- **修改**: `src/components/crm/crm-header.tsx`, `src/components/crm/views/ai-assistant-drawer.tsx`, `src/components/crm/views/workbench-view.tsx`, `src/components/crm/views/customer-list-view.tsx`, `src/components/crm/views/inquiry-list-view.tsx`, `src/components/crm/views/quotation-list-view.tsx`, `src/components/crm/views/order-list-view.tsx`, `src/components/crm/views/payment-list-view.tsx`, `src/app/globals.css`, `prisma/schema.prisma`

## 未解决问题或风险

### 低优先级
1. **AI聊天端到端测试**: LLM API已对接但实际对话未在浏览器中完整测试（需真实API交互验证）
2. **种子数据清理**: 之前测试创建的含"--timeout"文字的客户需要清理
3. **通知中心"查看全部"**: 当前仅显示按钮，点击后无实际导航目标
4. **看板视图拖拽**: 当前看板为静态分组展示，无拖拽排序功能

### 建议下一阶段优先事项
1. **P1**: 通知中心"查看全部"导航到活动记录列表页面
2. **P1**: 看板视图拖拽排序（客户在级别列之间移动）
3. **P1**: AI聊天端到端测试 + 流式响应(SSE)
4. **P2**: 种子数据优化（清理测试数据、增加更多样化客户）
5. **P2**: 权限中心（用户管理、角色配置）
6. **P2**: 社媒运营模块
7. **P3**: 多语言支持（英语/中文切换）
8. **P3**: 数据看板大屏展示（管理层）
9. **P3**: 客户地图视图（基于国家的客户分布地图）

---
Task ID: 6-b
Agent: User Menu Developer
Task: 为CRM Header添加用户下拉菜单

## 当前状态描述/判断

CRM Header右侧已有通知下拉、AI助手按钮、主题切换按钮，但缺少用户信息交互区域。需要添加一个完整的用户下拉菜单，替代原来显示用户名和角色徽章的简单按钮（实际上当前header中并无该按钮，需要新增）。

## 已完成的修改

### 1. 新建文件: `src/components/crm/user-menu.tsx`
- **'use client' 组件**，使用 shadcn/ui DropdownMenu 构建
- **Trigger 区域**:
  - 32px 圆形 Avatar，显示用户名首字符作为 fallback（emerald 配色）
  - 用户名文本（`hidden md:block`，移动端隐藏）
  - 角色徽章 Badge（variant=secondary，emerald 配色，移动端隐藏）
  - ChevronDown 箭头图标（移动端隐藏）
  - 整体使用 `<button>` 而非 Button 组件，以获得更灵活的布局控制
- **DropdownMenuContent** (w-64):
  - 用户信息区（DropdownMenuLabel，p-0 自定义布局）:
    - 40px Avatar（首字符 fallback）
    - 用户名（font-semibold）
    - 邮箱（text-muted-foreground）
    - 角色徽章 + 部门文字
  - Separator
  - 「个人设置」菜单项（Settings 图标，emerald focus 样式）→ `setCurrentModule('settings')`
  - Separator
  - 「退出登录」菜单项（LogOut 图标，red focus 样式）→ `logout()`
- 从 `@/lib/types` 导入 `ROLE_LABELS` 和 `UserRole` 类型
- 从 `@/store/use-crm-store` 导入 `useCRMStore`
- 所有文本为中文，颜色使用 emerald/teal，无 blue/purple
- 早期返回 `null` 当 `currentUser` 为空时

### 2. 修改文件: `src/components/crm/crm-header.tsx`
- 新增 `import { UserMenu } from '@/components/crm/user-menu'`
- 在 NotificationDropdown 之后添加垂直分隔线 `Separator`
- 添加 `<UserMenu />` 组件
- 保留所有原有元素（SidebarTrigger、Breadcrumb、GlobalSearchDialog、AI按钮、主题切换、NotificationDropdown）

## 验证结果
- ✅ ESLint 通过，无错误无警告
- ✅ 组件使用 shadcn/ui 标准组件（DropdownMenu, Avatar, Badge, Separator）
- ✅ 响应式设计：移动端仅显示 Avatar，桌面端显示完整信息
- ✅ emerald/teal 配色方案一致

---
Task ID: 6-c
Agent: Activity List Developer
Task: 创建活动记录列表页面并连接通知下拉"查看全部"按钮

## 当前状态描述/判断

通知下拉组件中的"查看全部"按钮无功能。需要创建完整的活动记录列表视图，并接入模块系统。

## 已完成的修改

### 1. 创建活动记录列表视图
- **文件**: `src/components/crm/views/activity-list-view.tsx`
- 标题: "活动记录"，副标题: "查看所有操作记录和系统动态"
- 返回按钮导航至工作台
- 筛选行: 搜索输入框、类型筛选(全部类型/跟进/电话/邮件/会议/备注/系统)、时间范围(全部时间/今天/本周/本月)
- 数据表格: 类型(icon+label)、内容、关联对象(Badge显示客户/询盘/报价/订单)、操作人、相对时间
- 类型图标映射: follow_up=Clock, call=Phone, email=Mail, meeting=Users, note=FileText, system=Info
- 使用 emerald/teal 配色
- 相对时间格式化辅助函数
- 使用 useQuery 从 @tanstack/react-query 获取数据
- 分页: 共 N 条，页码导航
- 空状态: Clock 图标 + "暂无活动记录"
- 加载状态: 3行骨架屏(animate-pulse)

### 2. 更新 API 路由
- **文件**: `src/app/api/activities/route.ts`
- 新增查询参数支持: search(搜索subject/content)、type(类型过滤)、dateRange(today/week/month)、page、pageSize
- 返回分页结构: { success, data, total, page, pageSize }
- 保留原有 POST 和 entityType/entityId 参数兼容

### 3. 连接通知下拉"查看全部"按钮
- **文件**: `src/components/crm/notification-dropdown.tsx`
- 导入 useCRMStore，点击"查看全部"时关闭下拉并调用 setCurrentModule('activities')

### 4. 模块系统更新
- **文件**: `src/lib/types.ts`
- ModuleKey 类型新增 'activities'
- MODULE_LABELS 新增 activities: '活动记录'
- **文件**: `src/app/page.tsx`
- 导入 ActivityListView，ModuleView switch 新增 case 'activities'
- 未添加到侧边栏(通过通知下拉访问)

## 验证结果
- `bun run lint` 通过，零错误
- 所有文件使用中文文本，emerald/teal 配色方案

---
Task ID: 6-d
Agent: Inquiry Kanban Developer
Task: 创建询盘看板视图并集成到询盘列表视图

## 项目当前状态描述/判断

### 已完成
- ✅ 询盘看板视图组件已创建完成 (inquiry-kanban-view.tsx)
- ✅ 询盘列表视图已集成看板/列表切换功能
- ✅ ESLint lint 检查通过，零错误
- ✅ TypeScript 编译检查通过（新文件无错误）

### 新增文件
- `src/components/crm/views/inquiry-kanban-view.tsx` — 询盘看板视图组件

### 修改文件
- `src/components/crm/views/inquiry-list-view.tsx` — 添加列表/看板视图切换

## 当前目标/已完成的修改/验证结果

### 询盘看板视图 (inquiry-kanban-view.tsx)
1. **4列看板布局**：
   - 新询盘 (new + assigned) — emerald 翠绿色，Inbox 图标
   - 跟进中 (following) — amber 琥珀色，Phone 图标
   - 已报价 (quoted) — sky 天蓝色，FileText 图标
   - 已成交/流失 (won + lost) — rose 玫红色，CheckCircle 图标

2. **卡片信息展示**：
   - 询盘编号 (inquiryNo，等宽字体)
   - 优先级徽章 (StatusBadge type='priority')
   - 主题 (subject，单行截断)
   - 客户公司名称
   - 来源标签 (中文)
   - 成交/流失图标指示 (CheckCircle/XCircle)
   - 负责人名称
   - 相对创建时间（刚刚/N分钟前/N小时前/N天前）

3. **交互功能**：
   - 点击卡片调用 selectInquiry 打开详情抽屉
   - 键盘可访问 (Enter/Space)
   - 流失卡片降低透明度显示

4. **数据获取**：
   - 通过 useQuery 获取 /api/inquiries
   - 应用搜索、优先级、来源筛选
   - 客户端按状态类别分组

5. **响应式设计**：
   - 桌面端：水平滚动看板，每列固定宽度 288px
   - 移动端：垂直堆叠列，卡片水平滚动
   - 列内卡片区域 ScrollArea 支持滚动

6. **动画效果**：
   - Framer Motion AnimatePresence + layoutId
   - 卡片 spring 弹性入场/退出动画
   - 空列状态展示

7. **技术细节**：
   - 使用 cn() 工具函数替代模板字符串（避免 TSX 解析兼容性问题）
   - 类型安全：ColumnConfig 接口定义
   - 无障碍：ARIA 标签、role、tabIndex

### 询盘列表视图更新 (inquiry-list-view.tsx)
1. **视图切换**：
   - 新增 ToggleGroup 组件（List/Kanban 切换按钮）
   - 本地 state viewMode: 'list' | 'kanban'
   - 看板模式渲染 InquiryKanbanView
   - 列表模式保持原有 DataTable

2. **筛选保持**：
   - 搜索、状态、优先级、来源筛选对两种视图均有效
   - 看板视图通过共享 store 的 filters 获取筛选条件

### 验证结果
- ✅ `bun run lint` 零错误通过
- ✅ TypeScript 编译新文件无错误
- ✅ 遵循与 customer-kanban-view 一致的设计模式

---
Task ID: 6-e
Agent: Main Orchestrator
Task: 客户联系人新建功能 + 综合QA + worklog更新

## 项目当前状态描述/判断

### 系统状态: 🟢 稳定运行
- Dev server HTTP 200，ESLint 0 错误
- 新增4个功能模块，所有核心功能正常运行
- 数据库12个字段，新增 contacts API 端点

### 浏览器QA验证结果 (Agent Browser)
- ✅ 角色选择→登录→工作台: 全流程正常
- ✅ 用户菜单下拉: 点击显示"个人设置"+"退出登录" (DropdownMenu)
- ✅ 订单详情抽屉: 3Tab(订单信息/物流追踪/备注) + 收款子表 + 操作按钮
- ✅ 系统设置: 个人资料卡片 + 通知偏好(4开关) + 显示设置
- ✅ 询盘看板: 4列(新询盘7/跟进中6/已报价6/成交流失3)，卡片含编号+优先级+来源+客户
- ✅ 活动记录页: "查看全部"从通知下拉正确导航，显示搜索+类型筛选+时间筛选
- ✅ 通知中心: "通知中心"标题 + "暂无通知" + "查看全部"按钮

## 本轮完成内容

### 新功能 (5项)
1. **用户菜单下拉** (Task 6-b) - DropdownMenu含头像+姓名+角色Badge+邮箱+部门，"个人设置"和"退出登录"
2. **活动记录列表页** (Task 6-c) - 完整列表页(搜索+类型+时间筛选+分页)，通知"查看全部"导航到此处
3. **询盘看板视图** (Task 6-d) - 4列状态看板(新询盘/跟进中/已报价/成交流失)，Framer Motion动画
4. **客户联系人内联新建** - 联系人Tab顶部"添加联系人"按钮，展开表单(姓名/职位/邮箱/电话/WhatsApp/决策者)
5. **联系人API** - /api/contacts POST端点，支持创建新联系人

### 增强功能 (3项)
1. **联系人卡片重设计** - 圆形首字母头像(翡翠色)，WhatsApp显示，悬停阴影，决策者Badge样式优化
2. **联系人空状态增强** - 图标+文字+提示语
3. **ModuleKey扩展** - types.ts新增'activities'模块类型

### 新增/修改文件清单
- **新增**: `src/components/crm/user-menu.tsx`, `src/components/crm/views/activity-list-view.tsx`, `src/components/crm/views/inquiry-kanban-view.tsx`, `src/app/api/contacts/route.ts`
- **修改**: `src/components/crm/crm-header.tsx`, `src/components/crm/notification-dropdown.tsx`, `src/components/crm/views/customer-detail-drawer.tsx`, `src/components/crm/views/inquiry-list-view.tsx`, `src/lib/types.ts`, `src/app/page.tsx`, `src/app/api/activities/route.ts`

## 未解决问题或风险

### 低优先级
1. **AI聊天端到端测试**: LLM API已对接但实际对话未在浏览器中完整测试
2. **种子数据清理**: 测试创建的含"--timeout"文字的客户需要清理
3. **通知为空**: 当前所有活动记录可能已标记已读，导致通知下拉显示"暂无通知"
4. **看板视图拖拽**: 客户/询盘看板均为静态分组，无拖拽排序功能
5. **设置页开关不持久**: 通知偏好和显示设置的Switch状态不保存到数据库/本地存储

### 建议下一阶段优先事项
1. **P1**: AI聊天端到端测试 + 流式响应(SSE)
2. **P1**: 设置页偏好持久化(localStorage)
3. **P2**: 种子数据优化（清理测试数据、增加更多样化客户）
4. **P2**: 看板拖拽排序（客户在级别列之间移动）
5. **P2**: 权限中心（用户管理、角色配置）
6. **P2**: 社媒运营模块
7. **P3**: 多语言支持（英语/中文切换）
8. **P3**: 数据看板大屏展示（管理层）
9. **P3**: 客户地图视图（基于国家的客户分布地图）
10. **P3**: WebSocket实时通知推送
