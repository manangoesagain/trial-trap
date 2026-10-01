// Finds calendar dates written the ways emails write them ("October 3, 2026",
// "3 Oct 2026", "15-Oct-2026", "2026-10-03", "10/03/2026") and turns them into
// YYYY-MM-DD. Shared by the built-in reader and the checker for AI answers.

import { daysBetween, isValidISODate, toISODate } from '../public/dates.js';

const MONTH_NUMBERS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY = '(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?';
const YEAR = '(?:(?:,?\\s+|-)(\\d{4}))?';

const DATE_PATTERNS = [
  { regex: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, read: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }) },
  { regex: new RegExp(`\\b${MONTH}\\.?\\s+${DAY}${YEAR}`, 'gi'), read: (m) => ({ month: monthNumber(m[1]), day: +m[2], year: m[3] && +m[3] }) },
  { regex: new RegExp(`\\b${DAY}(?:\\s+|-)(?:of\\s+)?${MONTH}\\.?${YEAR}`, 'gi'), read: (m) => ({ day: +m[1], month: monthNumber(m[2]), year: m[3] && +m[3] }) },
  { regex: /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g, read: readNumericDate },
];

function monthNumber(name) {
  return MONTH_NUMBERS[name.slice(0, 3).toLowerCase()];
}

// 10/04/2026 is ambiguous. Use the unambiguous reading when one part is over 12,
// otherwise day-first for non-US money and month-first for everything else.
function readNumericDate(match, options) {
  const first = +match[1];
  const second = +match[2];
  const dayFirst = first > 12 || (second <= 12 && options.dayFirst);
  return dayFirst
    ? { day: first, month: second, year: +match[3] }
    : { month: first, day: second, year: +match[3] };
}

// A date without a year ("October 4") means its next occurrence around the reference date.
function toDate({ year, month, day }, referenceISO) {
  if (!month || !day) return null;
  if (!year) {
    const referenceYear = +referenceISO.slice(0, 4);
    const sameYear = toISODate(referenceYear, month, day);
    if (!isValidISODate(sameYear)) return null;
    return daysBetween(referenceISO, sameYear) < -7 ? toISODate(referenceYear + 1, month, day) : sameYear;
  }
  const iso = toISODate(year, month, day);
  return isValidISODate(iso) ? iso : null;
}

// Every date in the text, in order, each with where it was found.
export function findDates(text, referenceISO, options = {}) {
  const found = [];
  for (const { regex, read } of DATE_PATTERNS) {
    for (const match of text.matchAll(regex)) {
      const iso = toDate(read(match, options), referenceISO);
      if (iso) found.push({ iso, start: match.index, end: match.index + match[0].length });
    }
  }
  // Keep the earliest, longest match when patterns overlap ("Sat, 26 Sep 2026").
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const dates = [];
  for (const date of found) {
    if (!dates.some((kept) => date.start < kept.end && date.end > kept.start)) dates.push(date);
  }
  return dates;
}

// The first date in a short piece of text, or null.
export function readDate(text, referenceISO, options = {}) {
  return findDates(String(text), referenceISO, options)[0]?.iso ?? null;
}
