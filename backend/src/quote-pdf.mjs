function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?')
}

function money(value, currency = 'USD') {
  const number = Number(value || 0)
  return `${currency} ${Number.isFinite(number) ? number.toFixed(2) : '0.00'}`
}

function snapshotLines(snapshot) {
  const quote = snapshot.quote || {}
  const customer = snapshot.customer || {}
  const version = snapshot.version || {}
  const totals = snapshot.totals || {}
  const items = Array.isArray(version.items) ? version.items.slice(0, 18) : []
  return [
    'NexFab Quotation',
    `Quote ID: ${quote.id || '-'}`,
    `Version: ${version.version || '-'}`,
    `Customer: ${customer.name || '-'}`,
    `Currency: ${quote.currency || 'USD'}`,
    `Generated At: ${snapshot.generatedAt || '-'}`,
    `Validity Days: ${snapshot.validityDays || '-'}`,
    '',
    'Items:',
    ...items.map((item, index) => `${index + 1}. ${item.name || item.sku || 'Item'}  Qty: ${item.quantity || 0}  Unit: ${money(item.unitPrice, quote.currency)}  Amount: ${money(item.amount, quote.currency)}`),
    '',
    `Total Amount: ${money(totals.totalAmount, quote.currency)}`,
    `Total Cost: ${money(totals.totalCost, quote.currency)}`,
    `Gross Margin: ${money(totals.grossMargin, quote.currency)}`,
    `Gross Margin Rate: ${Math.round(Number(totals.grossMarginRate || 0) * 10000) / 100}%`,
    '',
    snapshot.disclaimer || 'Manual confirmation required before external sending.',
  ]
}

export function quotePdfBuffer(snapshot) {
  const lines = snapshotLines(snapshot).slice(0, 32)
  const commands = ['BT', '/F1 12 Tf', '50 790 Td']
  lines.forEach((line, index) => {
    if (index > 0) commands.push('0 -22 Td')
    commands.push(`(${pdfEscape(line)}) Tj`)
  })
  commands.push('ET')
  const stream = commands.join('\n')
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ]
  let offset = Buffer.byteLength('%PDF-1.4\n', 'utf8')
  const xref = ['0000000000 65535 f ']
  for (const object of objects) {
    xref.push(String(offset).padStart(10, '0') + ' 00000 n ')
    offset += Buffer.byteLength(object, 'utf8')
  }
  const body = objects.join('')
  const xrefOffset = Buffer.byteLength('%PDF-1.4\n' + body, 'utf8')
  const trailer = `xref\n0 ${objects.length + 1}\n${xref.join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from('%PDF-1.4\n' + body + trailer, 'utf8')
}
