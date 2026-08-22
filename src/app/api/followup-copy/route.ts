import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callLlm, type ChatMessage } from '@/lib/agent-llm'
import { getAiConfig } from '@/lib/ai-settings'

interface CopyRequest {
  scenario: 'first_touch' | 'follow_up' | 'wake_silent' | 'holiday'
  customerName: string
  language: 'zh' | 'en' | 'bilingual'
  product?: string
  tone?: 'professional' | 'friendly' | 'formal'
}

const SCENARIO_BRIEF: Record<CopyRequest['scenario'], string> = {
  first_touch: '首封开发信。遵循首因建立信任打法：先亮同行案例建立信任、只谈价值不谈价格、简短专业、结尾给出明确下一步（如预约简短通话）。忌群发感与过度推销。',
  follow_up: '跟进催复。礼貌专业、重申上次沟通价值点、提供一个新的有价值信息（如行业动态/案例）、给出明确的下一步行动、不施压。',
  wake_silent: '沉默客户唤醒（30天以上未回复）。低压力、提供新价值或市场动态、不带催促语气、结尾用开放式邀约而非直接要订单。',
  holiday: '节日问候。得体温暖、简短、不直接销售、可自然带出"期待新一年合作"。',
}

const LANG_LABEL: Record<CopyRequest['language'], string> = {
  zh: '简体中文',
  en: '英文（商务英文）',
  bilingual: '先英文正文，附简体中文对照',
}

function buildPrompt(req: CopyRequest): string {
  const parts = [
    `场景：${SCENARIO_BRIEF[req.scenario]}`,
    `客户：${req.customerName}`,
    req.product ? `涉及产品/行业：${req.product}` : '',
    `语气：${req.tone === 'formal' ? '正式' : req.tone === 'friendly' ? '友好亲和' : '专业商务'}`,
    `语言要求：${LANG_LABEL[req.language]}`,
  ].filter(Boolean)
  return parts.join('；')
}

function localTemplate(req: CopyRequest): string {
  const p = req.product ? `关于${req.product}的` : ''
  const cn = req.customerName
  if (req.language === 'en' || req.language === 'bilingual') {
    const en: Record<CopyRequest['scenario'], string> = {
      first_touch: `Dear ${cn},\n\nWe recently partnered with several companies in your industry to help them ${p ? `source ${req.product} ` : ''}with proven quality and competitive lead times. I'd love to share a quick case study and see if it's relevant to your current plans.\n\nWould you be open to a brief 15-minute call next week?\n\nBest regards`,
      follow_up: `Dear ${cn},\n\nFollowing up on my previous note — I wanted to share a quick update: we've just shipped a new batch with improved specs that may fit your needs${p ? ` for ${req.product}` : ''}.\n\nHappy to send details or schedule a short call at your convenience.\n\nBest regards`,
      wake_silent: `Dear ${cn},\n\nIt's been a while — hope business is going well. We've noticed some shifts in ${req.product || 'your market'} lately that might be worth a quick exchange. No urgency at all; whenever convenient, I'd value catching up briefly.\n\nBest regards`,
      holiday: `Dear ${cn},\n\nWishing you and your team a wonderful holiday season and a prosperous New Year. We look forward to continuing our collaboration in the year ahead.\n\nSeason's greetings`,
    }
    if (req.language === 'bilingual') {
      return `${en[req.scenario]}\n\n---- 中文对照 ----\n${cn}，您好：\n（以上英文正文对应中文略）`
    }
    return en[req.scenario]
  }
  const zh: Record<CopyRequest['scenario'], string> = {
    first_touch: `${cn}，您好：\n\n近期我们为多家同行业客户提供了${p}优质供应方案，交付周期与质量均获认可。我们整理了一份简要案例，想看是否与您当前计划相关。\n\n不知下周是否方便安排 15 分钟简短交流？\n\n顺祝商祺`,
    follow_up: `${cn}，您好：\n\n跟进上次沟通，同步一个最新动态：我们刚完成一批${p ? req.product : ''}规格升级的新货，或许正合您需求。\n\n如需详情或安排简短通话，随时告诉我。\n\n顺祝商祺`,
    wake_silent: `${cn}，您好：\n\n许久未联系，祝生意顺遂。近期${req.product || '您所在市场'}出现一些新变化，值得简单交流。无需立刻处理，您方便时聊聊即可。\n\n顺祝商祺`,
    holiday: `${cn}，您好：\n\n祝您与团队节日愉快、新年顺意。期待新一年继续与您合作。\n\n此致`,
  }
  return zh[req.scenario]
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: CopyRequest
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }
  const { scenario, customerName, language, product, tone } = body
  if (!scenario || !customerName || !language) {
    return NextResponse.json({ success: false, error: '场景、客户名、语言为必填' }, { status: 400 })
  }

  const prompt = buildPrompt({ scenario, customerName, language, product, tone })
  const systemPrompt = '你是 NexFab 外贸 CRM 的话术助手，根据销售提供的场景与客户信息生成可直接使用的跟进话术。严格遵循指定场景的打法要求，语气自然、避免群发感，结尾给出明确的下一步行动。只输出话术正文，不要解释。'

  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
  const config = await getAiConfig()

  let copy: string
  let mode: 'llm' | 'local'
  const llmResult = await callLlm(messages, systemPrompt, config)
  if (llmResult) {
    copy = llmResult
    mode = 'llm'
  } else {
    copy = localTemplate({ scenario, customerName, language, product, tone })
    mode = 'local'
  }

  return NextResponse.json({
    success: true,
    data: { copy, mode, scenario, language },
  })
}
