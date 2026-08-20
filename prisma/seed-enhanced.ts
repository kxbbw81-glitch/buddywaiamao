import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0)
  return d
}

async function main() {
  console.log('\ud83c\udf31 增强种子数据 - NexFab CRM...')

  // Clean up existing data
  await db.activity.deleteMany()
  await db.payment.deleteMany()
  await db.sample.deleteMany()
  await db.quotationItem.deleteMany()
  await db.quotation.deleteMany()
  await db.order.deleteMany()
  await db.inquiry.deleteMany()
  await db.contact.deleteMany()
  await db.product.deleteMany()
  await db.customer.deleteMany()
  await db.user.deleteMany()

  // ============ USERS ============
  const users = await Promise.all([
    db.user.create({ data: { email: 'admin@nexfab.com', name: '张伟', primaryRole: 'super_admin', department: '总经办', avatar: null, isActive: true } }),
    db.user.create({ data: { email: 'wang@nexfab.com', name: '王芳', primaryRole: 'management', department: '管理层', avatar: null, isActive: true } }),
    db.user.create({ data: { email: 'li@nexfab.com', name: '李强', primaryRole: 'sales_manager', department: '销售部', avatar: null, isActive: true } }),
    db.user.create({ data: { email: 'chen@nexfab.com', name: '陈明', primaryRole: 'sales', department: '销售部', avatar: null, isActive: true } }),
    db.user.create({ data: { email: 'zhao@nexfab.com', name: '赵雪', primaryRole: 'finance', department: '财务部', avatar: null, isActive: true } }),
  ])

  const [admin, wang, li, chen, zhao] = users

  // ============ PRODUCTS ============
  const products = await Promise.all([
    db.product.create({ data: { productCode: 'NF-EL-001', name: '智能蓝牙耳机 Pro', nameEn: 'Smart Bluetooth Earbuds Pro', category: '消费电子', specification: '蓝牙5.3, ANC降噪, IPX5防水, 40h续航', unit: 'PCS', costPrice: 12.5, standardPrice: 28.9, minPrice: 22.0, description: '高品质TWS蓝牙耳机，支持主动降噪', keywords: '["蓝牙耳机", "TWS", "ANC"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-TX-001', name: '纯棉T恤', nameEn: '100% Cotton T-Shirt', category: '纺织品', specification: '180g纯棉, 亲肤透气, 多色可选', unit: 'PCS', costPrice: 3.2, standardPrice: 8.5, minPrice: 6.0, description: '高品质纯棉圆领T恤，适合印花定制', keywords: '["T恤", "纯棉", "服装"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-MC-001', name: '数控机床 V850', nameEn: 'CNC Machine V850', category: '机械设备', specification: '三轴联动, 850x500x500mm加工范围, 精度0.01mm', unit: 'SET', costPrice: 8500, standardPrice: 15800, minPrice: 14000, description: '高性能数控铣床，适合模具加工和精密零件制造', keywords: '["数控机床", "CNC", "铣床"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-EL-002', name: 'LED户外路灯', nameEn: 'LED Street Light', category: '照明灯具', specification: '100W, IP67防水, 5000K色温, 150lm/W', unit: 'PCS', costPrice: 45, standardPrice: 89, minPrice: 72, description: '高效节能LED路灯，适用于道路和广场照明', keywords: '["LED", "路灯", "户外照明"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-EL-003', name: '便携式储能电源 500W', nameEn: 'Portable Power Station 500W', category: '消费电子', specification: '500W/480Wh, LiFePO4电池, AC/DC/USB输出', unit: 'PCS', costPrice: 120, standardPrice: 249, minPrice: 195, description: '大容量便携储能电站，适合户外和应急使用', keywords: '["储能电源", "便携", "LiFePO4"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-TX-002', name: '防紫外线冲锋衣', nameEn: 'UV Protection Jacket', category: '纺织品', specification: '三合一设计, UPF50+, 防水2000mm', unit: 'PCS', costPrice: 15.8, standardPrice: 38.5, minPrice: 28.0, description: '多功能户外冲锋衣，防紫外线防水透气', keywords: '["冲锋衣", "防紫外线", "户外"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-MC-002', name: '工业机器人手臂', nameEn: 'Industrial Robot Arm', category: '机械设备', specification: '6轴, 负载10kg, 重复精度0.05mm, IP67', unit: 'SET', costPrice: 22000, standardPrice: 38000, minPrice: 35000, description: '六轴工业机器人，适用于焊接、搬运、装配等', keywords: '["机器人", "工业自动化", "机械臂"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-EL-004', name: '智能手表 S8', nameEn: 'Smart Watch S8', category: '消费电子', specification: '1.43" AMOLED, 心率血氧, GPS, 14天续航', unit: 'PCS', costPrice: 22, standardPrice: 55, minPrice: 42, description: '高端智能手表，健康监测全覆盖', keywords: '["智能手表", "健康监测", "GPS"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-HM-001', name: '竹纤维毛巾套装', nameEn: 'Bamboo Fiber Towel Set', category: '家居用品', specification: '70%竹纤维+30%棉, 5件套, 抗菌', unit: 'SET', costPrice: 5.5, standardPrice: 15.8, minPrice: 11.0, description: '天然竹纤维毛巾，柔软亲肤，适合酒店和家庭', keywords: '["毛巾", "竹纤维", "家居"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-PK-001', name: '环保纸包装盒', nameEn: 'Eco-friendly Paper Box', category: '包装印刷', specification: '350g铜版纸, CMYK印刷, 覆膜', unit: 'PCS', costPrice: 0.35, standardPrice: 0.85, minPrice: 0.6, description: '高品质定制纸盒，支持各种尺寸和工艺', keywords: '["包装盒", "定制", "环保"]', isActive: true } }),
    db.product.create({ data: { productCode: 'NF-EL-005', name: '无线充电器 15W', nameEn: 'Wireless Charger 15W', category: '消费电子', specification: '15W快充, Qi认证, LED指示灯', unit: 'PCS', costPrice: 5.8, standardPrice: 14.9, minPrice: 10.5, description: '超薄无线充电板，支持所有Qi兼容设备', keywords: '["无线充电", "快充", "Qi"]', isActive: true } }),
  ])

  // ============ CUSTOMERS (15 original + 5 new = 20) ============
  const customers = await Promise.all([
    // --- 原有15个客户 ---
    db.customer.create({ data: { companyName: 'TechVista Solutions', companyNameEn: 'TechVista Solutions', country: '美国', city: '洛杉矶', website: 'www.techvista-us.com', industry: '消费电子', customerLevel: 'A', source: 'exhibition', status: 'active', tags: '["重点客户", "VIP"]', notes: '美国大型电子产品分销商，年采购额超过500万美元', aiScore: 92, ownerId: chen.id, lastContactAt: daysAgo(5) } }),
    db.customer.create({ data: { companyName: 'GlobalTex GmbH', companyNameEn: 'GlobalTex GmbH', country: '德国', city: '汉堡', website: 'www.globaltex.de', industry: '纺织品', customerLevel: 'A', source: 'b2b_alibaba', status: 'active', tags: '["稳定合作"]', notes: '德国知名纺织品批发商，合作3年', aiScore: 88, ownerId: chen.id, lastContactAt: daysAgo(10) } }),
    db.customer.create({ data: { companyName: 'Al-Yamama Trading', companyNameEn: 'Al-Yamama Trading LLC', country: '阿联酋', city: '迪拜', website: 'www.alyamama.ae', industry: '消费电子', customerLevel: 'B', source: 'exhibition', status: 'active', tags: '["中东市场"]', notes: '迪拜电子产品贸易商，主要做批发', aiScore: 75, ownerId: chen.id, lastContactAt: daysAgo(22) } }),
    db.customer.create({ data: { companyName: 'Sakura Electronics', companyNameEn: 'Sakura Electronics Co., Ltd.', country: '日本', city: '东京', website: 'www.sakura-elec.jp', industry: '消费电子', customerLevel: 'B', source: 'linkedin', status: 'active', tags: '["日本市场", "高质量要求"]', notes: '日本电子产品零售连锁，品质要求极高', aiScore: 82, ownerId: chen.id, lastContactAt: daysAgo(14) } }),
    db.customer.create({ data: { companyName: 'AfroTech Industries', companyNameEn: 'AfroTech Industries Ltd.', country: '尼日利亚', city: '拉各斯', website: 'www.afrotech.ng', industry: '机械设备', customerLevel: 'C', source: 'social_media', status: 'active', tags: '["非洲市场"]', notes: '尼日利亚机械设备进口商，价格敏感', aiScore: 55, ownerId: li.id, lastContactAt: daysAgo(40) } }),
    db.customer.create({ data: { companyName: 'MegaPack Solutions', companyNameEn: 'MegaPack Solutions Sdn Bhd', country: '马来西亚', city: '吉隆坡', website: 'www.megapack.my', industry: '包装印刷', customerLevel: 'B', source: 'email', status: 'active', tags: '["东南亚"]', notes: '马来西亚包装解决方案公司', aiScore: 70, ownerId: li.id, lastContactAt: daysAgo(35) } }),
    db.customer.create({ data: { companyName: 'EuroLight AB', companyNameEn: 'EuroLight AB', country: '瑞典', city: '斯德哥尔摩', website: 'www.eurolight.se', industry: '照明灯具', customerLevel: 'A', source: 'exhibition', status: 'active', tags: '["欧洲市场", "环保"]', notes: '瑞典照明工程公司，大型市政照明项目', aiScore: 90, ownerId: li.id, lastContactAt: daysAgo(8) } }),
    db.customer.create({ data: { companyName: 'Patel & Sons', companyNameEn: 'Patel & Sons Trading', country: '印度', city: '孟买', website: 'www.pateltrading.in', industry: '家居用品', customerLevel: 'C', source: 'b2b_alibaba', status: 'active', tags: '["印度市场", "大采购量"]', notes: '印度家居用品批发商，单次采购量极大但利润薄', aiScore: 60, ownerId: chen.id, lastContactAt: daysAgo(42) } }),
    db.customer.create({ data: { companyName: 'BrightStar LLC', companyNameEn: 'BrightStar LLC', country: '美国', city: '纽约', website: 'www.brightstar-ny.com', industry: '消费电子', customerLevel: 'A', source: 'referral', status: 'active', tags: '["转介绍", "VIP"]', notes: 'TechVista推荐的客户，美国东海岸零售商', aiScore: 85, ownerId: chen.id, lastContactAt: daysAgo(6) } }),
    db.customer.create({ data: { companyName: 'Müller Industrie', companyNameEn: 'Müller Industrie GmbH', country: '德国', city: '慕尼黑', website: 'www.mueller-industrie.de', industry: '机械设备', customerLevel: 'A', source: 'exhibition', status: 'active', tags: '["欧洲工业", "精密制造"]', notes: '德国精密制造企业，对质量要求非常高', aiScore: 91, ownerId: li.id, lastContactAt: daysAgo(12) } }),
    db.customer.create({ data: { companyName: 'Shoppers Paradise', companyNameEn: 'Shoppers Paradise Ltd.', country: '英国', city: '伦敦', website: 'www.shoppersparadise.co.uk', industry: '家居用品', customerLevel: 'B', source: 'website', status: 'active', tags: '["英国零售"]', notes: '英国连锁零售商，主要采购家居和日用品', aiScore: 72, ownerId: chen.id, lastContactAt: daysAgo(30) } }),
    db.customer.create({ data: { companyName: 'Andes Tech', companyNameEn: 'Andes Technology S.A.', country: '巴西', city: '圣保罗', website: 'www.andestech.com.br', industry: '消费电子', customerLevel: 'C', source: 'linkedin', status: 'active', tags: '["南美市场"]', notes: '巴西电子产品进口商，关税问题需注意', aiScore: 50, ownerId: li.id, lastContactAt: daysAgo(59) } }),
    db.customer.create({ data: { companyName: 'Pacific Rim Trading', companyNameEn: 'Pacific Rim Trading Co.', country: '澳大利亚', city: '悉尼', website: 'www.pacificrim.au', industry: '消费电子', customerLevel: 'B', source: 'email', status: 'active', tags: '["澳洲市场"]', notes: '澳大利亚电子产品分销商', aiScore: 68, ownerId: chen.id, lastContactAt: daysAgo(15) } }),
    db.customer.create({ data: { companyName: 'Seoul Digital', companyNameEn: 'Seoul Digital Inc.', country: '韩国', city: '首尔', website: 'www.seouldigital.kr', industry: '消费电子', customerLevel: 'B', source: 'exhibition', status: 'active', tags: '["韩国市场"]', notes: '韩国电子产品零售商，竞争激烈', aiScore: 65, ownerId: chen.id, lastContactAt: daysAgo(18) } }),
    db.customer.create({ data: { companyName: 'Old Customer Corp', companyNameEn: 'Old Customer Corp.', country: '法国', city: '巴黎', industry: '纺织品', customerLevel: 'D', source: 'manual', status: 'lost', tags: '["流失客户"]', notes: '去年合作过一次后未再回复', aiScore: 20, ownerId: li.id, lastContactAt: daysAgo(180) } }),
    // --- 5个新客户: 巴西、印度、墨西哥、泰国、越南 ---
    db.customer.create({ data: { companyName: 'Tropical Trade Brasil', companyNameEn: 'Tropical Trade Brasil Ltda.', country: '巴西', city: '里约热内卢', website: 'www.tropicaltrade.br', industry: '纺织品', customerLevel: 'B', source: 'exhibition', status: 'active', tags: '["南美市场", "展会"]', notes: '巴西纺织品批发商，参加广交会认识', aiScore: 73, ownerId: chen.id, lastContactAt: daysAgo(8) } }),
    db.customer.create({ data: { companyName: 'Sharma Electronics', companyNameEn: 'Sharma Electronics Pvt. Ltd.', country: '印度', city: '新德里', website: 'www.sharma-elec.in', industry: '消费电子', customerLevel: 'B', source: 'b2b_alibaba', status: 'active', tags: '["印度市场", "B2B"]', notes: '印度电子产品分销商，主要销售充电器和耳机', aiScore: 67, ownerId: li.id, lastContactAt: daysAgo(12) } }),
    db.customer.create({ data: { companyName: 'Grupo Mexicano Industrial', companyNameEn: 'Grupo Mexicano Industrial S.A. de C.V.', country: '墨西哥', city: '墨西哥城', website: 'www.gmi-mexico.mx', industry: '机械设备', customerLevel: 'C', source: 'linkedin', status: 'active', tags: '["北美市场", "制造业"]', notes: '墨西哥制造企业，需要自动化设备', aiScore: 58, ownerId: chen.id, lastContactAt: daysAgo(20) } }),
    db.customer.create({ data: { companyName: 'Siam Green Energy', companyNameEn: 'Siam Green Energy Co., Ltd.', country: '泰国', city: '曼谷', website: 'www.siamgreenenergy.th', industry: '照明灯具', customerLevel: 'B', source: 'email', status: 'active', tags: '["东南亚", "新能源"]', notes: '泰国新能源公司，需要太阳能路灯和储能产品', aiScore: 76, ownerId: li.id, lastContactAt: daysAgo(7) } }),
    db.customer.create({ data: { companyName: 'Vietnam Home Goods', companyNameEn: 'Vietnam Home Goods JSC', country: '越南', city: '胡志明市', website: 'www.vnhomgoods.vn', industry: '家居用品', customerLevel: 'C', source: 'referral', status: 'active', tags: '["东南亚", "转介绍"]', notes: 'Patel & Sons推荐的越南合作伙伴', aiScore: 62, ownerId: chen.id, lastContactAt: daysAgo(15) } }),
  ])

  // ============ CONTACTS ============
  const contacts = await Promise.all([
    // 原有12个联系人
    db.contact.create({ data: { customerId: customers[0].id, name: 'John Smith', email: 'john@techvista-us.com', phone: '+1-310-555-0101', whatsapp: '+13105550101', position: '采购总监', isDecisionMaker: true, notes: '主要联系人，决策者' } }),
    db.contact.create({ data: { customerId: customers[0].id, name: 'Emily Davis', email: 'emily@techvista-us.com', phone: '+1-310-555-0102', position: '采购经理', isDecisionMaker: false } }),
    db.contact.create({ data: { customerId: customers[1].id, name: 'Hans Müller', email: 'hans@globaltex.de', phone: '+49-40-555-0201', whatsapp: '+49405550201', position: '总经理', isDecisionMaker: true, notes: '关键决策人，德国人，英语流利' } }),
    db.contact.create({ data: { customerId: customers[2].id, name: 'Ahmed Al-Rashid', email: 'ahmed@alyamama.ae', phone: '+971-4-555-0301', whatsapp: '+97145550301', position: '采购部经理', isDecisionMaker: true } }),
    db.contact.create({ data: { customerId: customers[3].id, name: '田中太郎', email: 'tanaka@sakura-elec.jp', phone: '+81-3-555-0401', position: '采购担当', isDecisionMaker: false, notes: '英语不太流利，建议用邮件沟通' } }),
    db.contact.create({ data: { customerId: customers[3].id, name: '鈴木花子', email: 'suzuki@sakura-elec.jp', phone: '+81-3-555-0402', position: '部长', isDecisionMaker: true } }),
    db.contact.create({ data: { customerId: customers[4].id, name: 'Oluwaseun Adeyemi', email: 'seun@afrotech.ng', phone: '+234-1-555-0501', whatsapp: '+23415550501', position: 'CEO', isDecisionMaker: true } }),
    db.contact.create({ data: { customerId: customers[6].id, name: 'Erik Lindqvist', email: 'erik@eurolight.se', phone: '+46-8-555-0701', whatsapp: '+4685550701', position: '项目总监', isDecisionMaker: true, notes: '负责市政照明项目采购' } }),
    db.contact.create({ data: { customerId: customers[7].id, name: 'Rajesh Patel', email: 'rajesh@pateltrading.in', phone: '+91-22-555-0801', whatsapp: '+91225550801', position: '采购经理', isDecisionMaker: true } }),
    db.contact.create({ data: { customerId: customers[8].id, name: 'Michael Brown', email: 'michael@brightstar-ny.com', phone: '+1-212-555-0901', position: 'VP of Procurement', isDecisionMaker: true, notes: 'TechVista推荐，预算充足' } }),
    db.contact.create({ data: { customerId: customers[9].id, name: 'Klaus Weber', email: 'klaus@mueller-industrie.de', phone: '+49-89-555-1001', position: '技术总监', isDecisionMaker: true, notes: '非常注重技术参数和品质' } }),
    db.contact.create({ data: { customerId: customers[10].id, name: 'James Wilson', email: 'james@shoppersparadise.co.uk', phone: '+44-20-555-1101', position: 'Category Manager', isDecisionMaker: true } }),
    // 新客户联系人 (5个新客户 x 2个联系人 = 10个)
    db.contact.create({ data: { customerId: customers[15].id, name: 'Carlos Silva', email: 'carlos@tropicaltrade.br', phone: '+55-21-555-2001', whatsapp: '+55215552001', position: '采购总监', isDecisionMaker: true, notes: '广交会认识，葡语沟通' } }),
    db.contact.create({ data: { customerId: customers[15].id, name: 'Ana Oliveira', email: 'ana@tropicaltrade.br', phone: '+55-21-555-2002', position: '采购专员', isDecisionMaker: false } }),
    db.contact.create({ data: { customerId: customers[16].id, name: 'Vikram Sharma', email: 'vikram@sharma-elec.in', phone: '+91-11-555-2101', whatsapp: '+91115552101', position: '创始人', isDecisionMaker: true, notes: '家族企业，快速决策' } }),
    db.contact.create({ data: { customerId: customers[16].id, name: 'Priya Sharma', email: 'priya@sharma-elec.in', phone: '+91-11-555-2102', position: '运营经理', isDecisionMaker: false } }),
    db.contact.create({ data: { customerId: customers[17].id, name: 'Roberto Garcia', email: 'roberto@gmi-mexico.mx', phone: '+52-55-555-2201', whatsapp: '+52555552201', position: '技术经理', isDecisionMaker: true, notes: '负责设备选型' } }),
    db.contact.create({ data: { customerId: customers[17].id, name: 'Maria Hernandez', email: 'maria@gmi-mexico.mx', phone: '+52-55-555-2202', position: '采购专员', isDecisionMaker: false } }),
    db.contact.create({ data: { customerId: customers[18].id, name: 'Somchai Wongsuwan', email: 'somchai@siamgreenenergy.th', phone: '+66-2-555-2301', whatsapp: '+6625552301', position: 'CEO', isDecisionMaker: true, notes: '泰国新能源行业资深人士' } }),
    db.contact.create({ data: { customerId: customers[18].id, name: 'Nattaporn Chaiyasit', email: 'nattaporn@siamgreenenergy.th', phone: '+66-2-555-2302', position: '项目工程师', isDecisionMaker: false } }),
    db.contact.create({ data: { customerId: customers[19].id, name: 'Nguyen Van Minh', email: 'minh@vnhomgoods.vn', phone: '+84-28-555-2401', whatsapp: '+84285552401', position: '总经理', isDecisionMaker: true, notes: 'Patel & Sons推荐的合作伙伴' } }),
    db.contact.create({ data: { customerId: customers[19].id, name: 'Tran Thi Hoa', email: 'hoa@vnhomgoods.vn', phone: '+84-28-555-2402', position: '采购经理', isDecisionMaker: false } }),
  ])

  // ============ INQUIRIES (21 original + 10 new = 31) ============
  const inquiries = await Promise.all([
    // 原有21个询盘
    db.inquiry.create({ data: { customerId: customers[0].id, inquiryNo: 'INQ-2024-001', source: 'email', subject: '蓝牙耳机年度采购需求', content: 'We are looking for a reliable supplier for TWS earbuds. We need about 50,000 units per quarter. Please provide your best FOB price.', language: 'en', status: 'won', priority: 'high', assignedTo: chen.id, assignedAt: daysAgo(90), lastFollowUpAt: daysAgo(14) } }),
    db.inquiry.create({ data: { customerId: customers[1].id, inquiryNo: 'INQ-2024-002', source: 'b2b_alibaba', subject: '纯棉T恤大批量定制需求', content: 'Wir benötigen 100.000 Stück Baumwoll-T-Shirts. 180g Qualität, verschiedene Farben.', language: 'de', status: 'quoted', priority: 'normal', assignedTo: chen.id, assignedAt: daysAgo(85), lastFollowUpAt: daysAgo(35) } }),
    db.inquiry.create({ data: { customerId: customers[2].id, inquiryNo: 'INQ-2024-003', source: 'exhibition', subject: '储能电源迪拜市场询价', content: 'We saw your portable power stations at the exhibition. We are interested in the 500W model for 2000 units.', language: 'en', status: 'following', priority: 'normal', assignedTo: chen.id, assignedAt: daysAgo(80), lastFollowUpAt: daysAgo(10) } }),
    db.inquiry.create({ data: { customerId: customers[3].id, inquiryNo: 'INQ-2024-004', source: 'linkedin', subject: '智能手表日本市场合作意向', content: 'Hello, we are interested in your smart watch S8 model for the Japanese market. Initial order would be 5,000 units.', language: 'en', status: 'assigned', priority: 'high', assignedTo: chen.id, assignedAt: daysAgo(75), lastFollowUpAt: daysAgo(19) } }),
    db.inquiry.create({ data: { customerId: customers[4].id, inquiryNo: 'INQ-2024-005', source: 'social_media', subject: '数控机床询价 - 尼日利亚工厂', content: 'We want to set up a small workshop and need a CNC machine. Budget within $15,000.', language: 'en', status: 'quoted', priority: 'low', assignedTo: li.id, assignedAt: daysAgo(100), lastFollowUpAt: daysAgo(50) } }),
    db.inquiry.create({ data: { customerId: customers[5].id, inquiryNo: 'INQ-2024-006', source: 'email', subject: '包装盒定制需求 - 马来西亚订单', content: 'Custom packaging boxes for our products. Size: 30x20x10cm, 4-color printing. Quantity: 50,000 pcs.', language: 'en', status: 'new', priority: 'normal' } }),
    db.inquiry.create({ data: { customerId: customers[6].id, inquiryNo: 'INQ-2024-007', source: 'exhibition', subject: '斯德哥尔摩路灯项目招标', content: 'We have a municipal street lighting project requiring 2,000 units of LED street lights.', language: 'en', status: 'won', priority: 'urgent', assignedTo: li.id, assignedAt: daysAgo(110), lastFollowUpAt: daysAgo(12) } }),
    db.inquiry.create({ data: { customerId: customers[7].id, inquiryNo: 'INQ-2024-008', subject: '竹纤维毛巾样品需求', content: 'We are interested in your bamboo fiber towel sets. First we need samples for testing.', language: 'en', status: 'following', priority: 'normal', assignedTo: chen.id, assignedAt: daysAgo(70), lastFollowUpAt: daysAgo(28) } }),
    db.inquiry.create({ data: { customerId: customers[8].id, inquiryNo: 'INQ-2024-009', source: 'referral', subject: '纽约零售渠道合作 - 耳机+充电器', content: 'TechVista recommended you. We want to add your products to our retail stores.', language: 'en', status: 'quoted', priority: 'high', assignedTo: chen.id, assignedAt: daysAgo(59), lastFollowUpAt: daysAgo(8) } }),
    db.inquiry.create({ data: { customerId: customers[9].id, inquiryNo: 'INQ-2024-010', source: 'exhibition', subject: '工业机器人技术评估', content: 'We are evaluating industrial robot arms for our automated production line.', language: 'en', status: 'assigned', priority: 'urgent', assignedTo: li.id, assignedAt: daysAgo(55), lastFollowUpAt: daysAgo(14) } }),
    db.inquiry.create({ data: { customerId: customers[10].id, inquiryNo: 'INQ-2024-011', source: 'website', subject: '家居用品采购 - 毛巾+包装', content: 'We are looking for bamboo fiber towel sets for our retail chain.', language: 'en', status: 'new', priority: 'normal' } }),
    db.inquiry.create({ data: { customerId: customers[11].id, inquiryNo: 'INQ-2024-012', source: 'linkedin', subject: '南美电子产品代理合作', content: 'We are a distributor in Brazil looking for exclusive partnerships.', language: 'en', status: 'new', priority: 'low' } }),
    db.inquiry.create({ data: { customerId: customers[12].id, inquiryNo: 'INQ-2024-013', source: 'email', subject: '澳洲智能穿戴设备需求', content: 'We operate consumer electronics stores across Australia. Interested in smart watches and wireless chargers.', language: 'en', status: 'following', priority: 'normal', assignedTo: chen.id, assignedAt: daysAgo(45), lastFollowUpAt: daysAgo(16) } }),
    db.inquiry.create({ data: { customerId: customers[13].id, inquiryNo: 'INQ-2024-014', source: 'exhibition', subject: '韩国消费电子竞品分析需求', content: 'We need competitive pricing for TWS earbuds and smart watches for the Korean market.', language: 'en', status: 'quoted', priority: 'normal', assignedTo: chen.id, assignedAt: daysAgo(66), lastFollowUpAt: daysAgo(37) } }),
    db.inquiry.create({ data: { customerId: customers[14].id, inquiryNo: 'INQ-2024-015', source: 'manual', subject: '去年未成交客户跟进', content: 'Follow up on last year\'s textile order discussion.', language: 'en', status: 'pooled', priority: 'low' } }),
    db.inquiry.create({ data: { customerId: customers[0].id, inquiryNo: 'INQ-2024-016', source: 'whatsapp', subject: '新增产品线需求 - LED灯具', content: 'We also want to expand into LED lighting products for the US market.', language: 'en', status: 'new', priority: 'normal' } }),
    db.inquiry.create({ data: { customerId: customers[9].id, inquiryNo: 'INQ-2024-017', source: 'email', subject: '二期设备采购需求', content: 'We now want to order 3 units of your CNC V850 machine.', language: 'en', status: 'quoted', priority: 'urgent', assignedTo: li.id, assignedAt: daysAgo(19), lastFollowUpAt: daysAgo(6) } }),
    db.inquiry.create({ data: { customerId: customers[6].id, inquiryNo: 'INQ-2024-018', source: 'email', subject: '二期路灯项目 - 扩展需求', content: 'The first batch was installed successfully. We now need an additional 1,500 units for Phase 2.', language: 'en', status: 'won', priority: 'high', assignedTo: li.id, assignedAt: daysAgo(40), lastFollowUpAt: daysAgo(10) } }),
    db.inquiry.create({ data: { customerId: customers[8].id, inquiryNo: 'INQ-2024-019', source: 'email', subject: '新季度订单需求 - Q1 2025', content: 'Planning Q1 2025 orders. Need updated pricing. Expecting 25% volume increase.', language: 'en', status: 'following', priority: 'high', assignedTo: chen.id, assignedAt: daysAgo(19), lastFollowUpAt: daysAgo(6) } }),
    db.inquiry.create({ data: { customerId: customers[2].id, inquiryNo: 'INQ-2024-020', source: 'whatsapp', subject: '迪拜消费电子展会后续', content: 'Great meeting at GITEX! We want to proceed with the power station order.', language: 'en', status: 'following', priority: 'high', assignedTo: chen.id, assignedAt: daysAgo(15), lastFollowUpAt: daysAgo(7) } }),
    db.inquiry.create({ data: { customerId: null, inquiryNo: 'INQ-2024-021', source: 'website', subject: '网站访客询盘 - 无明确客户', content: 'Website inquiry form submission. Asking about wholesale pricing for LED products.', language: 'en', status: 'new', priority: 'low' } }),
    // --- 10个新询盘 ---
    db.inquiry.create({ data: { customerId: customers[15].id, inquiryNo: 'INQ-2024-022', source: 'exhibition', subject: '巴西T恤和冲锋衣大批量采购', content: 'We met at Canton Fair. Need 80,000 T-shirts and 20,000 jackets for the Brazilian market. FOB pricing required.', language: 'en', status: 'won', priority: 'high', assignedTo: chen.id, assignedAt: daysAgo(60), lastFollowUpAt: daysAgo(8), createdAt: daysAgo(60) } }),
    db.inquiry.create({ data: { customerId: customers[16].id, inquiryNo: 'INQ-2024-023', source: 'b2b_alibaba', subject: '印度市场蓝牙耳机和充电器采购', content: 'We need 30,000 TWS earbuds and 50,000 wireless chargers for Indian market. Please quote best price.', language: 'en', status: 'following', priority: 'normal', assignedTo: li.id, assignedAt: daysAgo(50), lastFollowUpAt: daysAgo(12), createdAt: daysAgo(50) } }),
    db.inquiry.create({ data: { customerId: customers[17].id, inquiryNo: 'INQ-2024-024', source: 'linkedin', subject: '墨西哥工厂自动化改造项目', content: 'We are upgrading our production line with CNC machines and robot arms. Need 2 CNC V850 units and 1 robot arm.', language: 'en', status: 'quoted', priority: 'high', assignedTo: chen.id, assignedAt: daysAgo(45), lastFollowUpAt: daysAgo(10), createdAt: daysAgo(45) } }),
    db.inquiry.create({ data: { customerId: customers[18].id, inquiryNo: 'INQ-2024-025', source: 'email', subject: '泰国太阳能路灯项目', content: 'We need 3,000 solar-powered LED street lights for government project in Bangkok. Must meet Thai standards.', language: 'en', status: 'won', priority: 'urgent', assignedTo: li.id, assignedAt: daysAgo(70), lastFollowUpAt: daysAgo(7), createdAt: daysAgo(70) } }),
    db.inquiry.create({ data: { customerId: customers[19].id, inquiryNo: 'INQ-2024-026', source: 'referral', subject: '越南家居用品初次合作', content: 'Patel & Sons referred us. We want to start with 50,000 bamboo towel sets for Vietnam and export market.', language: 'en', status: 'following', priority: 'normal', assignedTo: chen.id, assignedAt: daysAgo(30), lastFollowUpAt: daysAgo(15), createdAt: daysAgo(30) } }),
    db.inquiry.create({ data: { customerId: customers[15].id, inquiryNo: 'INQ-2024-027', source: 'whatsapp', subject: '巴西客户追加LED灯具需求', content: 'After our T-shirt order, we also want 5,000 LED street lights for a construction project.', language: 'en', status: 'new', priority: 'normal', createdAt: daysAgo(10) } }),
    db.inquiry.create({ data: { customerId: customers[16].id, inquiryNo: 'INQ-2024-028', source: 'email', subject: '印度智能手表市场开拓', content: 'We want to test the Indian market with 2,000 smart watches S8. Need customized packaging.', language: 'en', status: 'quoted', priority: 'normal', assignedTo: li.id, assignedAt: daysAgo(25), lastFollowUpAt: daysAgo(5), createdAt: daysAgo(25) } }),
    db.inquiry.create({ data: { customerId: customers[18].id, inquiryNo: 'INQ-2024-029', source: 'email', subject: '泰国储能电源批量采购', content: 'Following our street light project, we now need 1,000 portable power stations 500W for retail distribution.', language: 'en', status: 'new', priority: 'normal', createdAt: daysAgo(5) } }),
    db.inquiry.create({ data: { customerId: customers[17].id, inquiryNo: 'INQ-2024-030', source: 'exhibition', subject: '墨西哥包装盒定制需求', content: 'Need custom packaging boxes for our electronic products. 100,000 units with our branding.', language: 'en', status: 'assigned', priority: 'normal', assignedTo: chen.id, assignedAt: daysAgo(15), lastFollowUpAt: daysAgo(3), createdAt: daysAgo(15) } }),
    db.inquiry.create({ data: { customerId: customers[19].id, inquiryNo: 'INQ-2024-031', source: 'email', subject: '越南T恤定制需求', content: 'We need 200,000 cotton T-shirts for our hotel chain clients. Multi-color, custom printing.', language: 'en', status: 'new', priority: 'high', createdAt: daysAgo(3) } }),
  ])

  // ============ QUOTATIONS (11 original) ============
  const quotations = await Promise.all([
    db.quotation.create({ data: { inquiryId: inquiries[0].id, customerId: customers[0].id, quoteNo: 'QT-2024-001', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 1445000, totalCost: 625000, profitRate: 56.7, status: 'accepted', validUntil: new Date('2024-11-30'), notes: '年度框架协议报价', marginCheckPassed: true, createdById: chen.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[1].id, customerId: customers[1].id, quoteNo: 'QT-2024-002', version: 1, tradeTerm: 'CIF', currency: 'USD', exchangeRate: 7.24, totalAmount: 850000, totalCost: 320000, profitRate: 62.4, status: 'sent', validUntil: new Date('2024-12-20'), marginCheckPassed: true, createdById: chen.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[4].id, customerId: customers[4].id, quoteNo: 'QT-2024-003', version: 2, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 14200, totalCost: 8500, profitRate: 40.1, status: 'sent', validUntil: new Date('2024-12-15'), notes: 'V2: 降价后版本', marginCheckPassed: true, createdById: li.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[6].id, customerId: customers[6].id, quoteNo: 'QT-2024-004', version: 1, tradeTerm: 'CIF', currency: 'USD', exchangeRate: 7.24, totalAmount: 178000, totalCost: 90000, profitRate: 49.4, status: 'accepted', validUntil: new Date('2024-10-31'), marginCheckPassed: true, approvedBy: li.id, approvedAt: daysAgo(90), createdById: li.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[8].id, customerId: customers[8].id, quoteNo: 'QT-2024-005', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 628000, totalCost: 305000, profitRate: 51.4, status: 'sent', validUntil: new Date('2025-01-15'), marginCheckPassed: true, createdById: chen.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[16].id, customerId: customers[9].id, quoteNo: 'QT-2024-006', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 47400, totalCost: 25500, profitRate: 46.2, status: 'pending', validUntil: new Date('2025-01-10'), marginCheckPassed: true, approvedBy: wang.id, approvedAt: daysAgo(10), createdById: li.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[13].id, customerId: customers[13].id, quoteNo: 'QT-2024-007', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 345000, totalCost: 185000, profitRate: 46.4, status: 'sent', validUntil: new Date('2024-12-10'), marginCheckPassed: true, createdById: chen.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[17].id, customerId: customers[6].id, quoteNo: 'QT-2024-008', version: 1, tradeTerm: 'CIF', currency: 'USD', exchangeRate: 7.24, totalAmount: 133500, totalCost: 67500, profitRate: 49.4, status: 'accepted', validUntil: new Date('2025-01-20'), marginCheckPassed: true, approvedBy: li.id, approvedAt: daysAgo(19), createdById: li.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[5].id, customerId: customers[5].id, quoteNo: 'QT-2024-009', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 42500, totalCost: 17500, profitRate: 58.8, status: 'draft', marginCheckPassed: true, createdById: chen.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[9].id, customerId: customers[9].id, quoteNo: 'QT-2024-010', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 38000, totalCost: 22000, profitRate: 42.1, status: 'pending', validUntil: new Date('2025-01-05'), marginCheckPassed: false, marginCheckReason: '利润率低于50%预警线', createdById: li.id } }),
    db.quotation.create({ data: { inquiryId: inquiries[3].id, customerId: customers[3].id, quoteNo: 'QT-2024-011', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 275000, totalCost: 110000, profitRate: 60.0, status: 'sent', validUntil: new Date('2025-01-20'), marginCheckPassed: true, createdById: chen.id } }),
    // 新增报价
    db.quotation.create({ data: { inquiryId: inquiries[21].id, customerId: customers[15].id, quoteNo: 'QT-2024-012', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 1525000, totalCost: 636000, profitRate: 58.3, status: 'accepted', validUntil: new Date('2025-02-15'), marginCheckPassed: true, createdById: chen.id, createdAt: daysAgo(55) } }),
    db.quotation.create({ data: { inquiryId: inquiries[24].id, customerId: customers[18].id, quoteNo: 'QT-2024-013', version: 1, tradeTerm: 'CIF', currency: 'USD', exchangeRate: 7.24, totalAmount: 357000, totalCost: 180000, profitRate: 49.6, status: 'accepted', validUntil: new Date('2025-02-28'), marginCheckPassed: true, approvedBy: li.id, approvedAt: daysAgo(60), createdById: li.id, createdAt: daysAgo(65) } }),
    db.quotation.create({ data: { inquiryId: inquiries[27].id, customerId: customers[16].id, quoteNo: 'QT-2024-014', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 110000, totalCost: 54000, profitRate: 50.9, status: 'sent', marginCheckPassed: true, createdById: li.id, createdAt: daysAgo(20) } }),
    db.quotation.create({ data: { inquiryId: inquiries[23].id, customerId: customers[17].id, quoteNo: 'QT-2024-015', version: 1, tradeTerm: 'FOB', currency: 'USD', exchangeRate: 7.24, totalAmount: 69200, totalCost: 41000, profitRate: 40.8, status: 'sent', marginCheckPassed: true, createdById: chen.id, createdAt: daysAgo(40) } }),
  ])

  // ============ QUOTATION ITEMS ============
  await Promise.all([
    db.quotationItem.create({ data: { quotationId: quotations[0].id, productId: products[0].id, productName: '智能蓝牙耳机 Pro', productSpec: '蓝牙5.3, ANC, IPX5', quantity: 50000, unit: 'PCS', unitPrice: 28.9, cost: 12.5, totalPrice: 1445000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[1].id, productId: products[1].id, productName: '纯棉T恤', productSpec: '180g纯棉, 多色', quantity: 100000, unit: 'PCS', unitPrice: 8.5, cost: 3.2, totalPrice: 850000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[2].id, productId: products[2].id, productName: '数控机床 V850', productSpec: '三轴, 850x500x500mm', quantity: 1, unit: 'SET', unitPrice: 14200, cost: 8500, totalPrice: 14200 } }),
    db.quotationItem.create({ data: { quotationId: quotations[3].id, productId: products[3].id, productName: 'LED户外路灯', productSpec: '100W, IP67', quantity: 2000, unit: 'PCS', unitPrice: 89, cost: 45, totalPrice: 178000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[4].id, productId: products[0].id, productName: '智能蓝牙耳机 Pro', productSpec: '蓝牙5.3, ANC', quantity: 10000, unit: 'PCS', unitPrice: 28.9, cost: 12.5, totalPrice: 289000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[4].id, productId: products[10].id, productName: '无线充电器 15W', productSpec: '15W快充, Qi', quantity: 10000, unit: 'PCS', unitPrice: 14.9, cost: 5.8, totalPrice: 149000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[5].id, productId: products[2].id, productName: '数控机床 V850', productSpec: '三轴, 850x500x500mm', quantity: 3, unit: 'SET', unitPrice: 15800, cost: 8500, totalPrice: 47400 } }),
    db.quotationItem.create({ data: { quotationId: quotations[6].id, productId: products[7].id, productName: '智能手表 S8', productSpec: '1.43" AMOLED', quantity: 3000, unit: 'PCS', unitPrice: 55, cost: 22, totalPrice: 165000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[6].id, productId: products[0].id, productName: '智能蓝牙耳机 Pro', productSpec: '蓝牙5.3', quantity: 2000, unit: 'PCS', unitPrice: 28.9, cost: 12.5, totalPrice: 57800 } }),
    db.quotationItem.create({ data: { quotationId: quotations[7].id, productId: products[3].id, productName: 'LED户外路灯', productSpec: '100W, IP67', quantity: 1500, unit: 'PCS', unitPrice: 89, cost: 45, totalPrice: 133500 } }),
    db.quotationItem.create({ data: { quotationId: quotations[8].id, productId: products[9].id, productName: '环保纸包装盒', productSpec: '350g铜版纸', quantity: 50000, unit: 'PCS', unitPrice: 0.85, cost: 0.35, totalPrice: 42500 } }),
    db.quotationItem.create({ data: { quotationId: quotations[9].id, productId: products[6].id, productName: '工业机器人手臂', productSpec: '6轴, 10kg', quantity: 1, unit: 'SET', unitPrice: 38000, cost: 22000, totalPrice: 38000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[10].id, productId: products[7].id, productName: '智能手表 S8', productSpec: '日文版定制', quantity: 5000, unit: 'PCS', unitPrice: 55, cost: 22, totalPrice: 275000 } }),
    // 新增报价项
    db.quotationItem.create({ data: { quotationId: quotations[11].id, productId: products[1].id, productName: '纯棉T恤', productSpec: '180g, 多色', quantity: 80000, unit: 'PCS', unitPrice: 8.5, cost: 3.2, totalPrice: 680000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[11].id, productId: products[5].id, productName: '防紫外线冲锋衣', productSpec: 'UPF50+, 三合一', quantity: 20000, unit: 'PCS', unitPrice: 38.5, cost: 15.8, totalPrice: 770000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[12].id, productId: products[3].id, productName: 'LED户外路灯', productSpec: '100W, 太阳能版', quantity: 3000, unit: 'PCS', unitPrice: 119, cost: 60, totalPrice: 357000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[13].id, productId: products[7].id, productName: '智能手表 S8', productSpec: '印度市场定制', quantity: 2000, unit: 'PCS', unitPrice: 55, cost: 22, totalPrice: 110000 } }),
    db.quotationItem.create({ data: { quotationId: quotations[14].id, productId: products[2].id, productName: '数控机床 V850', productSpec: '三轴联动', quantity: 2, unit: 'SET', unitPrice: 15800, cost: 8500, totalPrice: 31600 } }),
    db.quotationItem.create({ data: { quotationId: quotations[14].id, productId: products[6].id, productName: '工业机器人手臂', productSpec: '6轴, 10kg', quantity: 1, unit: 'SET', unitPrice: 37600, cost: 22000, totalPrice: 37600 } }),
  ])

  // ============ ORDERS (10 original + 5 new = 15) ============
  const orders = await Promise.all([
    db.order.create({ data: { quotationId: quotations[0].id, customerId: customers[0].id, orderNo: 'ORD-2024-001', piNo: 'PI-2024-001', status: 'shipped', totalAmount: 1445000, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-01-15'), paidAmount: 433500, createdById: chen.id, createdAt: daysAgo(85) } }),
    db.order.create({ data: { quotationId: quotations[3].id, customerId: customers[6].id, orderNo: 'ORD-2024-002', piNo: 'PI-2024-002', status: 'completed', totalAmount: 178000, currency: 'USD', paymentTerm: '50% T/T advance, 50% after delivery', deliveryDate: new Date('2024-11-30'), paidAmount: 178000, createdById: li.id, createdAt: daysAgo(110) } }),
    db.order.create({ data: { quotationId: quotations[5].id, customerId: customers[9].id, orderNo: 'ORD-2024-003', piNo: 'PI-2024-003', status: 'in_production', totalAmount: 47400, currency: 'USD', paymentTerm: '40% T/T advance, 60% before shipment', deliveryDate: new Date('2025-02-28'), paidAmount: 18960, createdById: li.id, createdAt: daysAgo(18) } }),
    db.order.create({ data: { quotationId: quotations[7].id, customerId: customers[6].id, orderNo: 'ORD-2024-004', piNo: 'PI-2024-004', status: 'confirmed', totalAmount: 133500, currency: 'USD', paymentTerm: '50% T/T advance, 50% after delivery', deliveryDate: new Date('2025-03-15'), paidAmount: 66750, createdById: li.id, createdAt: daysAgo(15) } }),
    db.order.create({ data: { quotationId: quotations[4].id, customerId: customers[8].id, orderNo: 'ORD-2024-005', piNo: 'PI-2024-005', status: 'pending', totalAmount: 628000, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-03-01'), paidAmount: 188400, createdById: chen.id, createdAt: daysAgo(40) } }),
    db.order.create({ data: { customerId: customers[0].id, orderNo: 'ORD-2024-006', piNo: 'PI-2024-006', status: 'ready', totalAmount: 89000, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-01-20'), paidAmount: 26700, createdById: chen.id, createdAt: daysAgo(50) } }),
    db.order.create({ data: { customerId: customers[1].id, orderNo: 'ORD-2024-007', piNo: 'PI-2024-007', status: 'in_production', totalAmount: 425000, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-02-15'), paidAmount: 127500, createdById: chen.id, createdAt: daysAgo(60) } }),
    db.order.create({ data: { customerId: customers[8].id, orderNo: 'ORD-2024-008', piNo: 'PI-2024-008', status: 'pending', totalAmount: 302000, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-04-01'), paidAmount: 90600, createdById: chen.id, createdAt: daysAgo(35) } }),
    db.order.create({ data: { customerId: customers[12].id, orderNo: 'ORD-2024-009', piNo: 'PI-2024-009', status: 'cancelled', totalAmount: 55000, currency: 'USD', paymentTerm: 'T/T advance', createdById: chen.id, createdAt: daysAgo(90) } }),
    db.order.create({ data: { customerId: customers[2].id, orderNo: 'ORD-2024-010', piNo: 'PI-2024-010', status: 'pending', totalAmount: 498000, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-03-20'), paidAmount: 149400, createdById: chen.id, createdAt: daysAgo(25) } }),
    // --- 5个新订单 ---
    db.order.create({ data: { quotationId: quotations[11].id, customerId: customers[15].id, orderNo: 'ORD-2024-011', piNo: 'PI-2024-011', status: 'in_production', totalAmount: 1525000, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-04-10'), paidAmount: 457500, createdById: chen.id, createdAt: daysAgo(50) } }),
    db.order.create({ data: { quotationId: quotations[12].id, customerId: customers[18].id, orderNo: 'ORD-2024-012', piNo: 'PI-2024-012', status: 'shipped', totalAmount: 357000, currency: 'USD', paymentTerm: 'L/C at sight', deliveryDate: new Date('2025-02-01'), paidAmount: 178500, createdById: li.id, createdAt: daysAgo(60) } }),
    db.order.create({ data: { customerId: customers[16].id, orderNo: 'ORD-2024-013', piNo: 'PI-2024-013', status: 'pending', totalAmount: 45000, currency: 'USD', paymentTerm: '50% T/T advance, 50% before shipment', deliveryDate: new Date('2025-05-01'), paidAmount: 22500, createdById: li.id, createdAt: daysAgo(15) } }),
    db.order.create({ data: { quotationId: quotations[14].id, customerId: customers[17].id, orderNo: 'ORD-2024-014', piNo: 'PI-2024-014', status: 'confirmed', totalAmount: 69200, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-05-15'), paidAmount: 20760, createdById: chen.id, createdAt: daysAgo(30) } }),
    db.order.create({ data: { customerId: customers[19].id, orderNo: 'ORD-2024-015', piNo: 'PI-2024-015', status: 'pending', totalAmount: 125000, currency: 'USD', paymentTerm: '30% T/T advance, 70% before shipment', deliveryDate: new Date('2025-06-01'), paidAmount: 0, createdById: chen.id, createdAt: daysAgo(5) } }),
  ])

  // ============ PAYMENTS (9 original + 10 new = 19) ============
  await Promise.all([
    // 原有9个付款
    db.payment.create({ data: { orderId: orders[0].id, amount: 433500, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(85), dueDate: daysAgo(85), status: 'partial', notes: '30% advance payment received' } }),
    db.payment.create({ data: { orderId: orders[0].id, amount: 1011500, currency: 'USD', paymentMethod: 'T/T', paymentDate: null, dueDate: new Date(Date.now() + 5 * 86400000), status: 'pending', notes: '70% balance before shipment' } }),
    db.payment.create({ data: { orderId: orders[1].id, amount: 89000, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(110), dueDate: daysAgo(110), status: 'partial', notes: '50% advance' } }),
    db.payment.create({ data: { orderId: orders[1].id, amount: 89000, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(19), dueDate: daysAgo(15), status: 'completed', notes: '50% after delivery' } }),
    db.payment.create({ data: { orderId: orders[2].id, amount: 18960, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(18), dueDate: daysAgo(18), status: 'partial', notes: '40% advance' } }),
    db.payment.create({ data: { orderId: orders[3].id, amount: 66750, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(15), dueDate: daysAgo(15), status: 'partial', notes: '50% advance' } }),
    db.payment.create({ data: { orderId: orders[4].id, amount: 188400, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(40), dueDate: daysAgo(38), status: 'partial', notes: '30% advance' } }),
    db.payment.create({ data: { orderId: orders[5].id, amount: 26700, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(50), dueDate: daysAgo(50), status: 'partial', notes: '30% advance' } }),
    db.payment.create({ data: { orderId: orders[6].id, amount: 127500, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(60), dueDate: daysAgo(60), status: 'partial', notes: '30% advance' } }),
    // --- 10个新付款 ---
    db.payment.create({ data: { orderId: orders[7].id, amount: 90600, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(35), dueDate: daysAgo(33), status: 'partial', notes: '30% advance for BrightStar Q1 order' } }),
    db.payment.create({ data: { orderId: orders[9].id, amount: 149400, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(25), dueDate: daysAgo(25), status: 'partial', notes: '30% advance for Al-Yamama' } }),
    db.payment.create({ data: { orderId: orders[10].id, amount: 457500, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(50), dueDate: daysAgo(48), status: 'partial', notes: '30% advance for Tropical Trade' } }),
    db.payment.create({ data: { orderId: orders[11].id, amount: 178500, currency: 'USD', paymentMethod: 'L/C', paymentDate: daysAgo(55), dueDate: daysAgo(50), status: 'partial', notes: 'L/C partial payment - Siam Green Energy' } }),
    db.payment.create({ data: { orderId: orders[12].id, amount: 22500, currency: 'USD', paymentMethod: 'PayPal', paymentDate: daysAgo(15), dueDate: daysAgo(14), status: 'partial', notes: '50% advance via PayPal - Sharma Electronics' } }),
    db.payment.create({ data: { orderId: orders[13].id, amount: 20760, currency: 'USD', paymentMethod: 'T/T', paymentDate: daysAgo(30), dueDate: daysAgo(28), status: 'partial', notes: '30% advance for GMI Mexico' } }),
    db.payment.create({ data: { orderId: orders[0].id, amount: 500000, currency: 'USD', paymentMethod: 'T/T', paymentDate: null, dueDate: daysAgo(10), status: 'overdue', notes: '部分尾款逾期 - TechVista已催收' } }),
    db.payment.create({ data: { orderId: orders[4].id, amount: 200000, currency: 'USD', paymentMethod: 'T/T', paymentDate: null, dueDate: daysAgo(5), status: 'overdue', notes: 'BrightStar 70%尾款逾期' } }),
    db.payment.create({ data: { orderId: orders[6].id, amount: 150000, currency: 'USD', paymentMethod: 'Western Union', paymentDate: null, dueDate: daysAgo(3), status: 'overdue', notes: 'GlobalTex 70%尾款逾期' } }),
    db.payment.create({ data: { orderId: orders[11].id, amount: 178500, currency: 'USD', paymentMethod: 'L/C', paymentDate: null, dueDate: new Date(Date.now() + 30 * 86400000), status: 'pending', notes: 'L/C remaining balance - Siam Green Energy' } }),
  ])

  // ============ ACTIVITIES (18 original + 20 new = 38) ============
  await Promise.all([
    // 原有18个活动
    db.activity.create({ data: { type: 'email', subject: '发送报价单QT-2024-001', content: '向TechVista发送了蓝牙耳机年度报价', entityType: 'inquiry', entityId: inquiries[0].id, userId: chen.id, createdAt: daysAgo(80) } }),
    db.activity.create({ data: { type: 'call', subject: '电话跟进德国客户', content: '与Hans Müller通话30分钟，讨论T恤交期', entityType: 'inquiry', entityId: inquiries[1].id, userId: chen.id, createdAt: daysAgo(75) } }),
    db.activity.create({ data: { type: 'meeting', subject: '展会客户洽谈', content: 'GITEX展会与Al-Yamama公司洽谈储能电源合作', entityType: 'inquiry', entityId: inquiries[2].id, userId: chen.id, createdAt: daysAgo(70) } }),
    db.activity.create({ data: { type: 'note', subject: '日本客户特殊要求', content: 'Sakura需要日语包装和PSE认证', entityType: 'inquiry', entityId: inquiries[3].id, userId: chen.id, createdAt: daysAgo(65) } }),
    db.activity.create({ data: { type: 'email', subject: '路灯项目报价审批通过', content: '经理批准了LED路灯项目报价', entityType: 'quotation', entityId: quotations[3].id, userId: li.id, createdAt: daysAgo(90) } }),
    db.activity.create({ data: { type: 'follow_up', subject: 'BrightStar订单确认', content: '客户确认了Q1订单数量，等待正式PO', entityType: 'inquiry', entityId: inquiries[8].id, userId: chen.id, createdAt: daysAgo(20) } }),
    db.activity.create({ data: { type: 'system', subject: '订单ORD-2024-001已发货', content: 'TechVista蓝牙耳机订单已从深圳发出', entityType: 'order', entityId: orders[0].id, userId: null, createdAt: daysAgo(7) } }),
    db.activity.create({ data: { type: 'email', subject: 'CNC机床新版本报价', content: '向AfroTech发送降价后的V2报价', entityType: 'quotation', entityId: quotations[2].id, userId: li.id, createdAt: daysAgo(45) } }),
    db.activity.create({ data: { type: 'meeting', subject: '月度销售会议', content: '讨论本月销售目标和重点跟进客户', entityType: null, entityId: null, userId: li.id, createdAt: daysAgo(12) } }),
    db.activity.create({ data: { type: 'call', subject: '催收尾款', content: '提醒BrightStar支付70%尾款', entityType: 'order', entityId: orders[0].id, userId: zhao.id, createdAt: daysAgo(15) } }),
    db.activity.create({ data: { type: 'note', subject: '瑞典项目二期需求确认', content: 'EuroLight确认需要追加1500盏路灯', entityType: 'inquiry', entityId: inquiries[17].id, userId: li.id, createdAt: daysAgo(35) } }),
    db.activity.create({ data: { type: 'follow_up', subject: '韩国市场竞品分析', content: '整理韩国市场智能穿戴产品竞品价格对比', entityType: 'inquiry', entityId: inquiries[13].id, userId: chen.id, createdAt: daysAgo(30) } }),
    db.activity.create({ data: { type: 'email', subject: '样品寄送确认', content: '竹纤维毛巾样品已寄往孟买', entityType: 'inquiry', entityId: inquiries[7].id, userId: chen.id, createdAt: daysAgo(25) } }),
    db.activity.create({ data: { type: 'system', subject: '报价即将过期提醒', content: 'QT-2024-003将于12月15日过期', entityType: 'quotation', entityId: quotations[2].id, userId: null, createdAt: daysAgo(3) } }),
    db.activity.create({ data: { type: 'follow_up', subject: 'Müller工业机器人需求', content: 'Klaus Weber要求提供更详细的技术参数和CE认证文件', entityType: 'inquiry', entityId: inquiries[9].id, userId: li.id, createdAt: daysAgo(10) } }),
    db.activity.create({ data: { type: 'email', subject: '季度报价更新', content: '向Pacific Rim发送更新后的产品报价', entityType: 'inquiry', entityId: inquiries[12].id, userId: chen.id, createdAt: daysAgo(8) } }),
    db.activity.create({ data: { type: 'note', subject: '迪拜展会后续行动项', content: '整理GITEX展会名片和客户需求，分配跟进任务', entityType: null, entityId: null, userId: li.id, createdAt: daysAgo(5) } }),
    db.activity.create({ data: { type: 'system', subject: '逾期付款提醒', content: 'TechVista ORD-2024-001尾款逾期', entityType: 'order', entityId: orders[0].id, userId: null, createdAt: daysAgo(2) } }),
    // --- 20个新活动 ---
    db.activity.create({ data: { type: 'email', subject: '发送巴西T恤订单确认函', content: '向Tropical Trade发送广交会后的正式订单确认', entityType: 'order', entityId: orders[10].id, userId: chen.id, createdAt: daysAgo(48) } }),
    db.activity.create({ data: { type: 'call', subject: '印度Sharma电话沟通报价', content: '与Vikram Sharma讨论蓝牙耳机价格，对方要求5%折扣', entityType: 'inquiry', entityId: inquiries[22].id, userId: li.id, createdAt: daysAgo(40) } }),
    db.activity.create({ data: { type: 'meeting', subject: '泰国路灯项目线上会议', content: '与Siam Green Energy Somchai召开视频会议，确认太阳能路灯技术参数', entityType: 'inquiry', entityId: inquiries[24].id, userId: li.id, createdAt: daysAgo(65) } }),
    db.activity.create({ data: { type: 'email', subject: '墨西哥CNC机床报价发送', content: '向GMI Mexico发送CNC V850和机器人手臂的联合报价', entityType: 'quotation', entityId: quotations[14].id, userId: chen.id, createdAt: daysAgo(38) } }),
    db.activity.create({ data: { type: 'follow_up', subject: '越南家居用品合作跟进', content: '与Nguyen Van Minh确认竹纤维毛巾需求细节和交期要求', entityType: 'inquiry', entityId: inquiries[25].id, userId: chen.id, createdAt: daysAgo(20) } }),
    db.activity.create({ data: { type: 'note', subject: '巴西客户付款问题', content: 'Tropical Trade要求30天账期，需要管理层审批', entityType: 'order', entityId: orders[10].id, userId: zhao.id, createdAt: daysAgo(45) } }),
    db.activity.create({ data: { type: 'system', subject: '泰国路灯订单已发货', content: 'Siam Green Energy的3000盏太阳能路灯已发货', entityType: 'order', entityId: orders[11].id, userId: null, createdAt: daysAgo(8) } }),
    db.activity.create({ data: { type: 'email', subject: '印度智能手表报价发送', content: '向Sharma Electronics发送2000台智能手表定制报价', entityType: 'quotation', entityId: quotations[13].id, userId: li.id, createdAt: daysAgo(18) } }),
    db.activity.create({ data: { type: 'call', subject: '泰国客户到货确认', content: 'Somchai确认路灯已到曼谷仓库，质量满意', entityType: 'order', entityId: orders[11].id, userId: li.id, createdAt: daysAgo(5) } }),
    db.activity.create({ data: { type: 'meeting', subject: 'Q4销售总结会议', content: '全团队参加Q4销售总结，讨论2025年Q1计划', entityType: null, entityId: null, userId: li.id, createdAt: daysAgo(3) } }),
    db.activity.create({ data: { type: 'follow_up', subject: '墨西哥设备选型跟进', content: 'Roberto Garcia要求现场技术演示，安排下月视频演示', entityType: 'inquiry', entityId: inquiries[23].id, userId: chen.id, createdAt: daysAgo(35) } }),
    db.activity.create({ data: { type: 'email', subject: '巴西客户LED灯具需求跟进', content: '回复Tropical Trade关于LED路灯的询价，提供初步方案', entityType: 'inquiry', entityId: inquiries[26].id, userId: chen.id, createdAt: daysAgo(8) } }),
    db.activity.create({ data: { type: 'system', subject: '逾期付款批量提醒', content: '3笔付款逾期，涉及TechVista、BrightStar、GlobalTex', entityType: null, entityId: null, userId: null, createdAt: daysAgo(1) } }),
    db.activity.create({ data: { type: 'note', subject: '越南T恤大单机会', content: 'Vietnam Home Goods需要20万件T恤，可能是今年最大单笔订单', entityType: 'inquiry', entityId: inquiries[30].id, userId: chen.id, createdAt: daysAgo(2) } }),
    db.activity.create({ data: { type: 'call', subject: '泰国储能电源需求确认', content: '与Siam Green Energy确认1000台储能电源的交付时间线', entityType: 'inquiry', entityId: inquiries[28].id, userId: li.id, createdAt: daysAgo(3) } }),
    db.activity.create({ data: { type: 'email', subject: '催收GlobalTex尾款', content: '第三次发邮件催收GlobalTex T恤订单70%尾款', entityType: 'order', entityId: orders[6].id, userId: zhao.id, createdAt: daysAgo(2) } }),
    db.activity.create({ data: { type: 'follow_up', subject: '墨西哥包装盒需求确认', content: 'GMI Mexico确认需要10万个包装盒，待提供设计文件', entityType: 'inquiry', entityId: inquiries[29].id, userId: chen.id, createdAt: daysAgo(10) } }),
    db.activity.create({ data: { type: 'system', subject: '订单ORD-2024-011进入生产', content: 'Tropical Trade巴西订单已安排生产线', entityType: 'order', entityId: orders[10].id, userId: null, createdAt: daysAgo(40) } }),
    db.activity.create({ data: { type: 'meeting', subject: '新客户开发策略会议', content: '讨论东南亚和南美市场新客户开发策略', entityType: null, entityId: null, userId: li.id, createdAt: daysAgo(7) } }),
    db.activity.create({ data: { type: 'email', subject: 'Sharma Electronics样品确认', content: '印度客户确认智能手表样品质量满意，准备下单', entityType: 'inquiry', entityId: inquiries[27].id, userId: li.id, createdAt: daysAgo(4) } }),
  ])

  // ============ SAMPLES ============
  await Promise.all([
    db.sample.create({ data: { customerId: customers[0].id, inquiryId: inquiries[0].id, productName: '智能蓝牙耳机 Pro', quantity: 5, status: 'confirmed', trackingNo: 'SF1234567890', shippingMethod: 'DHL Express', sentAt: daysAgo(95), deliveredAt: daysAgo(88), testResult: '音质测试通过，降噪效果满意' } }),
    db.sample.create({ data: { customerId: customers[7].id, inquiryId: inquiries[7].id, productName: '竹纤维毛巾套装', quantity: 3, status: 'sent', trackingNo: 'SF2345678901', shippingMethod: 'FedEx', sentAt: daysAgo(14) } }),
    db.sample.create({ data: { customerId: customers[3].id, inquiryId: inquiries[3].id, productName: '智能手表 S8', quantity: 2, status: 'in_transit', trackingNo: 'SF3456789012', shippingMethod: 'UPS Express', sentAt: daysAgo(10) } }),
    db.sample.create({ data: { customerId: customers[9].id, inquiryId: inquiries[9].id, productName: '工业机器人手臂', quantity: 1, status: 'approved', notes: '客户批准样品，准备下单' } }),
    db.sample.create({ data: { customerId: customers[10].id, inquiryId: inquiries[10].id, productName: '竹纤维毛巾套装', quantity: 2, status: 'pending', notes: '等待确认地址后寄送' } }),
    db.sample.create({ data: { customerId: customers[6].id, inquiryId: inquiries[17].id, productName: 'LED户外路灯', quantity: 1, status: 'delivered', trackingNo: 'SF4567890123', shippingMethod: 'DHL Express', sentAt: daysAgo(100), deliveredAt: daysAgo(93), testResult: '亮度、防水和耐久性全部通过' } }),
    db.sample.create({ data: { customerId: customers[5].id, inquiryId: inquiries[5].id, productName: '环保纸包装盒', quantity: 10, status: 'testing', sentAt: daysAgo(7), notes: '客户正在测试印刷质量和材质' } }),
  ])

  console.log('\u2705 增强种子数据完成!')
  console.log(`\ud83d\udc64 用户: ${users.length}`)
  console.log(`\ud83c\udfe2 客户: ${customers.length}`)
  console.log(`\ud83d\udc65 联系人: ${contacts.length}`)
  console.log(`\ud83d\udce6 产品: ${products.length}`)
  console.log(`\ud83d\udce7 询盘: ${inquiries.length}`)
  console.log(`\ud83d\udcb0 报价: ${quotations.length}`)
  console.log(`\ud83d\udccb 订单: ${orders.length}`)
  console.log(`\ud83d\udcb3 付款: ${await db.payment.count()}`)
  console.log(`\ud83d\udcdd 活动: ${await db.activity.count()}`)
  console.log(`\ud83e\uddea 样品: ${await db.sample.count()}`)
}

main()
  .catch((e) => {
    console.error('\u274c Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
