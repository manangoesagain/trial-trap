// Checks and cleans trials from either reader before they reach the page.
// Anything that doesn't look right becomes null ("Not in email") instead of a guess.

import { z } from 'zod';
import { isValidISODate } from '../public/dates.js';
import { safeUrl, trialKey } from '../public/trials.js';

const looseText = z.string().nullable().optional();

const TrialInput = z.object({
  service: z.string(),
  chargeDate: looseText,
  dateIsEstimated: z.boolean().nullable().optional(),
  price: z.number().nullable().optional(),
  currency: looseText,
  billingPeriod: looseText,
  cancelSteps: z.array(z.string()).nullable().optional(),
  cancelUrl: looseText,
});

const PERIODS = {
  week: 'week', weekly: 'week',
  month: 'month', monthly: 'month', mo: 'month',
  year: 'year', yearly: 'year', annual: 'year', annually: 'year',
};

function cleanText(value, maxLength) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function cleanTrial(input) {
  const parsed = TrialInput.safeParse(input);
  if (!parsed.success) return null;
  const trial = parsed.data;

  const service = cleanText(trial.service, 60);
  if (!service) return null;

  const chargeDate = isValidISODate(trial.chargeDate) ? trial.chargeDate : null;
  const price = Number.isFinite(trial.price) && trial.price >= 0 && trial.price < 100000
    ? Math.round(trial.price * 100) / 100
    : null;
  const currency = typeof trial.currency === 'string' && /^[A-Za-z]{3}$/.test(trial.currency.trim())
    ? trial.currency.trim().toUpperCase()
    : null;
  const billingPeriod = PERIODS[String(trial.billingPeriod ?? '').trim().toLowerCase()] ?? null;
  const cancelSteps = (trial.cancelSteps ?? [])
    .map((step) => cleanText(step, 200))
    .filter(Boolean)
    .slice(0, 6);

  return {
    id: trialKey(service, chargeDate),
    service,
    chargeDate,
    dateIsEstimated: chargeDate ? Boolean(trial.dateIsEstimated) : false,
    price,
    currency: price === null ? null : currency,
    billingPeriod: price === null ? null : billingPeriod,
    cancelSteps,
    cancelUrl: safeUrl(trial.cancelUrl),
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
