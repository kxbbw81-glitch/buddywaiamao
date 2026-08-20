import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0)
  return d
}

function futureDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(9 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), 0, 0)
  return d
}

async function main() {
  console.log('📢 社媒种子数据...')

  // Clean existing
  await db.socialPost.deleteMany()

  // Get existing users and customers/products
  const users = await db.user.findMany()
  const customers = await db.customer.findMany()
  const products = await db.product.findMany()

  const chen = users.find(u => u.primaryRole === 'sales') || users[0]
  const li = users.find(u => u.primaryRole === 'sales_manager') || users[0]

  await db.socialPost.createMany({
    data: [
      // Published posts
      {
        title: '2024年最新蓝牙耳机技术趋势',
        content: '随着蓝牙5.3技术的普及，TWS耳机在降噪、续航和音质方面都有了质的飞跃。本文将为您详细介绍2024年蓝牙耳机市场的五大技术趋势，帮助外贸买家了解最新行业动态。#蓝牙耳机 #消费电子 #外贸',
        platform: 'linkedin',
        status: 'published',
        publishedAt: daysAgo(25),
        customerId: customers[0]?.id,
        productId: products[0]?.id,
        tags: JSON.stringify(["蓝牙耳机", "消费电子", "外贸"]),
        likes: 156,
        comments: 23,
        shares: 18,
        clicks: 89,
        createdById: chen.id,
      },
      {
        title: '纯棉T恤出口：质量和认证指南',
        content: '出口纯棉T恤到欧美市场需要通过哪些认证？本文详细解读OEKO-TEX、GOTS等关键认证要求，以及如何选择合适的面料供应商。纺织品类出口不容错过！#纺织品 #T恤 #出口认证',
        platform: 'linkedin',
        status: 'published',
        publishedAt: daysAgo(18),
        customerId: customers[1]?.id,
        productId: products[1]?.id,
        tags: JSON.stringify(["纺织品", "T恤", "出口认证"]),
        likes: 89,
        comments: 12,
        shares: 7,
        clicks: 45,
        createdById: li.id,
      },
      {
        title: '阿里巴巴国际站店铺运营心得分享',
        content: '做了3年阿里巴巴国际站，总结出10条最实用的店铺运营技巧。从关键词优化到RFQ报价策略，每一条都是实战经验。点赞收藏不迷路！#阿里巴巴 #B2B运营 #外贸技巧',
        platform: 'alibaba',
        status: 'published',
        publishedAt: daysAgo(12),
        tags: JSON.stringify(["阿里巴巴", "B2B运营", "外贸技巧"]),
        likes: 203,
        comments: 30,
        shares: 15,
        clicks: 120,
        createdById: chen.id,
      },
      {
        title: '工厂实拍：数控机床加工过程',
        content: '参观我们的CNC加工车间，8000平米的现代化生产车间，精度可达0.01mm。从原材料到成品，全程质量管控。欢迎来厂参观考察！#数控机床 #精密加工 #工厂实拍',
        platform: 'instagram',
        status: 'published',
        publishedAt: daysAgo(8),
        customerId: customers[3]?.id,
        productId: products[2]?.id,
        tags: JSON.stringify(["数控机床", "精密加工", "工厂实拍"]),
        likes: 178,
        comments: 25,
        shares: 12,
        clicks: 67,
        createdById: li.id,
      },
      {
        title: '外贸展会总结：广交会第三期',
        content: '广交会第三期圆满结束！本次展会接待了来自30多个国家的客户，收获名片200+，意向订单15个。感恩每一位到访的朋友！#广交会 #外贸展会 #国际采购',
        platform: 'facebook',
        status: 'published',
        publishedAt: daysAgo(5),
        tags: JSON.stringify(["广交会", "外贸展会", "国际采购"]),
        likes: 45,
        comments: 8,
        shares: 5,
        clicks: 32,
        createdById: chen.id,
      },
      {
        title: 'LED路灯海外市场分析报告',
        content: '随着全球节能减排政策的推进，LED户外照明市场正迎来爆发式增长。本文分析东南亚、中东和非洲三大市场的机会与挑战。#LED照明 #新能源 #海外市场',
        platform: 'twitter',
        status: 'published',
        publishedAt: daysAgo(2),
        productId: products[4]?.id,
        tags: JSON.stringify(["LED照明", "新能源", "海外市场"]),
        likes: 67,
        comments: 5,
        shares: 9,
        clicks: 41,
        createdById: li.id,
      },
      // Scheduled posts
      {
        title: '环保包装趋势：可降解材料引领未来',
        content: '全球环保政策日趋严格，可降解包装材料成为出口新趋势。本文盘点5种主流环保包装方案及成本对比。#环保包装 #可持续发展 #绿色出口',
        platform: 'linkedin',
        status: 'scheduled',
        scheduledAt: futureDate(3),
        productId: products[6]?.id,
        tags: JSON.stringify(["环保包装", "可持续发展", "绿色出口"]),
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        createdById: chen.id,
      },
      {
        title: '新品发布：智能手表S8系列',
        content: '即将发布全新智能手表S8系列！1.5英寸AMOLED屏幕，支持血氧监测、心率追踪、睡眠分析，14天超长续航。预购享8折优惠！#智能手表 #新品发布 #消费电子',
        platform: 'instagram',
        status: 'scheduled',
        scheduledAt: futureDate(7),
        productId: products[3]?.id,
        customerId: customers[7]?.id,
        tags: JSON.stringify(["智能手表", "新品发布", "消费电子"]),
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        createdById: li.id,
      },
      // Draft posts
      {
        title: '2024年Q3外贸行业报告',
        content: '第三季度外贸行业数据回顾与Q4展望，涵盖主要出口品类、区域市场变化和政策更新。',
        platform: 'linkedin',
        status: 'draft',
        tags: JSON.stringify(["外贸报告", "行业分析"]),
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        createdById: chen.id,
      },
      {
        title: '工业机器人手臂应用场景详解',
        content: '六轴工业机器人在焊接、搬运、喷涂等场景的应用案例和技术参数对比。',
        platform: 'facebook',
        status: 'draft',
        productId: products[8]?.id,
        tags: '[["工业机器人", "自动化", "机械臂"]]',
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        createdById: li.id,
      },
    ],
  })

  console.log(`✅ 社媒种子数据完成: ${await db.socialPost.count()} 条`)
}

main()
  .catch((e) => {
    console.error('❌ Social seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
