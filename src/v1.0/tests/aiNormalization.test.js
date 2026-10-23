import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.AI_PROVIDER = 'rules';
const { normalizeAIResult } = await import('../server/adapters/ai/aiClient.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const products = JSON.parse(fs.readFileSync(path.join(root, 'data', 'seed', 'products.json'), 'utf8'));

test('AI result is mapped to the catalogue SKU and normalized fields', () => {
  const result = normalizeAIResult(
    {
      messageId: 'MSG-X',
      isOrder: true,
      category: 'order',
      intent: 'new_order',
      operation: 'none',
      customer: {
        name: 'Test Cafe',
        phone: '012-345 6789',
        email: 'TEST@EXAMPLE.COM',
        address: '1, Jalan Test, 50000 Kuala Lumpur',
      },
      items: [
        {
          productName: 'Arabica Coffee Beans',
          sku: null,
          quantity: 10,
          unit: 'box',
          unitPrice: null,
        },
      ],
      deliveryDate: '2026-10-30',
      notes: 'Please deliver before noon',
      missingFields: ['deliveryDate'],
      confidence: 0.88,
      reasoning: 'Clear order with one product.',
    },
    { id: 'MSG-X' },
    { products, today: '2026-10-21' },
  );

  assert.equal(result.isOrder, true);
  assert.equal(result.items[0].sku, 'BEAN-ARABICA-1KG');
  assert.equal(result.items[0].quantity, 10);
  assert.equal(result.items[0].unitPrice, null);
  assert.equal(result.customer.phone, '+60123456789');
  assert.equal(result.customer.email, 'test@example.com');
  assert.equal(result.deliveryDate, '2026-10-30');
  assert.equal(result.confidence, 0.88);
  assert.equal(result.mode, 'ai');
});

test('AI non-order is preserved as a filtered category', () => {
  const result = normalizeAIResult(
    {
      messageId: 'MSG-Y',
      isOrder: false,
      category: 'advertisement',
      intent: 'none',
      operation: 'none',
      customer: {},
      items: [],
      deliveryDate: null,
      missingFields: [],
      confidence: 0.92,
      reasoning: 'Promotional message.',
    },
    { id: 'MSG-Y' },
    { products, today: '2026-10-21' },
  );
  assert.equal(result.isOrder, false);
  assert.equal(result.category, 'advertisement');
  assert.equal(result.operation, 'none');
  assert.equal(result.items.length, 0);
});

test('invalid AI dates and unknown products are safely rejected', () => {
  const result = normalizeAIResult(
    {
      isOrder: true,
      category: 'order',
      operation: 'none',
      customer: {},
      items: [{ productName: 'Almond Milk', sku: 'NOT-REAL', quantity: 4 }],
      deliveryDate: 'next Friday',
      missingFields: ['items', 'unknownField'],
      confidence: 2,
    },
    { id: 'MSG-Z' },
    { products, today: '2026-10-21' },
  );
  assert.equal(result.deliveryDate, null);
  assert.equal(result.items[0].sku, null);
  assert.equal(result.items[0].matchConfidence, 0.3);
  assert.deepEqual(result.missingFields, ['items']);
  assert.equal(result.confidence, 1);
});
