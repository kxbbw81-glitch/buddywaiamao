import { HttpError, listQuery, readJson, send, text } from './http.mjs'
import { findDuplicateCustomers, fingerprintsFromLead } from './customer-fingerprint.mjs'
// 修复说明：[高危-越权]，原因：转线索查重未按访问者数据范围过滤，跨团队客户信息泄露/存在性探测；补 scopeFor。
import { scopeFor } from './access.mjs'
import { randomBytes } from 'node:crypto'
import { prepareEncryptedLead, publicPiiStorageSummary } from './pii.mjs'

const READ_ROLES = new Set(['SALES', 'MANAGER', 'EXEC', 'ADMIN'])
const WRITE_ROLES = new Set(['SALES', 'MANAGER', 'ADMIN'])
const APPROVE_ROLES = new Set(['MANAGER', 'ADMIN'])
const PLATFORMS = new Set(['LINKEDIN', 'X', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'WEBSITE', 'OTHER'])
const ACCOUNT_STATUSES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'DISABLED'])
const POST_STATUSES = new Set(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
const INTERACTION_TYPES = new Set(['COMMENT', 'DIRECT_MESSAGE', 'MENTION', 'FORM_SUBMISSION', 'MANUAL_ENTRY'])
const INTENTS = new Set(['UNCLASSIFIED', 'INQUIRY', 'PRODUCT_QUESTION', 'PARTNERSHIP', 'COMPLAINT', 'AFTER_SALES', 'CASUAL', 'SPAM'])
const INTERACTION_STATUSES = new Set(['NEW', 'REVIEWED', 'LEAD_SUGGESTED', 'CONVERTED', 'IGNORED'])

function assertRole(actor, allowed, message = '当前角色无权访问社媒获客助手。') {
  if (!allowed.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', message)
}

function upper(value, field, { required = false, max = 80 } = {}) {
  return text(value, field, { required, max })?.toUpperCase() || null
}

function enumValue(value, allowed, fallback, field) {
  const result = upper(value || fallback, field, { required: true })
  if (!allowed.has(result)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 不在允许范围内。`)
  return result
}

function jsonObject(value, field) {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 JSON 对象。`)
  return value
}

function dateOrNull(value, field) {
  if (value == null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 时间格式无效。`)
  return date
}

function accountInput(body) {
  return {
    platform: enumValue(body.platform, PLATFORMS, null, '平台'),
    displayName: text(body.displayName, '账号显示名称', { required: true, max: 160 }),
    accountRef: text(body.accountRef, '账号引用', { max: 160 }),
    integrationConnectionId: text(body.integrationConnectionId, '连接器 ID', { max: 120 }),
    status: enumValue(body.status, ACCOUNT_STATUSES, 'DRAFT', '账号状态'),
    fallbackMode: 'MANUAL_PUBLISH',
  }
}

function postInput(body) {
  return {
    socialAccountId: text(body.socialAccountId, '社媒账号 ID', { max: 120 }),
    platform: enumValue(body.platform, PLATFORMS, null, '平台'),
    title: text(body.title, '内容标题', { max: 160 }),
    body: text(body.body, '内容草稿', { required: true, max: 12000 }),
    contentType: upper(body.contentType || 'POST', '内容类型', { required: true, max: 40 }),
    campaignCode: text(body.campaignCode, '活动编码', { max: 80 }),
    utm: jsonObject(body.utm, 'UTM 参数'),
    scheduledAt: dateOrNull(body.scheduledAt, '计划发布时间'),
  }
}

function interactionInput(body) {
  return {
    socialAccountId: text(body.socialAccountId, '社媒账号 ID', { max: 120 }),
    socialPostId: text(body.socialPostId, '社媒内容 ID', { max: 120 }),
    platform: enumValue(body.platform, PLATFORMS, null, '平台'),
    interactionType: enumValue(body.interactionType, INTERACTION_TYPES, 'MANUAL_ENTRY', '互动类型'),
    externalRef: text(body.externalRef, '外部互动 ID', { max: 160 }),
    authorAlias: text(body.authorAlias, '互动方称呼', { max: 160 }),
    content: text(body.content, '互动内容', { required: true, max: 8000 }),
    intent: enumValue(body.intent, INTENTS, 'UNCLASSIFIED', '意图标签'),
    proposedReply: text(body.proposedReply, '回复草稿', { max: 8000 }),
    campaignCode: text(body.campaignCode, '活动编码', { max: 80 }),
  }
}

function compactAccount(row) {
  if (!row) return row
  const { integrationConnection, ...data } = row
  return { ...data, integrationLinked: Boolean(integrationConnection) }
}

async function accountById(db, id) {
  const row = await db.socialAccount.findUnique({ where: { id } })
  if (!row) throw new HttpError(404, 'NOT_FOUND', '社媒账号不存在。')
  return row
}

async function postById(db, id) {
  const row = await db.socialPost.findUnique({ where: { id } })
  if (!row) throw new HttpError(404, 'NOT_FOUND', '社媒内容不存在。')
  return row
}

async function interactionById(db, id) {
  const row = await db.socialInteraction.findUnique({ where: { id } })
  if (!row) throw new HttpError(404, 'NOT_FOUND', '社媒互动不存在。')
  return row
}

async function audit(db, actor, action, resource, resourceId, detail) {
  await db.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function nextLeadCode(db) {
  const total = await db.lead.count({ where: {} })
  return `SOCIAL-${String(total + 1).padStart(6, '0')}`
}

export async function handleSocialRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/social-accounts') {
    assertRole(actor, READ_ROLES)
    const { page, pageSize, skip } = listQuery(url)
    const platform = url.searchParams.get('platform')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(platform ? { platform } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.socialAccount.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize, include: { integrationConnection: true } }), db.socialAccount.count({ where })])
    return send(res, 200, { data: { items: items.map(compactAccount), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/social-accounts') {
    assertRole(actor, APPROVE_ROLES, '只有主管或管理员可维护社媒账号台账。')
    const data = accountInput(await readJson(req))
    if (data.integrationConnectionId) await db.integrationConnection.findUnique({ where: { id: data.integrationConnectionId } }).then((row) => { if (!row) throw new HttpError(404, 'NOT_FOUND', '连接器不存在。') })
    // 修复说明：[中危-容错]，原因：platform+accountRef 唯一冲突未捕获，重复登记变 500；转 409。
    let row
    try {
      row = await db.socialAccount.create({ data: { ...data, createdById: actor.id } })
    } catch (error) {
      if (error?.code === 'P2002') throw new HttpError(409, 'DUPLICATE_ACCOUNT', '同平台同账号引用已存在，不能重复登记。')
      throw error
    }
    await audit(db, actor, 'CREATE', 'social_account', row.id, { platform: row.platform, status: row.status, externalPublishing: false })
    return send(res, 201, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/social-posts') {
    assertRole(actor, READ_ROLES)
    const { page, pageSize, skip } = listQuery(url)
    const platform = url.searchParams.get('platform')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(platform ? { platform } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.socialPost.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.socialPost.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/social-posts') {
    assertRole(actor, WRITE_ROLES, '当前角色无权创建社媒草稿。')
    const data = postInput(await readJson(req))
    if (data.socialAccountId) await accountById(db, data.socialAccountId)
    const row = await db.socialPost.create({ data: { ...data, status: 'DRAFT', createdById: actor.id } })
    await audit(db, actor, 'CREATE', 'social_post', row.id, { platform: row.platform, campaignCode: row.campaignCode, status: row.status, externalPublishing: false })
    return send(res, 201, { data: row })
  }

  const postSubmitMatch = pathname.match(/^\/api\/social-posts\/([^/]+)\/submit-review$/)
  if (postSubmitMatch && req.method === 'POST') {
    assertRole(actor, WRITE_ROLES)
    const existing = await postById(db, postSubmitMatch[1])
    if (existing.createdById !== actor.id && !APPROVE_ROLES.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '只能提交自己的社媒草稿。')
    if (!['DRAFT', 'ARCHIVED'].includes(existing.status)) throw new HttpError(409, 'INVALID_STATE', '只有草稿或已归档内容可提交审核。')
    const row = await db.socialPost.update({ where: { id: existing.id }, data: { status: 'IN_REVIEW' } })
    await audit(db, actor, 'SUBMIT_REVIEW', 'social_post', row.id, { from: existing.status, to: row.status })
    return send(res, 200, { data: row })
  }

  const postApproveMatch = pathname.match(/^\/api\/social-posts\/([^/]+)\/approve$/)
  if (postApproveMatch && req.method === 'POST') {
    assertRole(actor, APPROVE_ROLES, '只有主管或管理员可审核社媒内容。')
    const existing = await postById(db, postApproveMatch[1])
    if (existing.status !== 'IN_REVIEW') throw new HttpError(409, 'INVALID_STATE', '只有待审核内容可以通过。')
    // 修复说明：[中危-职责分离]，原因：MANAGER 可自建草稿自审自发布，四眼原则缺失；现禁止创建人审核自己的内容（ADMIN 例外）。
    if (existing.createdById === actor.id && actor.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', '不能审核自己创建的内容。')
    const body = await readJson(req)
    const row = await db.socialPost.update({ where: { id: existing.id }, data: { status: 'APPROVED', approvedById: actor.id, approvalNote: text(body.note, '审核意见', { max: 1000 }) } })
    await audit(db, actor, 'APPROVE', 'social_post', row.id, { from: existing.status, to: row.status, externalPublishing: false })
    return send(res, 200, { data: row })
  }

  const postRecordPublishMatch = pathname.match(/^\/api\/social-posts\/([^/]+)\/record-published$/)
  if (postRecordPublishMatch && req.method === 'POST') {
    assertRole(actor, APPROVE_ROLES, '只有主管或管理员可记录人工发布结果。')
    const existing = await postById(db, postRecordPublishMatch[1])
    if (existing.status !== 'APPROVED') throw new HttpError(409, 'INVALID_STATE', '必须先完成人工审核，才可登记发布结果。')
    const row = await db.socialPost.update({ where: { id: existing.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } })
    await audit(db, actor, 'RECORD_MANUAL_PUBLISH', 'social_post', row.id, { from: existing.status, to: row.status, noExternalCall: true })
    return send(res, 200, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/social-interactions') {
    assertRole(actor, READ_ROLES)
    const { page, pageSize, skip } = listQuery(url)
    const intent = url.searchParams.get('intent')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(intent ? { intent } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.socialInteraction.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.socialInteraction.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/social-interactions') {
    assertRole(actor, WRITE_ROLES)
    const data = interactionInput(await readJson(req))
    if (data.socialAccountId) await accountById(db, data.socialAccountId)
    if (data.socialPostId) await postById(db, data.socialPostId)
    // 修复说明：[中危-容错]，原因：platform+externalRef 唯一冲突未捕获（如同一 webhook 重复登记）变 500；转 409。
    let row
    try {
      row = await db.socialInteraction.create({ data: { ...data, status: data.intent === 'UNCLASSIFIED' ? 'NEW' : 'LEAD_SUGGESTED', recordedById: actor.id } })
    } catch (error) {
      if (error?.code === 'P2002') throw new HttpError(409, 'DUPLICATE_INTERACTION', '同平台同外部引用的互动已登记。')
      throw error
    }
    await audit(db, actor, 'RECORD', 'social_interaction', row.id, { platform: row.platform, intent: row.intent, status: row.status, externalReply: false })
    return send(res, 201, { data: row })
  }

  const interactionConvertMatch = pathname.match(/^\/api\/social-interactions\/([^/]+)\/convert-to-lead$/)
  if (interactionConvertMatch && req.method === 'POST') {
    assertRole(actor, WRITE_ROLES)
    const interaction = await interactionById(db, interactionConvertMatch[1])
    if (interaction.leadId || interaction.status === 'CONVERTED') throw new HttpError(409, 'INVALID_STATE', '该互动已转为线索。')
    const body = await readJson(req)
    const candidate = { companyName: text(body.companyName, '公司名称', { required: true, max: 200 }), contactName: text(body.contactName || interaction.authorAlias, '联系人', { max: 120 }), email: text(body.email, '邮箱', { max: 160 }), phone: text(body.phone, '电话', { max: 80 }) }
    const fingerprints = fingerprintsFromLead(candidate, 'SOCIAL_INTERACTION')
    // 修复说明：[高危-越权]，原因：查重未按访问者数据范围过滤，SALES 可探测其他团队客户存在性且 409 返回完整客户行；现按数据范围过滤。
    const duplicates = await findDuplicateCustomers(db, fingerprints, { customerScope: scopeFor(actor) })
    if (duplicates.length && body.confirmNoDuplicate !== true) return send(res, 409, { error: { code: 'DUPLICATE_REVIEW_REQUIRED', message: '发现可能重复客户，请人工确认后再转线索。', detail: { candidates: duplicates } } })
    // 修复说明：[中危-数据一致性]，原因：建线索与互动状态回写原为两步无事务，重试会重复建线索；编号 count+1 并发撞唯一约束即 500；现事务化 + 编号加随机段 + P2002 转 409。
    let lead, row
    try {
      ;({ lead, row } = await db.$transaction(async (tx) => {
        const created = await tx.lead.create({ data: { ...prepareEncryptedLead({ ...candidate, source: 'SOCIAL', channel: interaction.platform, productInterest: { socialInteractionId: interaction.id, intent: interaction.intent, campaignCode: interaction.campaignCode } }), code: `${await nextLeadCode(tx)}-${randomBytes(2).toString('hex').toUpperCase()}`, ownerId: actor.id, createdById: actor.id } })
        const updated = await tx.socialInteraction.update({ where: { id: interaction.id }, data: { leadId: created.id, status: 'CONVERTED' } })
        await audit(tx, actor, 'CONVERT_TO_LEAD', 'social_interaction', updated.id, { leadId: created.id, intent: updated.intent, pii: publicPiiStorageSummary(created), duplicateConfirmed: body.confirmNoDuplicate === true })
        return { lead: created, row: updated }
      }))
    } catch (error) {
      if (error?.code === 'P2002') throw new HttpError(409, 'DUPLICATE_REQUEST', '互动已转换或编号冲突，请刷新后重试。')
      throw error
    }
    return send(res, 201, { data: { interaction: row, lead } })
  }

  return false
}
