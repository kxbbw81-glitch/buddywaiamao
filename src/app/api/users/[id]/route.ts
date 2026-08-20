import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    return NextResponse.json({ success: true, data: user })
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
    const { id } = await params
    const body = await request.json()
    const { name, email, primaryRole, department } = body

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
      },
    })

    return NextResponse.json({ success: true, data: user })
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
    const { id } = await params
    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive 必须为布尔值' },
        { status: 400 }
      )
    }

    const user = await db.user.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('User PATCH error:', error)
    return NextResponse.json({ success: false, error: '更新用户状态失败' }, { status: 500 })
  }
}
