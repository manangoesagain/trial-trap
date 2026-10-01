// The built-in reader: finds free trials in emails with simple patterns, no AI needed.
// It is less clever than the AI reader but always available, so the app never breaks.

import { splitEmails } from './splitEmails.js';
import { cleanTrials } from './validateTrials.js';
import { addDays, addMonths, daysBetween, isValidISODate, toISODate } from '../public/dates.js';

const TRIAL_HINT = /\bfree trial\b|\btrial (?:period|ends|will end|expires|has started|membership|starts)\b|\d+[- ]?(?:day|week|month)s?[- ](?:free )?trial\b/i;

const MONTH_NUMBERS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY = '(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?';
const YEAR = '(?:,?\\s+(\\d{4}))?';

const DATE_PATTERNS = [
  { regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, read: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }) },
  { regex: new RegExp(`\\b${MONTH}\\.?\\s+${DAY}${YEAR}`, 'gi'), read: (m) => ({ month: monthNumber(m[1]), day: +m[2], year: m[3] && +m[3] }) },
  { regex: new RegExp(`\\b${DAY}\\s+(?:of\\s+)?${MONTH}\\.?${YEAR}`, 'gi'), read: (m) => ({ day: +m[1], month: monthNumber(m[2]), year: m[3] && +m[3] }) },
  { regex: /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g, read: readNumericDate },
];

const CHARGE_WORDS = /trial|end|expire|charg|bill|renew|payment|until|starting|convert|from/i;
const MONEY_BEFORE = /(US\$|\$|₹|€|£|Rs\.?\s?|INR\s?|USD\s?|EUR\s?|GBP\s?)(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
const MONEY_AFTER = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s?(USD|INR|EUR|GBP)\b/gi;
const CURRENCIES = { 'us$': 'USD', $: 'USD', '₹': 'INR', '€': 'EUR', '£': 'GBP', rs: 'INR', 'rs.': 'INR', inr: 'INR', usd: 'USD', eur: 'EUR', gbp: 'GBP' };
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

function monthNumber(name) {
  return MONTH_NUMBERS[name.slice(0, 3).toLowerCase()];
}

// 10/04/2026 is ambiguous. Use the unambiguous reading when one part is over 12,
// otherwise day-first for non-US money and month-first for everything else.
function readNumericDate(match, context) {
  const first = +match[1];
  const second = +match[2];
  const dayFirst = first > 12 || (second <= 12 && context.dayFirst);
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

function findDates(text, referenceISO, context) {
  const found = [];
  for (const { regex, read } of DATE_PATTERNS) {
    for (const match of text.matchAll(regex)) {
      const iso = toDate(read(match, context), referenceISO);
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

function headerValue(email, name) {
  const match = new RegExp(`^\\s*${name}:\\s*(.+)$`, 'im').exec(email);
  return match ? match[1].trim() : null;
}

function findSentDate(email, todayISO, context) {
  const dateLine = headerValue(email, 'date') ?? headerValue(email, 'sent');
  if (!dateLine) return null;
  return findDates(dateLine, todayISO, context)[0]?.iso ?? null;
}

function findChargeDate(email, referenceISO, context) {
  const body = email.replace(/^\s*(?:date|sent):.*$/gim, '');
  const dates = findDates(body, referenceISO, context);
  const nearChargeWords = dates.find((date) => CHARGE_WORDS.test(body.slice(Math.max(0, date.start - 80), date.start)));
  const chosen = nearChargeWords ?? dates.find((date) => daysBetween(referenceISO, date.iso) >= 0);
  if (chosen) return { chargeDate: chosen.iso, dateIsEstimated: false };

  const length = /(\d{1,3})[-\s]?(day|week|month)s?\b[^.\n]{0,20}?\btrial\b/i.exec(email)
    ?? /\btrial\b[^.\n]{0,30}?\b(?:for|of|lasts?)\s+(\d{1,3})\s+(day|week|month)s?\b/i.exec(email);
  if (!length) return { chargeDate: null, dateIsEstimated: false };
  const amount = +length[1];
  const unit = length[2].toLowerCase();
  const chargeDate = unit === 'month'
    ? addMonths(referenceISO, amount)
    : addDays(referenceISO, unit === 'week' ? amount * 7 : amount);
  return { chargeDate, dateIsEstimated: true };
}

function findPrice(email) {
  const prices = [];
  for (const match of email.matchAll(MONEY_BEFORE)) {
    const symbol = match[1].trim().toLowerCase();
    prices.push({ amount: parseFloat(match[2].replace(/,/g, '')), currency: CURRENCIES[symbol] ?? null, start: match.index, end: match.index + match[0].length });
  }
  for (const match of email.matchAll(MONEY_AFTER)) {
    prices.push({ amount: parseFloat(match[1].replace(/,/g, '')), currency: match[2].toUpperCase(), start: match.index, end: match.index + match[0].length });
  }
  const paid = prices.filter((price) => price.amount > 0).sort((a, b) => a.start - b.start);
  if (!paid.length) return { price: null, currency: null, billingPeriod: null };

  const periodAfter = (price) => email.slice(price.end, price.end + 30);
  const hasPeriod = (price) => /^\s*(?:\/|per|a|each|every)\s*(?:mo|month|yr|year|annum|week|wk)/i.test(periodAfter(price));
  const nearCharge = (price) => /after|then|renew|charg|bill|will be|starting|converts?/i.test(email.slice(Math.max(0, price.start - 60), price.start));
  const chosen = paid.find(hasPeriod) ?? paid.find(nearCharge) ?? paid[0];

  const after = periodAfter(chosen).toLowerCase();
  let billingPeriod = null;
  if (/^\s*(?:\/|per|a|each|every)\s*(?:mo\b|month)/.test(after)) billingPeriod = 'month';
  else if (/^\s*(?:\/|per|a|each|every)\s*(?:yr\b|year|annum)/.test(after)) billingPeriod = 'year';
  else if (/^\s*(?:\/|per|a|each|every)\s*(?:wk\b|week)/.test(after)) billingPeriod = 'week';

  return { price: chosen.amount, currency: chosen.currency, billingPeriod };
}

function cleanServiceName(name) {
  return name
    .replace(/["'<>]/g, '')
    .replace(/\b(?:has|is|starts?|begins?|was|will)\b.*$/i, '')
    .replace(/\s+(?:team|billing|support|no-?reply|notifications?)$/i, '')
    .replace(/[!.,:;-]+$/, '')
    .split(/\s+/)
    .slice(0, 5)
    .join(' ')
    .trim();
}

function findService(email) {
  const phrases = [
    /welcome to ([^!.,\n]+)/i,
    /your (?:free )?trial (?:of|for) ([^!.,\n]+)/i,
    /(?:trial of|trial for) ([^!.,\n]+)/i,
    /[Yy]our ([A-Z][\w+&' ]{1,40}?) (?:free )?trial\b/,
  ];
  for (const phrase of phrases) {
    const match = phrase.exec(email);
    const name = match && cleanServiceName(match[1]);
    if (name && !/^(?:your|the|a|free)\b|trial/i.test(name)) return name;
  }

  const from = headerValue(email, 'from');
  if (from) {
    const displayName = cleanServiceName(from.replace(/<[^>]*>/g, ''));
    if (displayName && !displayName.includes('@')) return displayName;
    const domain = /@([a-z0-9-]+)\./i.exec(from);
    if (domain) return domain[1].charAt(0).toUpperCase() + domain[1].slice(1);
  }
  return null;
}

function findCancelSteps(email) {
  const sentences = email
    .replace(URL_PATTERN, 'the link below')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/:$/, '.').trim())
    // Keep sentences that say what to do, not "you'll be charged unless you cancel".
    .filter((sentence) => /cancel/i.test(sentence) && sentence.length >= 8)
    .filter((sentence) => /^to cancel|\b(?:go to|visit|click|tap|choose|select|open|settings|account|reply|contact|call|email us)\b/i.test(sentence));
  return sentences.slice(0, 3);
}

function findCancelUrl(email) {
  const urls = [...email.matchAll(URL_PATTERN)].map((match) => match[0].replace(/[.,;:!?]+$/, ''));
  return urls.find((url) => /cancel/i.test(url))
    ?? urls.find((url) => /account|subscription|billing|manage|membership|settings/i.test(url))
    ?? null;
}

export function basicExtract(text, todayISO) {
  const emails = splitEmails(text);
  const found = [];
  let ignoredCount = 0;

  for (const email of emails) {
    if (!TRIAL_HINT.test(email)) {
      ignoredCount += 1;
      continue;
    }
    const context = { dayFirst: /₹|€|£|\bRs\.?|\bINR\b|\bEUR\b|\bGBP\b/.test(email) };
    const referenceISO = findSentDate(email, todayISO, context) ?? todayISO;
    found.push({
      service: findService(email) ?? 'Unknown service',
      ...findChargeDate(email, referenceISO, context),
      ...findPrice(email),
      cancelSteps: findCancelSteps(email),
      cancelUrl: findCancelUrl(email),
    });
  }

  return { trials: cleanTrials(found), ignoredCount };
}
