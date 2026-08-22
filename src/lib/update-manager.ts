import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto'

// ============ 版本 ============

let cachedVersion: string | null = null

/** 读取当前应用版本（package.json version），module 级 cache */
export function getVersion(): string {
  if (cachedVersion) return cachedVersion
  try {
    const pkgPath = path.join(process.cwd(), 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (pkg.version) {
        cachedVersion = pkg.version
        return pkg.version
      }
    }
  } catch {
    // ignore
  }
  return process.env.APP_VERSION || '0.0.0'
}

// ============ 镜像源安全 ============

export interface MirrorNormResult {
  ok: boolean
  url: string
  error?: string
}

/** 镜像 URL 安全校验：HTTPS 强制、禁账号/查询参数/片段；localhost 例外需 env 白名单 */
export function normalizeMirror(raw: string): MirrorNormResult {
  if (!raw) return { ok: false, url: '', error: '镜像源未配置' }
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, url: '', error: '镜像源 URL 格式无效' }
  }
  const allowLocalhost = process.env.NEXFAB_MIRROR_ALLOW_LOCALHOST === 'true'
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(allowLocalhost && isLocal)) {
    return { ok: false, url: '', error: '镜像源必须为 HTTPS' }
  }
  if (url.username || url.password) {
    return { ok: false, url: '', error: '镜像源不得含账号密码' }
  }
  return { ok: true, url: `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}` }
}

// ============ manifest 校验 ============

export interface UpdateManifest {
  latestVersion: string
  minimumVersion?: string
  changelog?: string
  releases?: { version: string; url: string; sha256?: string }[]
  sha256?: string
}

const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/** manifest 严格校验 */
export function validateManifest(obj: unknown): { ok: boolean; manifest?: UpdateManifest; error?: string } {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'manifest 非对象' }
  const m = obj as Record<string, unknown>
  if (typeof m.latestVersion !== 'string' || !VERSION_RE.test(m.latestVersion)) {
    return { ok: false, error: 'latestVersion 格式无效（应为 x.y.z）' }
  }
  const manifest: UpdateManifest = { latestVersion: m.latestVersion }
  if (typeof m.minimumVersion === 'string') manifest.minimumVersion = m.minimumVersion
  if (typeof m.changelog === 'string') manifest.changelog = m.changelog
  if (Array.isArray(m.releases)) manifest.releases = m.releases as UpdateManifest['releases']
  if (typeof m.sha256 === 'string') manifest.sha256 = m.sha256
  return { ok: true, manifest }
}

/** semver 比较（含 pre-release）：返回 -1（a<b）/0/1（a>b） */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('-')
  const pb = b.split('-')
  const va = pa[0].split('.').map(Number)
  const vb = pb[0].split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return (va[i] || 0) < (vb[i] || 0) ? -1 : 1
  }
  const prea = pa[1] || ''
  const preb = pb[1] || ''
  if (!prea && preb) return 1
  if (prea && !preb) return -1
  if (prea < preb) return -1
  if (prea > preb) return 1
  return 0
}

// ============ 拉取 + 签名 ============

export interface LoadedManifest {
  ok: boolean
  manifest?: UpdateManifest
  sha256?: string
  signatureValid: boolean | null // null = 未校验
  error?: string
}

function verifySignature(publicKeyPem: string, data: Buffer, signatureB64: string): boolean {
  const pub = createPublicKey(publicKeyPem)
  const sig = Buffer.from(signatureB64, 'base64')
  return cryptoVerify(null, data, pub, sig)
}

/** 拉取 manifest.json + SHA256 + 可选 RSA 签名校验（x-manifest-signature header） */
export async function loadVerifiedManifest(mirrorUrl: string): Promise<LoadedManifest> {
  const norm = normalizeMirror(mirrorUrl)
  if (!norm.ok) return { ok: false, signatureValid: null, error: norm.error }
  try {
    const res = await fetch(`${norm.url}/manifest.json`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return { ok: false, signatureValid: null, error: `拉取 manifest 失败: HTTP ${res.status}` }
    const buf = Buffer.from(await res.arrayBuffer())
    const sha256 = createHash('sha256').update(buf).digest('hex')
    let parsed: unknown
    try {
      parsed = JSON.parse(buf.toString('utf8'))
    } catch {
      return { ok: false, sha256, signatureValid: null, error: 'manifest JSON 解析失败' }
    }
    const v = validateManifest(parsed)
    if (!v.ok || !v.manifest) return { ok: false, sha256, signatureValid: null, error: v.error }

    let signatureValid: boolean | null = null
    const pubKey = process.env.NEXFAB_UPDATE_PUBLIC_KEY
    const sigHeader = res.headers.get('x-manifest-signature') || ''
    if (pubKey && sigHeader) {
      try {
        signatureValid = verifySignature(pubKey, buf, sigHeader)
      } catch {
        signatureValid = false
      }
    }
    return { ok: true, manifest: v.manifest, sha256, signatureValid }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, signatureValid: null, error: `拉取失败: ${msg}` }
  }
}
