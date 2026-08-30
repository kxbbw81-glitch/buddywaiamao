'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api'

const demoAccounts = [
  ['admin', '默认管理员'],
  ['sales@nexfab.test', '销售业务员'],
  ['manager@nexfab.test', '销售经理'],
  ['finance@nexfab.test', '财务'],
  ['exec@nexfab.test', '管理层'],
  ['admin@nexfab.test', '超级管理员'],
] as const

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  // 修复说明：[中危-账号枚举]，原因：登录页公开展示全部内部账号并默认预填 admin，构成账号枚举面；生产构建不预填且隐藏演示账号列表。
  const [loginId, setLoginId] = useState(process.env.NODE_ENV === 'production' ? '' : 'admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.login(loginId, password)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.code}：${err.message}`)
      else setError('登录失败，请检查后端服务。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] p-6">
      <Card className="w-full max-w-[460px]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-xs font-bold text-white">NF</div>
            <div>
              <CardTitle>NexFab AI 外贸 CRM</CardTitle>
              <p className="mt-1 text-xs text-muted">P0 正式前端基础平台</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">账号 / 邮箱</span>
              <Input type="text" value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="admin 或 name@example.com" autoComplete="username" required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">密码</span>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" autoComplete="current-password" required />
            </label>
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
            <Button className="w-full" disabled={loading}>{loading ? '登录中...' : '登录'}</Button>
          </form>
          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-6 text-blue-800">
            <b>联调说明：</b>账号、邮箱、密码与权限由现有后端控制；默认 admin 别名由后端映射到唯一启用管理员，前端不保存明文密码、不生成演示数据。
          </div>
          {process.env.NODE_ENV !== 'production' ? (
            <div className="mt-4 grid gap-2 text-xs text-slate-500">
              {demoAccounts.map(([account, role]) => (
                <button key={account} type="button" className="flex justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:border-brand" onClick={() => setLoginId(account)}>
                  <span>{account}</span><span>{role}</span>
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
