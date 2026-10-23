import { addDays, daysBetween, formatLongDate, isValidISODate, todayInMalaysia } from '../domain/dates.js';
import { REQUIRED_FIELDS, RECOMMENDATION, RECOMMENDATION_META } from '../domain/constants.js';
import { formatMYR, fromCents, percent, roundMoney, toCents } from '../domain/money.js';

const DEFAULT_RULES = {
  marginMinPct: 10,
  marginRejectPct: 0,
  priceDeviationPct: 15,
  lowConfidence: 0.55,
  duplicateWindowHours: 48,
  handlingDays: 1,
};

const REQUIRED_LABELS = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field.key, field.label]));

function findProduct(item, products) {
  if (item?.sku) {
    const bySku = products.find((product) => product.sku === item.sku);
    if (bySku) return bySku;
  }
  const name = String(item?.productName || '').toLowerCase().trim();
  if (!name) return null;
  return (
    products.find((product) => {
      const productName = String(product.name || '').toLowerCase();
      if (productName === name || productName.includes(name) || name.includes(productName)) return true;
      return (product.aliases || []).some((alias) => {
        const normalized = String(alias).toLowerCase();
        return normalized === name || normalized.includes(name) || name.includes(normalized);
      });
    }) || null
  );
}

function unitMismatch(product, raw) {
  if (raw?.unitMismatch) return true;
  const unit = String(raw?.unit || '').toLowerCase();
  if (!unit || ['unit', 'pcs', 'piece', 'pieces'].includes(unit)) return false;
  return !String(product?.unit || '').toLowerCase().includes(unit);
}

function normalizeItems(order, products) {
  const normalized = [];
  const unknown = [];
  const invalidQuantity = [];
  const unitMismatches = [];

  for (const raw of order.items || []) {
    const product = findProduct(raw, products);
    const rawQuantity = Number(raw?.quantity);
    const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : null;

    if (!product) {
      const productName = raw?.productName || raw?.sku || 'Unknown product';
      normalized.push({
        sku: raw?.sku || null,
        productName,
        quantity,
        unit: raw?.unit || null,
        unitPrice: raw?.unitPrice ?? null,
        unitCost: null,
        cataloguePrice: null,
        priceSource: 'unknown',
        supplierId: null,
        supplierName: null,
        supplierLeadDays: null,
        safetyStock: null,
        lineRevenue: 0,
        lineCost: 0,
        lineProfit: 0,
        marginPct: null,
        matchConfidence: 0,
        unitMismatch: false,
        unknown: true,
      });
      unknown.push({ productName, sku: raw?.sku || null, quantity });
      continue;
    }

    if (quantity === null) {
      invalidQuantity.push({ productName: product.name, sku: product.sku, quantity: raw?.quantity ?? null });
    }
    const quoted = Number(raw?.unitPrice);
    const hasQuoted = Number.isFinite(quoted) && quoted > 0;
    const unitPrice = hasQuoted ? quoted : product.sellingPrice;
    const unitCost = Number(product.unitCost) || 0;
    const lineRevenueCents = toCents(unitPrice) * (quantity || 0);
    const lineCostCents = toCents(unitCost) * (quantity || 0);
    const lineProfitCents = lineRevenueCents - lineCostCents;
    const mismatch = unitMismatch(product, raw);
    if (mismatch) {
      unitMismatches.push({
        sku: product.sku,
        productName: product.name,
        unit: raw?.unit || null,
        catalogueUnit: product.unit,
      });
    }

    normalized.push({
      sku: product.sku,
      productName: product.name,
      quantity,
      unit: product.unit,
      unitPrice: roundMoney(unitPrice),
      unitCost: roundMoney(unitCost),
      cataloguePrice: roundMoney(product.sellingPrice),
      priceSource: hasQuoted ? 'quoted' : 'catalogue',
      supplierId: product.supplierId || null,
      supplierName: null,
      supplierLeadDays: null,
      safetyStock: Number(product.safetyStock) || 0,
      lineRevenue: fromCents(lineRevenueCents),
      lineCost: fromCents(lineCostCents),
      lineProfit: fromCents(lineProfitCents),
      marginPct: lineRevenueCents > 0 ? percent(lineProfitCents, lineRevenueCents) : null,
      matchConfidence: raw?.matchConfidence ?? (raw?.sku ? 0.95 : 0.6),
      unitMismatch: mismatch,
      unknown: false,
    });
  }

  return { normalized, unknown, invalidQuantity, unitMismatches };
}

function evaluateCompleteness(order, normalized) {
  const missingKeys = [];
  const customer = order.customer || {};
  if (!customer.name && !customer.businessName) missingKeys.push('customerName');
  if (!customer.phone && !customer.email) missingKeys.push('contact');
  if (normalized.filter((item) => !item.unknown && item.quantity > 0).length === 0) missingKeys.push('items');
  if (!isValidISODate(order.deliveryDate)) missingKeys.push('deliveryDate');
  if (!customer.address) missingKeys.push('address');

  return {
    ok: missingKeys.length === 0,
    missing: missingKeys.map((key) => ({ key, label: REQUIRED_LABELS[key] || key })),
    missingKeys,
    addressSource: customer.addressSource || null,
  };
}

function evaluateStock(normalized, { stock, suppliers, rules, deliveryDate, today }) {
  const stockMap = new Map((stock || []).map((row) => [row.sku, row]));
  const supplierMap = new Map((suppliers || []).map((supplier) => [supplier.id, supplier]));
  const daysUntil = isValidISODate(deliveryDate) ? daysBetween(today, deliveryDate) : null;

  const lines = normalized
    .filter((item) => !item.unknown && item.quantity > 0)
    .map((item) => {
      const row = stockMap.get(item.sku) || { sku: item.sku, onHand: 0, reserved: 0 };
      const onHand = Math.max(0, Number(row.onHand) || 0);
      const reserved = Math.max(0, Number(row.reserved) || 0);
      const available = Math.max(0, onHand - reserved);
      const required = item.quantity;
      const shortage = Math.max(0, required - available);
      const postOrderAvailable = available - required;
      const belowSafety = shortage === 0 && postOrderAvailable < item.safetyStock;
      const supplier = supplierMap.get(item.supplierId) || null;
      const supplierLeadDays = supplier ? Number(supplier.leadTimeDays) : null;
      const totalLeadDays = supplierLeadDays === null ? null : supplierLeadDays + rules.handlingDays;
      const canRestockInTime =
        shortage > 0 &&
        totalLeadDays !== null &&
        daysUntil !== null &&
        daysUntil >= 0 &&
        totalLeadDays <= daysUntil;
      const restockBy = shortage > 0 && totalLeadDays !== null ? addDays(today, totalLeadDays) : null;
      const restockCost = fromCents(toCents(item.unitCost) * shortage);
      const supplierMinOrderValue = supplier?.minOrderValue ?? null;
      const belowSupplierMoq =
        shortage > 0 && supplierMinOrderValue !== null && restockCost < supplierMinOrderValue;

      return {
        sku: item.sku,
        productName: item.productName,
        unit: item.unit,
        required,
        onHand,
        reserved,
        available,
        shortage,
        postOrderAvailable,
        safetyStock: item.safetyStock,
        belowSafety,
        supplierId: item.supplierId,
        supplierName: supplier?.name || null,
        supplierLeadDays,
        handlingDays: rules.handlingDays,
        totalLeadDays,
        canRestockInTime,
        restockBy,
        restockCost,
        supplierMinOrderValue,
        belowSupplierMoq,
      };
    });

  const shortageLines = lines.filter((line) => line.shortage > 0);
  const safetyWarnings = lines.filter((line) => line.belowSafety);
  const supplierMoqWarnings = shortageLines.filter((line) => line.belowSupplierMoq);
  const totalShortageUnits = shortageLines.reduce((total, line) => total + line.shortage, 0);
  const shortageValue = fromCents(
    shortageLines.reduce((total, line) => total + toCents(line.restockCost), 0),
  );

  return {
    ok: shortageLines.length === 0,
    lines,
    shortageLines,
    safetyWarnings,
    supplierMoqWarnings,
    totalShortageUnits,
    shortageValue,
  };
}

function evaluateDelivery(order, stock, { today, rules }) {
  const date = order.deliveryDate;
  const validDate = isValidISODate(date);
  const daysUntil = validDate ? daysBetween(today, date) : null;
  const past = daysUntil !== null && daysUntil < 0;
  const shortageLines = stock.shortageLines || [];
  const maxLeadDays = shortageLines.reduce(
    (max, line) => Math.max(max, line.totalLeadDays ?? 0),
    0,
  );
  const feasibleForShortages = shortageLines.every((line) => line.canRestockInTime);
  const ok = validDate && !past && feasibleForShortages;

  let reason = 'No restock needed; delivery date is valid.';
  if (!validDate) reason = 'No delivery date was extracted.';
  else if (past) reason = 'The delivery date is in the past.';
  else if (shortageLines.length > 0 && !feasibleForShortages) {
    reason = `Supplier lead time (${maxLeadDays} days) exceeds the ${daysUntil}-day delivery window.`;
  } else if (shortageLines.length > 0) {
    reason = `Shortages can be restocked within the ${daysUntil}-day delivery window.`;
  } else if (daysUntil === 0) {
    reason = 'Delivery is due today.';
  }

  return {
    ok,
    date: validDate ? date : null,
    daysUntil,
    past,
    maxLeadDays,
    feasibleForShortages,
    reason,
    handlingDays: rules.handlingDays,
  };
}

function evaluateProfit(normalized) {
  const lines = normalized
    .filter((item) => !item.unknown && item.quantity > 0)
    .map((item) => {
      const revenueCents = toCents(item.unitPrice) * item.quantity;
      const costCents = toCents(item.unitCost) * item.quantity;
      const profitCents = revenueCents - costCents;
      return {
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        cataloguePrice: item.cataloguePrice,
        priceSource: item.priceSource,
        lineRevenue: fromCents(revenueCents),
        lineCost: fromCents(costCents),
        lineProfit: fromCents(profitCents),
        marginPct: revenueCents > 0 ? percent(profitCents, revenueCents) : 0,
      };
    });

  const revenueCents = lines.reduce((total, line) => total + toCents(line.lineRevenue), 0);
  const costCents = lines.reduce((total, line) => total + toCents(line.lineCost), 0);
  const profitCents = revenueCents - costCents;
  const belowCostLines = lines.filter((line) => line.unitPrice < line.unitCost);

  return {
    revenue: fromCents(revenueCents),
    cost: fromCents(costCents),
    grossProfit: fromCents(profitCents),
    marginPct: revenueCents > 0 ? percent(profitCents, revenueCents) : 0,
    lines,
    belowCostLines,
    hasQuotedPrice: lines.some((line) => line.priceSource === 'quoted'),
  };
}

function evaluatePrice(normalized, rules) {
  const deviations = normalized
    .filter((item) => !item.unknown && item.priceSource === 'quoted' && item.cataloguePrice > 0)
    .map((item) => {
      const deviationPct = percent(item.unitPrice - item.cataloguePrice, item.cataloguePrice);
      return {
        sku: item.sku,
        productName: item.productName,
        quotedPrice: item.unitPrice,
        cataloguePrice: item.cataloguePrice,
        deviationPct,
        direction: deviationPct < 0 ? 'below' : 'above',
        outsideRule: Math.abs(deviationPct) > rules.priceDeviationPct,
      };
    })
    .filter((deviation) => deviation.outsideRule);

  return {
    ok: deviations.length === 0,
    deviations,
    thresholdPct: rules.priceDeviationPct,
  };
}

function evaluateDuplicate(order, normalized, { existingOrders, rules, now }) {
  if (!order.customerKey || order.changeRequest) {
    return { possible: false, matches: [], windowHours: rules.duplicateWindowHours };
  }
  const currentSkus = new Set(normalized.filter((item) => !item.unknown).map((item) => item.sku));
  const nowMs = Date.parse(now);
  const windowMs = rules.duplicateWindowHours * 3_600_000;
  const matches = (existingOrders || [])
    .filter(
      (candidate) =>
        candidate.id !== order.id &&
        candidate.customerKey === order.customerKey &&
        ['draft', 'needs_info', 'approved'].includes(candidate.status),
    )
    .filter((candidate) => {
      const created = Date.parse(candidate.createdAt);
      return Number.isFinite(created) && Math.abs(nowMs - created) <= windowMs;
    })
    .map((candidate) => {
      const overlapSkus = [
        ...new Set((candidate.items || []).map((item) => item.sku).filter((sku) => currentSkus.has(sku))),
      ];
      return {
        orderId: candidate.id,
        code: candidate.code,
        status: candidate.status,
        createdAt: candidate.createdAt,
        overlapSkus,
      };
    })
    .filter((match) => match.overlapSkus.length > 0);

  return {
    possible: matches.length > 0,
    matches,
    windowHours: rules.duplicateWindowHours,
  };
}

function buildReasons({ order, completeness, productMatch, stock, delivery, profit, price, duplicate, confidence, rules }) {
  const reasons = [];
  const add = (code, text, severity = 'warning') => reasons.push({ code, text, severity });

  if (completeness.missingKeys.length > 0) {
    add(
      'MISSING_FIELDS',
      `Missing: ${completeness.missing.map((field) => field.label.toLowerCase()).join(', ')}.`,
      'warning',
    );
  }
  if (productMatch.unknown.length > 0) {
    add(
      'UNKNOWN_PRODUCT',
      `Product not in catalogue: ${productMatch.unknown.map((item) => item.productName).join(', ')}.`,
      'warning',
    );
  }
  if (productMatch.invalidQuantity.length > 0) {
    add(
      'INVALID_QUANTITY',
      `Quantity missing or invalid for ${productMatch.invalidQuantity.map((item) => item.productName).join(', ')}.`,
      'warning',
    );
  }
  if (productMatch.unitMismatches.length > 0) {
    add(
      'UNIT_MISMATCH',
      `Unit mismatch: ${productMatch.unitMismatches
        .map((item) => `${item.productName} quoted in ${item.unit || 'unknown units'}`)
        .join(', ')}.`,
      'warning',
    );
  }
  if (confidence.low) {
    add(
      'LOW_CONFIDENCE',
      `Extraction confidence is low (${Math.round((confidence.score || 0) * 100)}%). Please verify the fields.`,
      'warning',
    );
  }

  if (delivery.past) add('DELIVERY_PAST', 'The delivery date is in the past.', 'danger');

  for (const line of stock.shortageLines || []) {
    if (line.canRestockInTime) {
      add(
        'SHORTAGE_RESTOCK',
        `Short ${line.shortage} ${line.unit} of ${line.productName}; ${line.supplierName || 'supplier'} can restock by ${formatLongDate(line.restockBy)}.`,
        'info',
      );
    } else if (line.supplierId && delivery.date) {
      add(
        'SHORTAGE_LATE',
        `Short ${line.shortage} ${line.unit} of ${line.productName}; supplier lead time (${line.totalLeadDays ?? 'unknown'} days) is too long for ${formatLongDate(delivery.date)}.`,
        'danger',
      );
    } else if (line.supplierId) {
      add(
        'SHORTAGE_NO_DATE',
        `Short ${line.shortage} ${line.unit} of ${line.productName}; supplier lead time is ${line.totalLeadDays ?? 'unknown'} days but no delivery date was extracted.`,
        'danger',
      );
    } else {
      add(
        'SHORTAGE_NO_SUPPLIER',
        `Short ${line.shortage} ${line.unit} of ${line.productName}; no supplier is on file, so restock cannot be confirmed.`,
        'danger',
      );
    }
    if (line.belowSupplierMoq) {
      add(
        'SUPPLIER_MOQ',
        `Restock value ${formatMYR(line.restockCost)} is below ${line.supplierName}'s minimum order of ${formatMYR(line.supplierMinOrderValue)}.`,
        'warning',
      );
    }
  }

  for (const line of stock.safetyWarnings || []) {
    add(
      'BELOW_SAFETY',
      `After fulfilment, ${line.productName} will be below safety stock (${line.postOrderAvailable} vs ${line.safetyStock}).`,
      'warning',
    );
  }

  if (profit.belowCostLines.length > 0) {
    add(
      'BELOW_COST',
      `Quoted price is below unit cost for ${profit.belowCostLines.map((line) => line.productName).join(', ')}.`,
      'danger',
    );
  }
  if (profit.revenue > 0 && profit.marginPct < rules.marginRejectPct) {
    add('NEGATIVE_MARGIN', `Gross margin is ${profit.marginPct.toFixed(1)}%, below the ${rules.marginRejectPct}% floor.`, 'danger');
  } else if (profit.revenue > 0 && profit.marginPct < rules.marginMinPct) {
    add(
      'LOW_MARGIN',
      `Gross margin ${profit.marginPct.toFixed(1)}% is below the ${rules.marginMinPct}% rule.`,
      'warning',
    );
  }

  for (const deviation of price.deviations) {
    add(
      'PRICE_DEVIATION',
      `Quoted price ${formatMYR(deviation.quotedPrice)} is ${Math.abs(deviation.deviationPct).toFixed(1)}% ${deviation.direction} catalogue price ${formatMYR(deviation.cataloguePrice)} for ${deviation.productName}.`,
      'warning',
    );
  }

  if (duplicate.possible) {
    add(
      'POSSIBLE_DUPLICATE',
      `Possible duplicate of ${duplicate.matches.map((match) => match.code).join(', ')} (same customer, overlapping items within ${duplicate.windowHours}h).`,
      'warning',
    );
  }

  if (order.changeRequest) {
    add('CHANGE_REQUEST', 'This updates an approved order; a fresh human approval is required.', 'info');
  }

  const severityRank = { danger: 0, warning: 1, info: 2 };
  reasons.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return reasons.slice(0, 8);
}

function chooseRecommendation({ order, completeness, productMatch, stock, delivery, profit, price, duplicate, confidence, rules }) {
  const hasInfoGap =
    completeness.missingKeys.length > 0 ||
    productMatch.unknown.length > 0 ||
    productMatch.invalidQuantity.length > 0 ||
    productMatch.unitMismatches.length > 0;

  const hasDanger =
    delivery.past ||
    !delivery.feasibleForShortages ||
    profit.marginPct < rules.marginRejectPct ||
    profit.belowCostLines.length > 0;

  const hasProcurement = stock.totalShortageUnits > 0 && delivery.feasibleForShortages;
  const hasReview =
    profit.marginPct < rules.marginMinPct ||
    stock.safetyWarnings.length > 0 ||
    price.deviations.length > 0 ||
    duplicate.possible ||
    confidence.low;

  let code;
  if (hasInfoGap) code = RECOMMENDATION.NEEDS_INFO;
  else if (hasDanger) code = RECOMMENDATION.HIGH_RISK;
  else if (hasProcurement) code = RECOMMENDATION.PROCUREMENT;
  else if (hasReview) code = RECOMMENDATION.REVIEW;
  else if (order.changeRequest) code = RECOMMENDATION.CHANGE_REQUEST;
  else code = RECOMMENDATION.READY;

  const meta = RECOMMENDATION_META[code];
  const actions =
    code === RECOMMENDATION.NEEDS_INFO
      ? ['request_info', 'edit']
      : code === RECOMMENDATION.HIGH_RISK
        ? ['approve_with_note', 'reject']
        : ['approve', 'reject'];

  return {
    code,
    label: meta.label,
    shortLabel: meta.shortLabel,
    severity: meta.severity,
    description: meta.description,
    reasons: [],
    actions,
    flagged:
      hasInfoGap || hasDanger || hasProcurement || hasReview || Boolean(order.changeRequest),
  };
}

function buildFlags({ completeness, productMatch, stock, delivery, profit, price, duplicate, confidence, order, rules }) {
  const flags = [];
  if (completeness.missingKeys.length > 0) {
    flags.push({ key: 'missing', label: `${completeness.missingKeys.length} missing`, tone: 'warning' });
  }
  if (productMatch.unknown.length > 0) {
    flags.push({ key: 'unknown', label: 'Unmatched product', tone: 'warning' });
  }
  if (productMatch.unitMismatches.length > 0) {
    flags.push({ key: 'unit', label: 'Unit mismatch', tone: 'warning' });
  }
  if (stock.totalShortageUnits > 0) {
    flags.push({ key: 'shortage', label: `Short ${stock.totalShortageUnits}`, tone: delivery.feasibleForShortages ? 'info' : 'danger' });
  }
  if (stock.safetyWarnings.length > 0) {
    flags.push({ key: 'safety', label: 'Below safety', tone: 'warning' });
  }
  if (stock.supplierMoqWarnings.length > 0) {
    flags.push({ key: 'moq', label: 'Below supplier MOQ', tone: 'warning' });
  }
  if (profit.revenue > 0 && profit.marginPct < rules.marginMinPct) {
    flags.push({ key: 'margin', label: `${profit.marginPct.toFixed(1)}% margin`, tone: profit.marginPct < 0 ? 'danger' : 'warning' });
  }
  if (price.deviations.length > 0) {
    flags.push({ key: 'price', label: `Price ${price.deviations[0].direction} ${Math.abs(price.deviations[0].deviationPct).toFixed(0)}%`, tone: 'warning' });
  }
  if (duplicate.possible) {
    flags.push({ key: 'duplicate', label: 'Possible duplicate', tone: 'warning' });
  }
  if (confidence.low) {
    flags.push({ key: 'confidence', label: 'Low confidence', tone: 'warning' });
  }
  if (order.changeRequest) {
    flags.push({ key: 'change', label: 'Change request', tone: 'info' });
  }
  return flags;
}

function buildSummary({ normalized, profit, stock, delivery, completeness, productMatch, recommendation, flags }) {
  const itemLabels = normalized
    .filter((item) => !item.unknown && item.quantity > 0)
    .map((item) => `${item.quantity} × ${item.productName}`);
  const items =
    itemLabels.length === 0
      ? 'No items parsed'
      : itemLabels.slice(0, 2).join(', ') + (itemLabels.length > 2 ? ` +${itemLabels.length - 2} more` : '');

  let stockLabel = stock.lines.length === 0 ? 'No stock check' : 'All in stock';
  if (stock.totalShortageUnits > 0) {
    stockLabel = `${stock.totalShortageUnits} unit${stock.totalShortageUnits === 1 ? '' : 's'} short`;
  } else if (stock.safetyWarnings.length > 0) {
    stockLabel = 'Below safety stock';
  }

  return {
    items,
    itemCount: normalized.filter((item) => !item.unknown).length,
    unitCount: normalized.reduce((total, item) => total + (item.quantity || 0), 0),
    total: profit.revenue,
    marginPct: profit.marginPct,
    delivery: delivery.date,
    daysUntil: delivery.daysUntil,
    stock: stockLabel,
    shortageUnits: stock.totalShortageUnits,
    missingCount: completeness.missingKeys.length,
    unknownCount: productMatch.unknown.length,
    flags,
    recommendation: recommendation.code,
  };
}

/**
 * Evaluate an order against stock, suppliers, margin, delivery and duplicate rules.
 * Pure function: it does not write to storage.
 */
export function evaluateOrder(order, context = {}) {
  const today = context.today || todayInMalaysia();
  const rules = { ...DEFAULT_RULES, ...(context.rules || {}) };
  const products = context.products || [];
  const suppliers = context.suppliers || [];
  const stock = context.stock || [];
  const existingOrders = context.existingOrders || [];
  const now = context.now || new Date().toISOString();

  const { normalized, unknown, invalidQuantity, unitMismatches } = normalizeItems(order, products);
  const completeness = evaluateCompleteness(order, normalized);
  const productMatch = {
    ok: unknown.length === 0 && invalidQuantity.length === 0 && unitMismatches.length === 0,
    unknown,
    invalidQuantity,
    unitMismatches,
  };
  const stockCheck = evaluateStock(normalized, {
    stock,
    suppliers,
    rules,
    deliveryDate: order.deliveryDate,
    today,
  });
  for (const line of stockCheck.lines) {
    const item = normalized.find((entry) => entry.sku === line.sku);
    if (item) item.supplierName = line.supplierName;
  }
  const delivery = evaluateDelivery(order, stockCheck, { today, rules });
  const profit = evaluateProfit(normalized);
  const price = evaluatePrice(normalized, rules);
  const duplicate = evaluateDuplicate(order, normalized, { existingOrders, rules, now });
  const confidence = {
    score: Number.isFinite(Number(order.confidence)) ? Number(order.confidence) : null,
    source: order.extractionMode || null,
    low: Number.isFinite(Number(order.confidence)) && Number(order.confidence) < rules.lowConfidence,
    threshold: rules.lowConfidence,
  };

  const recommendation = chooseRecommendation({
    order,
    completeness,
    productMatch,
    stock: stockCheck,
    delivery,
    profit,
    price,
    duplicate,
    confidence,
    rules,
  });
  recommendation.reasons = buildReasons({
    order,
    completeness,
    productMatch,
    stock: stockCheck,
    delivery,
    profit,
    price,
    duplicate,
    confidence,
    rules,
  });

  const flags = buildFlags({
    completeness,
    productMatch,
    stock: stockCheck,
    delivery,
    profit,
    price,
    duplicate,
    confidence,
    order,
    rules,
  });

  const summary = buildSummary({
    normalized,
    profit,
    stock: stockCheck,
    delivery,
    completeness,
    productMatch,
    recommendation,
    flags,
  });

  return {
    normalizedItems: normalized,
    checks: {
      completeness,
      productMatch,
      stock: stockCheck,
      delivery,
      profit,
      price,
      duplicate,
      confidence,
      rules,
    },
    recommendation,
    canApprove: recommendation.code !== RECOMMENDATION.NEEDS_INFO,
    approvalRequiresNote: recommendation.code === RECOMMENDATION.HIGH_RISK,
    totals: {
      revenue: profit.revenue,
      cost: profit.cost,
      grossProfit: profit.grossProfit,
      marginPct: profit.marginPct,
      itemCount: normalized.filter((item) => !item.unknown).length,
      unitCount: summary.unitCount,
      shortageUnits: stockCheck.totalShortageUnits,
      unknownCount: unknown.length,
      missingCount: completeness.missingKeys.length,
    },
    summary,
  };
}

export { DEFAULT_RULES, findProduct };
