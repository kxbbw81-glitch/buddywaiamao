import { HttpError, text } from './http.mjs'

const TRADE_TERMS = new Set(['EXW', 'FOB', 'CIF', 'DDP'])
const MAX_LINES = 50
const DEFAULT_RULE_SET = {
  code: 'EXCEL_V2_ABSTRACTED_DEFAULT',
  source: 'NexFab Excel V2 audit 20260823',
  currency: 'USD',
  fxRateCnyPerUsd: 7.85,
  marginRate: 0.3,
  minimumMarginRate: 0.15,
  charges: {
    domesticFreightCny: 500,
    exportDeclarationCny: 350,
    inspectionCny: 200,
    documentationCny: 200,
    internationalFreightUsd: 0,
    insuranceRate: 0.005,
    destinationPortChargesUsd: 150,
    customsClearanceUsd: 100,
    dutyRate: 0.05,
    vatRate: 0,
    deliveryFeeUsd: 200,
  },
}

function round2(value) {
  return Number(value.toFixed(2))
}

function numberValue(value, field, { required = false, min = 0, max = 1_000_000_000 } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return 0
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 ${min} 到 ${max} 之间的数字。`)
  return number
}

function rateValue(value, field, fallback) {
  if (value == null || value === '') return fallback
  return numberValue(value, field, { min: 0, max: 5 })
}

function currencyValue(value) {
  const currency = text(value || 'USD', '币种', { required: true, max: 3 })?.toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, 'VALIDATION_ERROR', '币种必须为三位 ISO 代码。')
  return currency
}

function tradeTermValue(value) {
  const term = text(value || 'FOB', '贸易术语', { required: true, max: 3 })?.toUpperCase()
  if (!TRADE_TERMS.has(term)) throw new HttpError(400, 'VALIDATION_ERROR', '贸易术语仅支持 EXW / FOB / CIF / DDP。')
  return term
}

function pickNumber(object, keys, fallback = 0) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return fallback
  for (const key of keys) {
    if (object[key] != null && object[key] !== '') {
      const number = Number(object[key])
      if (Number.isFinite(number)) return number
    }
  }
  return fallback
}

function productCostCny(product, item) {
  if (item.unitCostCny != null) return numberValue(item.unitCostCny, '行项目成本', { min: 0 })
  const costVersions = product.costVersions || {}
  return pickNumber(costVersions, ['currentUnitCostCny', 'unitCostCny', 'current', 'cost', 'standardCostCny'], 0)
}

function productPackingCny(product, item) {
  if (item.packagingCostCny != null) return numberValue(item.packagingCostCny, '包装成本', { min: 0 })
  return pickNumber(product.packing || {}, ['packagingCostCny', 'packaging', 'packingCostCny'], 0)
}

function productWeightKg(product, item) {
  if (item.weightKg != null) return numberValue(item.weightKg, '重量', { min: 0 })
  return pickNumber(product.packing || product.specs || {}, ['weightKg', 'unitWeightKg', 'weight'], 0)
}

function productVolumeM3(product, item) {
  if (item.volumeM3 != null) return numberValue(item.volumeM3, '体积', { min: 0 })
  return pickNumber(product.packing || product.specs || {}, ['volumeM3', 'unitVolumeM3', 'volume'], 0)
}

export function quoteRules(input = {}) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'VALIDATION_ERROR', '报价规则必须是 JSON 对象。')
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 16 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '报价规则不能超过 16KB。')
  const defaultCharges = DEFAULT_RULE_SET.charges
  const chargesInput = input.charges || {}
  if (chargesInput == null || typeof chargesInput !== 'object' || Array.isArray(chargesInput)) throw new HttpError(400, 'VALIDATION_ERROR', '费用规则必须是 JSON 对象。')
  const charges = Object.fromEntries(Object.entries(defaultCharges).map(([key, fallback]) => {
    const isRate = key.endsWith('Rate')
    return [key, isRate ? rateValue(chargesInput[key], `费用项 ${key}`, fallback) : numberValue(chargesInput[key] ?? fallback, `费用项 ${key}`, { min: 0 })]
  }))
  return {
    code: text(input.code || DEFAULT_RULE_SET.code, '规则版本', { required: true, max: 80 }),
    source: text(input.source || DEFAULT_RULE_SET.source, '规则来源', { max: 160 }),
    currency: currencyValue(input.currency || DEFAULT_RULE_SET.currency),
    fxRateCnyPerUsd: numberValue(input.fxRateCnyPerUsd ?? DEFAULT_RULE_SET.fxRateCnyPerUsd, '美元汇率', { required: true, min: 0.0001, max: 1000 }),
    marginRate: rateValue(input.marginRate, '目标利润率', DEFAULT_RULE_SET.marginRate),
    minimumMarginRate: rateValue(input.minimumMarginRate, '最低利润率', DEFAULT_RULE_SET.minimumMarginRate),
    charges,
  }
}

export function quoteCalculationInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', '请求体必须是 JSON 对象。')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 48 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '报价计算请求不能超过 48KB。')
  const items = body.items
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_LINES) throw new HttpError(400, 'VALIDATION_ERROR', `报价计算明细必须是 1 到 ${MAX_LINES} 行数组。`)
  const ruleSetId = text(body.ruleSetId, '报价规则版本', { max: 64 })
  if (ruleSetId && body.rules != null) throw new HttpError(400, 'VALIDATION_ERROR', 'ruleSetId 与临时 rules 不能同时传入。')
  return {
    customerId: text(body.customerId, '客户', { max: 64 }),
    ruleSetId,
    tradeTerm: tradeTermValue(body.tradeTerm),
    rules: ruleSetId ? null : quoteRules(body.rules),
    items: items.map((item, index) => {
      if (item == null || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'VALIDATION_ERROR', `第 ${index + 1} 行报价明细无效。`)
      const quantity = numberValue(item.quantity ?? 1, `第 ${index + 1} 行数量`, { required: true, min: 0.0001, max: 1_000_000 })
      return {
        productId: text(item.productId, `第 ${index + 1} 行产品`, { required: true, max: 64 }),
        quantity,
        unitCostCny: item.unitCostCny,
        packagingCostCny: item.packagingCostCny,
        weightKg: item.weightKg,
        volumeM3: item.volumeM3,
      }
    }),
  }
}

export async function loadCalculationProducts(db, items) {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const products = new Map()
  for (const productId of productIds) {
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) throw new HttpError(404, 'NOT_FOUND', '报价计算中的产品不存在。')
    if (product.active === false) throw new HttpError(400, 'VALIDATION_ERROR', '报价计算中的产品已停用。')
    products.set(productId, product)
  }
  return products
}

export function calculateQuote({ items, products, tradeTerm, rules }) {
  const domesticChargesUsd = (rules.charges.domesticFreightCny + rules.charges.exportDeclarationCny + rules.charges.inspectionCny + rules.charges.documentationCny) / rules.fxRateCnyPerUsd
  const calculatedLines = items.map((item, index) => {
    const product = products.get(item.productId)
    const unitCostCny = productCostCny(product, item)
    const packagingCostCny = productPackingCny(product, item)
    const unitLandedCostCny = unitCostCny + packagingCostCny
    const unitCostUsd = unitLandedCostCny / rules.fxRateCnyPerUsd
    const exwUnitPrice = unitCostUsd * (1 + rules.marginRate)
    return {
      lineNo: index + 1,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity: item.quantity,
      unitCostCny: round2(unitCostCny),
      packagingCostCny: round2(packagingCostCny),
      unitCostUsd: round2(unitCostUsd),
      weightKg: productWeightKg(product, item),
      volumeM3: productVolumeM3(product, item),
      exwUnitPrice: round2(exwUnitPrice),
      exwTotal: round2(exwUnitPrice * item.quantity),
      costTotalUsd: round2(unitCostUsd * item.quantity),
    }
  })
  const quantityTotal = items.reduce((sum, item) => sum + item.quantity, 0)
  if (quantityTotal <= 0) throw new HttpError(400, 'VALIDATION_ERROR', '报价总数量必须大于 0。')
  const exwTotal = calculatedLines.reduce((sum, line) => sum + line.exwTotal, 0)
  const costTotalUsd = calculatedLines.reduce((sum, line) => sum + line.costTotalUsd, 0)
  const fobTotal = exwTotal + domesticChargesUsd
  const insuranceUsd = fobTotal * rules.charges.insuranceRate
  const cifTotal = fobTotal + rules.charges.internationalFreightUsd + insuranceUsd
  const dutyUsd = cifTotal * rules.charges.dutyRate
  const vatUsd = (cifTotal + dutyUsd) * rules.charges.vatRate
  const ddpTotal = cifTotal + rules.charges.destinationPortChargesUsd + rules.charges.customsClearanceUsd + dutyUsd + vatUsd + rules.charges.deliveryFeeUsd
  const termTotals = {
    EXW: exwTotal,
    FOB: fobTotal,
    CIF: cifTotal,
    DDP: ddpTotal,
  }
  const selectedTotal = termTotals[tradeTerm]
  const selectedUnitPrice = selectedTotal / quantityTotal
  // 修复说明：[中危-业务逻辑]，原因：毛利原按"含国内费用/运费/保险/关税的报价总额 - 货款成本"计算，FOB/CIF/DDP 下毛利与毛利率被系统性高估，真实低毛利单不会触发审批提示；现毛利按 EXW 口径（EXW 总额 - 货款成本）计算，与审批判定口径一致。
  const grossMargin = exwTotal - costTotalUsd
  const grossMarginRate = selectedTotal > 0 ? grossMargin / selectedTotal : 0
  const approvalRequired = grossMarginRate < rules.minimumMarginRate
  return {
    ruleSet: {
      code: rules.code,
      source: rules.source,
      currency: rules.currency,
      fxRateCnyPerUsd: rules.fxRateCnyPerUsd,
      marginRate: rules.marginRate,
      minimumMarginRate: rules.minimumMarginRate,
    },
    tradeTerm,
    currency: rules.currency,
    lines: calculatedLines,
    charges: {
      domesticChargesUsd: round2(domesticChargesUsd),
      internationalFreightUsd: round2(rules.charges.internationalFreightUsd),
      insuranceUsd: round2(insuranceUsd),
      destinationPortChargesUsd: round2(rules.charges.destinationPortChargesUsd),
      customsClearanceUsd: round2(rules.charges.customsClearanceUsd),
      dutyUsd: round2(dutyUsd),
      vatUsd: round2(vatUsd),
      deliveryFeeUsd: round2(rules.charges.deliveryFeeUsd),
    },
    totals: {
      quantity: round2(quantityTotal),
      costTotal: round2(costTotalUsd),
      exwTotal: round2(exwTotal),
      fobTotal: round2(fobTotal),
      cifTotal: round2(cifTotal),
      ddpTotal: round2(ddpTotal),
      selectedTotal: round2(selectedTotal),
      selectedUnitPrice: round2(selectedUnitPrice),
      grossMargin: round2(grossMargin),
      grossMarginRate: round2(grossMarginRate),
    },
    approval: {
      required: approvalRequired,
      reason: approvalRequired ? 'LOW_MARGIN_BELOW_MINIMUM' : null,
      minimumMarginRate: rules.minimumMarginRate,
      actualMarginRate: round2(grossMarginRate),
    },
  }
}
