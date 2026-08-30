import { scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const clone = (value) => structuredClone(value)

async function passwordHash(password) {
  const salt = 'nexfab-memory-test-salt'
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString('hex')}`
}

function matches(where, row, owner) {
  if (!where || !Object.keys(where).length) return true
  if (where.AND) return where.AND.every((item) => matches(item, row, owner))
  if (where.OR) return where.OR.some((item) => matches(item, row, owner))
  return Object.entries(where).every(([key, value]) => {
    if (key === 'owner') return matches(value, owner || {}, undefined)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Object.prototype.hasOwnProperty.call(value, 'not')) return row[key] !== value.not
      if (Array.isArray(value.in)) return value.in.includes(row[key])
      // 修复说明：[低危-测试保真度]，原因：mock 不支持 gte/lte/gt/lt 范围操作符，带时间过滤的查询与真实数据库结果不一致；按真实语义补齐。
      const RANGE_OPERATORS = { gte: (a, b) => a >= b, lte: (a, b) => a <= b, gt: (a, b) => a > b, lt: (a, b) => a < b }
      for (const [operator, compare] of Object.entries(RANGE_OPERATORS)) {
        if (Object.prototype.hasOwnProperty.call(value, operator)) return row[key] != null && compare(row[key], value[operator])
      }
    }
    return row[key] === value
  })
}

export async function createMemoryPrisma() {
  const state = { nextId: 1, users: [], teams: [], customers: [], customerFingerprints: [], contacts: [], opportunities: [], followUps: [], leads: [], leadFollowUps: [], inquiries: [], inquiryItems: [], channelMessages: [], todos: [], memos: [], productCategories: [], products: [], productDocs: [], quoteRuleSets: [], quotes: [], quoteVersions: [], quoteApprovals: [], salesOrders: [], orderItems: [], fulfillmentEvents: [], orderPayments: [], tradeDocuments: [], shipments: [], commissionRecords: [], knowledgeDocuments: [], knowledgeChunks: [], promptTemplates: [], aiOutputSchemas: [], aiCapabilityContracts: [], promptEvalSets: [], promptEvalCases: [], aiPolicyRules: [], aiCostLimits: [], aiTasks: [], aiCitations: [], aiFeedbacks: [], toolCalls: [], automationRules: [], automationRuns: [], notifications: [], integrationConnections: [], webhookEvents: [], socialAccounts: [], socialPosts: [], socialInteractions: [], communicationEvents: [], sampleRequests: [], auditLogs: [] }
  const id = (prefix) => `${prefix}-${state.nextId++}`
  const team = { id: 'team-1', name: '销售一组', managerId: 'manager-1' }
  state.teams.push(team)
  const hash = await passwordHash('TestOnly#Password1')
  state.users.push(
    { id: 'admin-1', email: 'admin@nexfab.test', name: '管理员', passwordHash: hash, role: 'ADMIN', status: 'ACTIVE', teamId: null },
    { id: 'manager-1', email: 'manager@nexfab.test', name: '销售经理', passwordHash: hash, role: 'MANAGER', status: 'ACTIVE', teamId: 'team-1' },
    { id: 'sales-1', email: 'sales@nexfab.test', name: '销售专员', passwordHash: hash, role: 'SALES', status: 'ACTIVE', teamId: 'team-1' },
    { id: 'finance-1', email: 'finance@nexfab.test', name: '财务专员', passwordHash: hash, role: 'FINANCE', status: 'ACTIVE', teamId: null },
    { id: 'exec-1', email: 'exec@nexfab.test', name: '管理层', passwordHash: hash, role: 'EXEC', status: 'ACTIVE', teamId: null },
  )
  const ownerFor = (ownerId) => state.users.find((user) => user.id === ownerId)
  const publicOwner = (ownerId, fields = ['id', 'name', 'teamId']) => Object.fromEntries(fields.map((field) => [field, ownerFor(ownerId)?.[field]]))
  const enrichCustomer = (customer) => ({ ...clone(customer), owner: publicOwner(customer.ownerId), _count: { contacts: state.contacts.filter((item) => item.customerId === customer.id).length, opportunities: state.opportunities.filter((item) => item.customerId === customer.id).length } })
  const enrichCustomerFingerprint = (fingerprint) => ({ ...clone(fingerprint), customer: enrichCustomer(state.customers.find((customer) => customer.id === fingerprint.customerId)) })
  const enrichOpportunity = (opportunity) => ({ ...clone(opportunity), owner: publicOwner(opportunity.ownerId, ['id', 'name']), customer: enrichCustomer(state.customers.find((customer) => customer.id === opportunity.customerId)) })
  const filteredCustomers = (where) => state.customers.filter((row) => matches(where, row, ownerFor(row.ownerId)))
  const filteredCustomerFingerprints = (where) => state.customerFingerprints.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    if (where.AND) return where.AND.every((item) => filteredCustomerFingerprints(item).some((entry) => entry.id === row.id))
    if (where.OR) return where.OR.some((item) => filteredCustomerFingerprints(item).some((entry) => entry.id === row.id))
    const { customer, ...fingerprintWhere } = where
    const matchesFingerprint = matches(fingerprintWhere, row)
    if (!matchesFingerprint) return false
    return !customer || matches(customer, state.customers.find((item) => item.id === row.customerId), ownerFor(state.customers.find((item) => item.id === row.customerId)?.ownerId))
  })
  const filteredOpportunities = (where) => state.opportunities.filter((row) => matches(where, row, ownerFor(row.ownerId)))
  const categoryFor = (categoryId) => state.productCategories.find((item) => item.id === categoryId)
  const enrichProduct = (product) => ({ ...clone(product), category: clone(categoryFor(product.categoryId)), _count: { docs: state.productDocs.filter((item) => item.productId === product.id).length } })
  const enrichQuote = (quote) => ({
    ...clone(quote),
    customer: enrichCustomer(state.customers.find((customer) => customer.id === quote.customerId)),
    opportunity: quote.opportunityId ? clone(state.opportunities.find((item) => item.id === quote.opportunityId) || null) : null,
    owner: publicOwner(quote.ownerId, ['id', 'name']),
    createdBy: publicOwner(quote.createdById, ['id', 'name']),
    _count: { versions: state.quoteVersions.filter((item) => item.quoteId === quote.id).length },
  })
  const enrichQuoteRuleSet = (ruleSet) => ({ ...clone(ruleSet), createdBy: publicOwner(ruleSet.createdById, ['id', 'name']) })
  const quoteOwner = (quote) => ownerFor(state.customers.find((customer) => customer.id === quote.customerId)?.ownerId)
  const filteredQuotes = (where) => state.quotes.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    if (where.customer) return matches(where.customer, state.customers.find((customer) => customer.id === row.customerId), quoteOwner(row))
    return matches(where, row)
  })
  const enrichSalesOrder = (order) => ({
    ...clone(order),
    customer: enrichCustomer(state.customers.find((customer) => customer.id === order.customerId)),
    quote: clone(state.quotes.find((quote) => quote.id === order.quoteId) || null),
    owner: publicOwner(order.ownerId, ['id', 'name', 'email', 'role', 'teamId']),
    createdBy: publicOwner(order.createdById, ['id', 'name', 'email', 'role', 'teamId']),
    _count: { items: state.orderItems.filter((item) => item.salesOrderId === order.id).length, fulfillmentEvents: state.fulfillmentEvents.filter((item) => item.salesOrderId === order.id).length, payments: state.orderPayments.filter((item) => item.salesOrderId === order.id).length, shipments: state.shipments.filter((item) => item.salesOrderId === order.id).length },
  })
  const orderOwner = (order) => ownerFor(state.customers.find((customer) => customer.id === order.customerId)?.ownerId)
  const filteredSalesOrders = (where) => state.salesOrders.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    if (where.customer) return matches(where.customer, state.customers.find((customer) => customer.id === row.customerId), orderOwner(row))
    return matches(where, row)
  })
  const enrichOrderPayment = (payment) => ({
    ...clone(payment),
    salesOrder: enrichSalesOrder(state.salesOrders.find((order) => order.id === payment.salesOrderId)),
    customer: enrichCustomer(state.customers.find((customer) => customer.id === payment.customerId)),
    createdBy: publicOwner(payment.createdById, ['id', 'name']),
    confirmedBy: payment.confirmedById ? publicOwner(payment.confirmedById, ['id', 'name']) : null,
  })
  const filteredOrderPayments = (where) => state.orderPayments.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    return Object.entries(where).every(([key, value]) => {
      if (key === 'salesOrder') {
        const order = state.salesOrders.find((item) => item.id === row.salesOrderId)
        if (value.customer) return matches(value.customer, state.customers.find((customer) => customer.id === order?.customerId), orderOwner(order))
        return matches(value, order)
      }
      // 修复说明：[低危-测试保真度]，原因：字段级过滤只支持全等，in/范围操作符静默失效；统一委托 matches。
      return matches({ [key]: value }, row)
    })
  })
  const enrichTradeDocument = (document) => ({
    ...clone(document),
    salesOrder: enrichSalesOrder(state.salesOrders.find((order) => order.id === document.salesOrderId)),
    customer: enrichCustomer(state.customers.find((customer) => customer.id === document.customerId)),
    createdBy: publicOwner(document.createdById, ['id', 'name']),
    reviewedBy: document.reviewedById ? publicOwner(document.reviewedById, ['id', 'name']) : null,
  })
  const filteredTradeDocuments = (where) => state.tradeDocuments.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    return Object.entries(where).every(([key, value]) => {
      if (key === 'salesOrder') {
        const order = state.salesOrders.find((item) => item.id === row.salesOrderId)
        if (value.customer) return matches(value.customer, state.customers.find((customer) => customer.id === order?.customerId), orderOwner(order))
        return matches(value, order)
      }
      if (key === 'customer') return matches(value, state.customers.find((customer) => customer.id === row.customerId), ownerFor(state.customers.find((customer) => customer.id === row.customerId)?.ownerId))
      return row[key] === value
    })
  })
  const enrichShipment = (shipment) => ({
    ...clone(shipment),
    salesOrder: enrichSalesOrder(state.salesOrders.find((order) => order.id === shipment.salesOrderId)),
    customer: enrichCustomer(state.customers.find((customer) => customer.id === shipment.customerId)),
    createdBy: publicOwner(shipment.createdById, ['id', 'name']),
  })
  const filteredShipments = (where) => state.shipments.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    return Object.entries(where).every(([key, value]) => {
      if (key === 'salesOrder') {
        const order = state.salesOrders.find((item) => item.id === row.salesOrderId)
        if (value.customer) return matches(value.customer, state.customers.find((customer) => customer.id === order?.customerId), orderOwner(order))
        return matches(value, order)
      }
      if (key === 'customer') return matches(value, state.customers.find((customer) => customer.id === row.customerId), ownerFor(state.customers.find((customer) => customer.id === row.customerId)?.ownerId))
      return row[key] === value
    })
  })
  const enrichCommissionRecord = (record) => ({
    ...clone(record),
    sales: publicOwner(record.salesId, ['id', 'name', 'email', 'role', 'teamId']),
    createdBy: publicOwner(record.createdById, ['id', 'name']),
    approvedBy: record.approvedById ? publicOwner(record.approvedById, ['id', 'name']) : null,
  })
  const filteredCommissionRecords = (where) => state.commissionRecords.filter((row) => matches(where, row))
  const enrichLead = (lead) => ({
    ...clone(lead),
    owner: lead.ownerId ? publicOwner(lead.ownerId, ['id', 'name', 'email', 'role', 'teamId']) : null,
    createdBy: publicOwner(lead.createdById, ['id', 'name', 'email', 'role', 'teamId']),
    convertedCustomer: lead.convertedCustomerId ? enrichCustomer(state.customers.find((item) => item.id === lead.convertedCustomerId)) : null,
    convertedOpportunity: lead.convertedOpportunityId ? enrichOpportunity(state.opportunities.find((item) => item.id === lead.convertedOpportunityId)) : null,
    _count: { followUps: state.leadFollowUps.filter((item) => item.leadId === lead.id).length, inquiries: state.inquiries.filter((item) => item.leadId === lead.id).length },
  })
  const leadOwner = (lead) => lead.ownerId ? ownerFor(lead.ownerId) : null
  const filteredLeads = (where) => state.leads.filter((row) => matches(where, row, leadOwner(row)))
  const enrichLeadFollowUp = (followUp) => ({
    ...clone(followUp),
    author: publicOwner(followUp.authorId, ['id', 'name', 'email', 'role', 'teamId']),
    lead: enrichLead(state.leads.find((item) => item.id === followUp.leadId)),
  })
  const enrichInquiry = (inquiry) => ({
    ...clone(inquiry),
    owner: inquiry.ownerId ? publicOwner(inquiry.ownerId, ['id', 'name', 'email', 'role', 'teamId']) : null,
    createdBy: publicOwner(inquiry.createdById, ['id', 'name', 'email', 'role', 'teamId']),
    lead: inquiry.leadId ? enrichLead(state.leads.find((item) => item.id === inquiry.leadId)) : null,
    customer: inquiry.customerId ? enrichCustomer(state.customers.find((item) => item.id === inquiry.customerId)) : null,
    opportunity: inquiry.opportunityId ? enrichOpportunity(state.opportunities.find((item) => item.id === inquiry.opportunityId)) : null,
    _count: { items: state.inquiryItems.filter((item) => item.inquiryId === inquiry.id).length, messages: state.channelMessages.filter((item) => item.inquiryId === inquiry.id).length },
  })
  const inquiryOwner = (inquiry) => inquiry.ownerId ? ownerFor(inquiry.ownerId) : null
  const filteredInquiries = (where) => state.inquiries.filter((row) => matches(where, row, inquiryOwner(row)))
  const enrichKnowledgeDocument = (document) => ({
    ...clone(document),
    product: document.productId ? enrichProduct(state.products.find((product) => product.id === document.productId)) : null,
    createdBy: publicOwner(document.createdById, ['id', 'name']),
    reviewedBy: document.reviewedById ? publicOwner(document.reviewedById, ['id', 'name']) : null,
    _count: { chunks: state.knowledgeChunks.filter((chunk) => chunk.documentId === document.id).length },
  })
  const filteredKnowledgeDocuments = (where) => state.knowledgeDocuments.filter((row) => matches(where, row))
  const enrichPromptTemplate = (template) => ({
    ...clone(template),
    createdBy: publicOwner(template.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const filteredPromptTemplates = (where) => state.promptTemplates.filter((row) => matches(where, row))
  const enrichAiOutputSchema = (schema) => ({
    ...clone(schema),
    createdBy: publicOwner(schema.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const filteredAiOutputSchemas = (where) => state.aiOutputSchemas.filter((row) => matches(where, row))
  const enrichAiCapabilityContract = (contract) => ({
    ...clone(contract),
    createdBy: publicOwner(contract.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const filteredAiCapabilityContracts = (where) => state.aiCapabilityContracts.filter((row) => matches(where, row))
  const enrichPromptEvalSet = (evalSet) => ({
    ...clone(evalSet),
    createdBy: publicOwner(evalSet.createdById, ['id', 'name', 'email', 'role', 'teamId']),
    _count: { cases: state.promptEvalCases.filter((item) => item.evalSetId === evalSet.id).length },
  })
  const filteredPromptEvalSets = (where) => state.promptEvalSets.filter((row) => matches(where, row))
  const enrichAiPolicyRule = (rule) => ({
    ...clone(rule),
    createdBy: publicOwner(rule.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const filteredAiPolicyRules = (where) => state.aiPolicyRules.filter((row) => matches(where, row))
  const enrichAiCostLimit = (limit) => ({
    ...clone(limit),
    createdBy: publicOwner(limit.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const filteredAiCostLimits = (where) => state.aiCostLimits.filter((row) => matches(where, row))
  const enrichAiTask = (task) => ({
    ...clone(task),
    createdBy: publicOwner(task.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const enrichAiCitation = (citation) => ({
    ...clone(citation),
    aiTask: enrichAiTask(state.aiTasks.find((item) => item.id === citation.aiTaskId)),
    knowledgeDocument: citation.knowledgeDocumentId ? enrichKnowledgeDocument(state.knowledgeDocuments.find((item) => item.id === citation.knowledgeDocumentId)) : null,
    knowledgeChunk: citation.knowledgeChunkId ? clone(state.knowledgeChunks.find((item) => item.id === citation.knowledgeChunkId)) : null,
  })
  const enrichAiFeedback = (feedback) => ({
    ...clone(feedback),
    createdBy: publicOwner(feedback.createdById, ['id', 'name', 'email', 'role', 'teamId']),
    aiTask: enrichAiTask(state.aiTasks.find((item) => item.id === feedback.aiTaskId)),
  })
  const enrichToolCall = (toolCall) => ({
    ...clone(toolCall),
    createdBy: publicOwner(toolCall.createdById, ['id', 'name', 'email', 'role', 'teamId']),
    confirmedBy: toolCall.confirmedById ? publicOwner(toolCall.confirmedById, ['id', 'name', 'email', 'role', 'teamId']) : null,
    aiTask: toolCall.aiTaskId ? enrichAiTask(state.aiTasks.find((item) => item.id === toolCall.aiTaskId)) : null,
  })
  const enrichAutomationRule = (rule) => ({
    ...clone(rule),
    createdBy: publicOwner(rule.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const enrichAutomationRun = (run) => ({
    ...clone(run),
    createdBy: publicOwner(run.createdById, ['id', 'name', 'email', 'role', 'teamId']),
    rule: enrichAutomationRule(state.automationRules.find((item) => item.id === run.ruleId)),
  })
  const enrichNotification = (notification) => ({
    ...clone(notification),
    recipient: publicOwner(notification.recipientId, ['id', 'name', 'email', 'role', 'teamId']),
    createdBy: publicOwner(notification.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const enrichIntegrationConnection = (connection) => ({
    ...clone(connection),
    createdBy: publicOwner(connection.createdById, ['id', 'name', 'email', 'role', 'teamId']),
  })
  const enrichWebhookEvent = (event) => ({
    ...clone(event),
    recordedBy: publicOwner(event.recordedById, ['id', 'name', 'email', 'role', 'teamId']),
    integrationConnection: event.integrationConnectionId ? enrichIntegrationConnection(state.integrationConnections.find((item) => item.id === event.integrationConnectionId)) : null,
  })
  const filteredAiTasks = (where) => state.aiTasks.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    if (where.OR) return where.OR.some((item) => filteredAiTasks(item).some((task) => task.id === row.id))
    if (where.AND) return where.AND.every((item) => filteredAiTasks(item).some((task) => task.id === row.id))
    return Object.entries(where).every(([key, value]) => {
      if (key === 'createdBy') return matches(value, ownerFor(row.createdById), undefined)
      return matches({ [key]: value }, row)
    })
  })
  const filteredAiCitations = (where) => state.aiCitations.filter((row) => matches(where, row))
  const filteredAiFeedbacks = (where) => state.aiFeedbacks.filter((row) => matches(where, row))
  const filteredToolCalls = (where) => state.toolCalls.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    if (where.OR) return where.OR.some((item) => filteredToolCalls(item).some((toolCall) => toolCall.id === row.id))
    if (where.AND) return where.AND.every((item) => filteredToolCalls(item).some((toolCall) => toolCall.id === row.id))
    return Object.entries(where).every(([key, value]) => {
      if (key === 'createdBy') return matches(value, ownerFor(row.createdById), undefined)
      return matches({ [key]: value }, row)
    })
  })
  const filteredAutomationRules = (where) => state.automationRules.filter((row) => matches(where, row))
  const filteredAutomationRuns = (where) => state.automationRuns.filter((row) => matches(where, row))
  const filteredNotifications = (where) => state.notifications.filter((row) => matches(where, row))
  const filteredIntegrationConnections = (where) => state.integrationConnections.filter((row) => matches(where, row))
  const filteredWebhookEvents = (where) => state.webhookEvents.filter((row) => matches(where, row))
  const filteredSocialAccounts = (where) => state.socialAccounts.filter((row) => matches(where, row))
  const filteredSocialPosts = (where) => state.socialPosts.filter((row) => matches(where, row))
  const filteredSocialInteractions = (where) => state.socialInteractions.filter((row) => matches(where, row))
  const enrichCommunicationEvent = (event) => ({
    ...clone(event),
    customer: enrichCustomer(state.customers.find((customer) => customer.id === event.customerId)),
    opportunity: event.opportunityId ? clone(state.opportunities.find((item) => item.id === event.opportunityId) || null) : null,
    owner: publicOwner(event.ownerId, ['id', 'name']),
    createdBy: publicOwner(event.createdById, ['id', 'name']),
  })
  const filteredCommunicationEvents = (where) => state.communicationEvents.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    return Object.entries(where).every(([key, value]) => {
      if (key === 'customer') return matches(value, state.customers.find((customer) => customer.id === row.customerId), ownerFor(state.customers.find((customer) => customer.id === row.customerId)?.ownerId))
      return row[key] === value
    })
  })
  const enrichSampleRequest = (sample) => ({
    ...clone(sample),
    customer: enrichCustomer(state.customers.find((customer) => customer.id === sample.customerId)),
    product: enrichProduct(state.products.find((product) => product.id === sample.productId)),
    owner: publicOwner(sample.ownerId, ['id', 'name']),
    createdBy: publicOwner(sample.createdById, ['id', 'name']),
  })
  const filteredSampleRequests = (where) => state.sampleRequests.filter((row) => {
    if (!where || !Object.keys(where).length) return true
    return Object.entries(where).every(([key, value]) => {
      if (key === 'customer') return matches(value, state.customers.find((customer) => customer.id === row.customerId), ownerFor(state.customers.find((customer) => customer.id === row.customerId)?.ownerId))
      return row[key] === value
    })
  })
  const client = {
    user: {
      findUnique: async ({ where, select }) => { const row = state.users.find((user) => (where.id && user.id === where.id) || (where.email && user.email === where.email)); if (!row) return null; return select ? Object.fromEntries(Object.entries(select).filter(([, enabled]) => enabled).map(([field]) => [field, clone(row[field])])) : clone(row) },
      findMany: async ({ where, select, orderBy, take = 100 } = {}) => {
        let rows = state.users.filter((row) => matches(where, row))
        if (orderBy?.createdAt === 'asc') rows = rows.slice().sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
        rows = rows.slice(0, take)
        return rows.map((row) => select ? Object.fromEntries(Object.entries(select).filter(([, enabled]) => enabled).map(([field]) => [field, clone(row[field])])) : clone(row))
      },
      // 修复说明：[低危-测试保真度]，原因：mock 缺少 user.update，会话撤销（tokenVersion 递增）无法在测试中执行；行不存在时按真实语义抛 P2025。
      update: async ({ where, data }) => {
        const row = state.users.find((user) => (where.id && user.id === where.id) || (where.email && user.email === where.email))
        if (!row) { const error = new Error('Record not found'); error.code = 'P2025'; throw error }
        Object.assign(row, clone(data), { updatedAt: new Date() })
        return clone(row)
      },
    },
    customer: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredCustomers(where).slice(skip, skip + take).map(enrichCustomer),
      count: async ({ where }) => filteredCustomers(where).length,
      create: async ({ data }) => { const row = { id: id('customer'), ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.customers.push(row); return enrichCustomer(row) },
      findUnique: async ({ where }) => { const row = state.customers.find((customer) => customer.id === where.id); return row ? enrichCustomer(row) : null },
      update: async ({ where, data }) => { const row = state.customers.find((customer) => customer.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichCustomer(row) },
    },
    customerFingerprint: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredCustomerFingerprints(where).slice(skip, skip + take).map(enrichCustomerFingerprint),
      count: async ({ where }) => filteredCustomerFingerprints(where).length,
      create: async ({ data }) => {
        if (state.customerFingerprints.some((item) => item.type === data.type && item.normalized === data.normalized)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('customer-fingerprint'), ...clone(data), createdAt: new Date() }
        state.customerFingerprints.push(row)
        return clone(row)
      },
      findUnique: async ({ where }) => {
        const row = state.customerFingerprints.find((item) => item.id === where.id || (where.type_normalized && item.type === where.type_normalized.type && item.normalized === where.type_normalized.normalized))
        return row ? enrichCustomerFingerprint(row) : null
      },
    },
    contact: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.contacts.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.contacts.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('contact'), ...clone(data), createdAt: new Date() }; state.contacts.push(row); return clone(row) },
    },
    opportunity: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredOpportunities(where).slice(skip, skip + take).map(enrichOpportunity),
      count: async ({ where }) => filteredOpportunities(where).length,
      create: async ({ data }) => { const row = { id: id('opportunity'), stage: 'NEW', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.opportunities.push(row); return enrichOpportunity(row) },
      findUnique: async ({ where }) => { const row = state.opportunities.find((item) => item.id === where.id); return row ? enrichOpportunity(row) : null },
      update: async ({ where, data }) => { const row = state.opportunities.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichOpportunity(row) },
    },
    followUp: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.followUps.filter((row) => matches(where, row)).slice(skip, skip + take).map((row) => ({ ...clone(row), author: publicOwner(row.authorId, ['id', 'name']) })),
      count: async ({ where }) => state.followUps.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('follow-up'), ...clone(data), createdAt: new Date() }; state.followUps.push(row); return clone(row) },
    },
    lead: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredLeads(where).slice(skip, skip + take).map(enrichLead),
      count: async ({ where }) => filteredLeads(where).length,
      create: async ({ data }) => {
        if (state.leads.some((item) => item.code === data.code)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('lead'), status: 'NEW', priority: 'NORMAL', ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.leads.push(row)
        return enrichLead(row)
      },
      findUnique: async ({ where }) => {
        const row = state.leads.find((item) => item.id === where.id || item.code === where.code)
        return row ? enrichLead(row) : null
      },
      update: async ({ where, data }) => {
        const row = state.leads.find((item) => item.id === where.id)
        Object.assign(row, clone(data), { updatedAt: new Date() })
        return enrichLead(row)
      },
      // 修复说明：[低危-测试保真度]，原因：mock 缺少 updateMany，线索转换的条件更新守卫无法在测试中执行；按真实语义补齐。
      updateMany: async ({ where, data }) => {
        const rows = state.leads.filter((row) => matches(where, row))
        for (const row of rows) Object.assign(row, clone(data), { updatedAt: new Date() })
        return { count: rows.length }
      },
    },
    leadFollowUp: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.leadFollowUps.filter((row) => matches(where, row)).slice(skip, skip + take).map(enrichLeadFollowUp),
      count: async ({ where }) => state.leadFollowUps.filter((row) => matches(where, row)).length,
      create: async ({ data }) => {
        const row = { id: id('lead-follow-up'), ...clone(data), createdAt: new Date() }
        state.leadFollowUps.push(row)
        return enrichLeadFollowUp(row)
      },
    },
    inquiry: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredInquiries(where).slice(skip, skip + take).map(enrichInquiry),
      count: async ({ where }) => filteredInquiries(where).length,
      create: async ({ data }) => {
        if (state.inquiries.some((item) => item.code === data.code)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('inquiry'), status: 'NEW', priority: 'NORMAL', aiExtracted: false, ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.inquiries.push(row)
        return enrichInquiry(row)
      },
      findUnique: async ({ where }) => {
        const row = state.inquiries.find((item) => item.id === where.id || item.code === where.code)
        return row ? enrichInquiry(row) : null
      },
      update: async ({ where, data }) => {
        const row = state.inquiries.find((item) => item.id === where.id)
        Object.assign(row, clone(data), { updatedAt: new Date() })
        return enrichInquiry(row)
      },
    },
    inquiryItem: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.inquiryItems.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.inquiryItems.filter((row) => matches(where, row)).length,
      create: async ({ data }) => {
        const row = { id: id('inquiry-item'), ...clone(data), createdAt: new Date() }
        state.inquiryItems.push(row)
        return clone(row)
      },
    },
    channelMessage: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.channelMessages.filter((row) => matches(where, row)).slice(skip, skip + take).map((row) => ({ ...clone(row), createdBy: publicOwner(row.createdById, ['id', 'name', 'role', 'teamId']) })),
      count: async ({ where }) => state.channelMessages.filter((row) => matches(where, row)).length,
      create: async ({ data }) => {
        const row = { id: id('channel-message'), ...clone(data), createdAt: new Date() }
        state.channelMessages.push(row)
        return clone(row)
      },
    },
    todo: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.todos.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.todos.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('todo'), doneAt: null, dueAt: null, ...clone(data), createdAt: new Date() }; state.todos.push(row); return clone(row) },
      findUnique: async ({ where }) => clone(state.todos.find((row) => row.id === where.id) || null),
      update: async ({ where, data }) => { const row = state.todos.find((item) => item.id === where.id); Object.assign(row, clone(data)); return clone(row) },
    },
    memo: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.memos.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.memos.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('memo'), ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.memos.push(row); return clone(row) },
      findUnique: async ({ where }) => clone(state.memos.find((row) => row.id === where.id) || null),
      update: async ({ where, data }) => { const row = state.memos.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return clone(row) },
    },
    productCategory: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.productCategories.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.productCategories.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('category'), ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.productCategories.push(row); return clone(row) },
      findUnique: async ({ where }) => clone(state.productCategories.find((row) => row.id === where.id) || null),
    },
    product: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.products.filter((row) => matches(where, row)).slice(skip, skip + take).map(enrichProduct),
      count: async ({ where }) => state.products.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('product'), ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.products.push(row); return enrichProduct(row) },
      findUnique: async ({ where }) => { const row = state.products.find((item) => item.id === where.id); return row ? enrichProduct(row) : null },
      update: async ({ where, data }) => { const row = state.products.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichProduct(row) },
    },
    productDoc: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.productDocs.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.productDocs.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('product-doc'), ...clone(data), createdAt: new Date() }; state.productDocs.push(row); return clone(row) },
    },
    quote: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredQuotes(where).slice(skip, skip + take).map(enrichQuote),
      count: async ({ where }) => filteredQuotes(where).length,
      create: async ({ data }) => { const row = { id: id('quote'), status: 'DRAFT', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.quotes.push(row); return enrichQuote(row) },
      findUnique: async ({ where }) => { const row = state.quotes.find((item) => item.id === where.id); return row ? enrichQuote(row) : null },
      update: async ({ where, data }) => { const row = state.quotes.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichQuote(row) },
    },
    quoteVersion: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.quoteVersions.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.quoteVersions.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('quote-version'), lockStatus: 'DRAFT', ...clone(data), createdAt: new Date() }; state.quoteVersions.push(row); return clone(row) },
      findUnique: async ({ where }) => { const row = state.quoteVersions.find((item) => item.id === where.id || (where.quoteId_version && item.quoteId === where.quoteId_version.quoteId && item.version === where.quoteId_version.version)); return row ? clone(row) : null },
      update: async ({ where, data }) => { const row = state.quoteVersions.find((item) => item.id === where.id); Object.assign(row, clone(data)); return clone(row) },
    },
    quoteApproval: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.quoteApprovals.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.quoteApprovals.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('quote-approval'), status: 'PENDING', type: 'LOW_MARGIN', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.quoteApprovals.push(row); return clone(row) },
      findUnique: async ({ where }) => clone(state.quoteApprovals.find((item) => item.id === where.id) || null),
      findFirst: async ({ where }) => clone(state.quoteApprovals.find((row) => matches(where, row)) || null),
      update: async ({ where, data }) => { const row = state.quoteApprovals.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return clone(row) },
    },
    quoteRuleSet: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.quoteRuleSets.filter((row) => matches(where, row)).slice(skip, skip + take).map(enrichQuoteRuleSet),
      count: async ({ where }) => state.quoteRuleSets.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('quote-rule-set'), ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.quoteRuleSets.push(row); return enrichQuoteRuleSet(row) },
      findUnique: async ({ where }) => { const row = state.quoteRuleSets.find((item) => item.id === where.id || item.code === where.code); return row ? enrichQuoteRuleSet(row) : null },
    },
    salesOrder: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredSalesOrders(where).slice(skip, skip + take).map(enrichSalesOrder),
      count: async ({ where }) => filteredSalesOrders(where).length,
      create: async ({ data }) => { const row = { id: id('sales-order'), status: 'CONFIRMED', paymentStatus: 'UNPAID', fulfillmentStatus: 'PENDING', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.salesOrders.push(row); return enrichSalesOrder(row) },
      findUnique: async ({ where }) => { const row = state.salesOrders.find((item) => item.id === where.id); return row ? enrichSalesOrder(row) : null },
      update: async ({ where, data }) => { const row = state.salesOrders.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichSalesOrder(row) },
      // 修复说明：[低危-测试保真度]，原因：mock 缺少 findFirst（报价重复转单/结算防重守卫需要）；按真实语义补齐。
      findFirst: async ({ where }) => clone(state.salesOrders.find((row) => matches(where, row)) || null),
    },
    orderItem: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.orderItems.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.orderItems.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('order-item'), ...clone(data) }; state.orderItems.push(row); return clone(row) },
    },
    fulfillmentEvent: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.fulfillmentEvents.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.fulfillmentEvents.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('fulfillment-event'), ...clone(data), createdAt: new Date() }; state.fulfillmentEvents.push(row); return clone(row) },
    },
    orderPayment: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredOrderPayments(where).slice(skip, skip + take).map(enrichOrderPayment),
      count: async ({ where }) => filteredOrderPayments(where).length,
      create: async ({ data }) => { const row = { id: id('order-payment'), status: 'REGISTERED', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.orderPayments.push(row); return enrichOrderPayment(row) },
      findUnique: async ({ where }) => { const row = state.orderPayments.find((item) => item.id === where.id); return row ? enrichOrderPayment(row) : null },
      update: async ({ where, data }) => { const row = state.orderPayments.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichOrderPayment(row) },
      // 修复说明：[低危-测试保真度]，原因：mock 缺少 aggregate 聚合，回款确认的 SUM 统计无法在测试中执行；按真实语义补齐（无匹配行 _sum 为 null）。
      aggregate: async ({ _sum, where }) => {
        const matched = state.orderPayments.filter((row) => matches(where, row))
        return { _sum: { amount: matched.length ? matched.reduce((sum, row) => sum + Number(row.amount || 0), 0) : null } }
      },
    },
    tradeDocument: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredTradeDocuments(where).slice(skip, skip + take).map(enrichTradeDocument),
      count: async ({ where }) => filteredTradeDocuments(where).length,
      create: async ({ data }) => { const row = { id: id('trade-document'), status: 'GENERATED', version: 1, ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.tradeDocuments.push(row); return enrichTradeDocument(row) },
      findUnique: async ({ where }) => { const row = state.tradeDocuments.find((item) => item.id === where.id); return row ? enrichTradeDocument(row) : null },
      update: async ({ where, data }) => { const row = state.tradeDocuments.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichTradeDocument(row) },
    },
    shipment: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredShipments(where).slice(skip, skip + take).map(enrichShipment),
      count: async ({ where }) => filteredShipments(where).length,
      create: async ({ data }) => { const row = { id: id('shipment'), status: 'SHIPPED', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.shipments.push(row); return enrichShipment(row) },
      findUnique: async ({ where }) => { const row = state.shipments.find((item) => item.id === where.id); return row ? enrichShipment(row) : null },
      update: async ({ where, data }) => { const row = state.shipments.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichShipment(row) },
    },
    commissionRecord: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredCommissionRecords(where).slice(skip, skip + take).map(enrichCommissionRecord),
      count: async ({ where }) => filteredCommissionRecords(where).length,
      create: async ({ data }) => { const row = { id: id('commission-record'), status: 'CALCULATED', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.commissionRecords.push(row); return enrichCommissionRecord(row) },
      findUnique: async ({ where }) => { const row = state.commissionRecords.find((item) => item.id === where.id); return row ? enrichCommissionRecord(row) : null },
      update: async ({ where, data }) => { const row = state.commissionRecords.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichCommissionRecord(row) },
      // 修复说明：[低危-测试保真度]，原因：mock 缺少 findFirst（报价重复转单/结算防重守卫需要）；按真实语义补齐。
      findFirst: async ({ where }) => clone(state.commissionRecords.find((row) => matches(where, row)) || null),
    },
    knowledgeDocument: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredKnowledgeDocuments(where).slice(skip, skip + take).map(enrichKnowledgeDocument),
      count: async ({ where }) => filteredKnowledgeDocuments(where).length,
      create: async ({ data }) => { const row = { id: id('knowledge-document'), status: 'DRAFT', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.knowledgeDocuments.push(row); return enrichKnowledgeDocument(row) },
      findUnique: async ({ where }) => { const row = state.knowledgeDocuments.find((item) => item.id === where.id); return row ? enrichKnowledgeDocument(row) : null },
      update: async ({ where, data }) => { const row = state.knowledgeDocuments.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichKnowledgeDocument(row) },
    },
    knowledgeChunk: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.knowledgeChunks.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.knowledgeChunks.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('knowledge-chunk'), ...clone(data), createdAt: new Date() }; state.knowledgeChunks.push(row); return clone(row) },
      findUnique: async ({ where }) => { const row = state.knowledgeChunks.find((item) => item.id === where.id || (where.documentId_chunkNo && item.documentId === where.documentId_chunkNo.documentId && item.chunkNo === where.documentId_chunkNo.chunkNo)); return row ? clone(row) : null },
    },
    promptTemplate: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredPromptTemplates(where).slice(skip, skip + take).map(enrichPromptTemplate),
      count: async ({ where }) => filteredPromptTemplates(where).length,
      create: async ({ data }) => {
        if (state.promptTemplates.some((item) => item.code === data.code && item.version === data.version)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('prompt-template'), status: 'DRAFT', level: 'L1', version: 'v1', ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.promptTemplates.push(row)
        return enrichPromptTemplate(row)
      },
      findUnique: async ({ where }) => {
        const row = state.promptTemplates.find((item) => item.id === where.id || (where.code_version && item.code === where.code_version.code && item.version === where.code_version.version))
        return row ? enrichPromptTemplate(row) : null
      },
    },
    aiOutputSchema: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAiOutputSchemas(where).slice(skip, skip + take).map(enrichAiOutputSchema),
      count: async ({ where }) => filteredAiOutputSchemas(where).length,
      create: async ({ data }) => {
        if (state.aiOutputSchemas.some((item) => item.code === data.code && item.version === data.version)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('ai-output-schema'), status: 'DRAFT', version: 'v1', ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.aiOutputSchemas.push(row)
        return enrichAiOutputSchema(row)
      },
      findUnique: async ({ where }) => {
        const row = state.aiOutputSchemas.find((item) => item.id === where.id || (where.code_version && item.code === where.code_version.code && item.version === where.code_version.version))
        return row ? enrichAiOutputSchema(row) : null
      },
    },
    aiCapabilityContract: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAiCapabilityContracts(where).slice(skip, skip + take).map(enrichAiCapabilityContract),
      count: async ({ where }) => filteredAiCapabilityContracts(where).length,
      create: async ({ data }) => {
        if (state.aiCapabilityContracts.some((item) => item.code === data.code && item.version === data.version)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('ai-capability-contract'), status: 'DRAFT', level: 'L1', version: 'v1', ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.aiCapabilityContracts.push(row)
        return enrichAiCapabilityContract(row)
      },
      findUnique: async ({ where }) => {
        const row = state.aiCapabilityContracts.find((item) => item.id === where.id || (where.code_version && item.code === where.code_version.code && item.version === where.code_version.version))
        return row ? enrichAiCapabilityContract(row) : null
      },
    },
    promptEvalSet: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredPromptEvalSets(where).slice(skip, skip + take).map(enrichPromptEvalSet),
      count: async ({ where }) => filteredPromptEvalSets(where).length,
      create: async ({ data }) => {
        if (state.promptEvalSets.some((item) => item.code === data.code)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('prompt-eval-set'), status: 'DRAFT', ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.promptEvalSets.push(row)
        return enrichPromptEvalSet(row)
      },
      findUnique: async ({ where, include }) => {
        const row = state.promptEvalSets.find((item) => item.id === where.id || item.code === where.code)
        if (!row) return null
        return include?.cases ? { ...enrichPromptEvalSet(row), cases: state.promptEvalCases.filter((item) => item.evalSetId === row.id).map(clone) } : enrichPromptEvalSet(row)
      },
    },
    promptEvalCase: {
      findMany: async ({ where, skip = 0, take = 100 }) => state.promptEvalCases.filter((row) => matches(where, row)).slice(skip, skip + take).map(clone),
      count: async ({ where }) => state.promptEvalCases.filter((row) => matches(where, row)).length,
      create: async ({ data }) => { const row = { id: id('prompt-eval-case'), type: 'NORMAL', ...clone(data), createdAt: new Date() }; state.promptEvalCases.push(row); return clone(row) },
    },
    aiPolicyRule: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAiPolicyRules(where).slice(skip, skip + take).map(enrichAiPolicyRule),
      count: async ({ where }) => filteredAiPolicyRules(where).length,
      create: async ({ data }) => {
        if (state.aiPolicyRules.some((item) => item.code === data.code)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('ai-policy-rule'), status: 'DRAFT', maxLevel: 'L3', allowCloud: false, requireHumanConfirmation: true, ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.aiPolicyRules.push(row)
        return enrichAiPolicyRule(row)
      },
      findUnique: async ({ where }) => {
        const row = state.aiPolicyRules.find((item) => item.id === where.id || item.code === where.code)
        return row ? enrichAiPolicyRule(row) : null
      },
    },
    aiCostLimit: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAiCostLimits(where).slice(skip, skip + take).map(enrichAiCostLimit),
      count: async ({ where }) => filteredAiCostLimits(where).length,
      create: async ({ data }) => {
        if (state.aiCostLimits.some((item) => item.code === data.code)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('ai-cost-limit'), status: 'DRAFT', period: 'MONTHLY', maxTokens: 0, maxCost: '0', currency: 'USD', hardBlock: true, ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.aiCostLimits.push(row)
        return enrichAiCostLimit(row)
      },
      findUnique: async ({ where }) => {
        const row = state.aiCostLimits.find((item) => item.id === where.id || item.code === where.code)
        return row ? enrichAiCostLimit(row) : null
      },
    },
    aiTask: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAiTasks(where).slice(skip, skip + take).map(enrichAiTask),
      count: async ({ where }) => filteredAiTasks(where).length,
      create: async ({ data }) => { const row = { id: id('ai-task'), status: 'PENDING', tokens: 0, cost: '0', dataSentToCloud: false, ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.aiTasks.push(row); return enrichAiTask(row) },
      findUnique: async ({ where }) => { const row = state.aiTasks.find((item) => item.id === where.id); return row ? enrichAiTask(row) : null },
      update: async ({ where, data }) => {
        const row = state.aiTasks.find((item) => item.id === where.id)
        if (!row) throw new Error('AiTask not found')
        Object.assign(row, clone(data), { updatedAt: new Date() })
        return enrichAiTask(row)
      },
    },
    aiCitation: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAiCitations(where).slice(skip, skip + take).map(enrichAiCitation),
      count: async ({ where }) => filteredAiCitations(where).length,
      create: async ({ data }) => {
        const row = { id: id('ai-citation'), ...clone(data), createdAt: new Date() }
        state.aiCitations.push(row)
        return enrichAiCitation(row)
      },
      findUnique: async ({ where }) => {
        const row = state.aiCitations.find((item) => item.id === where.id)
        return row ? enrichAiCitation(row) : null
      },
    },
    aiFeedback: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAiFeedbacks(where).slice(skip, skip + take).map(enrichAiFeedback),
      count: async ({ where }) => filteredAiFeedbacks(where).length,
      create: async ({ data }) => {
        const row = { id: id('ai-feedback'), status: 'RECORDED', createsFormalWrite: false, confirmedHumanReview: false, ...clone(data), createdAt: new Date() }
        state.aiFeedbacks.push(row)
        return enrichAiFeedback(row)
      },
      findUnique: async ({ where }) => {
        const row = state.aiFeedbacks.find((item) => item.id === where.id)
        return row ? enrichAiFeedback(row) : null
      },
    },
    toolCall: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredToolCalls(where).slice(skip, skip + take).map(enrichToolCall),
      count: async ({ where }) => filteredToolCalls(where).length,
      create: async ({ data }) => {
        const row = { id: id('tool-call'), status: 'PENDING_CONFIRMATION', riskLevel: 'MEDIUM', requiresHumanConfirmation: true, ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.toolCalls.push(row)
        return enrichToolCall(row)
      },
      findUnique: async ({ where }) => {
        const row = state.toolCalls.find((item) => item.id === where.id)
        return row ? enrichToolCall(row) : null
      },
      update: async ({ where, data }) => {
        const row = state.toolCalls.find((item) => item.id === where.id)
        Object.assign(row, clone(data), { updatedAt: new Date() })
        return enrichToolCall(row)
      },
    },
    automationRule: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAutomationRules(where).slice(skip, skip + take).map(enrichAutomationRule),
      count: async ({ where }) => filteredAutomationRules(where).length,
      create: async ({ data }) => {
        if (state.automationRules.some((item) => item.code === data.code)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('automation-rule'), status: 'DRAFT', requiresManualOverride: true, ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.automationRules.push(row)
        return enrichAutomationRule(row)
      },
      findUnique: async ({ where }) => {
        const row = state.automationRules.find((item) => item.id === where.id || item.code === where.code)
        return row ? enrichAutomationRule(row) : null
      },
      update: async ({ where, data }) => {
        const row = state.automationRules.find((item) => item.id === where.id)
        Object.assign(row, clone(data), { updatedAt: new Date() })
        return enrichAutomationRule(row)
      },
    },
    automationRun: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredAutomationRuns(where).slice(skip, skip + take).map(enrichAutomationRun),
      count: async ({ where }) => filteredAutomationRuns(where).length,
      create: async ({ data }) => {
        if (data.idempotencyKey && state.automationRuns.some((item) => item.ruleId === data.ruleId && item.idempotencyKey === data.idempotencyKey)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('automation-run'), mode: 'DRY_RUN', status: 'DRY_RUN_RECORDED', matchedCount: 0, duplicatePrevented: false, ...clone(data), createdAt: new Date() }
        state.automationRuns.push(row)
        return enrichAutomationRun(row)
      },
      findFirst: async ({ where }) => {
        const row = state.automationRuns.find((item) => matches(where, item))
        return row ? enrichAutomationRun(row) : null
      },
      findUnique: async ({ where }) => {
        const row = state.automationRuns.find((item) => item.id === where.id)
        return row ? enrichAutomationRun(row) : null
      },
    },
    notification: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredNotifications(where).slice(skip, skip + take).map(enrichNotification),
      count: async ({ where }) => filteredNotifications(where).length,
      create: async ({ data }) => {
        const row = { id: id('notification'), priority: 'NORMAL', status: 'UNREAD', ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.notifications.push(row)
        return enrichNotification(row)
      },
      findUnique: async ({ where }) => {
        const row = state.notifications.find((item) => item.id === where.id)
        return row ? enrichNotification(row) : null
      },
      update: async ({ where, data }) => {
        const row = state.notifications.find((item) => item.id === where.id)
        Object.assign(row, clone(data), { updatedAt: new Date() })
        return enrichNotification(row)
      },
    },
    integrationConnection: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredIntegrationConnections(where).slice(skip, skip + take).map(enrichIntegrationConnection),
      count: async ({ where }) => filteredIntegrationConnections(where).length,
      create: async ({ data }) => {
        if (state.integrationConnections.some((item) => item.code === data.code)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('integration'), status: 'DRAFT', authMode: 'MANUAL', fallbackMode: 'MANUAL_ENTRY', healthStatus: 'UNKNOWN', ...clone(data), createdAt: new Date(), updatedAt: new Date() }
        state.integrationConnections.push(row)
        return enrichIntegrationConnection(row)
      },
      findUnique: async ({ where }) => {
        const row = state.integrationConnections.find((item) => item.id === where.id || item.code === where.code)
        return row ? enrichIntegrationConnection(row) : null
      },
      update: async ({ where, data }) => {
        const row = state.integrationConnections.find((item) => item.id === where.id)
        Object.assign(row, clone(data), { updatedAt: new Date() })
        return enrichIntegrationConnection(row)
      },
    },
    webhookEvent: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredWebhookEvents(where).slice(skip, skip + take).map(enrichWebhookEvent),
      count: async ({ where }) => filteredWebhookEvents(where).length,
      create: async ({ data }) => {
        if (data.idempotencyKey && state.webhookEvents.some((item) => item.provider === data.provider && item.idempotencyKey === data.idempotencyKey)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const row = { id: id('webhook-event'), status: 'RECEIVED', duplicatePrevented: false, ...clone(data), receivedAt: new Date() }
        state.webhookEvents.push(row)
        return enrichWebhookEvent(row)
      },
      findFirst: async ({ where }) => {
        const row = state.webhookEvents.find((item) => matches(where, item))
        return row ? enrichWebhookEvent(row) : null
      },
      findUnique: async ({ where }) => {
        const row = state.webhookEvents.find((item) => item.id === where.id)
        return row ? enrichWebhookEvent(row) : null
      },
    },
    socialAccount: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredSocialAccounts(where).slice(skip, skip + take).map(clone),
      count: async ({ where }) => filteredSocialAccounts(where).length,
      create: async ({ data }) => { const row = { id: id('social-account'), status: 'DRAFT', fallbackMode: 'MANUAL_PUBLISH', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.socialAccounts.push(row); return clone(row) },
      findUnique: async ({ where }) => { const row = state.socialAccounts.find((item) => item.id === where.id); return row ? clone(row) : null },
    },
    socialPost: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredSocialPosts(where).slice(skip, skip + take).map(clone),
      count: async ({ where }) => filteredSocialPosts(where).length,
      create: async ({ data }) => { const row = { id: id('social-post'), status: 'DRAFT', contentType: 'POST', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.socialPosts.push(row); return clone(row) },
      findUnique: async ({ where }) => { const row = state.socialPosts.find((item) => item.id === where.id); return row ? clone(row) : null },
      update: async ({ where, data }) => { const row = state.socialPosts.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return clone(row) },
    },
    socialInteraction: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredSocialInteractions(where).slice(skip, skip + take).map(clone),
      count: async ({ where }) => filteredSocialInteractions(where).length,
      create: async ({ data }) => { if (data.externalRef && state.socialInteractions.some((item) => item.platform === data.platform && item.externalRef === data.externalRef)) { const error = new Error('Unique constraint failed'); error.code = 'P2002'; throw error }; const row = { id: id('social-interaction'), intent: 'UNCLASSIFIED', status: 'NEW', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.socialInteractions.push(row); return clone(row) },
      findUnique: async ({ where }) => { const row = state.socialInteractions.find((item) => item.id === where.id); return row ? clone(row) : null },
      update: async ({ where, data }) => { const row = state.socialInteractions.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return clone(row) },
    },
    communicationEvent: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredCommunicationEvents(where).slice(skip, skip + take).map(enrichCommunicationEvent),
      count: async ({ where }) => filteredCommunicationEvents(where).length,
      create: async ({ data }) => { const row = { id: id('communication-event'), ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.communicationEvents.push(row); return enrichCommunicationEvent(row) },
      findUnique: async ({ where }) => { const row = state.communicationEvents.find((item) => item.id === where.id); return row ? enrichCommunicationEvent(row) : null },
      update: async ({ where, data }) => { const row = state.communicationEvents.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichCommunicationEvent(row) },
    },
    sampleRequest: {
      findMany: async ({ where, skip = 0, take = 100 }) => filteredSampleRequests(where).slice(skip, skip + take).map(enrichSampleRequest),
      count: async ({ where }) => filteredSampleRequests(where).length,
      create: async ({ data }) => { const row = { id: id('sample'), status: 'REQUESTED', ...clone(data), createdAt: new Date(), updatedAt: new Date() }; state.sampleRequests.push(row); return enrichSampleRequest(row) },
      findUnique: async ({ where }) => { const row = state.sampleRequests.find((item) => item.id === where.id); return row ? enrichSampleRequest(row) : null },
      update: async ({ where, data }) => { const row = state.sampleRequests.find((item) => item.id === where.id); Object.assign(row, clone(data), { updatedAt: new Date() }); return enrichSampleRequest(row) },
      // 修复说明：[低危-测试保真度]，原因：mock 缺少 updateMany，样品转单的条件更新守卫无法在测试中执行；按真实语义补齐。
      updateMany: async ({ where, data }) => {
        const rows = state.sampleRequests.filter((row) => matches(where, row))
        for (const row of rows) Object.assign(row, clone(data), { updatedAt: new Date() })
        return { count: rows.length }
      },
    },
    auditLog: { create: async ({ data }) => { const row = { id: id('audit'), ...clone(data), createdAt: new Date() }; state.auditLogs.push(row); return clone(row) } },
    $transaction: async (operations) => typeof operations === 'function' ? operations(client) : Promise.all(operations),
    __state: state,
  }
  return client
}
