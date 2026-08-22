import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getModuleSwitches, ensureModuleSwitch } from '@/lib/ai-settings'

const DEFAULT_MODULES = ['inquiry_analysis', 'quotation_suggestion', 'customer_wakeup', 'agent_chat']

/**
 * GET /api/ai-config/modules — AI 模块开关列表
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  for (const m of DEFAULT_MODULES) {
    await ensureModuleSwitch(m)
  }
  const switches = await getModuleSwitches()
  return NextResponse.json({ success: true, data: switches })
}
