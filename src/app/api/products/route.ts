import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { productCode: { contains: search } },
        { name: { contains: search } },
        { nameEn: { contains: search } },
      ]
    }
    if (category) where.category = category

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.product.count({ where }),
    ])

    return NextResponse.json({ success: true, data: products, total, page, pageSize })
  } catch (error) {
    console.error('Products GET error:', error)
    return NextResponse.json({ success: false, error: '获取产品列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const product = await db.product.create({
      data: {
        productCode: body.productCode,
        name: body.name,
        nameEn: body.nameEn,
        category: body.category,
        specification: body.specification,
        unit: body.unit || 'PCS',
        costPrice: body.costPrice || 0,
        standardPrice: body.standardPrice || 0,
        minPrice: body.minPrice || 0,
        description: body.description,
        keywords: body.keywords || '[]',
        imageUrl: body.imageUrl,
      },
    })
    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    console.error('Products POST error:', error)
    return NextResponse.json({ success: false, error: '创建产品失败' }, { status: 500 })
  }
}
