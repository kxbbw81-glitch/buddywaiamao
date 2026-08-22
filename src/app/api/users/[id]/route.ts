import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, toPublicUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(['super_admin', 'management', 'sales_manager', 'sales'])
    if (!auth.ok) return auth.response

    const { id } = await params

    // sales 仅能查看自己
    if (auth.user.primaryRole === 'sales' && auth.user.id !== id) {
      return NextResponse.json({ success: false, error: '无权查看其他用户' }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignedInquiries: true,
            createdCustomers: true,
            createdQuotations: true,
            createdOrders: true,
            activities: true,
          },
        },
      },
    })
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: toPublicUser(user) })
  } catch (error) {
    console.error('User GET error:', error)
    return NextResponse.json({ success: false, error: '获取用户详情失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(['super_admin', 'management'])
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await request.json()
    const { name, email, primaryRole, department, dataScope, teamId, permissionTemplateId } = body

    if (!name || !email || !primaryRole) {
      return NextResponse.json(
        { success: false, error: '姓名、邮箱和角色为必填项' },
        { status: 400 }
      )
    }

    // Check email uniqueness (excluding current user)
    if (email) {
      const existing = await db.user.findFirst({ where: { email, NOT: { id } } })
      if (existing) {
        return NextResponse.json(
          { success: false, error: '该邮箱已被使用' },
          { status: 409 }
        )
      }
    }

    const user = await db.user.update({
      where: { id },
      data: {
        name,
        email,
        primaryRole,
        department: department || null,
        ...(dataScope ? { dataScope } : {}),
        ...(teamId !== undefined ? { teamId: teamId || null } : {}),
        ...(permissionTemplateId !== undefined ? { permissionTemplateId: permissionTemplateId || null } : {}),
      },
    })

    return NextResponse.json({ success: true, data: toPublicUser(user) })
  } catch (error) {
    console.error('User PUT error:', error)
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(['super_admin', 'management'])
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive 必须为布尔值' },
        { status: 400 }
      )
    }

    // 防止停用自己的账号
    if (!isActive && auth.user.id === id) {
      return NextResponse.json(
        { success: false, error: '不能停用自己的账号' },
        { status: 400 }
      )
    }

    const user = await db.user.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json({ success: true, data: toPublicUser(user) })
  } catch (error) {
    console.error('User PATCH error:', error)
    return NextResponse.json({ success: false, error: '更新用户状态失败' }, { status: 500 })
  }
}
