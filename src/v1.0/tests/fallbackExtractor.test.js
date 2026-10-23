import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { extractMessage } from '../server/adapters/ai/fallbackExtractor.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', 'seed', name), 'utf8'));
const products = read('products.json');
const customers = read('customers.json');
const messages = read('messages.json');
const byId = Object.fromEntries(messages.map((message) => [message.id, message]));
const today = '2026-10-21';

function extract(id) {
  return extractMessage(byId[id], { products, customers, today });
}

test('clear WhatsApp order extracts customer, item, date and profile address', () => {
  const result = extract('MSG-1001');
  assert.equal(result.isOrder, true);
  assert.equal(result.category, 'order');
  assert.equal(result.customer.name, 'Nurul Aisyah');
  assert.match(result.customer.phone, /12-345 6789/);
  assert.match(result.customer.address, /Jalan SS2\/24/);
  assert.equal(result.items[0].sku, 'BEAN-ARABICA-1KG');
  assert.equal(result.items[0].quantity, 20);
  assert.equal(result.deliveryDate, '2026-10-23');
});

test('order update is detected as an add operation', () => {
  const result = extract('MSG-1002');
  assert.equal(result.isOrder, true);
  assert.equal(result.category, 'order_update');
  assert.equal(result.operation, 'add');
  assert.deepEqual(
    result.items.map((item) => [item.sku, item.quantity]),
    [
      ['BEAN-ARABICA-1KG', 10],
      ['TEA-TARIK-500G', 5],
    ],
  );
});

test('quantity correction is detected as replace', () => {
  const result = extract('MSG-1012');
  assert.equal(result.isOrder, true);
  assert.equal(result.operation, 'replace');
  assert.equal(result.items[0].sku, 'BEAN-ARABICA-1KG');
  assert.equal(result.items[0].quantity, 25);
});

test('cancel line is detected as remove', () => {
  const result = extract('MSG-1015');
  assert.equal(result.isOrder, true);
  assert.equal(result.operation, 'remove');
  assert.equal(result.items[0].sku, 'SYRUP-VANILLA-750ML');
  assert.equal(result.items[0].quantity, null);
});

test('date-only update is detected without items', () => {
  const result = extract('MSG-1016');
  assert.equal(result.isOrder, true);
  assert.equal(result.operation, 'update');
  assert.equal(result.items.length, 0);
  assert.equal(result.deliveryDate, '2026-10-22');
});

test('ad, inquiry, supplier, payment and spam are filtered', () => {
  assert.equal(extract('MSG-1007').isOrder, false);
  assert.equal(extract('MSG-1007').category, 'advertisement');
  assert.equal(extract('MSG-1006').isOrder, false);
  assert.equal(extract('MSG-1006').category, 'inquiry');
  assert.equal(extract('MSG-1011').isOrder, false);
  assert.equal(extract('MSG-1011').category, 'supplier');
  assert.equal(extract('MSG-1018').isOrder, false);
  assert.equal(extract('MSG-1018').category, 'payment');
  assert.equal(extract('MSG-1019').isOrder, false);
  assert.equal(extract('MSG-1019').category, 'spam');
});

test('missing information is listed for an unknown customer', () => {
  const result = extract('MSG-1017');
  assert.equal(result.isOrder, true);
  assert.equal(result.customer.name, null);
  assert.equal(result.customer.phone, '+60182227788');
  assert.ok(result.missingFields.includes('customerName'));
  assert.ok(result.missingFields.includes('deliveryDate'));
  assert.ok(result.missingFields.includes('address'));
});

test('quoted unit prices are extracted', () => {
  const cups = extract('MSG-2005');
  assert.equal(cups.isOrder, true);
  assert.equal(cups.items[0].sku, 'CUP-12OZ');
  assert.equal(cups.items[0].quantity, 100);
  assert.equal(cups.items[0].unitPrice, 12);
  assert.equal(cups.deliveryDate, '2026-10-28');

  const beans = extract('MSG-2012');
  assert.equal(beans.isOrder, true);
  assert.equal(beans.items[0].sku, 'BEAN-ARABICA-1KG');
  assert.equal(beans.items[0].quantity, 20);
  assert.equal(beans.items[0].unitPrice, 45);
  assert.equal(beans.deliveryDate, '2026-10-30');
});

test('Malay address and delivery wording is parsed', () => {
  const result = extract('MSG-2001');
  assert.equal(result.isOrder, true);
  assert.equal(result.deliveryDate, '2026-10-27');
  assert.match(result.customer.address, /Jalan Gasing/);
  assert.deepEqual(
    result.items.map((item) => [item.sku, item.quantity]),
    [
      ['TEA-TARIK-500G', 15],
      ['SUGAR-1KG', 30],
    ],
  );
});
