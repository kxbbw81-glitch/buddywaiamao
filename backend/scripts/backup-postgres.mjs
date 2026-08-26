import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const confirm = process.env.NEXFAB_BACKUP_CONFIRM
const outputDir = process.env.NEXFAB_BACKUP_DIR

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置；拒绝创建数据库备份。')
if (confirm !== 'CREATE_BACKUP') throw new Error('需要 NEXFAB_BACKUP_CONFIRM=CREATE_BACKUP；拒绝自动执行备份。')
if (!outputDir || !path.isAbsolute(outputDir)) throw new Error('NEXFAB_BACKUP_DIR 必须是明确的绝对路径。')
const resolvedDir = path.resolve(outputDir)
if (resolvedDir === path.parse(resolvedDir).root) throw new Error('拒绝将备份写入文件系统根目录。')

await fs.mkdir(resolvedDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const file = path.join(resolvedDir, `nexfab-crm-${stamp}.dump`)
const manifest = `${file}.sha256.json`
try {
  await fs.access(file)
  throw new Error('目标备份文件已存在；拒绝覆盖。')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

await execFileAsync('pg_dump', [`--dbname=${process.env.DATABASE_URL}`, '--format=custom', '--no-owner', `--file=${file}`], { maxBuffer: 1024 * 1024 })
const content = await fs.readFile(file)
await fs.writeFile(manifest, `${JSON.stringify({ createdAt: new Date().toISOString(), file: path.basename(file), bytes: content.byteLength, sha256: createHash('sha256').update(content).digest('hex'), format: 'pg_dump-custom', restore: 'pg_restore --clean --if-exists --no-owner' }, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ result: 'passed', mode: 'postgres-backup', file: path.basename(file), bytes: content.byteLength, manifest: path.basename(manifest) }))
