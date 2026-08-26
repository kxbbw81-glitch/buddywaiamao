export const ROLES = {
  sales: { name: '销售业务员', defaults: ['dashboard', 'pipeline', 'quote', 'comms'] },
  manager: { name: '销售经理', defaults: ['dashboard', 'pipeline', 'fulfillment'] },
  finance: { name: '财务', defaults: ['dashboard', 'finance', 'insight'] },
  exec: { name: '管理层', defaults: ['dashboard', 'insight', 'pipeline'] },
  admin: { name: '超级管理员', defaults: ['dashboard', 'system'] },
}

const allRoles = Object.keys(ROLES)
const moduleBadges = {
  dashboard: { n: 3, type: 'red' }, acquisition: { n: 12, type: 'blue' }, pipeline: { n: 5, type: 'blue' },
  comms: { n: 2, type: 'blue' }, quote: { n: 2, type: 'amber' }, fulfillment: { n: 8, type: 'amber' }, finance: { n: 4, type: 'red' },
}
const subMetadata = {
  'dashboard/角色工作台': { badge: { n: 5, type: 'blue' } }, 'dashboard/待办清单': { badge: { n: 5, type: 'blue' } }, 'dashboard/审批中心': { badge: { n: 3, type: 'red' } },
  'acquisition/线索池': { badge: { n: 12, type: 'blue' } }, 'pipeline/销售管道': { badge: { n: 5, type: 'blue' } }, 'quote/报价管理': { badge: { n: 2, type: 'amber' } },
  'finance/订单与回款': { badge: { n: 4, type: 'red' } },
  'aihub/销售打法': { demo: true }, 'aihub/业务记忆': { demo: true }, 'aihub/自动触发': { demo: true }, 'aihub/运行质量': { demo: true },
  'system/AI 配置': { demo: true }, 'system/系统设置': { demo: true }, 'system/数据库维护': { demo: true },
}

export const NAVIGATION = [
  { id: 'dashboard', name: '工作台', icon: 'dashboard', phase: 'blue', roles: allRoles, subs: [['角色工作台', true], ['晨会视图', true], ['经营简报', true], ['待办清单'], ['跟进与管道'], ['审批中心']] },
  { id: 'acquisition', name: '获客中心', icon: 'funnel', phase: 'teal', roles: ['sales', 'manager', 'exec', 'admin'], subs: [['线索池'], ['社媒运营', true], ['网站询盘', true], ['渠道分析']] },
  { id: 'customer', name: '客户管理', icon: 'users', phase: 'teal', roles: ['sales', 'manager', 'exec', 'admin'], subs: [['客户档案', true], ['客户画像', true]] },
  { id: 'pipeline', name: '商机中心', icon: 'target', phase: 'teal', roles: ['sales', 'manager', 'exec', 'admin'], subs: [['销售管道', true], ['跟进任务', true], ['售后与复购', true]] },
  { id: 'comms', name: '沟通中心', icon: 'chat', phase: 'teal', roles: ['sales', 'manager', 'exec', 'admin'], subs: [['邮件管理', true], ['WhatsApp', true], ['社媒私信', true], ['沟通时间线', true]] },
  { id: 'product', name: '产品知识库', icon: 'box', phase: 'amber', roles: ['sales', 'manager', 'exec', 'admin'], subs: [['产品库（PIM）', true], ['RAG 知识库问答', true]] },
  { id: 'quote', name: '报价中心', icon: 'tag', phase: 'amber', roles: ['sales', 'manager', 'exec', 'admin'], subs: [['快速报价', true], ['报价管理', true]] },
  { id: 'fulfillment', name: '订单履约', icon: 'truck', phase: 'amber', roles: allRoles, subs: [['样品管理', true], ['合同订单', true], ['生产跟踪', true], ['物流管理', true], ['单证管理', true]] },
  { id: 'finance', name: '财务经营', icon: 'money', phase: 'amber', roles: ['manager', 'finance', 'exec', 'admin'], subs: [['订单与回款', true], ['提成与对账', true]] },
  { id: 'aihub', name: 'AI Agent', icon: 'spark', phase: 'purple', roles: allRoles, subs: [['Agent 对话', true], ['销售打法'], ['业务记忆'], ['自动触发'], ['运行质量'], ['自定义 Skills', true]] },
  { id: 'tools', name: '工具中心', icon: 'tool', phase: 'purple', roles: allRoles, subs: [['名片 OCR 识别', true], ['官网链接登记'], ['汇率换算'], ['客户去重'], ['跟进话术生成', true], ['HS 编码速查']] },
  { id: 'insight', name: '数据洞察', icon: 'chart', phase: 'purple', roles: ['manager', 'finance', 'exec', 'admin'], subs: [['数据分析'], ['数据大屏']] },
  { id: 'system', name: '系统管理', icon: 'gear', phase: 'gray', roles: ['admin'], subs: [['账号与权限'], ['AI 配置', true], ['系统设置'], ['数据库维护']] },
]

export function navigationFor(role) {
  const roleConfig = ROLES[role]
  if (!roleConfig) return null
  return {
    role,
    roleName: roleConfig.name,
    defaultExpanded: roleConfig.defaults,
    modules: NAVIGATION
      .filter((module) => module.roles.includes(role))
      .map(({ subs, ...module }) => ({
        ...module,
        ...(moduleBadges[module.id] ? { badge: moduleBadges[module.id] } : {}),
        subs: subs.map(([name, ai = false]) => ({ name, ai, ...(subMetadata[`${module.id}/${name}`] || {}) })),
      })),
  }
}
