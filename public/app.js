// Page logic: sends the pasted emails to the helper server and draws the trials.

import { todayISO } from './dates.js';
import { sampleEmails } from './samples.js';

const emailText = document.querySelector('#email-text');
const findButton = document.querySelector('#find-button');
const sampleButton = document.querySelector('#sample-button');
const message = document.querySelector('#message');
const trialList = document.querySelector('#trial-list');

let trials = [];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(trial) {
  if (trial.price === null) return 'Price not in email';
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: trial.currency ?? 'USD' }).format(trial.price);
  return trial.billingPeriod ? `${amount}/${trial.billingPeriod}` : amount;
}

function render() {
  trialList.replaceChildren(...trials.map((trial) => {
    const card = element('article', 'card');
    card.append(
      element('h3', 'service', trial.service),
      element('p', 'charge-date', trial.chargeDate ? `Charges on ${trial.chargeDate}` : 'Date not in email'),
      element('p', 'price', formatPrice(trial)),
    );
    return card;
  }));
}

async function findTrials() {
  const text = emailText.value;
  if (!text.trim()) {
    message.textContent = 'Paste an email first, or try the sample emails.';
    return;
  }
  findButton.disabled = true;
  findButton.textContent = 'Reading your emails…';
  message.textContent = '';
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, today: todayISO() }),
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.error;
      return;
    }
    trials = result.trials;
    if (!trials.length) message.textContent = "We couldn't find a free trial in that text. Try pasting the whole email, including the dates.";
    render();
  } catch {
    message.textContent = "Couldn't reach Trial Trap. Is the server still running?";
  } finally {
    findButton.disabled = false;
    findButton.textContent = 'Find my trials';
  }
}

findButton.addEventListener('click', findTrials);
sampleButton.addEventListener('click', () => {
  emailText.value = sampleEmails(todayISO());
});
