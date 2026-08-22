'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bot, KeyRound, Link2, Cpu, ShieldCheck } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AiConfigData {
  provider: string
  baseUrl: string
  model: string
  apiKeyMasked: string
  configured: boolean
}

const MANAGER_ROLES = ['super_admin', 'management', 'sales_manager']

/** 系统管理 → AI 配置：接入 OpenAI 兼容服务（Base URL / 模型 / API Key） */
export function AiConfigView() {
  const { currentUser } = useCRMStore()
  const isManager = MANAGER_ROLES.includes(currentUser?.primaryRole || '')

  const [config, setConfig] = useState<AiConfigData | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-config')
      const json = await res.json()
      if (json.success) {
        setConfig(json.data)
        setBaseUrl(json.data.baseUrl || '')
        setModel(json.data.model || '')
      }
    } catch {
      toast.error('加载 AI 配置失败')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
      toast.error('Base URL 必须以 http(s):// 开头')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai-compatible',
          baseUrl,
          model,
          apiKey: apiKey.trim() || undefined, // 空值表示不变更
        }),
      })
      const json = await res.json()
      if (json.success) {
        setConfig(json.data)
        setApiKey('')
        toast.success(json.data.configured ? 'AI 配置已保存，Agent 对话已接入真实模型' : '已保存（尚未填齐 Base URL / API Key，对话仍为离线降级模式）')
      } else {
        toast.error(json.error || '保存失败')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 状态卡 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-emerald-600" /> Agent AI 服务
            </CardTitle>
            {config?.configured ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">已接入</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300">离线降级模式</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {config?.configured
            ? `Agent 对话当前使用 ${config.model}（${config.provider}）。对话会自动注入你权限范围内的客户、商机与线索数据。`
            : '尚未接入 AI 服务：Agent 对话仍可用（基于本地数据的规则回复），接入 OpenAI 兼容服务后自动切换为真实模型。'}
        </CardContent>
      </Card>

      {/* 配置表单 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">服务配置（OpenAI 兼容）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-baseurl" className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Base URL
            </Label>
            <Input
              id="ai-baseurl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={!isManager || saving}
              placeholder="https://api.openai.com/v1"
            />
            <p className="text-xs text-muted-foreground">
              任意 OpenAI 兼容接口均可（OpenAI / Azure / DeepSeek / 通义 / 本地 Ollama 等），填到 /v1 这一级即可。
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-model" className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" /> 模型名称
            </Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!isManager || saving}
              placeholder="gpt-4o-mini"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-apikey" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> API Key
            </Label>
            <Input
              id="ai-apikey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={!isManager || saving}
              placeholder={config?.apiKeyMasked ? `已保存（${config.apiKeyMasked}），留空表示不变更` : 'sk-...'}
            />
            <p className="text-xs text-muted-foreground">
              Key 仅存于服务端数据库，接口返回时脱敏展示；普通角色不可见。
            </p>
          </div>

          {isManager ? (
            <Button onClick={save} disabled={saving}>
              {saving ? '保存中…' : '保存配置'}
            </Button>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              仅管理角色（超级管理员 / 管理层 / 销售经理）可修改 AI 配置。
            </p>
          )}
        </CardContent>
      </Card>

      {/* 安全说明 */}
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          数据边界：Agent 对话注入的 CRM 上下文与你登录身份的数据权限一致（销售仅本人客户/商机）；
          API Key 不下发前端；所有外部动作仅生成建议，执行需人工批准。
        </span>
      </div>
    </div>
  )
}
