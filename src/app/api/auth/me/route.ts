import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

/**
 * GET /api/auth/me  当前会话用户
 * 401 = 未登录或会话过期（前端据此重新登录刷新会话）
 */
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录或会话已过期' }, { status: 401 })
    }
    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json({ success: false, error: '获取会话失败' }, { status: 500 })
  }
}
