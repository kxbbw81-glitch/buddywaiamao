import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * 权限模板 CRUD
 * GET  /api/permission-templates       列表（仅超管）
 * POST /api/permission-templates       新建（仅超管）
 */
export async function GET() {
  try {
    const auth = await requireAuth(['super_admin'])
    if (!auth.ok) return auth.response

    const templates = await db.permissionTemplate.findMany({
      orderBy: [{ isBuiltin: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { users: true } } },
    })
    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    console.error('PermissionTemplates GET error:', error)
    return NextResponse.json({ success: false, error: '获取权限模板失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['super_admin'])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { name, code, description, permissionsJson } = body

    if (!name || !code) {
      return NextResponse.json({ success: false, error: '名称和编码为必填项' }, { status: 400 })
    }

    const existing = await db.permissionTemplate.findFirst({
      where: { OR: [{ name }, { code }] },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: '名称或编码已存在' }, { status: 409 })
    }

    const template = await db.permissionTemplate.create({
      data: {
        name,
        code,
        description: description || '',
        permissionsJson: permissionsJson || '{}',
        isBuiltin: false,
      },
    })
    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    console.error('PermissionTemplates POST error:', error)
    return NextResponse.json({ success: false, error: '创建权限模板失败' }, { status: 500 })
  }
}
