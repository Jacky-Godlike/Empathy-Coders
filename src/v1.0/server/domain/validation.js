export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function cleanString(value, maxLength = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\r\n/g, '\n').trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

export function cleanMultiline(value, maxLength = 8000) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

export function clampNumber(value, min, max, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizePhone(value) {
  if (!value) return null;
  let digits = String(value).replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (digits.startsWith('+')) return `+${digits.slice(1).replace(/\D/g, '')}`;
  digits = digits.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('60')) return `+${digits}`;
  if (digits.startsWith('0')) return `+60${digits.slice(1)}`;
  if (digits.length >= 9 && digits.length <= 10) return `+60${digits}`;
  return `+${digits}`;
}

/** A stable key used to match the same Malaysian phone number across formats. */
export function phoneKey(value) {
  if (!value) return null;
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('60')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length < 8) return null;
  return digits.slice(-9);
}

export function normalizeEmail(value) {
  if (!value) return null;
  const email = String(value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeName(value) {
  if (!value) return null;
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function customerKey({ name, phone, email } = {}) {
  const p = phoneKey(phone);
  if (p) return `phone:${p}`;
  const e = normalizeEmail(email);
  if (e) return `email:${e}`;
  const n = normalizeName(name);
  if (n) return `name:${n}`;
  return null;
}

export function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (['true', '1', 'yes', 'y'].includes(value.toLowerCase())) return true;
    if (['false', '0', 'no', 'n'].includes(value.toLowerCase())) return false;
  }
  return fallback;
}

export function assertEnum(value, allowed, fallback = null) {
  return allowed.includes(value) ? value : fallback;
}

export function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows, columns) {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(','));
  return [header, ...body].join('\r\n');
}
