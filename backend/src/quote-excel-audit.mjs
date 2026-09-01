import { HttpError, text } from './http.mjs'
import { quoteRules } from './quote-engine.mjs'

const ERROR_VALUES = new Set(['#VALUE!', '#REF!', '#DIV/0!', '#NAME?', '#N/A', '#NUM!', '#NULL!'])
const MAX_ISSUES = 100

function jsonSize(value, maxBytes, message) {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maxBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', message)
}

function arrayValue(value, field, { max = 200 } = {}) {
  if (value == null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是数组。`)
  if (value.length > max) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 不能超过 ${max} 条。`)
  return value
}

function cellRef(value, field) {
  return text(value, field, { required: true, max: 40 })
}

function cellValueText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function issue(issues, severity, code, message, detail = {}) {
  if (issues.length >= MAX_ISSUES) return
  issues.push({ severity, code, message, detail })
}

function formulaErrorIssues(workbook, issues) {
  for (const item of arrayValue(workbook.formulaErrors, '公式错误', { max: 200 })) {
    const cachedValue = cellValueText(item.cachedValue ?? item.cached_value ?? item.value)
    if (!ERROR_VALUES.has(cachedValue)) continue
    const sheet = text(item.sheet || 'UNKNOWN', '错误工作表', { required: true, max: 80 })
    const cell = cellRef(item.cell, '错误单元格')
    const formula = text(item.formula, '错误公式', { max: 500 })
    const isQuoteCalculator = sheet.includes('报价计算器')
    const isDdp = ['I34', 'I35'].includes(cell) || /^L(4[5-9]|5[0-2])$/.test(cell)
    issue(
      issues,
      isQuoteCalculator && isDdp ? 'BLOCKER' : 'WARN',
      isQuoteCalculator && isDdp ? 'DDP_FORMULA_ERROR' : 'FORMULA_ERROR',
      `${sheet}!${cell} 当前为 ${cachedValue}，不能作为可直接迁移的报价规则。`,
      { sheet, cell, cachedValue, formula },
    )
  }
}

function ddpTextChargeIssues(workbook, issues) {
  const cells = arrayValue(workbook.cells || workbook.keyCells, '关键单元格', { max: 500 })
  for (const item of cells) {
    const sheet = text(item.sheet || 'UNKNOWN', '关键单元格工作表', { required: true, max: 80 })
    const cell = cellValueText(item.cell)
    const label = cellValueText(item.label || item.name)
    const value = item.value ?? item.cachedValue ?? item.cached_value
    const valueText = cellValueText(value)
    const formula = cellValueText(item.formula)
    const looksLikeDdpCharge = sheet.includes('报价计算器') && ['B31', 'B32', 'B33', 'B34', 'B35'].includes(cell)
    const shouldBeNumeric = looksLikeDdpCharge || /关税|增值税|清关|派送|目的港|保险|运费|charge|duty|vat|freight/i.test(label)
    if (shouldBeNumeric && value !== '' && value != null && !Number.isFinite(Number(value))) {
      issue(issues, 'BLOCKER', 'TEXT_IN_NUMERIC_CHARGE', `${sheet}!${cell || '?'} ${label || '费用项'} 是文本值 ${valueText}，不能进入报价求和。`, { sheet, cell, label, value: valueText, formula })
    }
  }
}

function workbookStructureIssues(workbook, issues) {
  const sheets = arrayValue(workbook.sheets, '工作表', { max: 100 })
  if (!sheets.length) issue(issues, 'WARN', 'NO_SHEET_SUMMARY', '缺少工作表结构摘要，无法确认 Excel 范围。')
  const namedRanges = arrayValue(workbook.namedRanges || workbook.definedNames || workbook.defined_names, '命名区域', { max: 200 })
  if (!namedRanges.length) issue(issues, 'WARN', 'NO_NAMED_RANGES', '工作簿未发现命名区域，不能把单元格坐标当作稳定接口。')
  const validations = arrayValue(workbook.dataValidations || workbook.data_validations, '数据验证', { max: 500 })
  if (!validations.length) issue(issues, 'WARN', 'NO_DATA_VALIDATIONS', '工作簿未发现数据验证下拉，产品、贸易术语和费用项仍需后端校验。')
}

function proposedRuleDraft(body, issues) {
  if (!body.proposedRules) return null
  const rules = quoteRules(body.proposedRules)
  const blockerCount = issues.filter((item) => item.severity === 'BLOCKER').length
  return {
    canCreateRuleSet: blockerCount === 0,
    reason: blockerCount === 0 ? null : 'BLOCKERS_REQUIRE_MANUAL_REVIEW',
    suggestedCode: text(body.suggestedCode || rules.code || 'EXCEL_V2_REVIEWED_RULES', '建议规则编码', { max: 80 })?.toUpperCase(),
    suggestedName: text(body.suggestedName || 'Excel V2 审计后规则草稿', '建议规则名称', { max: 120 }),
    rules,
  }
}

export function excelAuditInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', '请求体必须是 JSON 对象。')
  jsonSize(body, 64 * 1024, 'Excel 审计摘要不能超过 64KB。')
  const workbook = body.workbook
  if (!workbook || typeof workbook !== 'object' || Array.isArray(workbook)) throw new HttpError(400, 'VALIDATION_ERROR', 'workbook 必须是 JSON 对象。')
  return {
    sourceName: text(body.sourceName || workbook.name || 'Excel V2 workbook', '来源名称', { required: true, max: 160 }),
    workbook,
    proposedRules: body.proposedRules,
    suggestedCode: body.suggestedCode,
    suggestedName: body.suggestedName,
  }
}

export function auditExcelWorkbook(input) {
  const issues = []
  workbookStructureIssues(input.workbook, issues)
  formulaErrorIssues(input.workbook, issues)
  ddpTextChargeIssues(input.workbook, issues)
  const counts = {
    blockers: issues.filter((item) => item.severity === 'BLOCKER').length,
    warnings: issues.filter((item) => item.severity === 'WARN').length,
    info: issues.filter((item) => item.severity === 'INFO').length,
  }
  const status = counts.blockers > 0 ? 'BLOCKED' : counts.warnings > 0 ? 'CONDITIONAL-PASS' : 'PASS'
  return {
    sourceName: input.sourceName,
    status,
    summary: {
      sheetCount: arrayValue(input.workbook.sheets, '工作表', { max: 100 }).length,
      formulaErrorCount: arrayValue(input.workbook.formulaErrors, '公式错误', { max: 200 }).length,
      namedRangeCount: arrayValue(input.workbook.namedRanges || input.workbook.definedNames || input.workbook.defined_names, '命名区域', { max: 200 }).length,
      dataValidationCount: arrayValue(input.workbook.dataValidations || input.workbook.data_validations, '数据验证', { max: 500 }).length,
      ...counts,
    },
    issues,
    ruleDraft: proposedRuleDraft(input, issues),
  }
}
