// Trial helpers shared by the page, the helper server and the tests.

const FILLER_WORDS = new Set(['the', 'a', 'an', 'your', 'my']);

// The service name in lowercase without filler words, spaces or symbols:
// "The StreamBox Plus" becomes "streamboxplus".
function nameKey(service) {
  return String(service).toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((word) => word && !FILLER_WORDS.has(word)).join('');
}

// A short id for a trial card, made from its name and charge date.
export function trialKey(service, chargeDate) {
  return `${nameKey(service) || 'trial'}-${chargeDate ?? 'nodate'}`;
}

// Two cards are the same trial when the charge dates match and one name starts with the other,
// so "StreamBox" and "Streambox Plus" on the same day count as one, but "Nova Music" and "Nova Fitness" don't.
export function sameTrial(a, b) {
  if ((a.chargeDate ?? null) !== (b.chargeDate ?? null)) return false;
  const first = nameKey(a.service);
  const second = nameKey(b.service);
  if (!first || !second) return first === second;
  return first.startsWith(second) || second.startsWith(first);
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

// With no currency in the email, show just the amount rather than guess dollars.
export function formatMoney(amount, currency) {
  if (!currency) return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
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
    const currency = trial.currency ?? '';
    atRisk[currency] = Math.round(((atRisk[currency] ?? 0) + trial.price) * 100) / 100;
  }
  const saved = {};
  for (const trial of trials.filter((t) => t.status === 'cancelled' && t.price !== null && t.cancelledInTime !== false)) {
    const currency = trial.currency ?? '';
    saved[currency] = Math.round(((saved[currency] ?? 0) + trial.price) * 100) / 100;
  }
  return { atRisk, saved, next: upcoming[0] ?? null, upcomingCount: upcoming.length };
}

export function formatTotals(totals) {
  return Object.entries(totals).map(([currency, amount]) => formatMoney(amount, currency || null)).join(' + ');
}
