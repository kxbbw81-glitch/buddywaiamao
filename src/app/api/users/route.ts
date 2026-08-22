import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, toPublicUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(['super_admin', 'management', 'sales_manager'])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { department: { contains: search } },
      ]
    }

    const users = await db.user.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: users.map(toPublicUser), total: users.length })
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // 创建用户仅限超管与管理层
    const auth = await requireAuth(['super_admin', 'management'])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { name, email, primaryRole, department, dataScope, teamId, permissionTemplateId } = body

    if (!name || !email || !primaryRole) {
      return NextResponse.json(
        { success: false, error: '姓名、邮箱和角色为必填项' },
        { status: 400 }
      )
    }

    // Check email uniqueness
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: '该邮箱已被使用' },
        { status: 409 }
      )
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        primaryRole,
        department: department || null,
        additionalRoles: '[]',
        isActive: true,
        ...(dataScope ? { dataScope } : {}),
        ...(teamId ? { teamId } : {}),
        ...(permissionTemplateId ? { permissionTemplateId } : {}),
      },
    })

    return NextResponse.json({ success: true, data: toPublicUser(user) }, { status: 201 })
  } catch (error) {
    console.error('Users POST error:', error)
    return NextResponse.json({ success: false, error: '创建用户失败' }, { status: 500 })
  }
}
