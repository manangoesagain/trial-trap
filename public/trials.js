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
