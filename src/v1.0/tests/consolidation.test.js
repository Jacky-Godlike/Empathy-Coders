import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyOperation,
  mergeCustomer,
  mergeDeliveryDate,
  mergeNotes,
  mergeSourceMessages,
} from '../server/services/consolidation.js';

test('add merges quantities for the same SKU and appends new items', () => {
  const result = applyOperation(
    [
      { sku: 'A', productName: 'A', quantity: 20 },
      { sku: 'B', productName: 'B', quantity: 5 },
    ],
    'add',
    [
      { sku: 'A', productName: 'A', quantity: 10 },
      { sku: 'C', productName: 'C', quantity: 2 },
    ],
  );
  assert.deepEqual(
    result.items.map((item) => [item.sku, item.quantity]),
    [
      ['A', 30],
      ['B', 5],
      ['C', 2],
    ],
  );
});

test('replace changes the matching quantity and leaves other lines untouched', () => {
  const result = applyOperation(
    [
      { sku: 'A', productName: 'A', quantity: 30 },
      { sku: 'B', productName: 'B', quantity: 5 },
    ],
    'replace',
    [{ sku: 'A', productName: 'A', quantity: 25 }],
  );
  assert.deepEqual(
    result.items.map((item) => [item.sku, item.quantity]),
    [
      ['A', 25],
      ['B', 5],
    ],
  );
});

test('remove deletes a line and removeAll empties the order', () => {
  const removed = applyOperation(
    [
      { sku: 'A', productName: 'A', quantity: 12 },
      { sku: 'B', productName: 'B', quantity: 6 },
    ],
    'remove',
    [{ sku: 'B', productName: 'B', quantity: null }],
  );
  assert.deepEqual(removed.items.map((item) => item.sku), ['A']);
  assert.deepEqual(removed.removed, ['sku:B']);

  const cleared = applyOperation(
    [{ sku: 'A', productName: 'A', quantity: 12 }],
    'remove',
    [],
    { removeAll: true },
  );
  assert.equal(cleared.items.length, 0);
});

test('notes and source messages are deduplicated', () => {
  assert.equal(mergeNotes('COD', 'same address'), 'COD; same address');
  assert.equal(mergeNotes('COD; same address', 'same address'), 'COD; same address');
  assert.deepEqual(mergeSourceMessages(['MSG-1'], 'MSG-2'), ['MSG-1', 'MSG-2']);
  assert.deepEqual(mergeSourceMessages(['MSG-1'], 'MSG-1'), ['MSG-1']);
});

test('customer merge keeps the master identity and accepts an updated address', () => {
  const merged = mergeCustomer(
    {
      customerId: 'CUST-001',
      name: 'Nurul Aisyah',
      businessName: 'Kedai Kopi Nurul',
      phone: '+60 12-345 6789',
      address: 'Old address',
      addressSource: 'profile',
      matched: true,
    },
    {
      name: 'Nurul Aisyah',
      phone: '+60 12-345 6789',
      address: 'New address',
      addressSource: 'message',
    },
  );
  assert.equal(merged.customerId, 'CUST-001');
  assert.equal(merged.businessName, 'Kedai Kopi Nurul');
  assert.equal(merged.address, 'New address');
  assert.equal(merged.addressSource, 'message');
});

test('delivery date merge keeps the old date when the update has none', () => {
  assert.equal(mergeDeliveryDate('2026-10-23', null, 'add'), '2026-10-23');
  assert.equal(mergeDeliveryDate('2026-10-23', '2026-10-24', 'update'), '2026-10-24');
});
