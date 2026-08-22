import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, MANAGER_ROLES } from '@/lib/auth'

const productInclude = {
  productCategory: { select: { id: true, name: true, parentId: true } },
  _count: { select: { docs: true } },
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { productCode: { contains: search } },
        { name: { contains: search } },
        { nameEn: { contains: search } },
      ]
    }
    if (category) where.category = category
    if (categoryId) where.categoryId = categoryId

    const [products, total] = await Promise.all([
      db.product.findMany({ where, include: productInclude, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      db.product.count({ where }),
    ])
    return NextResponse.json({ success: true, data: products, total, page, pageSize })
  } catch (error) {
    console.error('Products GET error:', error)
    return NextResponse.json({ success: false, error: '获取产品列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  try {
    const body = await request.json()
    const code = (body.productCode || '').toUpperCase()
    if (!code) return NextResponse.json({ success: false, error: 'productCode 必填' }, { status: 400 })
    if (body.categoryId) {
      const cat = await db.productCategory.findUnique({ where: { id: body.categoryId } })
      if (!cat) return NextResponse.json({ success: false, error: '产品分类不存在' }, { status: 400 })
    }
    const product = await db.product.create({
      data: {
        productCode: code,
        name: body.name,
        nameEn: body.nameEn,
        category: body.category,
        categoryId: body.categoryId || null,
        specification: body.specification,
        unit: body.unit || 'PCS',
        costPrice: body.costPrice || 0,
        standardPrice: body.standardPrice || 0,
        minPrice: body.minPrice || 0,
        description: body.description,
        keywords: body.keywords || '[]',
        imageUrl: body.imageUrl,
        specs: body.specs ?? null,
        packing: body.packing ?? null,
        costVersions: body.costVersions ?? null,
      },
      include: productInclude,
    })
    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    console.error('Products POST error:', error)
    return NextResponse.json({ success: false, error: '创建产品失败' }, { status: 500 })
  }
}
