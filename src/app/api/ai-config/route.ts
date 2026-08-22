import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, MANAGER_ROLES } from '@/lib/auth'
import { listAiProviderConfigs, createAiProviderConfig, toPublicProviderConfig } from '@/lib/ai-settings'

/**
 * GET /api/ai-config — 当前用户的 AI 供应商配置列表（apiKey 脱敏）
 * POST /api/ai-config — 新建配置实例（仅管理角色；apiKey 加密存储）
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const list = await listAiProviderConfigs(auth.user.id)
  return NextResponse.json({ success: true, data: list })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body?.name) {
    return NextResponse.json({ success: false, error: 'name 必填' }, { status: 400 })
  }
  if (body.baseUrl && !/^https?:\/\//.test(body.baseUrl)) {
    return NextResponse.json({ success: false, error: 'baseUrl 必须以 http(s):// 开头' }, { status: 400 })
  }

  try {
    const created = await createAiProviderConfig(auth.user.id, {
      name: body.name,
      provider: body.provider,
      baseUrl: body.baseUrl,
      model: body.model,
      apiKey: body.apiKey,
      temperature: body.temperature,
      isDefault: body.isDefault,
    })
    return NextResponse.json({ success: true, data: toPublicProviderConfig(created) }, { status: 201 })
  } catch (error) {
    console.error('AiConfig POST error:', error)
    return NextResponse.json({ success: false, error: '创建配置失败' }, { status: 500 })
  }
}
