import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, MANAGER_ROLES } from '@/lib/auth'
import { setModuleSwitch } from '@/lib/ai-settings'

/**
 * PUT /api/ai-config/modules/[module]  body: { enabled?: boolean, configId?: string|null }
 * 切换模块 AI 开关 / 关联配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> }
) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response

  const { module } = await params
  const body = await request.json().catch(() => ({}))
  const updated = await setModuleSwitch(module, body.enabled, body.configId)
  return NextResponse.json({ success: true, data: updated })
}
