import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============ Country Flag Emojis ============
const COUNTRY_FLAG_MAP: Record<string, string> = {
  '美国': '🇺🇸',
  '德国': '🇩🇪',
  '瑞典': '🇸🇪',
  '澳大利亚': '🇦🇺',
  '韩国': '🇰🇷',
  '日本': '🇯🇵',
  '英国': '🇬🇧',
  '阿联酋': '🇦🇪',
  '法国': '🇫🇷',
  '巴西': '🇧🇷',
  '印度': '🇮🇳',
  '意大利': '🇮🇹',
  '西班牙': '🇪🇸',
  '荷兰': '🇳🇱',
  '加拿大': '🇨🇦',
  '墨西哥': '🇲🇽',
  '泰国': '🇹🇭',
  '越南': '🇻🇳',
  '印尼': '🇮🇩',
  '印度尼西亚': '🇮🇩',
  '马来西亚': '🇲🇾',
  '土耳其': '🇹🇷',
  '南非': '🇿🇦',
  '尼日利亚': '🇳🇬',
  '埃及': '🇪🇬',
  '沙特阿拉伯': '🇸🇦',
  '沙特': '🇸🇦',
  '俄罗斯': '🇷🇺',
  '波兰': '🇵🇱',
  '捷克': '🇨🇿',
}

export function getCountryFlag(country: string): string {
  return COUNTRY_FLAG_MAP[country] || ''
}

// ============ Number & Currency Formatting ============

export function formatCurrency(value: number, currency = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥',
  }
  const symbol = symbols[currency] || '$'
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return value < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}
