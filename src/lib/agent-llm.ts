import { db } from '@/lib/db'
import type { PublicUser } from '@/lib/auth'
import { customerScopeWhere, assignedScopeWhere, opportunityScopeWhere } from '@/lib/auth'
import { getAiConfig, type AiConfig } from '@/lib/ai-settings'

/**
 * Agent LLM 层：
 * - buildCrmContext：把当前用户可见的 CRM 快照注入 system prompt（数据权限同任务 38）
 * - callLlm：调用 OpenAI 兼容 /chat/completions；未配置或调用失败返回 null（由本地降级接管）
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ============ CRM 上下文 ============

export async function buildCrmContext(user: PublicUser): Promise<string> {
  const customerScope = customerScopeWhere(user)
  const assignedScope = assignedScopeWhere(user)
  const opportunityScope = opportunityScopeWhere(user)

  const [customerCount, customers, opportunityCount, opportunities, inquiryCount, openInquiryCount] =
    await Promise.all([
      db.customer.count({ where: customerScope }),
      db.customer.findMany({
        where: customerScope,
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: { companyName: true, country: true, customerLevel: true, status: true, lastContactAt: true },
      }),
      db.opportunity.count({ where: opportunityScope }),
      db.opportunity.findMany({
        where: { ...opportunityScope, stage: { notIn: ['won', 'lost'] } },
        orderBy: { amount: 'desc' },
        take: 6,
        include: { customer: { select: { companyName: true } } },
      }),
      db.inquiry.count({ where: assignedScope }),
      db.inquiry.count({ where: { ...assignedScope, status: { in: ['new', 'in_progress'] } } }),
    ])

  const pipelineTotal = opportunities.reduce((sum, o) => sum + (o.amount || 0), 0)
  const weighted = opportunities.reduce((sum, o) => sum + ((o.amount || 0) * (o.probability || 0)) / 100, 0)

  const customerLines = customers
    .map(
      (c) =>
        `- ${c.companyName}（${c.country || '未知地区'}｜${c.customerLevel} 级｜${c.status}）`
    )
    .join('\n')

  const oppLines = opportunities
    .map(
      (o) =>
        `- ${o.title}｜客户：${o.customer?.companyName || '未关联'}｜阶段：${o.stage}｜金额 $${o.amount || 0}｜概率 ${o.probability}%`
    )
    .join('\n')

  return [
    '你是 NexFab 外贸 CRM 的执行型销售 Agent。回复使用简体中文，务实、结构化、可执行。',
    '你只能基于下方数据范围回答业务问题；不知道的信息明确说明，不要编造客户名或金额。',
    '所有对外动作（发邮件、改数据、报价）只提出建议方案，执行需用户人工批准。',
    '',
    `当前用户：${user.name}（角色：${user.primaryRole}）`,
    `数据范围：${user.primaryRole === 'sales' ? '仅本人名下客户 / 分配给自己的线索与商机' : '全部数据'}`,
    `客户总数：${customerCount}`,
    `进行中商机：${opportunities.length} 条，管道总额 $${pipelineTotal.toLocaleString()}，加权金额 $${Math.round(weighted).toLocaleString()}`,
    `线索：累计 ${inquiryCount} 条，待处理 ${openInquiryCount} 条`,
    '',
    '近期客户（按更新时间）：',
    customerLines || '（暂无）',
    '',
    '进行中的重点商机：',
    oppLines || '（暂无）',
  ].join('\n')
}

// ============ LLM 调用 ============

export async function callLlm(
  messages: ChatMessage[],
  systemPrompt: string,
  config?: AiConfig
): Promise<string | null> {
  const cfg = config || (await getAiConfig())
  if (!cfg.configured) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.4,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    return content || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ============ 本地降级（未配置 LLM 时） ============

/**
 * 基于关键词 + CRM 上下文的规则回复。
 * 目的：在 AI 配置完成前保持对话可用，并明确提示这是离线降级模式。
 */
export function localFallbackReply(userMessage: string, systemPrompt: string): string {
  const msg = userMessage.toLowerCase()
  const has = (...kw: string[]) => kw.some((k) => userMessage.includes(k) || msg.includes(k))

  if (has('唤醒', '沉默', 'sleep')) {
    return [
      '**[离线降级模式]** 尚未配置 AI 服务，以下为基于本地数据的规则回复：',
      '',
      '**沉默客户唤醒方案（建议）**',
      '1. 筛选「上次联系 > 30 天」的客户（可让我在客户档案中按 lastContactAt 排序）',
      '2. 按「首因建立信任打法」skill：用行业资讯切入，避免硬推销',
      '3. 首封邮件节奏：第 1 天资讯、第 7 天案例、第 21 天轻量询价',
      '4. 高价值客户（A 级）同步生成交际邮件草稿，由你批准后发送',
      '',
      '配置真实 AI 后（系统管理 → AI 配置），我可以结合具体客户名单给出逐户话术。',
    ].join('\n')
  }
  if (has('邮件', 'email', '跟进', '草稿')) {
    return [
      '**[离线降级模式]** 尚未配置 AI 服务，以下为邮件起草模板：',
      '',
      '主题：Re: our cooperation – quick update from NexFab',
      '',
      'Hi [客户名],',
      'Hope this email finds you well. 简要回顾上次沟通要点，',
      '1）我们针对 [产品] 的方案已更新；2）9 月产能窗口尚可预留。',
      '如有 15 分钟，我可以约个简短 call 对齐细节。',
      '',
      'Best regards,',
      '[你的名字] · NexFab',
      '',
      '配置真实 AI 后，我会自动填入客户历史沟通上下文与具体产品参数。',
    ].join('\n')
  }
  if (has('复盘', '商机', '管道', 'pipeline', '销售')) {
    const m = systemPrompt.match(/进行中商机：(\d+) 条，管道总额 \$([\d,]+)，加权金额 \$([\d,]+)/)
    if (m) {
      return [
        '**[离线降级模式]** 基于你的实时数据：',
        '',
        `- 进行中商机 **${m[1]} 条**，管道总额 **$${m[2]}**，加权金额 **$${m[3]}**`,
        '- 建议动作：优先推进「商务谈判」阶段商机（离成交最近），对超 14 天未动的商机安排本周触达',
        '',
        '配置真实 AI 后，我可以做逐条商机分析并生成跟进计划。',
      ].join('\n')
    }
  }
  if (has('丢单', '输单', 'lost', '原因')) {
    return [
      '**[离线降级模式]** 丢单分析框架（建议）：',
      '',
      '1. 从商机看板筛出「输单」卡片，按输单原因分组（价格/需求消失/竞争对手/其他）',
      '2. 价格类丢单 → 检查是否低于「价值锚定报价打法」的锚定步骤',
      '3. 需求消失类 → 纳入复购窗口提醒 skill 的观察名单',
      '4. 竞争对手类 → 记入业务记忆（客户偏好分类）',
      '',
      '配置真实 AI 后，我可以自动汇总输单记录并输出改进清单。',
    ].join('\n')
  }

  const lines = systemPrompt.split('\n').filter((l) => l.includes('：'))
  return [
    '**[离线降级模式]** 尚未配置 AI 服务，当前只能基于本地数据做规则化回复。',
    '',
    '你当前的简要数据面：',
    ...lines.slice(0, 6).map((l) => `- ${l}`),
    '',
    '要获得完整 Agent 能力（目标拆解、逐户话术、自动任务），请到「系统管理 → AI 配置」接入 OpenAI 兼容服务（填 Base URL、模型名与 API Key）。',
  ].join('\n')
}
