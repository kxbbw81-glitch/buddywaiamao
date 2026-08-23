const MAX_FINGERPRINTS = 12

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeEmail(value) {
  const email = clean(value).toLowerCase()
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function normalizePhone(value) {
  const raw = clean(value)
  if (!raw) return null
  const plus = raw.startsWith('+') ? '+' : ''
  const digits = raw.replace(/[^\d]/g, '')
  return digits.length >= 6 ? `${plus}${digits}` : null
}

export function normalizeDomain(value) {
  const raw = clean(value).toLowerCase()
  if (!raw) return null
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
    const host = new URL(withProtocol).hostname.replace(/^www\./, '')
    return host.includes('.') ? host : null
  } catch {
    return null
  }
}

export function domainFromEmail(value) {
  const email = normalizeEmail(value)
  return email ? email.split('@')[1] : null
}

export function normalizeCompany(value) {
  const company = clean(value)
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
  return company.length >= 2 ? company.slice(0, 160) : null
}

function fingerprint(type, value, normalized = value, source = 'MANUAL') {
  return normalized ? { type, value: clean(value || normalized).slice(0, 255), normalized: clean(normalized).slice(0, 255), source } : null
}

function unique(entries) {
  const seen = new Set()
  return entries.filter(Boolean).filter((entry) => {
    const key = `${entry.type}:${entry.normalized}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, MAX_FINGERPRINTS)
}

export function fingerprintsFromCustomer(customer, source = 'CUSTOMER') {
  return unique([
    fingerprint('COMPANY', customer?.name, normalizeCompany(customer?.name), source),
    fingerprint('DOMAIN', customer?.website, normalizeDomain(customer?.website), source),
  ])
}

export function fingerprintsFromContact(contact, source = 'CONTACT') {
  return unique([
    fingerprint('EMAIL', contact?.email, normalizeEmail(contact?.email), source),
    fingerprint('DOMAIN', domainFromEmail(contact?.email), domainFromEmail(contact?.email), source),
    fingerprint('PHONE', contact?.phone, normalizePhone(contact?.phone), source),
  ])
}

export function fingerprintsFromLead(lead, source = 'LEAD') {
  return unique([
    fingerprint('COMPANY', lead?.companyName, normalizeCompany(lead?.companyName), source),
    fingerprint('EMAIL', lead?.email, normalizeEmail(lead?.email), source),
    fingerprint('DOMAIN', domainFromEmail(lead?.email), domainFromEmail(lead?.email), source),
    fingerprint('PHONE', lead?.phone, normalizePhone(lead?.phone), source),
  ])
}

export function fingerprintsFromDedupeInput(input, source = 'DEDUPE_QUERY') {
  return unique([
    fingerprint('COMPANY', input?.companyName || input?.name, normalizeCompany(input?.companyName || input?.name), source),
    fingerprint('EMAIL', input?.email, normalizeEmail(input?.email), source),
    fingerprint('DOMAIN', input?.website || input?.domain, normalizeDomain(input?.website || input?.domain), source),
    fingerprint('DOMAIN', domainFromEmail(input?.email), domainFromEmail(input?.email), source),
    fingerprint('PHONE', input?.phone || input?.whatsapp, normalizePhone(input?.phone || input?.whatsapp), source),
  ])
}

export async function findDuplicateCustomers(db, entries, { take = 10 } = {}) {
  const fingerprints = unique(entries)
  if (!fingerprints.length) return []
  const rows = await db.customerFingerprint.findMany({
    where: { OR: fingerprints.map(({ type, normalized }) => ({ type, normalized })) },
    include: { customer: { include: { owner: { select: { id: true, name: true, teamId: true } }, _count: { select: { contacts: true, opportunities: true } } } } },
    take,
  })
  const byCustomer = new Map()
  for (const row of rows) {
    if (!row.customer) continue
    const current = byCustomer.get(row.customerId) || { customer: row.customer, matches: [] }
    current.matches.push({ type: row.type, value: row.value, normalized: row.normalized, source: row.source })
    byCustomer.set(row.customerId, current)
  }
  return [...byCustomer.values()]
}

export async function registerCustomerFingerprints(db, customerId, entries, source = 'SYSTEM') {
  const fingerprints = unique(entries).map((entry) => ({ ...entry, source: entry.source || source }))
  if (!fingerprints.length) return []
  const existing = await db.customerFingerprint.findMany({ where: { OR: fingerprints.map(({ type, normalized }) => ({ type, normalized })) } })
  const existingKeys = new Set(existing.map((row) => `${row.type}:${row.normalized}`))
  const created = []
  for (const entry of fingerprints) {
    const key = `${entry.type}:${entry.normalized}`
    if (existingKeys.has(key)) continue
    const row = await db.customerFingerprint.create({ data: { customerId, ...entry } })
    existingKeys.add(key)
    created.push(row)
  }
  return created
}
