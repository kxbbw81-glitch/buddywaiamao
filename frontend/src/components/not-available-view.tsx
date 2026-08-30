'use client'

import { ShieldCheck } from 'lucide-react'

// 修复说明：[P1-台账外]，原因：无后端实现的导航入口原命中通用"页面接入策略"提示，误导用户以为已具备功能；
// 改为诚实的"未接入"页，明确说明状态与所需后端能力，符合"不伪造业务能力"的项目红线。
export function NotAvailableView({ title, reason, needed }: { title: string; reason: string; needed: string }) {
  return (
    <div className="max-w-[760px] space-y-4">
      <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-800">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-500" /><b>{title}</b></div>
        <p className="mt-2"><b>当前状态：</b>{reason}</p>
        <p className="mt-1 text-xs text-slate-600">按项目红线（不伪造业务能力），此入口在能力接入前保持禁用展示，而不是渲染演示数据。</p>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-900">
        <b>接入所需：</b>{needed}
      </div>
    </div>
  )
}

export function AccountAccessView({ user }: { user: { name: string; email: string; role: string; teamId: string | null } | null }) {
  return (
    <div className="max-w-[760px] space-y-4">
      <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-800">
        <b>账号与权限</b>
        <p className="mt-2">当前登录身份（来自已认证会话，真实数据）：</p>
        {user ? (
          <ul className="mt-1 space-y-1 text-xs">
            <li>· 姓名：{user.name}</li>
            <li>· 邮箱：{user.email}</li>
            <li>· 角色：{user.role}</li>
            <li>· 团队：{user.teamId || '（未分配）'}</li>
          </ul>
        ) : <p className="text-xs text-muted">会话信息加载中…</p>}
        <p className="mt-3"><b>当前状态：</b>账号管理（创建/停用用户、角色分配、团队管理）后端接口尚未提供，本页仅展示只读会话身份；权限矩阵由后端 access 层五角色体系（ADMIN/MANAGER/SALES/FINANCE/EXEC）强制执行。</p>
        <p className="mt-1 text-xs text-slate-600">此页与「运行状态」页相互独立：运维健康数据请见系统管理 → 运行状态。</p>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-900">
        <b>接入所需：</b>后端用户管理端点（列表/创建/停用/角色变更 + 审计），接入后本页替换为完整账号权限管理界面。
      </div>
    </div>
  )
}
