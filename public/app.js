// Page logic: sends the pasted emails to the helper server and draws the trials.
// Everything that came from an email is shown with textContent, never as HTML.

import { buildIcs, googleCalendarUrl, icsFileName } from './calendar.js';
import { countdownText, daysBetween, formatDate, todayISO, urgency } from './dates.js';
import { sampleEmails } from './samples.js';
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

const BADGES = { soon: 'Soon', month: 'Within 2 weeks', later: 'Later', past: 'Charged', none: 'No date' };

let trials = [];

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
  top.append(element('h3', 'service', trial.service), element('span', 'badge', BADGES[level]));

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
  actions.append(cancelInfo.button);

  card.append(top, countdown, priceLine, actions, cancelInfo.body);
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
  const { atRisk, next } = summarize(trials, today);
  banner.classList.toggle('clear', !next);

  if (!next) {
    bannerLabel.textContent = 'All good';
    bannerAmount.textContent = "You're all clear 🎉";
    bannerNext.textContent = 'No trials are about to charge you.';
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
  renderBanner(today);
  trialList.replaceChildren(...sortTrials(trials).map((trial) => renderCard(trial, today)));
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
    trials = result.trials.map((trial) => ({ ...trial, status: 'active' }));
    const skipped = result.ignoredCount
      ? ` ${result.ignoredCount} email${result.ignoredCount === 1 ? " didn't" : "s didn't"} look like a free trial.`
      : '';
    const note = result.note ? ` ${result.note}` : '';
    if (!trials.length) {
      showMessage(`We couldn't find a free trial in that text. Try pasting the whole email, including the dates.${skipped}`, true);
    } else {
      showMessage(`Found ${trials.length} trial${trials.length === 1 ? '' : 's'}.${skipped}${note}`);
    }
    render();
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
sampleButton.addEventListener('click', () => {
  emailText.value = sampleEmails(todayISO());
  emailText.setSelectionRange(0, 0);
  emailText.focus();
  emailText.scrollTop = 0;
});
