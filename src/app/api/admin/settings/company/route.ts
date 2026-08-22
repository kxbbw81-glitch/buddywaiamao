import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/admin/settings/company
 *   - 返回 CompanyProfile 单行（不存在返回空字符串字段）
 *   - 仅超级管理员可读
 *
 * PUT /api/admin/settings/company
 *   - body: { companyName, website, email, mainProducts, phone, address }
 *   - 仅超级管理员可写，更新人记录到 updatedById
 */

export async function GET() {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const row = await db.companyProfile.findUnique({ where: { id: '1' } })
    return NextResponse.json({
      success: true,
      data: row
        ? {
            companyName: row.companyName,
            website: row.website,
            email: row.email,
            mainProducts: row.mainProducts,
            phone: row.phone,
            address: row.address,
            updatedAt: row.updatedAt,
          }
        : {
            companyName: '',
            website: '',
            email: '',
            mainProducts: '',
            phone: '',
            address: '',
            updatedAt: null,
          },
    })
  } catch (error) {
    console.error('[admin/settings/company GET]', error)
    return NextResponse.json({ success: false, error: '读取公司资料失败' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['super_admin'])
  if (!auth.ok) return auth.response
  try {
    const body = await req.json()
    const data = {
      companyName: typeof body.companyName === 'string' ? body.companyName.trim() : '',
      website: typeof body.website === 'string' ? body.website.trim() : '',
      email: typeof body.email === 'string' ? body.email.trim() : '',
      mainProducts: typeof body.mainProducts === 'string' ? body.mainProducts.trim() : '',
      phone: typeof body.phone === 'string' ? body.phone.trim() : '',
      address: typeof body.address === 'string' ? body.address.trim() : '',
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return NextResponse.json({ success: false, error: '对外邮箱格式不正确' }, { status: 400 })
    }
    if (data.website && !/^https?:\/\//i.test(data.website)) {
      return NextResponse.json({ success: false, error: '公司官网需以 http(s):// 开头' }, { status: 400 })
    }
    const row = await db.companyProfile.upsert({
      where: { id: '1' },
      create: { id: '1', ...data, updatedById: auth.user.id },
      update: { ...data, updatedById: auth.user.id },
    })
    return NextResponse.json({ success: true, data: { updatedAt: row.updatedAt } })
  } catch (error) {
    console.error('[admin/settings/company PUT]', error)
    return NextResponse.json({ success: false, error: '保存公司资料失败' }, { status: 500 })
  }
}
