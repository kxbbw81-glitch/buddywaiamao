'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Phone, Mail, Info, FileText, ShoppingCart, CheckCheck, Inbox, Loader2 } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ============ Types ============
interface NotificationItem {
  id: string
  type: string
  subject: string | null
  content: string | null
  entityType: string | null
  entityId: string | null
  entityName: string
  entitySubject: string
  userId: string | null
  user: { name: string } | null
  readAt: string | null
  createdAt: string
}

// ============ Icon Mapping ============
const TYPE_ICON_MAP: Record<string, React.ReactNode> = {
  follow_up: <Phone className="h-4 w-4 text-emerald-600" />,
  call: <Phone className="h-4 w-4 text-emerald-600" />,
  email: <Mail className="h-4 w-4 text-teal-600" />,
  system: <Info className="h-4 w-4 text-amber-500" />,
  quote_sent: <FileText className="h-4 w-4 text-emerald-600" />,
  order_placed: <ShoppingCart className="h-4 w-4 text-teal-600" />,
  meeting: <FileText className="h-4 w-4 text-emerald-600" />,
  note: <FileText className="h-4 w-4 text-muted-foreground" />,
}

const TYPE_LABEL_MAP: Record<string, string> = {
  follow_up: '跟进',
  call: '电话',
  email: '邮件',
  system: '系统',
  quote_sent: '报价',
  order_placed: '订单',
  meeting: '会议',
  note: '备注',
}

// ============ Relative Time Helper ============
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`
  return `${Math.floor(diffDays / 365)}年前`
}

// ============ Component ============
export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=10')
      const json = await res.json()
      if (json.success) {
        setNotifications(json.data)
        setUnreadCount(json.unreadCount)
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open, fetchNotifications])

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">通知</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold">通知中心</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            全部已读
          </Button>
        </div>

        <Separator />

        {/* Notification List */}
        <ScrollArea className="h-[360px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">暂无通知</p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((item) => {
                const isUnread = !item.readAt
                return (
                  <div
                    key={item.id}
                    className={`relative px-4 py-3 flex gap-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                      isUnread ? 'border-l-2 border-l-emerald-500' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Type Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        {TYPE_ICON_MAP[item.type] || <Info className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <span className="flex-shrink-0 h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {TYPE_LABEL_MAP[item.type] || item.type}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate mt-0.5">
                        {item.subject || item.content || '系统通知'}
                      </p>
                      {item.entityName && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.entityType === 'customer' && `客户: ${item.entityName}`}
                          {item.entityType === 'inquiry' && `${item.entityName} - ${item.entitySubject}`}
                          {item.entityType === 'quotation' && `${item.entityName} - ${item.entitySubject}`}
                          {item.entityType === 'order' && `${item.entityName} - ${item.entitySubject}`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {item.user?.name && (
                          <span className="mr-1">{item.user.name}</span>
                        )}
                        <span>{formatRelativeTime(item.createdAt)}</span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <div className="px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            onClick={() => {
              setOpen(false)
              useCRMStore.getState().setCurrentNavigation('workbench', 'todo-list')
            }}
          >
            查看全部
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
