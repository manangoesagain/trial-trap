// Trial helpers shared by the page, the helper server and the tests.

const FILLER_WORDS = new Set(['the', 'a', 'an', 'your', 'my']);

// Two cards are the same trial when the service's main word and the charge date match,
// so "StreamBox" and "Streambox Plus" on the same day count as one.
export function trialKey(service, chargeDate) {
  const words = String(service).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const mainWord = words.find((word) => !FILLER_WORDS.has(word)) ?? 'trial';
  return `${mainWord}-${chargeDate ?? 'nodate'}`;
}

// Only plain web links are ever shown as buttons.
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'USD' }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// Soonest charge first; trials without a date go last.
export function sortTrials(trials) {
  return [...trials].sort((a, b) => {
    if (a.chargeDate === b.chargeDate) return a.service.localeCompare(b.service);
    if (!a.chargeDate) return 1;
    if (!b.chargeDate) return -1;
    return a.chargeDate < b.chargeDate ? -1 : 1;
  });
}

// What the banner shows: money at risk from active trials that haven't charged yet
// (one total per currency) and the next trial to charge.
export function summarize(trials, today) {
  const upcoming = sortTrials(trials.filter((trial) => trial.status !== 'cancelled' && trial.chargeDate && trial.chargeDate >= today));
  const atRisk = {};
  for (const trial of upcoming) {
    if (trial.price === null) continue;
    const currency = trial.currency ?? 'USD';
    atRisk[currency] = Math.round(((atRisk[currency] ?? 0) + trial.price) * 100) / 100;
  }
  const saved = {};
  for (const trial of trials.filter((t) => t.status === 'cancelled' && t.price !== null)) {
    const currency = trial.currency ?? 'USD';
    saved[currency] = Math.round(((saved[currency] ?? 0) + trial.price) * 100) / 100;
  }
  return { atRisk, saved, next: upcoming[0] ?? null, upcomingCount: upcoming.length };
}

export function formatTotals(totals) {
  return Object.entries(totals).map(([currency, amount]) => formatMoney(amount, currency)).join(' + ');
}
