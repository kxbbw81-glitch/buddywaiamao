const API_CONTRACTS = [
  ['POST', /^\/api\/auth\/login$/, '登录'], ['POST', /^\/api\/auth\/logout$/, '退出登录'], ['GET', /^\/api\/auth\/session$/, '当前会话'],
  ['GET', /^\/api\/navigation$/, '角色导航'],
  ['GET', /^\/api\/admin\/ops\/status$/, '管理员运行状态'],
  ['GET', /^\/api\/dashboard$/, '工作台指标与提醒'],
  ['GET', /^\/api\/analytics\/operations-report$/, '受限经营快照与规则预警'],
  ['GET', /^\/api\/leads$/, '线索列表'], ['POST', /^\/api\/leads$/, '新建线索'], ['POST', /^\/api\/leads\/import$/, '线索导入'],
  ['GET', /^\/api\/social-accounts$/, '社媒账号台账'], ['POST', /^\/api\/social-accounts$/, '登记社媒账号'], ['GET', /^\/api\/social-posts$/, '社媒内容草稿'], ['POST', /^\/api\/social-posts$/, '创建社媒草稿'], ['POST', /^\/api\/social-posts\/[^/]+\/(submit-review|approve|record-published)$/, '社媒内容人工审核与发布记录'], ['GET', /^\/api\/social-interactions$/, '社媒互动台账'], ['POST', /^\/api\/social-interactions$/, '登记社媒互动'], ['POST', /^\/api\/social-interactions\/[^/]+\/convert-to-lead$/, '社媒互动转线索'],
  ['GET', /^\/api\/customers$/, '客户列表'], ['POST', /^\/api\/customers$/, '新建客户'], ['GET', /^\/api\/customers\/[^/]+$/, '客户 360° 视图'], ['PUT', /^\/api\/customers\/[^/]+(?:\/profile)?$/, '客户更新'], ['GET', /^\/api\/customers\/[^/]+\/contacts$/, '联系人列表'], ['POST', /^\/api\/customers\/[^/]+\/contacts$/, '新建联系人'],
  ['GET', /^\/api\/opportunities$/, '销售管道'], ['POST', /^\/api\/opportunities$/, '新建商机'], ['PATCH', /^\/api\/opportunities\/[^/]+\/stage$/, '商机阶段更新'], ['GET', /^\/api\/opportunities\/[^/]+\/follow-ups$/, '跟进记录'], ['POST', /^\/api\/opportunities\/[^/]+\/follow-ups$/, '新建跟进记录'],
  ['GET', /^\/api\/quotes$/, '报价列表'], ['GET', /^\/api\/quotes\/[^/]+$/, '报价详情'], ['POST', /^\/api\/quotes\/quick$/, '快速报价'], ['GET', /^\/api\/quotes\/[^/]+\/versions$/, '报价版本'],
  ['GET', /^\/api\/orders$/, '订单列表'], ['GET', /^\/api\/orders\/[^/]+$/, '订单详情'], ['POST', /^\/api\/orders\/from-quote\/[^/]+$/, '报价转订单'], ['GET', /^\/api\/orders\/[^/]+\/gate$/, '收款门禁'],
  ['GET', /^\/api\/payments$/, '订单与回款'], ['POST', /^\/api\/payments$/, '登记回款'], ['POST', /^\/api\/payments\/[^/]+\/confirm$/, '财务确认回款'], ['GET', /^\/api\/commissions$/, '提成与对账'],
  ['GET', /^\/api\/timeline$/, '沟通时间线'], ['POST', /^\/api\/timeline$/, '新建沟通记录'], ['GET', /^\/api\/product-categories$/, '产品分类'], ['POST', /^\/api\/product-categories$/, '创建产品分类'], ['GET', /^\/api\/products$/, '产品 PIM'], ['POST', /^\/api\/products$/, '创建产品'], ['GET', /^\/api\/products\/[^/]+$/, '产品详情'], ['PUT', /^\/api\/products\/[^/]+$/, '更新产品'], ['GET', /^\/api\/products\/[^/]+\/docs$/, '产品资料'], ['POST', /^\/api\/products\/[^/]+\/docs$/, '登记产品资料'], ['POST', /^\/api\/rag\/query$/, 'RAG 问答'],
  ['GET', /^\/api\/outbound-drafts$/, '渠道草稿列表'], ['POST', /^\/api\/outbound-drafts$/, '创建渠道草稿'], ['POST', /^\/api\/outbound-drafts\/[^/]+\/(submit-review|approve|record-manual-send)$/, '渠道草稿人工审核与发送留痕'],
  ['GET', /^\/api\/skills$/, '技能列表'], ['POST', /^\/api\/skills$/, '创建技能'], ['PATCH', /^\/api\/skills\/[^/]+$/, '更新技能'], ['POST', /^\/api\/skill-categories$/, '创建技能分类'],
  ['POST', /^\/api\/agent\/tasks$/, '创建 Agent 任务'], ['POST', /^\/api\/agent\/tasks\/[^/]+\/approve$/, '批准 Agent 外部动作'],
  ['POST', /^\/api\/tools\/(ocr|dedupe|website-link|followup-copy)$/, '工具服务'], ['GET', /^\/api\/tools\/(fx|hs)$/, '工具查询'],
  ['GET', /^\/api\/admin\/(accounts|ai-config)$/, '系统管理查询'], ['PUT', /^\/api\/admin\/(accounts|ai-config)$/, '系统管理更新'], ['POST', /^\/api\/admin\/db\/backup$/, '数据库维护'],
]

export function plannedEndpoint(method, pathname) {
  const item = API_CONTRACTS.find(([plannedMethod, pattern]) => plannedMethod === method && pattern.test(pathname))
  return item ? item[2] : null
}

export function notImplemented(res, feature) {
  res.writeHead(501, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({
    error: { code: 'NOT_IMPLEMENTED', message: `${feature} 后端尚未接入数据库与业务服务。` },
    meta: { mode: 'skeleton', aiEnabled: false },
  }))
}
