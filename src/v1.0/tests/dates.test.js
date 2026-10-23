import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays, daysBetween, parseNaturalDate } from '../server/domain/dates.js';

const today = '2026-10-21';

test('relative Malaysian/English delivery wording resolves against today', () => {
  assert.equal(parseNaturalDate('deliver this Friday', today).iso, '2026-10-23');
  assert.equal(parseNaturalDate('next Monday', today).iso, '2026-10-26');
  assert.equal(parseNaturalDate('tomorrow', today).iso, '2026-10-22');
  assert.equal(parseNaturalDate('next Tuesday', today).iso, '2026-10-27');
  assert.equal(parseNaturalDate('hantar Jumaat', today).iso, '2026-10-23');
});

test('explicit dates are parsed in Malaysian day-first order', () => {
  assert.equal(parseNaturalDate('Delivery by 24 Oct 2026', today).iso, '2026-10-24');
  assert.equal(parseNaturalDate('by 30 Oct 2026', today).iso, '2026-10-30');
  assert.equal(parseNaturalDate('24/10/2026', today).iso, '2026-10-24');
  assert.equal(parseNaturalDate('2026-10-24', today).iso, '2026-10-24');
});

test('delivery hints win over an order date elsewhere in the message', () => {
  const result = parseNaturalDate('Order today, deliver this Friday please', today);
  assert.equal(result.iso, '2026-10-23');
});

test('no date returns null', () => {
  assert.equal(parseNaturalDate('please send the price list', today), null);
});

test('date arithmetic is inclusive of calendar days', () => {
  assert.equal(addDays('2026-10-21', 2), '2026-10-23');
  assert.equal(daysBetween('2026-10-21', '2026-10-23'), 2);
  assert.equal(daysBetween('2026-10-21', '2026-10-20'), -1);
});
