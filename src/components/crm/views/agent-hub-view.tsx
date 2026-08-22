'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Bot, Plus, Settings2, Trash2, Pencil, BookOpen, Brain, Timer, BarChart3,
  ShieldCheck, Package, Star,
} from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { cn } from '@/lib/utils'
import { AgentChatPanel } from '@/components/crm/views/agent-chat-view'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ============ 数据类型 ============

type SkillSource = 'builtin' | 'custom'

interface AgentSkill {
  id: string
  name: string
  icon: string
  src: SkillSource
  on: boolean
  desc: string
  params: string // JSON 字符串
}

interface SkillCategory {
  key: string
  name: string
  icon: string
  builtin: boolean
  desc: string
  items: AgentSkill[]
}

// 侧栏二级 key → 分类 key
const SUB_TO_CAT: Record<string, string> = {
  'agent-playbook': 'playbook',
  'agent-memory': 'memory',
  'agent-trigger': 'trigger',
  'agent-quality': 'quality',
}

// 动态分类 sub key 与 cat key 互转（侧栏动态子项 key 形如 agent-cat-<catKey>，支持自定义分类）
const catToSub = (catKey: string) => `agent-cat-${catKey}`
const subToCat = (sub: string) =>
  sub.startsWith('agent-cat-') ? sub.slice('agent-cat-'.length) : (SUB_TO_CAT[sub] || '')

const CATEGORY_ICONS = [BookOpen, Brain, Timer, BarChart3, Star, Package]

// ============ API 封装 ============

async function api<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init)
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || '操作失败')
      return null
    }
    return json.data as T
  } catch {
    toast.error('网络错误，请重试')
    return null
  }
}

async function fetchCats(): Promise<SkillCategory[] | null> {
  return api<SkillCategory[]>('/api/agent/skills')
}

// ============ 主视图 ============

export function AgentHubView() {
  const { currentSubView, setCurrentNavigation } = useCRMStore()
  const [cats, setCats] = useState<SkillCategory[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const data = await fetchCats()
    if (data) setCats(data)
    setLoaded(true)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const activeCatKey = subToCat(currentSubView)

  if (!activeCatKey) {
    return <AgentChatEntry cats={cats} loaded={loaded} onJump={(catKey) => {
      setCurrentNavigation('aihub', catToSub(catKey))
    }} />
  }

  return (
    <SkillsContainer
      cats={cats}
      loaded={loaded}
      activeCatKey={activeCatKey}
      reload={reload}
      onSwitchCat={(catKey) => {
        setCurrentNavigation('aihub', catToSub(catKey))
      }}
    />
  )
}

// ============ Agent 对话入口 ============

function AgentChatEntry({ cats, loaded, onJump }: { cats: SkillCategory[]; loaded: boolean; onJump: (catKey: string) => void }) {
  const totalOn = cats.reduce((n, c) => n + c.items.filter((s) => s.on).length, 0)
  const total = cats.reduce((n, c) => n + c.items.length, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Bot className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Agent 对话</h2>
            <p className="text-sm text-muted-foreground">
              目标驱动的执行型助手——给它一个目标（如「把沉默客户唤醒」），它会结合你的客户与商机数据拆解执行；
              所有外部动作（发邮件/改数据）100% 需人工批准。
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-emerald-600">{loaded ? `${totalOn} / ${total}` : '…'}</div>
            <div className="text-xs text-muted-foreground">skills 已启用</div>
          </div>
        </div>
      </div>

      {/* 对话面板（后端已接入：会话与消息持久化，未配置 AI 时本地降级） */}
      <AgentChatPanel />

      {/* 能力面板：全部分类动态遍历 */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Agent 能力（skills 分类 · 不设限）</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((cat, i) => {
            const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length]
            const on = cat.items.filter((s) => s.on).length
            return (
              <Card
                key={cat.key}
                className="crm-card-hover cursor-pointer"
                onClick={() => onJump(cat.key)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-lg dark:bg-emerald-950">
                    {cat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{cat.name}</span>
                      {!cat.builtin && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">自定义</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {on} / {cat.items.length} 启用 · 点击配置
                    </div>
                  </div>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          安全红线：Agent 的所有外部动作（发送邮件、修改客户/订单数据、对外报价）必须人工批准后执行；
          个人数据（待办/备忘）任何角色仅本人可见，Agent 不越权读取。
        </span>
      </div>
    </div>
  )
}

// ============ Skills 容器 ============

function SkillsContainer({
  cats, loaded, activeCatKey, reload, onSwitchCat,
}: {
  cats: SkillCategory[]
  loaded: boolean
  activeCatKey: string
  reload: () => Promise<void>
  onSwitchCat: (catKey: string) => void
}) {
  const activeCat = cats.find((c) => c.key === activeCatKey) || cats[0]
  const [addOpen, setAddOpen] = useState(false)
  const [catMgrOpen, setCatMgrOpen] = useState(false)

  const toggleSkill = async (skillId: string) => {
    const skill = cats.flatMap((c) => c.items).find((s) => s.id === skillId)
    if (!skill) return
    const ok = await api('/api/agent/skills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: skillId, on: !skill.on }),
    })
    if (ok !== null) await reload()
  }

  const removeSkill = async (skillId: string) => {
    const ok = await api(`/api/agent/skills?id=${encodeURIComponent(skillId)}`, { method: 'DELETE' })
    if (ok !== null) {
      toast.success('已删除自定义 skill')
      await reload()
    }
  }

  if (!loaded || !activeCat) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">加载 skills…</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* 分类 Tab 栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={activeCat.key} onValueChange={onSwitchCat}>
          <TabsList>
            {cats.map((c) => (
              <TabsTrigger key={c.key} value={c.key} className="gap-1.5">
                <span>{c.icon}</span>
                {c.name}
                <span className="text-xs text-muted-foreground">
                  {c.items.filter((s) => s.on).length}/{c.items.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={() => setCatMgrOpen(true)}>
          <Settings2 className="mr-1 h-4 w-4" /> 管理分类
        </Button>
      </div>

      {/* 当前分类说明 + 添加入口 */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{activeCat.icon}</span>
              <h2 className="text-base font-semibold">{activeCat.name}</h2>
              {activeCat.builtin
                ? <Badge variant="secondary" className="h-5 text-[10px]">预置分类</Badge>
                : <Badge variant="outline" className="h-5 text-[10px]">自定义分类</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{activeCat.desc}</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> 添加 skill
          </Button>
        </div>
      </div>

      {/* skill 卡片网格 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {activeCat.items.map((skill) => (
          <Card key={skill.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xl">{skill.icon}</span>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold">{skill.name}</CardTitle>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge
                        variant={skill.src === 'builtin' ? 'secondary' : 'outline'}
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {skill.src === 'builtin' ? '内置' : '自定义'}
                      </Badge>
                      <span className={cn('text-xs', skill.on ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {skill.on ? '已启用' : '已停用'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={skill.on} onCheckedChange={() => toggleSkill(skill.id)} />
                  {skill.src === 'custom' && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSkill(skill.id)}
                      title="删除自定义 skill"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
              <p className="text-sm text-muted-foreground">{skill.desc}</p>
              <pre className="mt-auto overflow-x-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed text-muted-foreground">
                {skill.params}
              </pre>
            </CardContent>
          </Card>
        ))}
        {activeCat.items.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              该分类下暂无 skill，点击右上角「添加 skill」开始配置。
            </CardContent>
          </Card>
        )}
      </div>

      <AddSkillDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        cats={cats}
        defaultCatKey={activeCat.key}
        onSubmit={async (skill, catKey) => {
          const created = await api('/api/agent/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryKey: catKey, ...skill }),
          })
          if (created !== null) {
            toast.success(`已添加 skill「${skill.name}」到「${cats.find((c) => c.key === catKey)?.name}」`)
            await reload()
          }
        }}
      />

      <CategoryManagerDialog
        open={catMgrOpen}
        onOpenChange={setCatMgrOpen}
        cats={cats}
        reload={reload}
      />
    </div>
  )
}

// ============ 添加 skill 弹窗 ============

function AddSkillDialog({
  open, onOpenChange, cats, defaultCatKey, onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  cats: SkillCategory[]
  defaultCatKey: string
  onSubmit: (skill: Omit<AgentSkill, 'id'>, catKey: string) => void
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('⚡')
  const [desc, setDesc] = useState('')
  const [params, setParams] = useState('{}')
  const [catKey, setCatKey] = useState(defaultCatKey)

  useEffect(() => {
    if (open) {
      setName('')
      setIcon('⚡')
      setDesc('')
      setParams('{}')
      setCatKey(defaultCatKey)
    }
  }, [open, defaultCatKey])

  const valid = name.trim() && desc.trim()

  const submit = () => {
    let finalParams = params.trim() || '{}'
    try {
      JSON.parse(finalParams)
    } catch {
      toast.error('参数必须是合法 JSON，例如 {"触发":"沉默>30天"}')
      return
    }
    onSubmit({
      name: name.trim(),
      icon: icon.trim() || '⚡',
      src: 'custom',
      on: true,
      desc: desc.trim(),
      params: finalParams,
    }, catKey)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加 skill</DialogTitle>
          <DialogDescription>
            自定义 skill 归入任意分类；内置 skill 由系统随版本维护，不可删除。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <Label htmlFor="skill-name">名称</Label>
            <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：展会线索快速建档" />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <Label htmlFor="skill-icon">图标</Label>
            <Input id="skill-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="emoji，如 🎪" className="w-24" />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <Label htmlFor="skill-desc">说明</Label>
            <Input id="skill-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="这个 skill 做什么、何时触发" />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <Label>所属分类</Label>
            <Select value={catKey} onValueChange={setCatKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.icon} {c.name}{!c.builtin ? '（自定义）' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start gap-3">
            <Label htmlFor="skill-params" className="pt-2">参数</Label>
            <Textarea
              id="skill-params" value={params} onChange={(e) => setParams(e.target.value)}
              placeholder='JSON 格式，如 {"触发":"沉默>30天","频次":"3次/月"}' rows={3}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!valid} onClick={submit}>添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ 分类管理弹窗 ============

function CategoryManagerDialog({
  open, onOpenChange, cats, reload,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  cats: SkillCategory[]
  reload: () => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const createCat = async () => {
    const name = newName.trim()
    if (!name) return
    if (cats.some((c) => c.name === name)) {
      toast.error('已存在同名分类')
      return
    }
    const ok = await api('/api/agent/skills/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (ok !== null) {
      setNewName('')
      toast.success(`已创建分类「${name}」`)
      await reload()
    }
  }

  const renameCat = async (key: string) => {
    const name = renameValue.trim()
    if (!name) return
    if (cats.some((c) => c.name === name && c.key !== key)) {
      toast.error('已存在同名分类')
      return
    }
    const ok = await api('/api/agent/skills/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, name }),
    })
    if (ok !== null) {
      setRenaming(null)
      toast.success('分类已重命名')
      await reload()
    }
  }

  const deleteCat = async (key: string) => {
    const cat = cats.find((c) => c.key === key)
    if (!cat || cat.builtin) return
    const ok = await api(`/api/agent/skills/categories?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
    if (ok !== null) {
      toast.success(`已删除分类「${cat.name}」`)
      await reload()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>管理 skills 分类</DialogTitle>
          <DialogDescription>
            分类不设限：预置分类之外可自由创建业务分类（如客户服务、产品知识、售后支持）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 py-1">
          <Input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="新分类名称，如：客户服务"
            onKeyDown={(e) => e.key === 'Enter' && createCat()}
          />
          <Button size="sm" onClick={createCat} disabled={!newName.trim()}>
            <Plus className="mr-1 h-4 w-4" /> 新建
          </Button>
        </div>

        <div className="max-h-72 space-y-1.5 overflow-y-auto py-1">
          {cats.map((c) => (
            <div key={c.key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span>{c.icon}</span>
              {renaming === c.key ? (
                <>
                  <Input
                    value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    className="h-8 flex-1" autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && renameCat(c.key)}
                  />
                  <Button size="sm" className="h-7" onClick={() => renameCat(c.key)}>保存</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setRenaming(null)}>取消</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm">
                    {c.name}
                    <span className="ml-2 text-xs text-muted-foreground">{c.items.length} 个 skill</span>
                  </span>
                  {c.builtin ? (
                    <Badge variant="secondary" className="h-5 text-[10px]">预置</Badge>
                  ) : (
                    <>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7" title="重命名"
                        onClick={() => { setRenaming(c.key); setRenameValue(c.name) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="删除分类（含其下 skill）"
                        onClick={() => deleteCat(c.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
