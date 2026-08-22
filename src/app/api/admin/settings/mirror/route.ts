import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/admin/settings/mirror
 *   - 返回镜像源 URL + 上次检查时间 + 上次已知最新版本
 *   - 仅超管
 *
 * PUT /api/admin/settings/mirror
 *   - body: { url }
 */

export async function GET() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const row = await db.systemMirror.findUnique({ where: { id: '1' } })
    return NextResponse.json({
      success: true,
      data: row
        ? { url: row.url, lastCheckedAt: row.lastCheckedAt, lastKnownVersion: row.lastKnownVersion }
        : { url: '', lastCheckedAt: null, lastKnownVersion: '' },
    })
  } catch (error) {
    console.error('[admin/settings/mirror GET]', error)
    return NextResponse.json({ success: false, error: '读取镜像源失败' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const body = await req.json()
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ success: false, error: '镜像源 URL 需以 http(s):// 开头' }, { status: 400 })
    }
    const row = await db.systemMirror.upsert({
      where: { id: '1' },
      create: { id: '1', url, updatedById: auth.user.id },
      update: { url, updatedById: auth.user.id },
    })
    return NextResponse.json({ success: true, data: { url: row.url } })
  } catch (error) {
    console.error('[admin/settings/mirror PUT]', error)
    return NextResponse.json({ success: false, error: '保存镜像源失败' }, { status: 500 })
  }
}
