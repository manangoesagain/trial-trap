// Saves trials in this browser only (localStorage), so there's no login and no database.
// If the browser blocks storage (some private windows do), the app still works for this visit.

import { isValidISODate } from './dates.js';
import { safeUrl, sameTrial, trialKey } from './trials.js';

export const STORAGE_KEY = 'trialtrap.trials.v1';

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Saved data could be old or edited by hand, so tidy each trial before using it.
function tidy(trial) {
  if (!trial || typeof trial !== 'object' || typeof trial.service !== 'string' || !trial.service.trim()) return null;
  // Only a real date is kept: "2026-10-20T00:00:00Z" becomes "2026-10-20", anything else "No date".
  const day = typeof trial.chargeDate === 'string' ? trial.chargeDate.slice(0, 10) : '';
  const chargeDate = isValidISODate(day) ? day : null;
  return {
    ...trial,
    id: trialKey(trial.service, chargeDate),
    chargeDate,
    price: typeof trial.price === 'number' ? trial.price : null,
    cancelSteps: Array.isArray(trial.cancelSteps) ? trial.cancelSteps.filter((step) => typeof step === 'string') : [],
    cancelUrl: safeUrl(trial.cancelUrl),
    status: trial.status === 'cancelled' ? 'cancelled' : 'active',
  };
}

export function loadTrials(storage = browserStorage()) {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    const trials = [];
    for (const trial of saved.map(tidy)) {
      if (trial && !trials.some((kept) => sameTrial(kept, trial))) trials.push(trial);
    }
    return trials;
  } catch {
    return [];
  }
}

// Returns false when the browser wouldn't let us save.
export function saveTrials(trials, storage = browserStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(trials));
    return true;
  } catch {
    return false;
  }
}

// Adds newly found trials to the saved ones. A trial that's already saved is left as it is,
// so pasting an email again never brings back a trial you marked as cancelled.
export function mergeTrials(saved, found, now = new Date().toISOString()) {
  const trials = [...saved];
  let added = 0;
  for (const trial of found) {
    if (trials.some((kept) => sameTrial(kept, trial))) continue;
    trials.push({ ...trial, id: trialKey(trial.service, trial.chargeDate), status: 'active', addedAt: now });
    added += 1;
  }
  return { trials, added, alreadySaved: found.length - added };
}
