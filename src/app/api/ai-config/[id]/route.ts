import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, MANAGER_ROLES } from '@/lib/auth'
import { updateAiProviderConfig, deleteAiProviderConfig, toPublicProviderConfig } from '@/lib/ai-settings'

/**
 * GET    /api/ai-config/[id]   单个配置
 * PUT    /api/ai-config/[id]   更新（apiKey 传空=不变更）
 * DELETE /api/ai-config/[id]   删除
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const cfg = await db.aiProviderConfig.findFirst({ where: { id, ownerId: auth.user.id } })
  if (!cfg) {
    return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: toPublicProviderConfig(cfg) })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  if (body.baseUrl && !/^https?:\/\//.test(body.baseUrl)) {
    return NextResponse.json({ success: false, error: 'baseUrl 必须以 http(s):// 开头' }, { status: 400 })
  }

  try {
    const updated = await updateAiProviderConfig(id, auth.user.id, body)
    return NextResponse.json({ success: true, data: toPublicProviderConfig(updated) })
  } catch (error) {
    console.error('AiConfig PUT error:', error)
    return NextResponse.json({ success: false, error: '更新配置失败' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response

  const { id } = await params
  const result = await deleteAiProviderConfig(id, auth.user.id)
  if (result.count === 0) {
    return NextResponse.json({ success: false, error: '配置不存在' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
