import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const COUNTRY_REGION_MAP: Record<string, string> = {
  '美国': '北美', '加拿大': '北美', '墨西哥': '北美',
  '德国': '欧洲', '英国': '欧洲', '法国': '欧洲', '瑞典': '欧洲', '意大利': '欧洲', '西班牙': '欧洲', '荷兰': '欧洲',
  '日本': '东亚', '韩国': '东亚', '中国': '东亚',
  '泰国': '东南亚', '越南': '东南亚', '马来西亚': '东南亚', '印度尼西亚': '东南亚', '印尼': '东南亚', '菲律宾': '东南亚',
  '印度': '南亚',
  '阿联酋': '中东', '沙特阿拉伯': '中东', '沙特': '中东',
  '澳大利亚': '大洋洲', '新西兰': '大洋洲',
  '巴西': '南美', '阿根廷': '南美', '智利': '南美',
  '尼日利亚': '非洲', '南非': '非洲', '埃及': '非洲',
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  '美国': 'US', '加拿大': 'CA', '墨西哥': 'MX',
  '德国': 'DE', '英国': 'GB', '法国': 'FR', '瑞典': 'SE', '意大利': 'IT', '西班牙': 'ES', '荷兰': 'NL',
  '日本': 'JP', '韩国': 'KR', '中国': 'CN',
  '泰国': 'TH', '越南': 'VN', '马来西亚': 'MY', '印度尼西亚': 'ID', '印尼': 'ID', '菲律宾': 'PH',
  '印度': 'IN',
  '阿联酋': 'AE', '沙特阿拉伯': 'SA', '沙特': 'SA',
  '澳大利亚': 'AU', '新西兰': 'NZ',
  '巴西': 'BR', '阿根廷': 'AR', '智利': 'CL',
  '尼日利亚': 'NG', '南非': 'ZA', '埃及': 'EG',
}

export async function GET() {
  try {
    // Fetch all customers with country and order revenue
    const customers = await db.customer.findMany({
      where: { status: { in: ['active', 'inactive'] } },
      select: {
        id: true,
        companyName: true,
        country: true,
        customerLevel: true,
        orders: {
          select: { totalAmount: true, currency: true },
        },
      },
    })

    // Group by country
    const countryMap = new Map<string, {
      country: string
      code: string
      count: number
      revenue: number
      customers: Array<{ id: string; companyName: string; customerLevel: string }>
    }>()

    let totalRevenue = 0
    let totalCustomers = 0

    for (const c of customers) {
      if (!c.country) continue

      const existing = countryMap.get(c.country)
      const orderRevenue = c.orders.reduce((sum, o) => {
        // Convert to USD if needed (simplified: assume all are USD)
        return sum + (o.totalAmount || 0)
      }, 0)

      if (existing) {
        existing.count += 1
        existing.revenue += orderRevenue
        existing.customers.push({
          id: c.id,
          companyName: c.companyName,
          customerLevel: c.customerLevel,
        })
      } else {
        countryMap.set(c.country, {
          country: c.country,
          code: COUNTRY_CODE_MAP[c.country] || 'XX',
          count: 1,
          revenue: orderRevenue,
          customers: [{
            id: c.id,
            companyName: c.companyName,
            customerLevel: c.customerLevel,
          }],
        })
      }

      totalRevenue += orderRevenue
      totalCustomers += 1
    }

    const countryDistribution = Array.from(countryMap.values())
      .sort((a, b) => b.count - a.count)

    // Group by region
    const regionMap = new Map<string, { region: string; count: number; revenue: number }>()

    for (const cd of countryDistribution) {
      const region = COUNTRY_REGION_MAP[cd.country] || '其他'
      const existing = regionMap.get(region)
      if (existing) {
        existing.count += cd.count
        existing.revenue += cd.revenue
      } else {
        regionMap.set(region, { region, count: cd.count, revenue: cd.revenue })
      }
    }

    const regionSummary = Array.from(regionMap.values())
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      data: {
        countryDistribution,
        regionSummary,
        totalCustomers,
        totalRevenue,
        countryCount: countryDistribution.length,
      },
    })
  } catch (error) {
    console.error('Failed to fetch map data:', error)
    return NextResponse.json(
      { success: false, error: '获取客户地图数据失败' },
      { status: 500 }
    )
  }
}
