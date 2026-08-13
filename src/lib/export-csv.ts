export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: { key: string; label: string }[],
): void {
  // BOM for Excel Chinese compatibility
  const BOM = '\uFEFF'

  // Build header row
  const headers = columns.map((col) => escapeCSV(col.label))
  const headerRow = headers.join(',')

  // Build data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const value = getNestedValue(item, col.key)
        return escapeCSV(formatValue(value))
      })
      .join(',')
  })

  const csvContent = BOM + headerRow + '\n' + rows.join('\n')

  // Trigger browser download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Escape a CSV field value according to RFC 4180
 */
function escapeCSV(value: string): string {
  if (value == null) return ''
  const str = String(value)
  // If the value contains commas, quotes, or newlines, wrap in double quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

/**
 * Get a nested value from an object using dot notation (e.g., "owner.name")
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * Format a value for CSV display
 */
function formatValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    // Handle nested objects like owner, customer, order
    const obj = value as Record<string, unknown>
    if (obj.companyName) return String(obj.companyName)
    if (obj.name) return String(obj.name)
    if (obj.orderNo) return String(obj.orderNo)
    return JSON.stringify(value)
  }
  return String(value)
}
