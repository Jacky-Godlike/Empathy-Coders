import { parseNaturalDate, todayInMalaysia } from '../../domain/dates.js';
import {
  clampNumber,
  cleanMultiline,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeText,
  phoneKey,
} from '../../domain/validation.js';

const UNIT_PATTERN =
  'boxes?|box|packs?|pack|sleeves?|sleeve|bottles?|bottle|bags?|bag|cartons?|carton|units?|unit|pcs|pieces?|piece|kg|g|litres?|liters?|liter|litre|l|kotak|pak|botol|bungkus|biji';

const UNIT_MAP = {
  box: 'box', boxes: 'box', kotak: 'box',
  pack: 'pack', packs: 'pack', pak: 'pack', bungkus: 'pack',
  sleeve: 'sleeve', sleeves: 'sleeve',
  bottle: 'bottle', bottles: 'bottle', botol: 'bottle',
  bag: 'bag', bags: 'bag',
  carton: 'carton', cartons: 'carton',
  unit: 'unit', units: 'unit', pcs: 'unit', piece: 'unit', pieces: 'unit', biji: 'unit',
  kg: 'kg', g: 'g',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
};

const SIZE_UNITS = new Set(['kg', 'g', 'l']);

const INQUIRY_PATTERN =
  /\b(do you supply|do you deliver|do you have|do u|how much|price list|minimum order|quotation|quote|can i order|available\?|ada tak|boleh tak|what is your|asking about)\b/i;
const SPAM_PATTERN =
  /\b(prize|voucher|winner|congrats|congratulations|lucky draw|claim now|click here|loan|free gift)\b/i;
const AD_PATTERN =
  /\b(promo|promotion|flash sale|discount|%\s*off|buy 1 free 1|limited time|subscribe|webinar|special offer|deal today)\b/i;
const SUPPLIER_PATTERN =
  /\b(we are a wholesale supplier|we supply|our catalogue|our catalog|price list changes|attached update|distributor|wholesale pricing|bulk orders|price list update)\b/i;
const PAYMENT_PATTERN =
  /\b(invoice|payment reminder|due on|bank transfer|receipt|outstanding|statement|arrange payment)\b/i;
const ORDER_PATTERN =
  /\b(nak order|want to order|would like to order|i'd like to order|we'd like to order|please supply|please send|order|pesan|tempah|beli|need|required|hantar|deliver|delivery)\b/i;
const COMMITMENT_PATTERN =
  /\b(need|deliver|delivery|hantar|please supply|nak order|want to order|i'd like to order|we'd like to order|order the|pesan|tempah)\b/i;
const UPDATE_PATTERN =
  /\b(add|also add|tambah|plus|extra|another|change|update|tukar|instead|cancel|remove|delete|batal|tak jadi|same order|my order|order just now)\b/i;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUnit(unit) {
  if (!unit) return null;
  return UNIT_MAP[String(unit).toLowerCase()] || null;
}

function productUnitCategory(product) {
  const unit = String(product.unit || '').toLowerCase();
  if (/\bbox\b/.test(unit)) return 'box';
  if (/\bpack\b/.test(unit)) return 'pack';
  if (/\bsleeve\b/.test(unit)) return 'sleeve';
  if (/\bbottle\b/.test(unit)) return 'bottle';
  if (/\bbag\b/.test(unit)) return 'bag';
  if (/\bcarton\b/.test(unit)) return 'carton';
  if (/\bkg\b/.test(unit)) return 'kg';
  if (/\bl\b/.test(unit) || /litre|liter/.test(unit)) return 'l';
  return 'unit';
}

function isGenericName(name) {
  if (!name) return true;
  const normalized = normalizeName(name);
  if (!normalized) return true;
  return /^(unknown|admin|administrator|finance|sales|support|team|owner|manager|rewards centre|lucky draw|coffee deals|syrup deals|beanworks|whatsapp)$/i.test(
    normalized,
  );
}

function extractPhone(text) {
  const matches = String(text).match(/(?:\+?60|0)(?:1\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}|[3-9][-\s]?\d{3,4}[-\s]?\d{4})/g);
  if (!matches) return null;
  return normalizePhone(matches[0]);
}

function extractEmail(text) {
  const match = String(text).match(/[^\s<>()]+@[^\s<>()]+\.[a-z]{2,}/i);
  return match ? normalizeEmail(match[0]) : null;
}

function extractNameFromText(text) {
  const patterns = [
    /(?:thanks|thank you|regards|from|—|-)\s*[,:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:\n|$)/m,
    /\b(?:i am|i'm|saya|nama saya)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && !isGenericName(match[1])) return match[1].trim();
  }
  return null;
}

function looksLikeAddress(value) {
  if (!value || value.length < 8) return false;
  if (!/\d/.test(value)) return false;
  return (
    /\b(jalan|taman|kampung|lot|level|menara|persiaran|lorong|bukit|bangunan|blok|block|floor|street|road|avenue|suite|ss\d+|seksyen|no\.?|tingkat)\b/i.test(
      value,
    ) || /\b\d{5}\b/.test(value)
  );
}

function extractAddress(text) {
  const patterns = [
    /(?:our|the)\s+address\s+(?:is|:)\s*([^\n.]+)/i,
    /address\s*[:\-]?\s*([^\n.]+)/i,
    /(?:deliver|delivery|ship|send)\s+to\s*[:\-]?\s*([^\n.]+)/i,
    /(?:hantar|penghantaran)\s+(?:ke|kepada)\s*[:\-]?\s*([^\n.]+)/i,
    /alamat\s*[:\-]?\s*([^\n.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const candidate = cleanMultiline(match[1], 300);
      if (candidate && looksLikeAddress(candidate)) return candidate;
    }
  }
  // Fall back to a line that looks like a Malaysian street address.
  for (const line of String(text).split('\n')) {
    const candidate = line.trim();
    if (looksLikeAddress(candidate)) return candidate;
  }
  return null;
}

function extractNotes(text) {
  const bits = String(text)
    .split(/[.\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) =>
      /\b(cod|urgent|before|morning|afternoon|confirm|budget|same address|same delivery|call|note|please|pukul|sebelum|weekend|leave at|no onion)\b/i.test(
        part,
      ),
    );
  const unique = [...new Set(bits)];
  const note = unique.slice(0, 3).join('; ').slice(0, 300);
  return note || null;
}

function findCustomer(message, text, customers) {
  const fromPhone = normalizePhone(message.from);
  const fromEmail = normalizeEmail(message.from);
  const bodyPhone = extractPhone(text);
  const bodyEmail = extractEmail(text);
  const fromName = !isGenericName(message.fromName) ? message.fromName : null;

  const match = customers.find((customer) => {
    if (fromPhone && phoneKey(customer.phone) === phoneKey(fromPhone)) return true;
    if (bodyPhone && phoneKey(customer.phone) === phoneKey(bodyPhone)) return true;
    if (fromEmail && normalizeEmail(customer.email) === fromEmail) return true;
    if (bodyEmail && normalizeEmail(customer.email) === bodyEmail) return true;
    const customerName = normalizeName(customer.businessName || customer.name);
    if (fromName && customerName && normalizeName(fromName).includes(customerName)) return true;
    return false;
  });

  if (match) {
    return {
      customerId: match.id,
      name: match.name,
      businessName: match.businessName || match.name,
      phone: match.phone || fromPhone || bodyPhone || null,
      email: match.email || fromEmail || bodyEmail || null,
      address: null,
      addressSource: null,
      matched: true,
      type: match.type || null,
    };
  }

  return {
    customerId: null,
    name: fromName || extractNameFromText(text),
    businessName: null,
    phone: fromPhone || bodyPhone || null,
    email: fromEmail || bodyEmail || null,
    address: null,
    addressSource: null,
    matched: false,
    type: null,
  };
}

function scoreQuantity({ number, unit, unitRaw, distance, beforeAlias, text, start, end, product }) {
  let score = 0;
  const before = text.slice(Math.max(0, start - 5), start).toLowerCase();
  const after = text.slice(end, end + 16).toLowerCase();

  if (/rm\s*$/.test(before) || /myr\s*$/.test(before)) score -= 12;
  if (/^\s*%/.test(after)) score -= 12;
  if (/^\s*(?:am|pm)\b/.test(after)) score -= 6;
  if (/^\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(after)) score -= 12;
  if (/^\s*(?:st|nd|rd|th)\b/.test(after)) score -= 6;
  if (number >= 2020 && number <= 2035) score -= 10;

  if (unit) {
    score += 3;
    const productCategory = productUnitCategory(product);
    if (SIZE_UNITS.has(unit) && !['kg', 'g', 'l'].includes(productCategory)) {
      // "500g" or "1L" is usually a pack size, not the number of packs.
      score -= 5;
    }
  } else {
    score -= 1;
    if (String(number).length >= 3) score -= 2;
  }

  if (beforeAlias) score += 2;
  else score += 1;
  if (distance <= 20) score += 2;
  else if (distance <= 40) score += 1;
  else if (distance > 90) score -= 2;

  return score;
}

function findQuantity(text, aliasStart, aliasEnd, product) {
  const windowStart = Math.max(0, aliasStart - 90);
  const windowEnd = Math.min(text.length, aliasEnd + 90);
  const windowText = text.slice(windowStart, windowEnd);
  const numberRe = /(?<![\d.])(\d{1,4}(?:\.\d+)?)(?![\d])/g;
  const candidates = [];

  for (const match of windowText.matchAll(numberRe)) {
    const absoluteStart = windowStart + match.index;
    const absoluteEnd = absoluteStart + match[0].length;
    const number = Number(match[1]);
    if (!Number.isFinite(number) || number <= 0 || number > 9999) continue;
    // "12oz cups": 12 is part of the product name, not the quantity.
    if (absoluteStart >= aliasStart && absoluteStart < aliasEnd) continue;

    const rest = text.slice(absoluteEnd, absoluteEnd + 32);
    const unitMatch = new RegExp(`^\\s*(?:(?:more|extra|of|the)\\s+){0,3}(${UNIT_PATTERN})\\b`, 'i').exec(rest);
    const unitRaw = unitMatch ? unitMatch[1].toLowerCase() : null;
    const unit = normalizeUnit(unitRaw);
    const distance = absoluteStart < aliasStart ? aliasStart - absoluteEnd : absoluteStart - aliasEnd;
    const beforeAlias = absoluteStart < aliasStart;
    const score = scoreQuantity({
      number,
      unit,
      unitRaw,
      distance,
      beforeAlias,
      text,
      start: absoluteStart,
      end: absoluteEnd,
      product,
    });

    candidates.push({
      value: number,
      unit,
      unitRaw,
      unitMismatch: Boolean(unit && unit !== productUnitCategory(product) && !SIZE_UNITS.has(unit)),
      score,
      position: absoluteStart,
      distance,
      beforeAlias,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || a.distance - b.distance || (a.beforeAlias === b.beforeAlias ? 0 : a.beforeAlias ? -1 : 1));
  const best = candidates[0];
  return best.score >= 2 ? best : null;
}

/**
 * Match catalogue products in a message. Each result keeps the best alias
 * occurrence for that SKU, and may or may not have a quantity.
 */
export function matchProducts(text, products) {
  const matches = new Map();

  for (const product of products) {
    const aliases = [...(product.aliases || [])]
      .map((alias) => String(alias).toLowerCase())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    for (const alias of aliases) {
      const regex = new RegExp(`(?<![a-z0-9])${escapeRegExp(alias)}(?![a-z0-9])`, 'gi');
      for (const match of text.matchAll(regex)) {
        const index = match.index ?? 0;
        const end = index + match[0].length;
        const quantity = findQuantity(text, index, end, product);
        const candidate = {
          productName: product.name,
          sku: product.sku,
          quantity: quantity?.value ?? null,
          unit: quantity?.unit || null,
          unitRaw: quantity?.unitRaw || null,
          unitMismatch: Boolean(quantity?.unitMismatch),
          position: index,
          alias,
          aliasLength: alias.length,
          matchConfidence: alias.length >= 8 ? 0.95 : 0.8,
          quantityScore: quantity?.score ?? null,
        };
        const existing = matches.get(product.sku);
        if (
          !existing ||
          (candidate.quantity !== null && existing.quantity === null) ||
          (candidate.quantity !== null &&
            existing.quantity !== null &&
            candidate.aliasLength > existing.aliasLength) ||
          (candidate.quantity !== null &&
            existing.quantity !== null &&
            candidate.aliasLength === existing.aliasLength &&
            candidate.quantityScore > existing.quantityScore)
        ) {
          matches.set(product.sku, candidate);
        }
      }
    }
  }

  return [...matches.values()].sort((a, b) => a.position - b.position);
}

function extractPrices(text, items) {
  if (!items.length) return [];
  const prices = [];
  const priceRe = /(?:rm|myr)\s*(\d{1,4}(?:\.\d{1,2})?)|(\d{1,4}(?:\.\d{1,2})?)\s*(?:rm|ringgit)\b/gi;
  for (const match of text.matchAll(priceRe)) {
    const value = Number(match[1] || match[2]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const position = match.index ?? 0;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const item of items) {
      const distance = Math.abs(position - item.position);
      if (distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    if (nearest && nearestDistance <= 140) {
      prices.push({ sku: nearest.sku, value, position });
    }
  }
  return prices;
}

function extractReplaceItems(text, products) {
  const patterns = [
    /(?:change|update|tukar)\s+(?:the\s+)?([a-z0-9 ]{2,40}?)\s+(?:to|jadi)\s+(\d+(?:\.\d+)?)\s*([a-z]*)/i,
    /([a-z0-9 ]{2,40}?)\s+(?:change|update|tukar)\s+(?:to|jadi)\s+(\d+(?:\.\d+)?)\s*([a-z]*)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const phrase = match[1].trim().toLowerCase();
    const product = products.find((entry) =>
      (entry.aliases || []).some((alias) => {
        const normalized = String(alias).toLowerCase();
        return phrase.includes(normalized) || normalized.includes(phrase);
      }),
    );
    if (!product) continue;
    const quantity = Number(match[2]);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    return [
      {
        productName: product.name,
        sku: product.sku,
        quantity,
        unit: normalizeUnit(match[3]),
        unitRaw: match[3] || null,
        unitMismatch: false,
        position: match.index ?? 0,
        alias: phrase,
        aliasLength: phrase.length,
        matchConfidence: 0.9,
        quantityScore: 10,
      },
    ];
  }
  return [];
}

function detectOperation(text) {
  if (/\b(cancel|remove|delete|batal|tak jadi)\b/i.test(text)) return 'remove';
  if (/\b(change|update|tukar|instead of)\b/i.test(text) || /\bnot\s+\d+\s*(?:boxes?|packs?|sleeves?)\b/i.test(text)) {
    return 'replace';
  }
  if (/\b(add|also add|tambah|plus|extra|another)\b/i.test(text)) return 'add';
  if (/\b(instead|actually|same delivery|same order|my order|order just now|sebentar)\b/i.test(text)) {
    return 'update';
  }
  return 'none';
}

function categoryForNonOrder(lower) {
  if (SPAM_PATTERN.test(lower)) return 'spam';
  if (SUPPLIER_PATTERN.test(lower)) return 'supplier';
  if (PAYMENT_PATTERN.test(lower)) return 'payment';
  if (AD_PATTERN.test(lower)) return 'advertisement';
  if (INQUIRY_PATTERN.test(lower)) return 'inquiry';
  return 'other';
}

export function extractMessage(message, context = {}) {
  const text = String(message.body || '');
  const lower = normalizeText(text);
  const products = context.products || [];
  const customers = context.customers || [];
  const today = context.today || todayInMalaysia();

  const operation = detectOperation(lower);
  const allMatches = matchProducts(text, products);
  const replaceItems = operation === 'replace' ? extractReplaceItems(text, products) : [];

  let items;
  if (replaceItems.length > 0) {
    items = replaceItems;
  } else if (operation === 'remove') {
    items = allMatches;
  } else {
    items = allMatches.filter((item) => item.quantity !== null);
  }

  const prices = extractPrices(text, items);
  for (const item of items) {
    const price = prices.find((entry) => entry.sku === item.sku);
    item.unitPrice = price ? price.value : null;
  }

  const customer = findCustomer(message, text, customers);
  const addressFromMessage = extractAddress(text);
  const customerAddress = customer.matched
    ? customers.find((entry) => entry.id === customer.customerId)?.address || null
    : null;
  customer.address = addressFromMessage || customerAddress || null;
  customer.addressSource = addressFromMessage ? 'message' : customerAddress ? 'profile' : null;

  const dateResult = parseNaturalDate(text, today);
  const deliveryDate = dateResult?.iso || null;

  const hasContact = Boolean(customer.phone || customer.email);
  const orderPhrase = ORDER_PATTERN.test(lower);
  const commitment = COMMITMENT_PATTERN.test(lower);
  const inquiry = INQUIRY_PATTERN.test(lower);
  const updateLanguage = UPDATE_PATTERN.test(lower);

  let isOrder = false;
  let category = 'other';
  let intent = 'none';

  if (operation === 'remove' && (items.length > 0 || /\border\b/i.test(lower))) {
    isOrder = true;
    category = 'order_update';
    intent = 'order_update';
  } else if (operation === 'update' && items.length === 0 && deliveryDate && (orderPhrase || /\bdeliver\b/i.test(lower))) {
    isOrder = true;
    category = 'order_update';
    intent = 'order_update';
  } else if (items.length > 0 && !(inquiry && !commitment && operation === 'none')) {
    if (SPAM_PATTERN.test(lower) && !orderPhrase) {
      category = 'spam';
    } else if (SUPPLIER_PATTERN.test(lower) && !commitment) {
      category = 'supplier';
    } else if (PAYMENT_PATTERN.test(lower) && !orderPhrase) {
      category = 'payment';
    } else {
      isOrder = true;
      category = operation === 'none' ? 'order' : 'order_update';
      intent = operation === 'none' ? 'new_order' : 'order_update';
    }
  } else {
    category = categoryForNonOrder(lower);
  }

  const missingFields = [];
  if (isOrder && category !== 'order_update') {
    if (!customer.name) missingFields.push('customerName');
    if (!hasContact) missingFields.push('contact');
    if (items.length === 0) missingFields.push('items');
    if (!deliveryDate) missingFields.push('deliveryDate');
    if (!customer.address) missingFields.push('address');
  }

  let confidence = 0.5;
  if (items.some((item) => item.quantity !== null)) confidence += 0.15;
  if (customer.matched) confidence += 0.1;
  if (hasContact) confidence += 0.05;
  if (deliveryDate) confidence += 0.05;
  if (customer.address) confidence += 0.05;
  if (orderPhrase) confidence += 0.05;
  if (items.some((item) => item.unitMismatch)) confidence -= 0.1;
  if (isOrder && items.length === 0) confidence -= 0.2;
  confidence = clampNumber(confidence, 0.35, 0.95, 0.5);

  const matchedNames = items.map((item) => item.productName).filter(Boolean);
  const reasons = [];
  if (matchedNames.length) reasons.push(`matched ${[...new Set(matchedNames)].join(', ')}`);
  if (customer.matched) reasons.push('customer found in master data');
  if (deliveryDate) reasons.push(`delivery ${dateResult.matched || deliveryDate}`);
  if (missingFields.length) reasons.push(`missing ${missingFields.join(', ')}`);
  if (!isOrder) reasons.push(`classified as ${category}`);

  return {
    messageId: message.id,
    isOrder,
    category,
    intent,
    operation: isOrder ? (operation === 'none' ? 'none' : operation) : 'none',
    customer,
    items: items.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit,
      unitRaw: item.unitRaw,
      unitMismatch: item.unitMismatch,
      unitPrice: item.unitPrice ?? null,
      matchConfidence: item.matchConfidence,
    })),
    deliveryDate,
    deliveryDateConfidence: dateResult?.confidence ?? null,
    notes: extractNotes(text),
    missingFields,
    confidence,
    reasoning: `Rules: ${reasons.join('; ') || 'no order signals'}.`,
    mode: 'rules',
    provider: 'rules-fallback',
    model: null,
  };
}

export const fallbackInternals = {
  detectOperation,
  extractAddress,
  extractEmail,
  extractPhone,
  findQuantity,
  looksLikeAddress,
  matchProducts,
  extractReplaceItems,
};
