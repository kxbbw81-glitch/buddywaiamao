import type { ModuleKey, UserRole } from '@/lib/types'

// ============ 导航色系与角标（对照 HTML 原型 V3.12） ============
export type NavPhase = 'blue' | 'teal' | 'amber' | 'purple' | 'gray'
export type NavBadgeType = 'red' | 'blue' | 'amber'
export interface NavBadge {
  n: number
  type: NavBadgeType
}

// 模块色板（与 HTML 原型 phaseColors 完全一致）
export const PHASE_COLORS: Record<NavPhase, string> = {
  blue: '#185FA5',
  teal: '#0F6E56',
  amber: '#854F0B',
  purple: '#534AB7',
  gray: '#5F5E5A',
}

export type NavigationSubItem = {
  key: string
  label: string
  description: string
  existingView?: ModuleKey
  ai?: boolean // 是否嵌入 AI 能力（侧栏显示 AI 标签）
  demo?: boolean // 原型标记为已有完整实现的演示页（侧栏显示 ▶）
  badge?: NavBadge // 角标：运行时由后端计算，此处仅预留类型，不硬编码演示数字
}

export type NavigationModule = {
  key: ModuleKey
  label: string
  icon: string
  phase: NavPhase
  roles: UserRole[]
  items: NavigationSubItem[]
}

// AI Agent 模块下「Agent 对话」是唯一硬编码二级菜单。
// 销售打法/业务记忆/自动触发/运行质量 4 个预置 skills 分类及任意自定义分类，
// 由侧栏从 /api/agent/skills 动态追加（见 crm-sidebar.tsx 的 AihubDynamicItems）。
// 导航数据源共 43 条硬编码二级菜单 + aihub 动态分类。
export const AIHUB_MODULE_KEY: ModuleKey = 'aihub'

// HTML 原型（V3.12）的 43 条硬编码二级菜单是导航验收基准（aihub 4 条预置分类改为动态）。
export const NAVIGATION_MODULES: NavigationModule[] = [
  {
    key: 'workbench', label: '工作台', icon: 'LayoutDashboard', phase: 'blue',
    roles: ['sales', 'sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'role-workbench', label: '角色工作台', description: '按当前角色进入既有工作台。', existingView: 'workbench', ai: true },
      { key: 'morning-view', label: '晨会视图', description: '角色晨会内容页面待接入。', ai: true },
      { key: 'operating-brief', label: '经营简报', description: '按角色聚合的经营简报：核心 KPI、销售管道、团队业绩、回款与风险、行动项。', existingView: 'operating_brief', ai: true },
      { key: 'todo-list', label: '待办清单', description: '复用既有活动记录与待办列表。', existingView: 'activities' },
      { key: 'followup-pipeline', label: '跟进与管道', description: '跟进与管道页面待接入。' },
      { key: 'approval-center', label: '审批中心', description: '审批中心页面待接入。' },
    ],
  },
  {
    key: 'acquisition', label: '获客中心', icon: 'Funnel', phase: 'teal',
    roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'lead-pool', label: '线索池', description: '复用既有询盘与线索列表。', existingView: 'inquiries' },
      { key: 'social-operations', label: '社媒运营', description: '复用既有社媒运营页面。', existingView: 'social_media', ai: true },
      { key: 'website-inquiries', label: '网站询盘', description: '网站询盘独立页面待接入。', ai: true },
      { key: 'channel-analysis', label: '渠道分析', description: '渠道归因分析页面待接入。' },
    ],
  },
  {
    key: 'customer', label: '客户管理', icon: 'Users', phase: 'teal',
    roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'customer-records', label: '客户档案', description: '复用既有客户档案与联系人页面。', existingView: 'customers', ai: true },
      { key: 'customer-profile', label: '客户画像', description: '客户全维度画像：商机阶段分布、订单回款、活动时间线、AI 评分。', existingView: 'customer_profile', ai: true },
    ],
  },
  {
    key: 'pipeline', label: '商机中心', icon: 'Target', phase: 'teal',
    roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'sales-pipeline', label: '销售管道', description: '商机管道看板：阶段拖拽流转、金额与赢单率统计。', existingView: 'opportunities', ai: true },
      { key: 'followup-tasks', label: '跟进任务', description: '跟进任务列表、状态流转与到期提醒。', existingView: 'followup_tasks', ai: true },
      { key: 'aftersales-retention', label: '售后与复购', description: '成交客户复购窗口与售后跟进。', existingView: 'aftersales', ai: true },
    ],
  },
  {
    key: 'comms', label: '沟通中心', icon: 'MessageSquare', phase: 'teal',
    roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'email-management', label: '邮件管理', description: '邮件管理页面待接入。', ai: true },
      { key: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp 会话页面待接入。', ai: true },
      { key: 'social-messages', label: '社媒私信', description: '社媒私信页面待接入。', ai: true },
      { key: 'communication-timeline', label: '沟通时间线', description: '客户沟通时间线页面待接入。', ai: true },
    ],
  },
  {
    key: 'product', label: '产品知识库', icon: 'PackageSearch', phase: 'amber',
    roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'product-pim', label: '产品库（PIM）', description: '复用既有产品资料库。', existingView: 'products', ai: true },
      { key: 'rag-qa', label: 'RAG 知识库问答', description: 'RAG 问答页面待接入。', ai: true },
    ],
  },
  {
    key: 'quote', label: '报价中心', icon: 'Tag', phase: 'amber',
    roles: ['sales', 'sales_manager', 'management', 'super_admin'],
    items: [
      { key: 'quick-quote', label: '快速报价', description: '复用既有报价新建流程，独立秒报价页面待接入。', existingView: 'quotations', ai: true },
      { key: 'quotation-management', label: '报价管理', description: '复用既有报价管理页面。', existingView: 'quotations', ai: true },
    ],
  },
  {
    key: 'fulfillment', label: '订单履约', icon: 'Truck', phase: 'amber',
    roles: ['sales', 'sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'sample-management', label: '样品管理', description: '复用既有样品管理页面。', existingView: 'samples', ai: true },
      { key: 'contract-orders', label: '合同订单', description: '复用既有订单管理页面。', existingView: 'orders', ai: true },
      { key: 'production-tracking', label: '生产跟踪', description: '生产跟踪页面待接入。', ai: true },
      { key: 'logistics-management', label: '物流管理', description: '物流管理页面待接入。', ai: true },
      { key: 'document-management', label: '单证管理', description: '单证管理页面待接入。', ai: true },
    ],
  },
  {
    key: 'finance', label: '财务经营', icon: 'CircleDollarSign', phase: 'amber',
    roles: ['sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'orders-collections', label: '订单与回款', description: '复用既有收款管理页面。', existingView: 'payments', ai: true },
      { key: 'commission-reconciliation', label: '提成与对账', description: '按销售聚合成交订单与回款，按可配置提成率核算预计提成。', existingView: 'commission', ai: true },
    ],
  },
  {
    key: 'aihub', label: 'AI Agent', icon: 'Bot', phase: 'purple',
    roles: ['sales', 'sales_manager', 'finance', 'management', 'super_admin'],
    // 仅硬编码「Agent 对话」；预置 4 分类 + 自定义分类由侧栏动态追加。
    items: [
      { key: 'agent-chat', label: 'Agent 对话', description: '目标驱动的执行型 Agent 对话入口。', existingView: 'aihub', ai: true },
    ],
  },
  {
    key: 'tools', label: '工具中心', icon: 'Wrench', phase: 'purple',
    roles: ['sales', 'sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'business-card-ocr', label: '名片 OCR 识别', description: '名片 OCR 工具页面待接入。', ai: true },
      { key: 'website-registration', label: '官网链接登记', description: '官网链接登记工具页面待接入。' },
      { key: 'exchange-converter', label: '汇率换算', description: '常用外贸币种实时汇率换算（USD/CNY/EUR/GBP/JPY/HKD）。', existingView: 'exchange_converter' },
      { key: 'customer-deduplication', label: '客户去重', description: '客户去重工具页面待接入。' },
      { key: 'followup-copy', label: '跟进话术生成', description: '按场景（首封/催复/唤醒/节日）AI 生成多语言跟进话术。', existingView: 'followup_copy', ai: true },
      { key: 'hs-lookup', label: 'HS 编码速查', description: '外贸常用 HS 编码分类速查与退税率参考。', existingView: 'hs_lookup' },
    ],
  },
  {
    key: 'insight', label: '数据洞察', icon: 'BarChart3', phase: 'purple',
    roles: ['sales_manager', 'finance', 'management', 'super_admin'],
    items: [
      { key: 'data-analysis', label: '数据分析', description: '复用既有数据分析页面。', existingView: 'analytics' },
      { key: 'data-screen', label: '数据大屏', description: '复用既有数据大屏页面。', existingView: 'data_screen' },
    ],
  },
  {
    key: 'system', label: '系统管理', icon: 'Settings', phase: 'gray',
    roles: ['super_admin'],
    items: [
      { key: 'accounts-permissions', label: '账号与权限', description: '复用既有权限管理页面。', existingView: 'user_management' },
      { key: 'ai-configuration', label: 'AI 配置', description: '配置 Agent 对话使用的 OpenAI 兼容 AI 服务。', existingView: 'ai_config', ai: true, demo: true },
      { key: 'system-settings', label: '系统设置', description: '复用既有系统设置页面。', existingView: 'settings', demo: true },
      { key: 'database-maintenance', label: '数据库维护', description: '数据库维护页面待接入。', demo: true },
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
