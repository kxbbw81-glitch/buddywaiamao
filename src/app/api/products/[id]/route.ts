import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, MANAGER_ROLES } from '@/lib/auth'

const productInclude = {
  productCategory: { select: { id: true, name: true, parentId: true } },
  _count: { select: { docs: true } },
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id }, include: productInclude })
    if (!product) {
      return NextResponse.json({ success: false, error: '产品不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Product GET error:', error)
    return NextResponse.json({ success: false, error: '获取产品失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const body = await request.json()
    if (body.categoryId) {
      const cat = await db.productCategory.findUnique({ where: { id: body.categoryId } })
      if (!cat) return NextResponse.json({ success: false, error: '产品分类不存在' }, { status: 400 })
    }
    const product = await db.product.update({
      where: { id },
      data: {
        ...(body.productCode ? { productCode: body.productCode.toUpperCase() } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.nameEn !== undefined ? { nameEn: body.nameEn } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
        ...(body.specification !== undefined ? { specification: body.specification } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
        ...(body.standardPrice !== undefined ? { standardPrice: body.standardPrice } : {}),
        ...(body.minPrice !== undefined ? { minPrice: body.minPrice } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.keywords !== undefined ? { keywords: body.keywords } : {}),
        ...(body.specs !== undefined ? { specs: body.specs } : {}),
        ...(body.packing !== undefined ? { packing: body.packing } : {}),
        ...(body.costVersions !== undefined ? { costVersions: body.costVersions } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      include: productInclude,
    })
    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Product PUT error:', error)
    return NextResponse.json({ success: false, error: '更新产品失败' }, { status: 500 })
  }
}
