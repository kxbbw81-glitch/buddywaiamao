import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'

const { decryptPii } = await import('../src/pii.mjs')
const { planFingerprintBackfill, planPiiRecordBackfill } = await import('../src/pii-backfill-plan.mjs')

const contactPlan = planPiiRecordBackfill({ id: 'contact-1', email: 'Legacy.Buyer@Example.com', phone: '+1 (555) 010-8899', emailCiphertext: null, phoneCiphertext: null })
assert.equal(contactPlan.actionable, true)
assert.equal(contactPlan.data.email, null)
assert.equal(contactPlan.data.phone, null)
assert.equal(decryptPii(contactPlan.data.emailCiphertext), 'Legacy.Buyer@Example.com')
assert.equal(decryptPii(contactPlan.data.phoneCiphertext), '+1 (555) 010-8899')
assert.match(contactPlan.data.emailHash, /^[a-f0-9]{64}$/)

const conflictPlan = planPiiRecordBackfill({ id: 'lead-1', email: 'legacy@example.com', phone: null, emailCiphertext: 'v1.already-present', phoneCiphertext: null })
assert.equal(conflictPlan.actionable, false)
assert.deepEqual(conflictPlan.conflicts, ['email'])

const fingerprintPlan = planFingerprintBackfill({ id: 'fp-1', customerId: 'customer-1', type: 'EMAIL', value: 'legacy@example.com', normalized: 'legacy@example.com' })
assert.equal(fingerprintPlan.state, 'actionable')
assert.match(fingerprintPlan.data.normalized, /^[a-f0-9]{64}$/)
assert.equal(fingerprintPlan.data.value.includes('legacy@example.com'), false)
assert.equal(planFingerprintBackfill({ id: 'fp-2', customerId: 'customer-1', type: 'EMAIL', value: 'le***@example.com', normalized: 'a'.repeat(64) }).state, 'already-protected')

console.log(JSON.stringify({ result: 'passed', mode: 'p0-pii-backfill-plan', contactFields: 2, fingerprintProtected: true }))
