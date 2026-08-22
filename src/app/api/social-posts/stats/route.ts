import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const totalPosts = await db.socialPost.count()
    const publishedPosts = await db.socialPost.count({ where: { status: 'published' } })

    const engagementResult = await db.socialPost.aggregate({
      _sum: { likes: true, comments: true, shares: true, clicks: true },
    })
    const totalEngagement =
      (engagementResult._sum.likes || 0) +
      (engagementResult._sum.comments || 0) +
      (engagementResult._sum.shares || 0)
    const avgEngagementRate = publishedPosts > 0
      ? Math.round((totalEngagement / publishedPosts) * 100) / 100
      : 0

    // Platform distribution
    const platformGroups = await db.socialPost.groupBy({
      by: ['platform'],
      _count: { id: true },
    })
    const platformDistribution = platformGroups.map((g) => ({
      platform: g.platform,
      count: g._count.id,
    }))

    // Monthly engagement trend (last 6 months)
    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyPosts = await db.socialPost.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
        likes: true,
        comments: true,
        shares: true,
        clicks: true,
      },
    })

    // Group by month
    const monthMap: Record<string, { month: string; likes: number; comments: number; shares: number; clicks: number; engagement: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = { month: key, likes: 0, comments: 0, shares: 0, clicks: 0, engagement: 0 }
    }

    for (const post of monthlyPosts) {
      const key = `${post.createdAt.getFullYear()}-${String(post.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (monthMap[key]) {
        monthMap[key].likes += post.likes
        monthMap[key].comments += post.comments
        monthMap[key].shares += post.shares
        monthMap[key].clicks += post.clicks
        monthMap[key].engagement += post.likes + post.comments + post.shares
      }
    }

    const monthlyTrend = Object.values(monthMap)

    return NextResponse.json({
      success: true,
      data: {
        totalPosts,
        publishedPosts,
        totalEngagement,
        avgEngagementRate,
        platformDistribution,
        monthlyTrend,
      },
    })
  } catch (error) {
    console.error('SocialPosts stats error:', error)
    return NextResponse.json({ success: false, error: '获取统计数据失败' }, { status: 500 })
  }
}
