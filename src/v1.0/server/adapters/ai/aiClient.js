import { config, aiStatus } from '../../config.js';
import { isValidISODate } from '../../domain/dates.js';
import { clampNumber, cleanString, normalizeEmail, normalizePhone } from '../../domain/validation.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import { callProvider } from './providers.js';

const ALLOWED_CATEGORIES = new Set([
  'order',
  'order_update',
  'inquiry',
  'advertisement',
  'supplier',
  'payment',
  'spam',
  'other',
]);
const ALLOWED_INTENTS = new Set(['new_order', 'order_update', 'question', 'none']);
const ALLOWED_OPERATIONS = new Set(['none', 'add', 'replace', 'remove', 'update']);
const ALLOWED_MISSING = new Set(['customerName', 'contact', 'items', 'deliveryDate', 'address']);

function parseJsonLoose(text) {
  if (!text) throw new Error('AI returned an empty response');
  let cleaned = String(text).trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('AI response did not contain a JSON object');
  }
  cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned);
}

function resolveProduct(rawItem, products) {
  if (rawItem?.sku) {
    const bySku = products.find((product) => product.sku === rawItem.sku);
    if (bySku) return { product: bySku, matchedBy: 'sku' };
  }
  const name = String(rawItem?.productName || '').toLowerCase().trim();
  if (!name) return { product: null, matchedBy: null };
  const byName = products.find((product) => {
    const productName = String(product.name || '').toLowerCase();
    if (productName === name || productName.includes(name) || name.includes(productName)) return true;
    return (product.aliases || []).some((alias) => {
      const normalized = String(alias).toLowerCase();
      return normalized === name || normalized.includes(name) || name.includes(normalized);
    });
  });
  return byName ? { product: byName, matchedBy: 'name' } : { product: null, matchedBy: null };
}

function unitMismatchFor(product, unit) {
  if (!product || !unit) return false;
  const normalized = String(unit).toLowerCase();
  if (['unit', 'pcs', 'piece'].includes(normalized)) return false;
  return !String(product.unit || '').toLowerCase().includes(normalized);
}

export function normalizeAIResult(raw, message, context = {}) {
  const products = context.products || [];
  const isOrder = Boolean(raw?.isOrder);
  const rawOperation = String(raw?.operation || 'none').toLowerCase();
  const operation = ALLOWED_OPERATIONS.has(rawOperation) ? rawOperation : 'none';
  let category = String(raw?.category || '').toLowerCase();
  if (!ALLOWED_CATEGORIES.has(category)) {
    category = isOrder ? (operation === 'none' ? 'order' : 'order_update') : 'other';
  }
  let intent = String(raw?.intent || '').toLowerCase();
  if (!ALLOWED_INTENTS.has(intent)) {
    intent = isOrder ? (operation === 'none' ? 'new_order' : 'order_update') : 'none';
  }

  const customerRaw = raw?.customer || {};
  const customer = {
    customerId: null,
    name: cleanString(customerRaw.name, 120),
    businessName: cleanString(customerRaw.businessName, 160),
    phone: normalizePhone(customerRaw.phone),
    email: normalizeEmail(customerRaw.email),
    address: cleanString(customerRaw.address, 400),
    addressSource: customerRaw.address ? 'message' : null,
    matched: false,
    type: null,
  };

  const items = [];
  for (const rawItem of Array.isArray(raw?.items) ? raw.items : []) {
    const productName = cleanString(rawItem?.productName, 160);
    if (!productName && !rawItem?.sku) continue;
    const { product, matchedBy } = resolveProduct(rawItem, products);
    const quantity = clampNumber(rawItem?.quantity, 0, 100_000, null);
    const unit = cleanString(rawItem?.unit, 30);
    const unitPrice = clampNumber(rawItem?.unitPrice, 0, 1_000_000, null);
    items.push({
      productName: product?.name || productName || rawItem?.sku,
      sku: product?.sku || null,
      quantity: quantity === 0 ? null : quantity,
      unit,
      unitRaw: unit,
      unitMismatch: unitMismatchFor(product, unit),
      unitPrice,
      matchConfidence: matchedBy === 'sku' ? 0.95 : matchedBy === 'name' ? 0.7 : 0.3,
    });
  }

  const missingFields = (Array.isArray(raw?.missingFields) ? raw.missingFields : []).filter((field) =>
    ALLOWED_MISSING.has(field),
  );

  return {
    messageId: raw?.messageId || message.id,
    isOrder,
    category,
    intent,
    operation: isOrder ? operation : 'none',
    customer,
    items,
    deliveryDate: isValidISODate(raw?.deliveryDate) ? raw.deliveryDate : null,
    deliveryDateConfidence: isValidISODate(raw?.deliveryDate) ? 0.9 : null,
    notes: cleanString(raw?.notes, 600),
    missingFields,
    confidence: clampNumber(raw?.confidence, 0, 1, 0.6),
    reasoning: `AI: ${cleanString(raw?.reasoning, 300) || (isOrder ? 'Order detected.' : 'Not an order.')}`,
    mode: 'ai',
    provider: config.ai.provider,
    model: config.ai.model,
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

/**
 * Extract a batch of messages with the configured AI provider.
 * Returns one result per input message; failed chunks are reported and the
 * caller can fall back to the deterministic extractor for those messages.
 */
export async function extractBatch(messages, context = {}) {
  if (!config.ai.configured) {
    const error = new Error('AI is not configured');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { results: [], meta: { provider: config.ai.provider, model: config.ai.model, chunks: 0, latencyMs: 0 } };
  }

  const products = context.products || [];
  const system = buildSystemPrompt({
    today: context.today,
    products,
    businessName: config.business.name,
  });
  const batches = chunk(messages, config.ai.maxMessagesPerCall);
  const results = new Map();
  const errors = [];
  const usage = [];
  let latencyMs = 0;

  for (const batch of batches) {
    const started = Date.now();
    try {
      const response = await callProvider({
        aiConfig: config.ai,
        system,
        user: buildUserPrompt(batch),
      });
      latencyMs += Date.now() - started;
      if (response.usage) usage.push(response.usage);
      const parsed = parseJsonLoose(response.text);
      const rawResults = Array.isArray(parsed?.results) ? parsed.results : [];
      const byId = new Map();
      rawResults.forEach((result, index) => {
        const id = result?.messageId || batch[index]?.id;
        if (id) byId.set(id, result);
      });
      for (const message of batch) {
        const raw = byId.get(message.id);
        if (raw) {
          results.set(message.id, normalizeAIResult(raw, message, { products, today: context.today }));
        }
      }
    } catch (error) {
      errors.push({
        code: error.code || 'AI_ERROR',
        message: error.message,
        messageIds: batch.map((message) => message.id),
      });
    }
  }

  return {
    results: messages.map((message) => results.get(message.id) || null),
    meta: {
      provider: config.ai.provider,
      model: config.ai.model,
      chunks: batches.length,
      latencyMs,
      usage,
      errors,
    },
  };
}

export async function testConnection() {
  if (!config.ai.configured) {
    return { ok: false, configured: false, ...aiStatus() };
  }
  const started = Date.now();
  const response = await callProvider({
    aiConfig: config.ai,
    system: 'You return only valid JSON.',
    user: 'Return exactly {"ok":true} and nothing else.',
  });
  let parsed = null;
  try {
    parsed = parseJsonLoose(response.text);
  } catch {
    parsed = null;
  }
  return {
    ok: Boolean(parsed?.ok),
    configured: true,
    provider: config.ai.provider,
    model: response.model || config.ai.model,
    latencyMs: Date.now() - started,
  };
}
