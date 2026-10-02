// Page logic: sends the pasted emails to the helper server and draws the trials.
// Everything that came from an email is shown with textContent, never as HTML.

import { buildIcs, googleCalendarUrl, icsFileName } from './calendar.js';
import { countdownText, daysBetween, formatDate, todayISO, urgency } from './dates.js';
import { sampleEmails } from './samples.js';
import { STORAGE_KEY, loadTrials, mergeTrials, saveTrials } from './storage.js';
import { formatMoney, formatTotals, sameTrial, sortTrials, summarize } from './trials.js';

const emailText = document.querySelector('#email-text');
const findButton = document.querySelector('#find-button');
const sampleButton = document.querySelector('#sample-button');
const message = document.querySelector('#message');
const trialList = document.querySelector('#trial-list');
const trialsTitle = document.querySelector('#trials-title');
const banner = document.querySelector('#banner');
const bannerLabel = document.querySelector('#banner-label');
const bannerAmount = document.querySelector('#banner-amount');
const bannerNext = document.querySelector('#banner-next');
const cancelledSection = document.querySelector('#cancelled-section');
const cancelledTitle = document.querySelector('#cancelled-title');
const cancelledSaved = document.querySelector('#cancelled-saved');
const bannerSentinel = document.querySelector('#banner-sentinel');
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
// "How to cancel" panels the user opened, so they stay open when the list is redrawn.
const openCancelPanels = new Set();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Runs a button's action once per click. The second click of a double-click is ignored:
// by then the list has been redrawn and the next card's button sits under the pointer.
// The action is told whether the keyboard pressed the button (a click with detail 0).
function onClick(button, action) {
  button.addEventListener('click', (event) => {
    if (event.detail > 1) return;
    action(event.detail === 0);
  });
}

// Only changes text that's different, so screen readers don't repeat what hasn't changed.
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
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
  // Don't leave keyboard focus on a button that's about to disappear.
  if (toast.contains(document.activeElement)) trialList.focus({ preventScroll: true });
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
  startToastTimer();
}

function startToastTimer() {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, TOAST_SECONDS * 1000);
}

// The card that was used has just been redrawn, so put focus somewhere sensible.
// Keyboard users land on Undo in the note, so they can take it straight back.
function focusAfterChange(fromKeyboard = false) {
  if (fromKeyboard && !toastUndo.hidden) toastUndo.focus({ preventScroll: true });
  else if (!document.activeElement || document.activeElement === document.body) trialList.focus({ preventScroll: true });
}

function findTrial(id) {
  return trials.find((trial) => trial.id === id);
}

function markCancelled(id, fromKeyboard) {
  const trial = findTrial(id);
  if (!trial) return;
  trial.status = 'cancelled';
  // Money only counts as saved if the trial hadn't charged yet.
  trial.cancelledInTime = !trial.chargeDate || trial.chargeDate >= todayISO();
  persist();
  render();
  const saved = trial.price === null || !trial.cancelledInTime ? '' : ` That's ${formatMoney(trial.price, trial.currency)} saved.`;
  showToast(`Nice! ${trial.service} is marked as cancelled.${saved}`, () => markActive(id));
  focusAfterChange(fromKeyboard);
}

function markActive(id) {
  const trial = findTrial(id);
  if (!trial) return;
  trial.status = 'active';
  persist();
  render();
  hideToast();
  focusAfterChange();
}

function removeTrial(id, fromKeyboard) {
  const index = trials.findIndex((trial) => trial.id === id);
  if (index === -1) return;
  const [removed] = trials.splice(index, 1);
  persist();
  render();
  showToast(`Removed ${removed.service}.`, () => {
    if (!trials.some((trial) => sameTrial(trial, removed))) trials.splice(Math.min(index, trials.length), 0, removed);
    persist();
    render();
    hideToast();
  });
  focusAfterChange(fromKeyboard);
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
  emailText.focus({ preventScroll: true });
}

function removeButton(trial) {
  const button = element('button', 'remove-button', '×');
  button.type = 'button';
  button.title = 'Remove (if it was read wrongly)';
  button.setAttribute('aria-label', `Remove ${trial.service}`);
  onClick(button, (fromKeyboard) => removeTrial(trial.id, fromKeyboard));
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
  const meta = element('p', 'charge-meta');
  if (days === null) {
    countdown.append(element('strong', null, 'No date found'));
    meta.append(element('span', 'not-found', 'No date in the email'));
  } else if (days < 0) {
    countdown.append(element('strong', null, countdownText(days).replace(/^./, (c) => c.toUpperCase())));
    meta.append(`Was due ${formatDate(trial.chargeDate)}. Check your bank.`);
  } else {
    countdown.append('Charges ', element('strong', null, countdownText(days)));
    meta.append(formatDate(trial.chargeDate));
    if (trial.dateIsEstimated) meta.append(' ', element('span', 'estimated', '(estimated)'));
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
  cancelledButton.setAttribute('aria-label', `I cancelled it: ${trial.service}`);
  onClick(cancelledButton, (fromKeyboard) => markCancelled(trial.id, fromKeyboard));
  actions.append(cancelInfo.button, cancelledButton);

  card.append(top, countdown, meta, priceLine, actions, cancelInfo.body);
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
  let noteText = price ? `You won't pay ${price}` : 'No charge coming from this one';
  if (trial.cancelledInTime === false) noteText = 'Cancelled after it charged, so check your bank';
  const note = element('p', 'price', noteText);

  const actions = element('div', 'card-actions');
  const undo = element('button', 'button soft small', 'Undo');
  undo.type = 'button';
  undo.setAttribute('aria-label', `Undo: ${trial.service} isn't cancelled yet`);
  onClick(undo, () => markActive(trial.id));
  actions.append(undo);

  card.append(top, note, actions);
  return card;
}

function renderCalendarMenu(trial, today) {
  const menu = element('details', 'menu calendar-menu');
  const summary = element('summary', 'button small');
  const icon = element('span', null, '📅');
  icon.setAttribute('aria-hidden', 'true');
  summary.append(icon, ' Add to calendar');
  const options = element('div', 'menu-options');

  // The reminder is worked out when clicked, so it's right even if the page was left open.
  const google = element('a', 'menu-option', 'Google Calendar');
  google.href = googleCalendarUrl(trial, today);
  google.target = '_blank';
  google.rel = 'noopener noreferrer';
  google.addEventListener('click', () => {
    google.href = googleCalendarUrl(trial, todayISO());
  });

  const file = element('button', 'menu-option', 'Apple / Outlook (download)');
  file.type = 'button';
  file.addEventListener('click', () => {
    const blob = new Blob([buildIcs(trial, todayISO())], { type: 'text/calendar;charset=utf-8' });
    const link = element('a');
    link.href = URL.createObjectURL(blob);
    link.download = icsFileName(trial);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    menu.open = false;
    summary.focus();
  });

  options.append(google, file);
  menu.append(summary, options);
  return menu;
}

function renderCancelInfo(trial) {
  const body = element('div', 'cancel-body');
  body.id = `cancel-${trial.id}`;
  body.hidden = !openCancelPanels.has(trial.id);
  // The card says up front when the email had no cancel steps or link.
  const found = trial.cancelSteps.length > 0 || Boolean(trial.cancelUrl);
  const button = element('button', 'button small soft', found ? 'How to cancel' : 'How to cancel (not in email)');
  button.type = 'button';
  button.setAttribute('aria-expanded', String(!body.hidden));
  button.setAttribute('aria-controls', body.id);
  button.addEventListener('click', () => {
    body.hidden = !body.hidden;
    button.setAttribute('aria-expanded', String(!body.hidden));
    if (body.hidden) openCancelPanels.delete(trial.id);
    else openCancelPanels.add(trial.id);
  });

  if (trial.cancelSteps.length) {
    const steps = element('ol', 'cancel-steps');
    steps.append(...trial.cancelSteps.map((step) => element('li', null, step)));
    body.append(steps);
  } else {
    body.append(element('p', 'not-found', `The email didn't say how to cancel. Look under Account or Subscription settings on ${trial.service}'s website.`));
  }
  if (trial.cancelUrl) {
    const link = element('a', 'button primary small', 'Open cancel page');
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
    setText(bannerLabel, 'All good');
    setText(bannerAmount, "You're all clear 🎉");
    setText(bannerNext, (undated
      ? 'No dated charges are coming up. Check any trial below that has no date.'
      : 'No trials are about to charge you.') + savedText);
    return;
  }
  setText(bannerLabel, 'Money at risk');
  setText(bannerAmount, Object.keys(atRisk).length ? formatTotals(atRisk) : 'Price unknown');
  const price = next.price === null ? '' : ` ${formatMoney(next.price, next.currency)}`;
  const when = countdownText(daysBetween(today, next.chargeDate));
  setText(bannerNext, `Heads up! ${next.service} charges you${price} ${when} (${formatDate(next.chargeDate)}).`);
}

function render() {
  const today = todayISO();
  const active = trials.filter((trial) => trial.status !== 'cancelled');
  const cancelled = trials.filter((trial) => trial.status === 'cancelled');

  trialsTitle.hidden = !trials.length;
  renderBanner(today);
  trialList.replaceChildren(...sortTrials(active).map((trial) => renderCard(trial, today)));
  observeReveal(trialList);

  cancelledSection.hidden = !cancelled.length;
  const { saved } = summarize(trials, today);
  setText(cancelledTitle, `Cancelled (${cancelled.length})`);
  setText(cancelledSaved, Object.keys(saved).length ? `${formatTotals(saved)} saved` : '');
  cancelledList.replaceChildren(...sortTrials(cancelled).map(renderCancelledCard));
  observeReveal(cancelledList);

  listFooter.hidden = !trials.length;
}

// Sends the pasted text to the helper server. Returns null if the server couldn't be reached.
async function askServer(text) {
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, today: todayISO() }),
    });
    return { ok: response.ok, result: await response.json() };
  } catch {
    return null;
  }
}

async function findTrials() {
  const text = emailText.value;
  if (!text.trim()) {
    showMessage('Paste an email first, or try the sample emails.', true);
    return;
  }
  findButton.disabled = true;
  findButton.textContent = 'Reading your emails…';
  showMessage('Reading your emails…');
  try {
    const reply = await askServer(text);
    if (!reply) {
      showMessage("Couldn't reach Trial Trap. Is the server still running?", true);
      return;
    }
    const { ok, result } = reply;
    if (!ok) {
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
  } finally {
    findButton.disabled = false;
    findButton.textContent = 'Find my trials';
    // Disabling the button dropped keyboard focus, so put it back.
    if (document.activeElement === document.body) findButton.focus();
  }
}

// Close an open calendar menu when clicking anywhere else, or pressing Escape.
document.addEventListener('click', (event) => {
  for (const menu of document.querySelectorAll('.calendar-menu[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});
// Tabbing out of an open menu closes it too, so it never covers the button you moved to.
document.addEventListener('focusin', (event) => {
  for (const menu of document.querySelectorAll('.calendar-menu[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  for (const menu of document.querySelectorAll('.calendar-menu[open]')) {
    menu.open = false;
    if (menu.contains(document.activeElement)) menu.querySelector('summary').focus();
  }
});

// Keep the Undo note on screen while someone is pointing at it or has tabbed into it.
toast.addEventListener('mouseenter', () => clearTimeout(toastTimer));
toast.addEventListener('focusin', (event) => {
  if (event.target.matches(':focus-visible')) clearTimeout(toastTimer);
});
toast.addEventListener('mouseleave', () => { if (toast.classList.contains('show')) startToastTimer(); });
toast.addEventListener('focusout', () => { if (toast.classList.contains('show')) startToastTimer(); });

// Countdowns move on: redraw after midnight, and whenever the page is looked at again.
let shownDay = todayISO();
function redrawIfNewDay() {
  if (todayISO() === shownDay) return;
  shownDay = todayISO();
  render();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') redrawIfNewDay();
});
window.addEventListener('focus', redrawIfNewDay);
setInterval(redrawIfNewDay, 60 * 1000);

// Another tab saved changes: show them here too, so two tabs never undo each other's work.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  trials = loadTrials();
  render();
});

// Cards rise into place as the timeline scrolls into view — not a one-shot
// animation that only plays near the top, but a real scroll effect: a card
// below the fold stays hidden until you actually scroll to it. Reduced
// motion shows every card immediately, no animation at all.
const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
  : null;

function observeReveal(container) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.querySelectorAll('.card').forEach((card, index) => {
    if (reduceMotion || !revealObserver) {
      card.classList.add('is-visible');
      return;
    }
    card.style.setProperty('--reveal-delay', `${Math.min(index, 6) * 70}ms`);
    card.classList.add('reveal');
    revealObserver.observe(card);
  });
}

// The one-click Gmail button opens the app with an email packed into the URL (#import=...).
// It's the same text you'd paste, so it goes through the same reader and is shown as plain text.
function importFromUrl() {
  const match = /[#&]import=([^&]+)/.exec(location.hash);
  if (!match) return;
  let text = '';
  try {
    text = decodeURIComponent(escape(window.atob(decodeURIComponent(match[1]))));
  } catch {
    text = '';
  }
  // Drop it from the address bar so a refresh doesn't read the same email again.
  history.replaceState(null, '', location.pathname + location.search);
  if (!text.trim()) return;
  emailText.value = text;
  emailText.setSelectionRange(0, 0);
  findTrials();
}
window.addEventListener('hashchange', importFromUrl);

findButton.addEventListener('click', findTrials);
clearButton.addEventListener('click', clearAll);
onClick(toastUndo, () => toastUndoAction?.());
sampleButton.addEventListener('click', () => {
  emailText.value = sampleEmails(todayISO());
  emailText.setSelectionRange(0, 0);
  emailText.focus();
  emailText.scrollTop = 0;
});

// Pin the money-at-risk bar to the top and condense it once you scroll past it,
// and drift the background glow with the page, so scrolling visibly moves more
// than just the list. One rAF-throttled listener drives both, cheaply.
{
  const moveGlow = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ticking = false;
  const syncScroll = () => {
    if (bannerSentinel) banner.classList.toggle('is-stuck', bannerSentinel.getBoundingClientRect().top < 0);
    if (moveGlow) document.documentElement.style.setProperty('--scrollY', String(window.scrollY));
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(syncScroll);
  }, { passive: true });
  syncScroll();
}

render();
importFromUrl();
