import type { ModuleKey, UserRole } from '@/lib/types'

export type NavigationSubItem = {
  key: string
  label: string
  description: string
  existingView?: ModuleKey
}

export type NavigationModule = {
  key: ModuleKey
  label: string
  icon: string
  roles: UserRole[]
  items: NavigationSubItem[]
}

// HTML 原型（V3.12）的 47 个二级菜单是导航验收基准。
// AI Agent = Agent 对话 + 四类预置 skills 分类（销售打法/业务记忆/自动触发/运行质量），
// 分类不设限：skills 容器支持新建/重命名/删除自定义分类，skill 可归入任意分类。
export const NAVIGATION_MODULES: NavigationModule[] = [
  {
    key: 'workbench', label: '工作台', icon: 'LayoutDashboard', roles: ['sales', 'sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'role-workbench', label: '角色工作台', description: '按当前角色进入既有工作台。', existingView: 'workbench' },
      { key: 'morning-view', label: '晨会视图', description: '角色晨会内容页面待接入。' },
      { key: 'operating-brief', label: '经营简报', description: '按角色聚合的经营简报：核心 KPI、销售管道、团队业绩、回款与风险、行动项。', existingView: 'operating_brief' },
      { key: 'todo-list', label: '待办清单', description: '复用既有活动记录与待办列表。', existingView: 'activities' },
      { key: 'followup-pipeline', label: '跟进与管道', description: '跟进与管道页面待接入。' },
      { key: 'approval-center', label: '审批中心', description: '审批中心页面待接入。' },
    ],
  },
  {
    key: 'acquisition', label: '获客中心', icon: 'Funnel', roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'lead-pool', label: '线索池', description: '复用既有询盘与线索列表。', existingView: 'inquiries' },
      { key: 'social-operations', label: '社媒运营', description: '复用既有社媒运营页面。', existingView: 'social_media' },
      { key: 'website-inquiries', label: '网站询盘', description: '网站询盘独立页面待接入。' },
      { key: 'channel-analysis', label: '渠道分析', description: '渠道归因分析页面待接入。' },
    ],
  },
  {
    key: 'customer', label: '客户管理', icon: 'Users', roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'customer-records', label: '客户档案', description: '复用既有客户档案与联系人页面。', existingView: 'customers' },
      { key: 'customer-profile', label: '客户画像', description: '客户全维度画像：商机阶段分布、订单回款、活动时间线、AI 评分。', existingView: 'customer_profile' },
    ],
  },
  {
    key: 'pipeline', label: '商机中心', icon: 'Target', roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'sales-pipeline', label: '销售管道', description: '商机管道看板：阶段拖拽流转、金额与赢单率统计。', existingView: 'opportunities' },
      { key: 'followup-tasks', label: '跟进任务', description: '跟进任务列表、状态流转与到期提醒。', existingView: 'followup_tasks' },
      { key: 'aftersales-retention', label: '售后与复购', description: '成交客户复购窗口与售后跟进。', existingView: 'aftersales' },
    ],
  },
  {
    key: 'comms', label: '沟通中心', icon: 'MessageSquare', roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'email-management', label: '邮件管理', description: '邮件管理页面待接入。' },
      { key: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp 会话页面待接入。' },
      { key: 'social-messages', label: '社媒私信', description: '社媒私信页面待接入。' },
      { key: 'communication-timeline', label: '沟通时间线', description: '客户沟通时间线页面待接入。' },
    ],
  },
  {
    key: 'product', label: '产品知识库', icon: 'PackageSearch', roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'product-pim', label: '产品库（PIM）', description: '复用既有产品资料库。', existingView: 'products' },
      { key: 'rag-qa', label: 'RAG 知识库问答', description: 'RAG 问答页面待接入。' },
    ],
  },
  {
    key: 'quote', label: '报价中心', icon: 'Tag', roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'quick-quote', label: '快速报价', description: '复用既有报价新建流程，独立秒报价页面待接入。', existingView: 'quotations' },
      { key: 'quotation-management', label: '报价管理', description: '复用既有报价管理页面。', existingView: 'quotations' },
    ],
  },
  {
    key: 'fulfillment', label: '订单履约', icon: 'Truck', roles: ['sales', 'sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'sample-management', label: '样品管理', description: '复用既有样品管理页面。', existingView: 'samples' },
      { key: 'contract-orders', label: '合同订单', description: '复用既有订单管理页面。', existingView: 'orders' },
      { key: 'production-tracking', label: '生产跟踪', description: '生产跟踪页面待接入。' },
      { key: 'logistics-management', label: '物流管理', description: '物流管理页面待接入。' },
      { key: 'document-management', label: '单证管理', description: '单证管理页面待接入。' },
    ],
  },
  {
    key: 'finance', label: '财务经营', icon: 'CircleDollarSign', roles: ['sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'orders-collections', label: '订单与回款', description: '复用既有收款管理页面。', existingView: 'payments' },
      { key: 'commission-reconciliation', label: '提成与对账', description: '按销售聚合成交订单与回款，按可配置提成率核算预计提成。', existingView: 'commission' },
    ],
  },
  {
    key: 'aihub', label: 'AI Agent', icon: 'Bot', roles: ['sales', 'sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'agent-chat', label: 'Agent 对话', description: '目标驱动的执行型 Agent 对话入口。', existingView: 'aihub' },
      { key: 'agent-playbook', label: '销售打法', description: '团队销售方法论 skills 容器，按需手动添加。', existingView: 'aihub' },
      { key: 'agent-memory', label: '业务记忆', description: 'Agent 执行时引用的业务记忆 skills 容器。', existingView: 'aihub' },
      { key: 'agent-trigger', label: '自动触发', description: '规则化触发 Agent 任务的 skills 容器。', existingView: 'aihub' },
      { key: 'agent-quality', label: '运行质量', description: 'Agent 执行治理与质量指标 skills 容器。', existingView: 'aihub' },
    ],
  },
  {
    key: 'tools', label: '工具中心', icon: 'Wrench', roles: ['sales', 'sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'business-card-ocr', label: '名片 OCR 识别', description: '名片 OCR 工具页面待接入。' },
      { key: 'website-registration', label: '官网链接登记', description: '官网链接登记工具页面待接入。' },
      { key: 'exchange-converter', label: '汇率换算', description: '常用外贸币种实时汇率换算（USD/CNY/EUR/GBP/JPY/HKD）。', existingView: 'exchange_converter' },
      { key: 'customer-deduplication', label: '客户去重', description: '客户去重工具页面待接入。' },
      { key: 'followup-copy', label: '跟进话术生成', description: '按场景（首封/催复/唤醒/节日）AI 生成多语言跟进话术。', existingView: 'followup_copy' },
      { key: 'hs-lookup', label: 'HS 编码速查', description: '外贸常用 HS 编码分类速查与退税率参考。', existingView: 'hs_lookup' },
    ],
  },
  {
    key: 'insight', label: '数据洞察', icon: 'BarChart3', roles: ['sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'data-analysis', label: '数据分析', description: '复用既有数据分析页面。', existingView: 'analytics' },
      { key: 'data-screen', label: '数据大屏', description: '复用既有数据大屏页面。', existingView: 'data_screen' },
    ],
  },
  {
    key: 'system', label: '系统管理', icon: 'Settings', roles: ['super_admin'],
    items: [
      { key: 'accounts-permissions', label: '账号与权限', description: '复用既有权限管理页面。', existingView: 'user_management' },
      { key: 'ai-configuration', label: 'AI 配置', description: '配置 Agent 对话使用的 OpenAI 兼容 AI 服务。', existingView: 'ai_config' },
      { key: 'system-settings', label: '系统设置', description: '复用既有系统设置页面。', existingView: 'settings' },
      { key: 'database-maintenance', label: '数据库维护', description: '数据库维护页面待接入。' },
    ],
  },
]

export const ROLE_DEFAULT_EXPANDED: Record<UserRole, ModuleKey[]> = {
  sales: ['workbench', 'pipeline', 'quote', 'comms'],
  sales_manager: ['workbench', 'pipeline', 'fulfillment'],
  finance: ['workbench', 'finance', 'insight'],
  management: ['workbench', 'insight', 'pipeline'],
  super_admin: ['workbench', 'system'],
}

export function getNavigationModule(key: ModuleKey) {
  return NAVIGATION_MODULES.find((module) => module.key === key)
}

export function getNavigationSubItem(moduleKey: ModuleKey, subKey: string) {
  return getNavigationModule(moduleKey)?.items.find((item) => item.key === subKey)
}

export function canAccessModule(role: UserRole | undefined, module: NavigationModule) {
  return Boolean(role && module.roles.includes(role))
}
