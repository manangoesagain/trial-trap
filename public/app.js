// Page logic: sends the pasted emails to the helper server and draws the trials.
// Everything that came from an email is shown with textContent, never as HTML.

import { buildIcs, googleCalendarUrl, icsFileName } from './calendar.js';
import { countdownText, daysBetween, formatDate, todayISO, urgency } from './dates.js';
import { sampleEmails } from './samples.js';
import { loadTrials, mergeTrials, saveTrials } from './storage.js';
import { formatMoney, formatTotals, sortTrials, summarize } from './trials.js';

const emailText = document.querySelector('#email-text');
const findButton = document.querySelector('#find-button');
const sampleButton = document.querySelector('#sample-button');
const message = document.querySelector('#message');
const trialList = document.querySelector('#trial-list');
const banner = document.querySelector('#banner');
const bannerLabel = document.querySelector('#banner-label');
const bannerAmount = document.querySelector('#banner-amount');
const bannerNext = document.querySelector('#banner-next');
const cancelledSection = document.querySelector('#cancelled-section');
const cancelledTitle = document.querySelector('#cancelled-title');
const cancelledList = document.querySelector('#cancelled-list');
const listFooter = document.querySelector('#list-footer');
const clearButton = document.querySelector('#clear-button');
const toast = document.querySelector('#toast');
const toastText = document.querySelector('#toast-text');
const toastUndo = document.querySelector('#toast-undo');

const BADGES = { soon: 'Soon', month: 'Within 2 weeks', later: 'Later', past: 'Charged', none: 'No date' };
const TOAST_SECONDS = 6;

let trials = loadTrials();
let warnedAboutStorage = false;
let toastTimer = null;
let toastUndoAction = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

const STORAGE_WARNING = "This browser won't let Trial Trap save, so your trials will be gone when you close the page.";

// Saves the list and returns whether it worked. The warning is shown once per visit.
function persist() {
  const saved = saveTrials(trials);
  if (!saved && !warnedAboutStorage) {
    warnedAboutStorage = true;
    showMessage(STORAGE_WARNING, true);
  }
  return saved;
}

function hideToast() {
  clearTimeout(toastTimer);
  toast.classList.remove('show');
  toastText.textContent = '';
  toastUndo.hidden = true;
  toastUndoAction = null;
}

// A short note at the bottom of the screen, with an Undo button for a few seconds.
function showToast(text, undo) {
  hideToast();
  toastText.textContent = text;
  toastUndoAction = undo;
  toastUndo.hidden = !undo;
  toast.classList.add('show');
  toastTimer = setTimeout(hideToast, TOAST_SECONDS * 1000);
}

function findTrial(id) {
  return trials.find((trial) => trial.id === id);
}

function markCancelled(id) {
  const trial = findTrial(id);
  if (!trial) return;
  trial.status = 'cancelled';
  persist();
  render();
  const saved = trial.price === null ? '' : ` That's ${formatMoney(trial.price, trial.currency)} saved.`;
  showToast(`Nice! ${trial.service} is marked as cancelled.${saved}`, () => markActive(id));
}

function markActive(id) {
  const trial = findTrial(id);
  if (!trial) return;
  trial.status = 'active';
  persist();
  render();
  hideToast();
}

function removeTrial(id) {
  const index = trials.findIndex((trial) => trial.id === id);
  if (index === -1) return;
  const [removed] = trials.splice(index, 1);
  persist();
  render();
  showToast(`Removed ${removed.service}.`, () => {
    if (!findTrial(removed.id)) trials.splice(Math.min(index, trials.length), 0, removed);
    persist();
    render();
    hideToast();
  });
}

function clearAll() {
  const count = trials.length;
  if (!count) return;
  if (!window.confirm(`Remove all ${count} trial${count === 1 ? '' : 's'} saved in this browser? This can't be undone.`)) return;
  trials = [];
  persist();
  render();
  hideToast();
  showMessage('All trials cleared.');
}

function removeButton(trial) {
  const button = element('button', 'remove-button', '×');
  button.type = 'button';
  button.title = 'Remove (if it was read wrongly)';
  button.setAttribute('aria-label', `Remove ${trial.service}`);
  button.addEventListener('click', () => removeTrial(trial.id));
  return button;
}

function priceText(trial) {
  if (trial.price === null) return null;
  const amount = formatMoney(trial.price, trial.currency);
  return trial.billingPeriod ? `${amount}/${trial.billingPeriod}` : amount;
}

function daysUntil(trial, today) {
  return trial.chargeDate ? daysBetween(today, trial.chargeDate) : null;
}

function renderCard(trial, today) {
  const days = daysUntil(trial, today);
  const level = urgency(days);
  const card = element('article', `card urgency-${level}`);
  card.dataset.id = trial.id;

  const top = element('div', 'card-top');
  const labels = element('div', 'card-labels');
  labels.append(element('span', 'badge', BADGES[level]), removeButton(trial));
  top.append(element('h3', 'service', trial.service), labels);

  const countdown = element('p', 'countdown');
  if (days === null) {
    countdown.append(element('strong', null, 'No date found'), ' · ', element('span', 'not-found', 'Date not in email'));
  } else if (days < 0) {
    countdown.append(element('strong', null, `Charged ${formatDate(trial.chargeDate)}`), ', check your bank');
  } else {
    countdown.append('Charges ', element('strong', null, countdownText(days)), ` · ${formatDate(trial.chargeDate)}`);
    if (trial.dateIsEstimated) countdown.append(' ', element('span', 'estimated', '(estimated)'));
  }

  const price = priceText(trial);
  const priceLine = price
    ? element('p', 'price', `then ${price}`)
    : element('p', 'price not-found', 'Price not in email');

  const actions = element('div', 'card-actions');
  if (days !== null && days >= 0) actions.append(renderCalendarMenu(trial, today));
  const cancelInfo = renderCancelInfo(trial);
  const cancelledButton = element('button', 'button primary small', 'I cancelled it ✓');
  cancelledButton.type = 'button';
  cancelledButton.setAttribute('aria-label', `I cancelled ${trial.service}`);
  cancelledButton.addEventListener('click', () => markCancelled(trial.id));
  actions.append(cancelInfo.button, cancelledButton);

  card.append(top, countdown, priceLine, actions, cancelInfo.body);
  return card;
}

function renderCancelledCard(trial) {
  const card = element('article', 'card cancelled');
  card.dataset.id = trial.id;

  const top = element('div', 'card-top');
  const labels = element('div', 'card-labels');
  labels.append(element('span', 'badge', 'Cancelled ✓'), removeButton(trial));
  top.append(element('h3', 'service', trial.service), labels);

  const price = priceText(trial);
  const note = element('p', 'price', price ? `You won't pay ${price}` : 'No charge coming from this one');

  const actions = element('div', 'card-actions');
  const undo = element('button', 'button soft small', 'Undo');
  undo.type = 'button';
  undo.setAttribute('aria-label', `Undo: ${trial.service} isn't cancelled yet`);
  undo.addEventListener('click', () => markActive(trial.id));
  actions.append(undo);

  card.append(top, note, actions);
  return card;
}

function renderCalendarMenu(trial, today) {
  const menu = element('details', 'menu calendar-menu');
  const summary = element('summary', 'button small', '📅 Add to calendar');
  const options = element('div', 'menu-options');

  const google = element('a', 'menu-option', 'Google Calendar');
  google.href = googleCalendarUrl(trial, today);
  google.target = '_blank';
  google.rel = 'noopener noreferrer';

  const file = element('button', 'menu-option', 'Apple / Outlook (download)');
  file.type = 'button';
  file.addEventListener('click', () => {
    const blob = new Blob([buildIcs(trial, today)], { type: 'text/calendar;charset=utf-8' });
    const link = element('a');
    link.href = URL.createObjectURL(blob);
    link.download = icsFileName(trial);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    menu.open = false;
  });

  options.append(google, file);
  menu.append(summary, options);
  return menu;
}

function renderCancelInfo(trial) {
  const body = element('div', 'cancel-body');
  body.id = `cancel-${trial.id}`;
  body.hidden = true;
  const button = element('button', 'button small soft', 'How to cancel');
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', body.id);
  button.addEventListener('click', () => {
    body.hidden = !body.hidden;
    button.setAttribute('aria-expanded', String(!body.hidden));
  });

  if (trial.cancelSteps.length) {
    const steps = element('ol', 'cancel-steps');
    steps.append(...trial.cancelSteps.map((step) => element('li', null, step)));
    body.append(steps);
  } else {
    body.append(element('p', 'not-found', `The email didn't say how to cancel. Look under Account or Subscription settings on ${trial.service}'s website.`));
  }
  if (trial.cancelUrl) {
    const link = element('a', 'button primary small', 'Open cancel page ↗');
    link.href = trial.cancelUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    body.append(link);
  }
  return { button, body };
}

function renderBanner(today) {
  if (!trials.length) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  const { atRisk, saved, next } = summarize(trials, today);
  banner.classList.toggle('clear', !next);

  if (!next) {
    const undated = trials.some((trial) => trial.status !== 'cancelled' && !trial.chargeDate);
    const savedText = Object.keys(saved).length ? ` You've saved ${formatTotals(saved)} so far.` : '';
    bannerLabel.textContent = 'All good';
    bannerAmount.textContent = "You're all clear 🎉";
    bannerNext.textContent = (undated
      ? 'No dated charges are coming up. Check any trial below that has no date.'
      : 'No trials are about to charge you.') + savedText;
    return;
  }
  bannerLabel.textContent = 'Money at risk';
  bannerAmount.textContent = Object.keys(atRisk).length ? formatTotals(atRisk) : 'Price unknown';
  const price = next.price === null ? '' : ` ${formatMoney(next.price, next.currency)}`;
  const when = countdownText(daysBetween(today, next.chargeDate));
  bannerNext.textContent = `Heads up! ${next.service} charges you${price} ${when} (${formatDate(next.chargeDate)}).`;
}

function render() {
  const today = todayISO();
  const active = trials.filter((trial) => trial.status !== 'cancelled');
  const cancelled = trials.filter((trial) => trial.status === 'cancelled');

  renderBanner(today);
  trialList.replaceChildren(...sortTrials(active).map((trial) => renderCard(trial, today)));

  cancelledSection.hidden = !cancelled.length;
  const { saved } = summarize(trials, today);
  const savedText = Object.keys(saved).length ? ` · ${formatTotals(saved)} saved` : '';
  cancelledTitle.textContent = `Cancelled (${cancelled.length})${savedText}`;
  cancelledList.replaceChildren(...sortTrials(cancelled).map(renderCancelledCard));

  listFooter.hidden = !trials.length;
}

async function findTrials() {
  const text = emailText.value;
  if (!text.trim()) {
    showMessage('Paste an email first, or try the sample emails.', true);
    return;
  }
  findButton.disabled = true;
  findButton.textContent = 'Reading your emails…';
  showMessage('');
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, today: todayISO() }),
    });
    const result = await response.json();
    if (!response.ok) {
      showMessage(result.error, true);
      return;
    }
    const skipped = result.ignoredCount
      ? ` ${result.ignoredCount} email${result.ignoredCount === 1 ? " didn't" : "s didn't"} look like a free trial.`
      : '';
    const note = result.note ? ` ${result.note}` : '';
    if (!result.trials.length) {
      showMessage(`We couldn't find a free trial in that text. Try pasting the whole email, including the dates.${skipped}`, true);
      return;
    }
    const merged = mergeTrials(trials, result.trials);
    trials = merged.trials;
    const saved = persist();
    render();
    const found = result.trials.length;
    let summary;
    if (!merged.added) summary = found === 1 ? 'That trial is already on your list.' : 'Those trials are already on your list.';
    else if (merged.alreadySaved) summary = `Found ${found} trials: ${merged.added} new, ${merged.alreadySaved} already on your list.`;
    else summary = `Found ${found} trial${found === 1 ? '' : 's'}.`;
    showMessage(`${summary}${skipped}${note}${saved ? '' : ` ${STORAGE_WARNING}`}`, !saved);
  } catch {
    showMessage("Couldn't reach Trial Trap. Is the server still running?", true);
  } finally {
    findButton.disabled = false;
    findButton.textContent = 'Find my trials';
  }
}

// Close an open calendar menu when clicking anywhere else.
document.addEventListener('click', (event) => {
  for (const menu of document.querySelectorAll('.calendar-menu[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});

findButton.addEventListener('click', findTrials);
clearButton.addEventListener('click', clearAll);
toastUndo.addEventListener('click', () => toastUndoAction?.());
sampleButton.addEventListener('click', () => {
  emailText.value = sampleEmails(todayISO());
  emailText.setSelectionRange(0, 0);
  emailText.focus();
  emailText.scrollTop = 0;
});

render();
