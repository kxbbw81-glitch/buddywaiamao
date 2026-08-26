import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const layout = readFileSync(new URL('src/app/layout.tsx', root), 'utf8')
const shell = readFileSync(new URL('src/components/crm-shell.tsx', root), 'utf8')
const ops = readFileSync(new URL('src/components/p3-ops-status-view.tsx', root), 'utf8')
const registration = readFileSync(new URL('src/components/pwa-registration.tsx', root), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8'))
const worker = readFileSync(new URL('public/sw.js', root), 'utf8')

assert.equal(manifest.display, 'standalone')
assert.equal(manifest.start_url, './', '相对入口需兼容生产 /new 子路径部署')
assert.ok(manifest.icons.length > 0)
assert.match(layout, /const basePath = process\.env\.NEXT_PUBLIC_BASE_PATH \|\| ''/)
assert.match(layout, /manifest:\s*`\$\{basePath\}\/manifest\.webmanifest`/)
assert.match(layout, /width:\s*'device-width'/)
assert.match(registration, /navigator\.serviceWorker\.register\(`\$\{basePath\}\/sw\.js`, \{ scope: `\$\{basePath\}\//)
assert.match(registration, /process\.env\.NODE_ENV !== 'production'/)
assert.doesNotMatch(worker, /fetch\s*[,)]|caches\./, 'PWA worker must not cache CRM API or business data')
assert.match(shell, /h-\[100dvh\]/)
assert.match(shell, /max-sm:.*translate-x/, 'mobile navigation must have a compact drawer')
assert.match(shell, /P3OpsStatusView/)
assert.match(ops, /api\.opsStatus\(\)/)
assert.match(ops, /不会执行迁移、备份、发布、连接器调用/)

console.log(JSON.stringify({ result: 'passed', mode: 'p3-pwa-contract', cacheBusinessData: false, mobileDrawer: true, manifest: true, opsStatusUi: true }))
