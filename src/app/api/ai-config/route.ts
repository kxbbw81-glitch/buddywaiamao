import { requireAuth, MANAGER_ROLES } from '@/lib/auth'
import { getAiConfig, saveAiConfig, maskApiKey } from '@/lib/ai-settings'
import { NextRequest, NextResponse } from 'next/server'

/** GET /api/ai-config — 读取 AI 配置（apiKey 脱敏；普通用户仅见连通状态） */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const config = await getAiConfig()
  const isManager = MANAGER_ROLES.includes(auth.user.primaryRole)

  return NextResponse.json({
    success: true,
    data: {
      provider: config.provider,
      baseUrl: isManager ? config.baseUrl : '',
      model: config.model,
      apiKeyMasked: isManager ? maskApiKey(config.apiKey) : '',
      configured: config.configured,
    },
  })
}

/** PUT /api/ai-config — 保存 AI 配置（仅管理角色；apiKey 传空字符串表示不变更） */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response

  let body: {
    provider?: string
    baseUrl?: string
    model?: string
    apiKey?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }

  if (body.baseUrl !== undefined && body.baseUrl && !/^https?:\/\//.test(body.baseUrl)) {
    return NextResponse.json({ success: false, error: 'Base URL 必须以 http(s):// 开头' }, { status: 400 })
  }

  await saveAiConfig({
    provider: body.provider,
    baseUrl: body.baseUrl,
    model: body.model,
    apiKey: body.apiKey,
  })

  const config = await getAiConfig()
  return NextResponse.json({
    success: true,
    data: {
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKeyMasked: maskApiKey(config.apiKey),
      configured: config.configured,
    },
  })
}
