import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * GET  /api/permission-templates/[id]   单个模板
 * PUT  /api/permission-templates/[id]   更新
 * DELETE /api/permission-templates/[id]  删除（内置不可删）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(['super_admin'])
    if (!auth.ok) return auth.response

    const { id } = await params
    const template = await db.permissionTemplate.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!template) {
      return NextResponse.json({ success: false, error: '模板不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    console.error('PermissionTemplate GET error:', error)
    return NextResponse.json({ success: false, error: '获取权限模板失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(['super_admin'])
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await request.json()
    const { name, code, description, permissionsJson } = body

    const existing = await db.permissionTemplate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '模板不存在' }, { status: 404 })
    }

    const template = await db.permissionTemplate.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(code ? { code } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(permissionsJson !== undefined ? { permissionsJson } : {}),
      },
    })
    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    console.error('PermissionTemplate PUT error:', error)
    return NextResponse.json({ success: false, error: '更新权限模板失败' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(['super_admin'])
    if (!auth.ok) return auth.response

    const { id } = await params
    const existing = await db.permissionTemplate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '模板不存在' }, { status: 404 })
    }
    if (existing.isBuiltin) {
      return NextResponse.json({ success: false, error: '内置模板不可删除' }, { status: 400 })
    }

    await db.permissionTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PermissionTemplate DELETE error:', error)
    return NextResponse.json({ success: false, error: '删除权限模板失败' }, { status: 500 })
  }
}
