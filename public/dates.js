// Date helpers shared by the page, the helper server and the tests.
// Every date is a plain calendar date ("2026-10-04") in the user's own time zone,
// so the maths below works on whole days and never on clock times.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toISODate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidISODate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function todayISO(now = new Date()) {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function toUTC(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUTC(ms) {
  const date = new Date(ms);
  return toISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(iso, days) {
  return fromUTC(toUTC(iso) + days * DAY_MS);
}

export function addMonths(iso, months) {
  const [year, month, day] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return toISODate(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(day, lastDay));
}

// Whole days from `fromISO` to `toISO`: tomorrow is 1, yesterday is -1.
export function daysBetween(fromISO, toISO) {
  return Math.round((toUTC(toISO) - toUTC(fromISO)) / DAY_MS);
}

// "today", "tomorrow", "in 2 days", "charged yesterday", "charged 3 days ago".
export function countdownText(days) {
  if (days === null) return 'No date found';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return 'charged yesterday';
  return `charged ${-days} days ago`;
}

// Red within 3 days, amber within 14, green later; grey once the date has passed.
export function urgency(days) {
  if (days === null) return 'none';
  if (days < 0) return 'past';
  if (days <= 3) return 'soon';
  if (days <= 14) return 'month';
  return 'later';
}

// "Fri, Oct 3"
export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}
