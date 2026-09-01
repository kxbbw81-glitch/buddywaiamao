import { maskEmail, maskPhone, piiHash, protectPiiFields } from './pii.mjs'

const HASH = /^[a-f0-9]{64}$/i

export function planPiiRecordBackfill(row) {
  const data = {}
  const conflicts = []
  let legacyFields = 0
  for (const field of ['email', 'phone']) {
    if (row[field] == null || row[field] === '') continue
    legacyFields += 1
    if (row[`${field}Ciphertext`]) {
      conflicts.push(field)
      continue
    }
    Object.assign(data, protectPiiFields({ [field]: row[field] }, [field]))
  }
  return { data, legacyFields, conflicts, actionable: Object.keys(data).length > 0 }
}

export function planFingerprintBackfill(row) {
  if (!['EMAIL', 'PHONE'].includes(row.type)) return { data: null, state: 'unsupported' }
  if (HASH.test(row.normalized || '') && String(row.value || '').includes('***')) return { data: null, state: 'already-protected' }
  const normalized = piiHash(row.type, row.normalized || row.value)
  const value = row.type === 'EMAIL' ? maskEmail(row.value || row.normalized) : maskPhone(row.value || row.normalized)
  if (!normalized || !value) return { data: null, state: 'invalid' }
  return { data: { normalized, value }, state: 'actionable' }
}
