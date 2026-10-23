import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluateOrder } from '../server/services/decisionEngine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', 'seed', name), 'utf8'));
const products = read('products.json');
const suppliers = read('suppliers.json');
const stock = read('stock.json');

const today = '2026-10-21';
const now = '2026-10-21T12:00:00.000Z';

function baseOrder(overrides = {}) {
  return {
    customerKey: 'phone:123456789',
    customer: {
      name: 'Nurul Aisyah',
      businessName: 'Kedai Kopi Nurul',
      phone: '+60 12-345 6789',
      email: 'nurul@kedaikopi.my',
      address: '12, Jalan SS2/24, 47300 Petaling Jaya, Selangor',
      addressSource: 'profile',
    },
    items: [],
    deliveryDate: '2026-10-23',
    confidence: 0.9,
    extractionMode: 'rules',
    changeRequest: false,
    ...overrides,
  };
}

function evaluate(order, existingOrders = []) {
  return evaluateOrder(order, {
    products,
    suppliers,
    stock,
    existingOrders,
    today,
    now,
  });
}

test('ready order passes stock, delivery and margin rules', () => {
  const result = evaluate(
    baseOrder({
      items: [
        { sku: 'BEAN-ARABICA-1KG', productName: 'Arabica Coffee Beans', quantity: 25 },
        { sku: 'TEA-TARIK-500G', productName: 'Teh Tarik Powder', quantity: 5 },
      ],
    }),
  );
  assert.equal(result.recommendation.code, 'READY');
  assert.equal(result.totals.revenue, 1512.5);
  assert.equal(result.totals.marginPct, 27.6);
  assert.equal(result.totals.shortageUnits, 0);
  assert.equal(result.checks.completeness.ok, true);
  assert.equal(result.checks.delivery.ok, true);
  assert.equal(result.canApprove, true);
  assert.equal(result.approvalRequiresNote, false);
});

test('shortage with a supplier that can restock becomes procurement', () => {
  const result = evaluate(
    baseOrder({
      customerKey: 'phone:197742201',
      customer: {
        name: 'Pak Su',
        businessName: 'Restoran Nasi Lemak Pak Su',
        phone: '+60 19-774 2201',
        address: '44, Jalan Chow Kit, 50350 Kuala Lumpur',
      },
      items: [
        { sku: 'MILK-FRESH-1L', productName: 'Fresh Milk', quantity: 60 },
        { sku: 'MILK-OAT-1L', productName: 'Oat Milk', quantity: 20 },
      ],
    }),
  );
  assert.equal(result.recommendation.code, 'PROCUREMENT');
  assert.equal(result.totals.shortageUnits, 8);
  assert.ok(result.recommendation.reasons.some((reason) => reason.code === 'SHORTAGE_RESTOCK'));
  assert.equal(result.canApprove, true);
});

test('quote below cost is high risk and requires an override note', () => {
  const result = evaluate(
    baseOrder({
      customerKey: 'phone:125558899',
      customer: {
        name: 'Cafe Lima',
        phone: '+60 12-555 8899',
        address: '12, Jalan Kemuning, 40400 Shah Alam, Selangor',
      },
      items: [
        {
          sku: 'CUP-12OZ',
          productName: '12oz Paper Cups',
          quantity: 100,
          unitPrice: 12,
        },
      ],
      deliveryDate: '2026-10-28',
    }),
  );
  assert.equal(result.recommendation.code, 'HIGH_RISK');
  assert.equal(result.totals.marginPct, -4.2);
  assert.ok(result.checks.profit.belowCostLines.length > 0);
  assert.equal(result.approvalRequiresNote, true);
});

test('shortage that cannot be restocked before delivery is high risk', () => {
  const result = evaluate(
    baseOrder({
      customerKey: 'phone:129081177',
      customer: {
        name: 'Sunway Catering',
        phone: '+60 12-908 1177',
        address: '18, Jalan Lagoon Selatan, 47500 Subang Jaya',
      },
      items: [{ sku: 'MILK-FRESH-1L', productName: 'Fresh Milk', quantity: 100 }],
      deliveryDate: '2026-10-22',
    }),
  );
  assert.equal(result.recommendation.code, 'HIGH_RISK');
  assert.equal(result.checks.delivery.ok, false);
  assert.equal(result.checks.delivery.feasibleForShortages, false);
  assert.ok(result.recommendation.reasons.some((reason) => reason.code === 'SHORTAGE_LATE'));
});

test('missing customer name, date and address blocks approval', () => {
  const result = evaluate(
    baseOrder({
      customerKey: 'phone:182227788',
      customer: {
        name: null,
        businessName: null,
        phone: '+60 18-222 7788',
        email: null,
        address: null,
        addressSource: null,
      },
      items: [{ sku: 'BEAN-ARABICA-1KG', productName: 'Arabica Coffee Beans', quantity: 10 }],
      deliveryDate: null,
    }),
  );
  assert.equal(result.recommendation.code, 'NEEDS_INFO');
  assert.equal(result.checks.completeness.ok, false);
  assert.deepEqual(
    result.checks.completeness.missingKeys.sort(),
    ['address', 'customerName', 'deliveryDate'].sort(),
  );
  assert.equal(result.canApprove, false);
});

test('margin under the 10% rule is a review, not a block', () => {
  const result = evaluate(
    baseOrder({
      customerKey: 'phone:1120984432',
      customer: {
        name: 'BrightWorks Office',
        phone: '+60 11-2098 4432',
        address: 'Level 9, Menara Bright, Jalan Ampang, 50450 Kuala Lumpur',
      },
      items: [
        {
          sku: 'BEAN-ARABICA-1KG',
          productName: 'Arabica Coffee Beans',
          quantity: 20,
          unitPrice: 45,
        },
      ],
      deliveryDate: '2026-10-30',
    }),
  );
  assert.equal(result.recommendation.code, 'REVIEW');
  assert.equal(result.totals.marginPct, 6.7);
  assert.ok(result.checks.price.deviations.length > 0);
  assert.equal(result.canApprove, true);
});

test('post-order stock below safety triggers a review flag', () => {
  const result = evaluate(
    baseOrder({
      customerKey: 'phone:134017788',
      customer: {
        name: 'Kafe Hijau',
        phone: '+60 13-401 7788',
        address: '5, Jalan Gasing, 46000 Petaling Jaya',
      },
      items: [
        { sku: 'TEA-TARIK-500G', productName: 'Teh Tarik Powder', quantity: 20 },
        { sku: 'SUGAR-1KG', productName: 'Granulated Sugar', quantity: 30 },
      ],
      deliveryDate: '2026-10-27',
    }),
  );
  assert.equal(result.recommendation.code, 'REVIEW');
  assert.ok(result.checks.stock.safetyWarnings.some((line) => line.sku === 'TEA-TARIK-500G'));
});

test('possible duplicate is detected for the same customer and overlapping items', () => {
  const existing = {
    id: 'ord_op-1000',
    code: 'OP-1000',
    status: 'draft',
    customerKey: 'phone:123456789',
    items: [{ sku: 'BEAN-ARABICA-1KG', quantity: 10 }],
    createdAt: '2026-10-21T10:00:00.000Z',
  };
  const result = evaluate(
    baseOrder({
      id: 'ord_op-1001',
      items: [{ sku: 'BEAN-ARABICA-1KG', productName: 'Arabica Coffee Beans', quantity: 10 }],
    }),
    [existing],
  );
  assert.equal(result.checks.duplicate.possible, true);
  assert.equal(result.checks.duplicate.matches[0].code, 'OP-1000');
  assert.equal(result.recommendation.code, 'REVIEW');
});

test('unknown product is needs-info and excluded from profit', () => {
  const result = evaluate(
    baseOrder({
      items: [{ productName: 'Almond Milk', sku: null, quantity: 12 }],
    }),
  );
  assert.equal(result.recommendation.code, 'NEEDS_INFO');
  assert.equal(result.checks.productMatch.unknown.length, 1);
  assert.equal(result.totals.revenue, 0);
});
