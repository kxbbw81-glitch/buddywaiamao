import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, setSessionCookie, clearSessionCookie, toPublicUser, verifyPassword } from '@/lib/auth'

/**
 * POST /api/auth  登录
 * body: { email, password? }
 * - 用户已设置密码（passwordHash）时校验密码
 * - 未设置密码的用户（演示角色卡）直接登录
 * 成功后签发 HTTP-only 会话 Cookie
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email) {
      return NextResponse.json({ success: false, error: '邮箱不能为空' }, { status: 400 })
    }
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }
    if (!user.isActive) {
      return NextResponse.json({ success: false, error: '账号已停用，请联系管理员' }, { status: 403 })
    }
    if (!verifyPassword(password || '', user.passwordHash)) {
      return NextResponse.json({ success: false, error: '密码错误' }, { status: 401 })
    }

    await setSessionCookie(user.id)
    return NextResponse.json({ success: true, data: toPublicUser(user) })
  } catch (error) {
    console.error('Auth login error:', error)
    return NextResponse.json({ success: false, error: '登录失败' }, { status: 500 })
  }
}

/**
 * GET /api/auth  用户列表（仅管理角色可访问）
 */
export async function GET() {
  try {
    const auth = await requireAuth(['super_admin', 'management', 'sales_manager'])
    if (!auth.ok) return auth.response

    const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ success: true, data: users.map(toPublicUser) })
  } catch (error) {
    console.error('Auth GET error:', error)
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 })
  }
}

/**
 * DELETE /api/auth  登出（清除会话 Cookie）
 */
export async function DELETE() {
  try {
    await clearSessionCookie()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Auth logout error:', error)
    return NextResponse.json({ success: false, error: '登出失败' }, { status: 500 })
  }
}
