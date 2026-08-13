import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ success: false, error: '邮箱不能为空' }, { status: 400 })
    }
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('Auth login error:', error)
    return NextResponse.json({ success: false, error: '登录失败' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('Auth GET error:', error)
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 })
  }
}
