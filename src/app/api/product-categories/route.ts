import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, MANAGER_ROLES } from '@/lib/auth'

/**
 * GET /api/product-categories — 分类列表（parentId 筛选，含子分类数）
 * POST /api/product-categories — 新建分类（仅管理角色）
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')
    const where = parentId ? { parentId } : {}
    const items = await db.productCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true, children: true } } },
    })
    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    console.error('ProductCategories GET error:', error)
    return NextResponse.json({ success: false, error: '获取分类失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  try {
    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ success: false, error: '分类名称必填' }, { status: 400 })
    }
    if (body.parentId) {
      const parent = await db.productCategory.findUnique({ where: { id: body.parentId } })
      if (!parent) return NextResponse.json({ success: false, error: '父分类不存在' }, { status: 400 })
    }
    const existing = await db.productCategory.findFirst({
      where: { name: body.name, parentId: body.parentId || null },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: '该层级下分类名已存在' }, { status: 409 })
    }
    const item = await db.productCategory.create({
      data: { name: body.name, parentId: body.parentId || null },
    })
    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('ProductCategories POST error:', error)
    return NextResponse.json({ success: false, error: '创建分类失败' }, { status: 500 })
  }
}
