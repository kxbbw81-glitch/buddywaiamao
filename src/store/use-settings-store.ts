import { create } from 'zustand'

// ─── Types ───────────────────────────────────────────────────────────────────

/** 通知偏好设置 */
export interface NotificationSettings {
  /** 新询盘到达 */
  inquiry: boolean
  /** 报价审批 */
  approval: boolean
  /** 订单状态变更 */
  orderStatus: boolean
  /** 付款提醒 */
  payment: boolean
}

/** 显示设置 */
export interface DisplaySettings {
  /** 默认每页条数 */
  pageSize: '10' | '20' | '50'
  /** 紧凑表格模式 */
  compactTable: boolean
  /** 深色模式 */
  darkMode: boolean
  /** 界面语言 */
  language: 'zh-CN' | 'en'
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const NOTIFICATION_KEY = 'nexfab_settings_notifications' as const
const DISPLAY_KEY = 'nexfab_settings_display' as const

const defaultNotifications: NotificationSettings = {
  inquiry: true,
  approval: true,
  orderStatus: true,
  payment: true,
}

const defaultDisplay: DisplaySettings = {
  pageSize: '20',
  compactTable: false,
  darkMode: false,
  language: 'zh-CN',
}

// ─── LocalStorage helpers ────────────────────────────────────────────────────

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    /* ignore parse errors */
  }
  return fallback
}

function saveJSON<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota errors */
  }
}

// ─── Store interface ─────────────────────────────────────────────────────────

interface SettingsState {
  notifications: NotificationSettings
  display: DisplaySettings
  /** Whether hydration from localStorage has completed */
  hydrated: boolean
}

interface SettingsActions {
  /** Read localStorage & populate store (call once after mount) */
  hydrate: () => void
  toggleNotification: (key: keyof NotificationSettings) => void
  setNotification: (key: keyof NotificationSettings, value: boolean) => void
  setPageSize: (value: DisplaySettings['pageSize']) => void
  setCompactTable: (value: boolean) => void
  setDarkMode: (value: boolean) => void
  setLanguage: (value: DisplaySettings['language']) => void
  /** Reset all settings to defaults */
  resetAll: () => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  // ── State (defaults; overwritten by hydrate()) ──
  notifications: { ...defaultNotifications },
  display: { ...defaultDisplay },
  hydrated: false,

  // ── Actions ──
  hydrate: () => {
    const notifications = loadJSON<NotificationSettings>(NOTIFICATION_KEY, defaultNotifications)
    const display = loadJSON<DisplaySettings>(DISPLAY_KEY, defaultDisplay)
    set({ notifications, display, hydrated: true })
  },

  toggleNotification: (key) => {
    const next = {
      ...get().notifications,
      [key]: !get().notifications[key],
    }
    saveJSON(NOTIFICATION_KEY, next)
    set({ notifications: next })
  },

  setNotification: (key, value) => {
    const next = { ...get().notifications, [key]: value }
    saveJSON(NOTIFICATION_KEY, next)
    set({ notifications: next })
  },

  setPageSize: (value) => {
    const next = { ...get().display, pageSize: value }
    saveJSON(DISPLAY_KEY, next)
    set({ display: next })
  },

  setCompactTable: (value) => {
    const next = { ...get().display, compactTable: value }
    saveJSON(DISPLAY_KEY, next)
    set({ display: next })
  },

  setDarkMode: (value) => {
    const next = { ...get().display, darkMode: value }
    saveJSON(DISPLAY_KEY, next)
    set({ display: next })
  },

  setLanguage: (value) => {
    const next = { ...get().display, language: value }
    saveJSON(DISPLAY_KEY, next)
    set({ display: next })
  },

  resetAll: () => {
    saveJSON(NOTIFICATION_KEY, defaultNotifications)
    saveJSON(DISPLAY_KEY, defaultDisplay)
    set({
      notifications: { ...defaultNotifications },
      display: { ...defaultDisplay },
    })
  },
}))

// ─── Convenience hook (re-exported) ──────────────────────────────────────────

/**
 * `useSettings` — drop-in alias for `useSettingsStore`.
 * Reads/writes `nexfab_settings_notifications` & `nexfab_settings_display` in
 * localStorage via Zustand.
 */
export const useSettings = useSettingsStore
