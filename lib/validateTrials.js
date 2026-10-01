// Checks and cleans trials from either reader before they reach the page.
// Each field is checked on its own: anything that doesn't look right becomes null
// ("Not in email") instead of a guess, and one bad field never throws away the whole trial.

import { isValidISODate, todayISO } from '../public/dates.js';
import { safeUrl, trialKey } from '../public/trials.js';
import { readDate } from './readDates.js';

const PERIODS = {
  week: 'week', weekly: 'week', wk: 'week',
  month: 'month', monthly: 'month', mo: 'month',
  year: 'year', yearly: 'year', annual: 'year', annually: 'year', yr: 'year',
};

// Symbols and words that emails (and AI models) use for money, mapped to 3-letter codes.
const CURRENCIES = {
  $: 'USD', 'us$': 'USD', usd: 'USD',
  'ca$': 'CAD', c$: 'CAD', cad: 'CAD',
  'au$': 'AUD', a$: 'AUD', aud: 'AUD',
  'nz$': 'NZD', nzd: 'NZD',
  's$': 'SGD', sgd: 'SGD',
  'hk$': 'HKD', hkd: 'HKD',
  '₹': 'INR', rs: 'INR', 'rs.': 'INR', inr: 'INR', rupees: 'INR',
  '€': 'EUR', eur: 'EUR', euro: 'EUR', euros: 'EUR',
  '£': 'GBP', gbp: 'GBP',
};

export function currencyCode(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (CURRENCIES[text]) return CURRENCIES[text];
  return /^[a-z]{3}$/.test(text) ? text.toUpperCase() : null;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

// "2026-10-03", "2026-10-03T00:00:00Z", "2026/10/3" or "October 3, 2026" all become "2026-10-03".
function cleanDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (isValidISODate(text.slice(0, 10))) return text.slice(0, 10);
  return readDate(text, todayISO());
}

// A number, or text like "$15.99" or "₹1,499"; also returns a currency if the text shows one.
function cleanPrice(value) {
  if (typeof value === 'number') return { price: value, currency: null };
  if (typeof value !== 'string') return { price: null, currency: null };
  const match = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+,\d{2}(?!\d)|\d+(?:\.\d{1,2})?)/.exec(value);
  if (!match) return { price: null, currency: null };
  const amount = /^\d+,\d{2}$/.test(match[1]) ? match[1].replace(',', '.') : match[1].replace(/,/g, '');
  const symbol = /(US\$|CA\$|AU\$|NZ\$|HK\$|S\$|C\$|A\$|\$|₹|€|£|Rs\.?|INR|USD|EUR|GBP)/i.exec(value);
  return { price: parseFloat(amount), currency: symbol ? currencyCode(symbol[1]) : null };
}

function cleanSteps(value) {
  const steps = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return steps.map((step) => cleanText(step, 200)).filter(Boolean).slice(0, 6);
}

export function cleanTrial(input) {
  if (!input || typeof input !== 'object') return null;
  const service = cleanText(input.service, 60);
  if (!service) return null;

  const chargeDate = cleanDate(input.chargeDate);
  const read = cleanPrice(input.price);
  const price = Number.isFinite(read.price) && read.price >= 0 && read.price < 100000
    ? Math.round(read.price * 100) / 100
    : null;
  const currency = currencyCode(input.currency) ?? read.currency;
  const billingPeriod = PERIODS[String(input.billingPeriod ?? '').trim().toLowerCase().replace(/^per\s+/, '')] ?? null;
  const estimated = input.dateIsEstimated === true || String(input.dateIsEstimated).toLowerCase() === 'true';

  return {
    id: trialKey(service, chargeDate),
    service,
    chargeDate,
    dateIsEstimated: chargeDate ? estimated : false,
    price,
    currency: price === null ? null : currency,
    billingPeriod: price === null ? null : billingPeriod,
    cancelSteps: cleanSteps(input.cancelSteps),
    cancelUrl: safeUrl(input.cancelUrl),
  };
}

export function cleanTrials(list) {
  const seen = new Set();
  const trials = [];
  for (const item of Array.isArray(list) ? list : []) {
    const trial = cleanTrial(item);
    if (!trial || seen.has(trial.id)) continue;
    seen.add(trial.id);
    trials.push(trial);
  }
  return trials;
}
