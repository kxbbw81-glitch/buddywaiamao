import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const shell = readFileSync(new URL('src/components/crm-shell.tsx', root), 'utf8')
const view = readFileSync(new URL('src/components/p3-social-acquisition-view.tsx', root), 'utf8')
const api = readFileSync(new URL('src/lib/api.ts', root), 'utf8')

assert.match(shell, /P3SocialAcquisitionView/)
// 修复说明：[低危-测试契约同步]，原因：社媒私信入口已复用 P3 社媒视图，测试仍只允许社媒运营，导致合同测试误报。
assert.match(shell, /\['社媒运营', '社媒私信'\]\.includes\(active\.subName\)/)
assert.match(view, /不会抓取未授权数据、自动发帖、群发私信或回复评论/)
assert.match(view, /api\.submitSocialPost/)
assert.match(view, /api\.approveSocialPost/)
assert.match(view, /api\.recordSocialPostPublished/)
assert.match(view, /api\.convertSocialInteractionToLead/)
assert.match(api, /\/api\/social-posts/)
assert.match(api, /\/api\/social-interactions/)

console.log(JSON.stringify({ result: 'passed', mode: 'p3-social-acquisition-frontend-contract', navigation: true, manualApproval: true, externalPlatformCalls: false }))
