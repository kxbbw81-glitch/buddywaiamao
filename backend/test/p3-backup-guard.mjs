import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const script = readFileSync(new URL('scripts/backup-postgres.mjs', root), 'utf8')
assert.match(script, /NEXFAB_BACKUP_CONFIRM=CREATE_BACKUP/)
assert.match(script, /NEXFAB_BACKUP_DIR/)
assert.match(script, /pg_dump/)
assert.match(script, /flag: 'wx'/)
assert.doesNotMatch(script, /rm\s+-rf|unlinkSync|truncate/i)

const refused = spawnSync(process.execPath, ['scripts/backup-postgres.mjs'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/nexfab_p2_verify', NEXFAB_BACKUP_DIR: '/private/tmp/nexfab-backup-guard-test' },
  encoding: 'utf8',
})
assert.notEqual(refused.status, 0)
assert.match(refused.stderr, /NEXFAB_BACKUP_CONFIRM=CREATE_BACKUP/)
console.log(JSON.stringify({ result: 'passed', mode: 'p3-backup-guard', explicitConfirmation: true, overwriteProtection: true, automaticExecution: false }))
