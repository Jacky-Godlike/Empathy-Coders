/** Date helpers for Malaysia (UTC+8). All order dates are calendar dates (YYYY-MM-DD). */

const MONTHS = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2,
  mar: 3, march: 3, mac: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6,
  jul: 7, july: 7, julai: 7,
  aug: 8, august: 8, ogos: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, disember: 12,
};

const WEEKDAYS = {
  sunday: 0, sun: 0, ahad: 0,
  monday: 1, mon: 1, isnin: 1,
  tuesday: 2, tue: 2, tues: 2, selasa: 2,
  wednesday: 3, wed: 3, rabu: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, khamis: 4,
  friday: 5, fri: 5, jumaat: 5,
  saturday: 6, sat: 6, sabtu: 6,
};

const WEEKDAY_PATTERN = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const DELIVERY_HINT = /(deliver|delivery|send|ship|need|by|before|hantar|sebelum|pada|untuk|collect|pickup|pick up|arrive)/i;
const ORDER_HINT = /(order|pesan|beli|book|tempah)/i;

export function todayInMalaysia(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toISODate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(...value.split('-')) === value;
}

export function addDays(iso, days) {
  if (!isValidISODate(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + Number(days));
  return toISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function daysBetween(fromISO, toISO) {
  if (!isValidISODate(fromISO) || !isValidISODate(toISO)) return null;
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function weekdayIndex(iso) {
  if (!isValidISODate(iso)) return null;
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function endOfMonth(iso) {
  if (!isValidISODate(iso)) return null;
  const [y, m] = iso.split('-').map(Number);
  return toISODate(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}

export function formatLongDate(iso) {
  if (!isValidISODate(iso)) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatShortDate(iso) {
  if (!isValidISODate(iso)) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function yearForMonthDay(month, day, todayISO) {
  const [todayYear] = todayISO.split('-').map(Number);
  const candidate = toISODate(todayYear, month, day);
  if (!candidate) return null;
  // A date without a year that has already passed almost certainly means next year.
  return candidate < todayISO ? toISODate(todayYear + 1, month, day) : candidate;
}

/**
 * Parse a natural-language delivery date.
 * Returns { iso, confidence, matched } or null.
 *
 * Examples: "this Friday", "next Monday", "24 Oct", "24/10/2026",
 * "tomorrow", "hantar Jumaat", "in 3 days", "end of month".
 */
export function parseNaturalDate(text, todayISO = todayInMalaysia()) {
  if (typeof text !== 'string' || !isValidISODate(todayISO)) return null;
  const lower = text.toLowerCase().replace(/[’']/g, "'");
  const candidates = [];

  const push = (index, iso, confidence, matched, length = matched.length) => {
    if (!iso) return;
    const before = lower.slice(Math.max(0, index - 50), index);
    const after = lower.slice(index + length, index + length + 30);
    let score = confidence;
    if (DELIVERY_HINT.test(before) || DELIVERY_HINT.test(after)) score += 0.3;
    if (ORDER_HINT.test(before) && !DELIVERY_HINT.test(before)) score -= 0.15;
    candidates.push({ iso, score, matched, index });
  };

  // 2026-10-24
  for (const match of lower.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) {
    push(match.index, toISODate(match[1], match[2], match[3]), 1, match[0]);
  }

  // 24/10/2026, 24-10-2026 (Malaysian day-first), 2026/10/24
  for (const match of lower.matchAll(/\b(20\d{2})[/.](\d{1,2})[/.](\d{1,2})\b/g)) {
    push(match.index, toISODate(match[1], match[2], match[3]), 0.95, match[0]);
  }
  for (const match of lower.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})\b/g)) {
    // Malaysian dates are day-first: 24/10/2026.
    const iso = toISODate(match[3], match[2], match[1]);
    push(match.index, iso, 0.95, match[0]);
  }

  // 24 Oct, 24 October 2026, 24th Oct
  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\.?(?:\\s+(20\\d{2}))?\\b`, 'gi');
  for (const match of lower.matchAll(dayMonth)) {
    const month = MONTHS[match[2]];
    const iso = match[3] ? toISODate(match[3], month, match[1]) : yearForMonthDay(month, Number(match[1]), todayISO);
    push(match.index, iso, match[3] ? 0.98 : 0.9, match[0]);
  }

  // Oct 24, October 24 2026
  const monthDay = new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, 'gi');
  for (const match of lower.matchAll(monthDay)) {
    const month = MONTHS[match[1]];
    const iso = match[3] ? toISODate(match[3], month, match[2]) : yearForMonthDay(month, Number(match[2]), todayISO);
    push(match.index, iso, match[3] ? 0.98 : 0.9, match[0]);
  }

  // Relative words
  const relative = [
    { pattern: /\bday after tomorrow\b/g, days: 2, confidence: 0.9 },
    { pattern: /\btomorrow\b|\besok\b/g, days: 1, confidence: 0.95 },
    { pattern: /\btoday\b|\btonight\b|\bhari ini\b/g, days: 0, confidence: 0.9 },
    { pattern: /\bnext week\b|\bminggu depan\b/g, days: 7, confidence: 0.8 },
    { pattern: /\bin\s+(\d{1,2})\s+days?\b|\bdalam\s+(\d{1,2})\s+hari\b/g, days: null, confidence: 0.85 },
    { pattern: /\bin\s+(\d{1,2})\s+weeks?\b|\bdalam\s+(\d{1,2})\s+minggu\b/g, days: null, confidence: 0.8 },
  ];
  for (const item of relative) {
    for (const match of lower.matchAll(item.pattern)) {
      let days = item.days;
      if (days === null) {
        const amount = Number(match[1] || match[2] || 1);
        days = /week|minggu/.test(match[0]) ? amount * 7 : amount;
      }
      push(match.index, addDays(todayISO, days), item.confidence, match[0]);
    }
  }

  // "end of month" / "end of October"
  for (const match of lower.matchAll(/\bend of (?:the )?(month|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/g)) {
    if (match[1] === 'month') {
      push(match.index, endOfMonth(todayISO), 0.7, match[0]);
    } else {
      const month = MONTHS[match[1].slice(0, 3)];
      if (month) {
        const [y] = todayISO.split('-').map(Number);
        const iso = toISODate(y, month, new Date(Date.UTC(y, month, 0)).getUTCDate());
        push(match.index, iso, 0.75, match[0]);
      }
    }
  }

  // Weekdays: "this Friday", "next Monday", "by Saturday", "hantar Jumaat"
  const weekdayRe = new RegExp(`\\b(?:(this|coming|next|by|before|pada|sebelum)\\s+)?(${WEEKDAY_PATTERN})\\b`, 'gi');
  const todayDow = weekdayIndex(todayISO);
  for (const match of lower.matchAll(weekdayRe)) {
    const prefix = (match[1] || '').toLowerCase();
    const target = WEEKDAYS[match[2].toLowerCase()];
    if (target === undefined) continue;
    let days;
    if (prefix === 'next') {
      days = 7 - todayDow + target;
      if (days === 0) days = 7;
    } else {
      days = (target - todayDow + 7) % 7;
      // A bare weekday that is today is ambiguous; give the customer the benefit
      // of the doubt only when a delivery hint is nearby.
      if (days === 0) days = 7;
    }
    push(match.index, addDays(todayISO, days), prefix === 'next' ? 0.8 : 0.85, match[0]);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const best = candidates[0];
  return { iso: best.iso, confidence: Math.min(0.99, Math.max(0.3, best.score)), matched: best.matched };
}
