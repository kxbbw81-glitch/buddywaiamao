import { db } from '@/lib/db'

/**
 * Agent Skills 预置数据（与 V3.12 原型一致：4 个预置分类，各 3 内置 + 1 自定义示例）
 * 首次访问 /api/agent/skills 时自动播种（表为空才写入）
 */

interface SeedSkill {
  name: string
  icon: string
  src: 'builtin' | 'custom'
  on: boolean
  desc: string
  params: string
}

interface SeedCategory {
  key: string
  name: string
  icon: string
  desc: string
  skills: SeedSkill[]
}

export const SEED_SKILL_CATS: SeedCategory[] = [
  {
    key: 'playbook', name: '销售打法', icon: '📖',
    desc: '团队沉淀的销售方法论（Playbook）——Agent 对话时按老销售的打法执行。按需手动添加新打法 skill，新人 Agent 自动继承团队经验。预置分类之一，不满意可自定义新分类。',
    skills: [
      { name: '首因建立信任打法', icon: '🤝', src: 'builtin', on: true, params: '{"首次接触":"先价值后产品","信任锚点":"同行业案例","禁忌":"首封邮件不谈价格"}', desc: '首封开发信先亮同行案例建立信任，第二轮才引入产品价值点。' },
      { name: '价值锚定报价打法', icon: '⚓', src: 'builtin', on: true, params: '{"报价前置":"先锚定价值量","参考":"历史成交价区间","让步":"每次让步换取承诺"}', desc: '报价前先锚定价值（节省工时/良率提升），让步必须换取客户承诺。' },
      { name: '催单窗口打法', icon: '⏰', src: 'builtin', on: true, params: '{"触发":"客户国假期≤14天","动作":"补货高峰提醒","话术":"假期前后产能收紧"}', desc: '客户国家节假日窗口期主动催单，与工作台假日告警联动。' },
      { name: '沉默客户唤醒打法', icon: '🔔', src: 'custom', on: false, params: '{"触发":"沉默>30天","首触":"行业资讯切入","频次":"3次/月"}', desc: '对 30 天以上沉默客户用行业资讯重新切入，避免硬推销。' },
    ],
  },
  {
    key: 'memory', name: '业务记忆', icon: '🧠',
    desc: 'Agent 执行时自动引用的业务记忆——客户偏好、历史决策、价格底线。手动添加记忆 skill 让 Agent 记得更多业务上下文，可查看、可关闭。预置分类之一。',
    skills: [
      { name: '客户偏好记忆', icon: '🎯', src: 'builtin', on: true, params: '{"记录":"沟通渠道偏好","决策":"价格敏感度","禁忌":"不记录隐私信息"}', desc: '记录客户沟通渠道偏好、价格敏感度、决策链，Agent 跟进时自动引用。' },
      { name: '价格底线记忆', icon: '💎', src: 'builtin', on: true, params: '{"来源":"审批通过的底价","保护":"低于底价需审批","版本":"按产品+客户"}', desc: '沉淀审批通过的底价与数量梯度，Agent 报价时自动对标且不越界。' },
      { name: '汇率决策记忆', icon: '💱', src: 'builtin', on: true, params: '{"来源":"财务汇率版本台账","规则":"报价/收款/提成同版本","更新":"生效日切换"}', desc: '引用财务汇率版本台账，报价折算与提成核算保持同一版本可追溯。' },
      { name: '售后承诺记忆', icon: '🛠️', src: 'custom', on: false, params: '{"记录":"客诉处理结论","跟进":"承诺到期提醒","权限":"仅管理员写"}', desc: '记录售后客诉处理结论与承诺事项，Agent 复购沟通时引用避免重复承诺。' },
    ],
  },
  {
    key: 'trigger', name: '自动触发', icon: '⏱️',
    desc: '规则化触发 Agent 任务——符合条件即自动生成任务在后台执行（如沉默客户自动唤醒）。手动添加触发规则 skill 即可扩展自动化场景。预置分类之一。',
    skills: [
      { name: '沉默客户自动唤醒', icon: '📴', src: 'builtin', on: true, params: '{"条件":"沉默>30天","动作":"生成唤醒方案","频率":"每周一8:00"}', desc: '沉默超 30 天客户自动生成唤醒方案，Agent 后台执行并推送给对应销售。' },
      { name: '样品签收跟进', icon: '📦', src: 'builtin', on: true, params: '{"条件":"签收7天无反馈","动作":"发送反馈询问","升级":"14天转主管"}', desc: '样品签收 7 天无反馈自动发送询问邮件，14 天未回自动升级主管。' },
      { name: '复购窗口提醒', icon: '🔄', src: 'builtin', on: true, params: '{"条件":"消耗周期-30天","动作":"生成复购商机","渠道":"邮件+WhatsApp"}', desc: '按消耗周期预测复购窗口，临近时自动生成复购商机进入管道。' },
      { name: '询盘夜间响应', icon: '🌙', src: 'custom', on: false, params: '{"条件":"时区差异>8小时","动作":"首轮AI回复","升级":"人工8:00跟进"}', desc: '客户时区差异大时，夜间询盘由 Agent 首轮回复，次日人工跟进。' },
    ],
  },
  {
    key: 'quality', name: '运行质量', icon: '📊',
    desc: 'Agent 执行治理——任务成功率、外部动作批准率、纠错记录。治理 skill 决定采集哪些质量指标，看板实时可视化。预置分类之一。',
    skills: [
      { name: '任务成功率监控', icon: '✅', src: 'builtin', on: true, params: '{"指标":"任务成功率","目标":"≥90%","维度":"按任务类型"}', desc: '按任务类型统计成功率，低于目标自动标记异常并通知管理员。' },
      { name: '外部动作批准率', icon: '🚩', src: 'builtin', on: true, params: '{"指标":"人工批准率","目标":"≤30%需优化","记录":"批准/拒绝原因"}', desc: '统计外部动作人工批准率与拒绝原因，识别 Agent 越权风险。' },
      { name: '纠错记录追溯', icon: '🔍', src: 'builtin', on: true, params: '{"记录":"用户纠错内容","回灌":"纠错进记忆库","审计":"保留90天"}', desc: '记录用户每次纠错，纠错内容回灌记忆库并保留审计轨迹。' },
      { name: '成本效率看板', icon: '💹', src: 'custom', on: false, params: '{"指标":"每次任务token成本","预警":"超均值2x","报告":"每周一"}', desc: '监控 Agent 任务 token 成本与耗时，异常波动自动周报。' },
    ],
  },
]

/** 表为空时播种预置分类与 skills（幂等） */
export async function ensureSkillsSeeded(): Promise<void> {
  const count = await db.agentSkillCategory.count()
  if (count > 0) return

  for (let ci = 0; ci < SEED_SKILL_CATS.length; ci++) {
    const cat = SEED_SKILL_CATS[ci]
    const created = await db.agentSkillCategory.create({
      data: {
        key: cat.key,
        name: cat.name,
        icon: cat.icon,
        builtin: true,
        desc: cat.desc,
        sortOrder: ci,
      },
    })
    for (let si = 0; si < cat.skills.length; si++) {
      const s = cat.skills[si]
      await db.agentSkill.create({
        data: {
          categoryId: created.id,
          name: s.name,
          icon: s.icon,
          src: s.src,
          on: s.on,
          desc: s.desc,
          params: s.params,
          sortOrder: si,
        },
      })
    }
  }
}
