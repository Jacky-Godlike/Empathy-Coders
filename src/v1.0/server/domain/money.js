/** Money helpers. Calculations are done in integer cents to avoid float drift. */

export function toCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

export function fromCents(cents) {
  if (!Number.isFinite(Number(cents))) return 0;
  return Math.round(Number(cents)) / 100;
}

export function roundMoney(value) {
  return fromCents(toCents(value));
}

export function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((Number(part) / Number(whole)) * 1000) / 10;
}

export function formatMYR(value, options = {}) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(Number(value) || 0);
}

export function sumCents(values) {
  return values.reduce((total, value) => total + toCents(value), 0);
}
