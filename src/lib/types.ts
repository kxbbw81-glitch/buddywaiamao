// ============ User Roles ============
export type UserRole = 'super_admin' | 'management' | 'sales_manager' | 'sales' | 'finance'

// ============ Navigation ============
export type ModuleKey =
  | 'workbench'
  | 'acquisition'
  | 'customer'
  | 'pipeline'
  | 'comms'
  | 'product'
  | 'quote'
  | 'fulfillment'
  | 'finance'
  | 'aihub'
  | 'tools'
  | 'insight'
  | 'system'
  | 'inquiries'
  | 'customers'
  | 'customer_map'
  | 'products'
  | 'quotations'
  | 'samples'
  | 'orders'
  | 'payments'
  | 'analytics'
  | 'social_media'
  | 'data_screen'
  | 'settings'
  | 'activities'
  | 'user_management'
  | 'opportunities'
  | 'ai_config'
  | 'followup_tasks'
  | 'aftersales'
  | 'customer_profile'
  | 'commission'
  | 'operating_brief'
  | 'exchange_converter'
  | 'hs_lookup'
  | 'followup_copy'
  | 'approvals'
  | 'morning_view'
  | 'rag_qa'
  | 'business_card_ocr'
  | 'database_maintenance'

export interface NavItem {
  key: ModuleKey
  label: string
  icon: string
  roles?: UserRole[]
}

// ============ Status Enums ============
export type InquiryStatus = 'new' | 'assigned' | 'following' | 'quoted' | 'won' | 'lost' | 'pooled' | 'closed'
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled' | 'pending'
export type OrderStatus = 'pending' | 'confirmed' | 'in_production' | 'ready' | 'shipped' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'partial' | 'completed' | 'overdue'
export type SampleStatus = 'pending' | 'approved' | 'sent' | 'in_transit' | 'delivered' | 'testing' | 'confirmed' | 'rejected'
export type CustomerLevel = 'A' | 'B' | 'C' | 'D'
export type CustomerStatus = 'active' | 'inactive' | 'lost'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type InquirySource = 'email' | 'website' | 'whatsapp' | 'exhibition' | 'b2b_alibaba' | 'linkedin' | 'social_media'
export type TradeTerm = 'FOB' | 'CIF' | 'EXW' | 'DDP'
export type PaymentMethod = 'T/T' | 'L/C' | 'Western Union' | 'PayPal'
export type SocialPlatform = 'linkedin' | 'facebook' | 'twitter' | 'instagram' | 'alibaba'
export type SocialPostStatus = 'draft' | 'scheduled' | 'published' | 'failed'

// ============ Status Labels (Chinese) ============
export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: '新询盘',
  assigned: '已分配',
  following: '跟进中',
  quoted: '已报价',
  won: '已成交',
  lost: '已流失',
  pooled: '公海',
  closed: '已关闭',
}

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: '草稿',
  pending: '待审批',
  sent: '已发送',
  accepted: '已接受',
  rejected: '已拒绝',
  expired: '已过期',
  cancelled: '已取消',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  in_production: '生产中',
  ready: '待发货',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: '待付款',
  partial: '部分付款',
  completed: '已付清',
  overdue: '逾期',
}

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  pending: '待处理',
  approved: '已批准',
  sent: '已寄出',
  in_transit: '运输中',
  delivered: '已送达',
  testing: '测试中',
  confirmed: '已确认',
  rejected: '已拒绝',
}

export const CUSTOMER_LEVEL_LABELS: Record<CustomerLevel, string> = {
  A: 'A级客户',
  B: 'B级客户',
  C: 'C级客户',
  D: 'D级客户',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

export const INQUIRY_SOURCE_LABELS: Record<string, string> = {
  email: '邮件',
  website: '官网',
  whatsapp: 'WhatsApp',
  exhibition: '展会',
  b2b_alibaba: 'B2B平台',
  linkedin: 'LinkedIn',
  social_media: '社交媒体',
  manual: '手动录入',
  referral: '客户介绍',
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  twitter: 'Twitter',
  instagram: 'Instagram',
  alibaba: '阿里巴巴',
}

export const SOCIAL_POST_STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: '草稿',
  scheduled: '已排期',
  published: '已发布',
  failed: '发布失败',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  management: '管理层',
  sales_manager: '销售经理',
  sales: '销售专员',
  finance: '财务',
}

export const MODULE_LABELS: Record<string, string> = {
  workbench: '工作台',
  acquisition: '获客中心',
  customer: '客户管理',
  pipeline: '商机中心',
  comms: '沟通中心',
  product: '产品知识库',
  quote: '报价中心',
  fulfillment: '订单履约',
  finance: '财务经营',
  aihub: 'AI Agent',
  tools: '工具中心',
  insight: '数据洞察',
  system: '系统管理',
  inquiries: '目标线索',
  opportunities: '销售管道',
  ai_config: 'AI 配置',
  followup_tasks: '跟进任务',
  aftersales: '售后与复购',
  customers: '客户档案',
  customer_map: '客户地图',
  products: '产品资料库',
  quotations: '报价管理',
  samples: '样品管理',
  orders: '合同订单',
  payments: '收款管理',
  analytics: '数据分析',
  social_media: '社媒运营',
  data_screen: '数据大屏',
  settings: '系统设置',
  activities: '活动记录',
  user_management: '权限中心',
  customer_profile: '客户画像',
  commission: '提成与对账',
  operating_brief: '经营简报',
  exchange_converter: '汇率换算',
  hs_lookup: 'HS编码速查',
  followup_copy: '跟进话术生成',
}

// ============ Dashboard Types ============
export interface DashboardKPI {
  id: string
  label: string
  value: string | number
  change?: number
  changeType?: 'increase' | 'decrease'
  icon?: string
}

export interface RiskAlert {
  id: string
  type: 'overdue_payment' | 'low_margin' | 'expiring_quotation' | 'unassigned_inquiry'
  level: 'warning' | 'danger' | 'info'
  message: string
  entityType?: string
  entityId?: string
}

export interface SalesFunnel {
  stage: string
  count: number
  value: number
}

export interface RevenueByCountry {
  country: string
  revenue: number
}

// ============ API Response Types ============
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ============ Form Types ============
export interface CustomerFormData {
  companyName: string
  companyNameEn?: string
  country?: string
  city?: string
  website?: string
  industry?: string
  customerLevel: CustomerLevel
  source: string
  tags?: string
  notes?: string
  ownerId?: string
  contacts?: ContactFormData[]
}

export interface ContactFormData {
  name: string
  email?: string
  phone?: string
  whatsapp?: string
  position?: string
  isDecisionMaker?: boolean
  notes?: string
}

export interface InquiryFormData {
  customerId?: string
  source: string
  subject: string
  content?: string
  language?: string
  priority: Priority
}

export interface QuotationFormData {
  customerId: string
  inquiryId?: string
  tradeTerm: TradeTerm
  currency: string
  exchangeRate: number
  validUntil?: string
  notes?: string
  items: QuotationItemFormData[]
}

export interface QuotationItemFormData {
  productId?: string
  productName: string
  productSpec?: string
  quantity: number
  unit: string
  unitPrice: number
  cost: number
}

export interface OrderFormData {
  customerId: string
  quotationId?: string
  totalAmount: number
  currency: string
  paymentTerm?: string
  deliveryDate?: string
}

export interface ProductFormData {
  productCode: string
  name: string
  nameEn?: string
  category?: string
  specification?: string
  unit: string
  costPrice: number
  standardPrice: number
  minPrice: number
  description?: string
  keywords?: string
  imageUrl?: string
}

// ============ AI Chat ============
export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface AIChatRequest {
  message: string
  context?: string
}

// ============ Store Types ============
export interface CRMFilters {
  inquiryStatus?: string
  quotationStatus?: string
  orderStatus?: string
  customerLevel?: string
  customerStatus?: string
  customerCountry?: string
  productCategory?: string
  paymentStatus?: string
  sampleStatus?: string
  priority?: string
  source?: string
  dateRange?: string
}
