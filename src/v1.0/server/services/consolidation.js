import { normalizeName } from '../domain/validation.js';

export function itemKey(item) {
  if (item?.sku) return `sku:${item.sku}`;
  const name = normalizeName(item?.productName);
  return name ? `name:${name}` : null;
}

function findItem(items, incoming) {
  const key = itemKey(incoming);
  if (!key) return -1;
  return items.findIndex((item) => itemKey(item) === key);
}

/**
 * Apply an order-update operation to the current line items.
 * Returns a new array; the input is not mutated.
 */
export function applyOperation(items, operation, newItems = [], { removeAll = false } = {}) {
  const next = items.map((item) => ({ ...item }));
  if (removeAll) return { items: [], removed: next.map(itemKey).filter(Boolean), changed: true };

  const removed = [];
  let changed = false;

  for (const incoming of newItems) {
    const index = findItem(next, incoming);

    if (operation === 'add') {
      if (index >= 0) {
        const current = next[index];
        const currentQuantity = Number(current.quantity);
        const incomingQuantity = Number(incoming.quantity);
        if (Number.isFinite(currentQuantity) && Number.isFinite(incomingQuantity)) {
          current.quantity = currentQuantity + incomingQuantity;
          changed = true;
        } else if (!Number.isFinite(currentQuantity) && Number.isFinite(incomingQuantity)) {
          current.quantity = incomingQuantity;
          changed = true;
        }
      } else if (Number.isFinite(Number(incoming.quantity)) && Number(incoming.quantity) > 0) {
        next.push({ ...incoming });
        changed = true;
      }
      continue;
    }

    if (operation === 'replace') {
      if (index >= 0) {
        const current = next[index];
        if (Number.isFinite(Number(incoming.quantity)) && Number(incoming.quantity) > 0) {
          current.quantity = Number(incoming.quantity);
          changed = true;
        }
        if (Number.isFinite(Number(incoming.unitPrice)) && Number(incoming.unitPrice) > 0) {
          current.unitPrice = Number(incoming.unitPrice);
          changed = true;
        }
      } else if (Number.isFinite(Number(incoming.quantity)) && Number(incoming.quantity) > 0) {
        next.push({ ...incoming });
        changed = true;
      }
      continue;
    }

    if (operation === 'remove') {
      if (index >= 0) {
        removed.push(itemKey(next[index]));
        next.splice(index, 1);
        changed = true;
      }
    }
  }

  return { items: next, removed, changed };
}

export function mergeNotes(existing, incoming) {
  if (!incoming) return existing || null;
  if (!existing) return incoming;
  const normalizedExisting = String(existing).toLowerCase();
  if (normalizedExisting.includes(String(incoming).toLowerCase())) return existing;
  return `${existing}; ${incoming}`.slice(0, 1200);
}

export function mergeCustomer(existing, update) {
  const left = existing || {};
  const right = update || {};
  return {
    customerId: left.customerId || right.customerId || null,
    name: right.name || left.name || null,
    businessName: right.businessName || left.businessName || null,
    phone: right.phone || left.phone || null,
    email: right.email || left.email || null,
    address: right.address || left.address || null,
    addressSource: right.address ? right.addressSource || 'message' : left.addressSource || null,
    matched: Boolean(left.matched || right.matched),
    type: left.type || right.type || null,
  };
}

export function mergeDeliveryDate(existing, incoming, operation) {
  if (incoming) return incoming;
  if (operation === 'update' || operation === 'replace' || operation === 'add') return existing || null;
  return existing || null;
}

export function mergeSourceMessages(existingIds, messageId) {
  const ids = new Set(existingIds || []);
  if (messageId) ids.add(messageId);
  return [...ids];
}
