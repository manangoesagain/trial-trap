import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basicExtract } from '../lib/basicExtract.js';
import { splitEmails } from '../lib/splitEmails.js';
import { sampleEmails } from '../public/samples.js';

const today = '2026-10-01';

test('reads the three sample emails', () => {
  const { trials, ignoredCount } = basicExtract(sampleEmails(today), today);
  assert.equal(ignoredCount, 0);
  assert.deepEqual(trials.map((t) => [t.service, t.chargeDate, t.dateIsEstimated, t.price, t.currency, t.billingPeriod]), [
    ['StreamBox Plus', '2026-10-03', false, 15.99, 'USD', 'month'],
    ['PixelForge Pro', '2026-10-10', true, 12.99, 'USD', 'month'],
    ['MunchPass', '2026-10-26', false, 9.99, 'USD', 'month'],
  ]);
  assert.equal(trials[0].cancelUrl, 'https://streambox.example/account/cancel');
  assert.match(trials[0].cancelSteps[0], /^To cancel, go to Account/);
  assert.deepEqual(trials[2].cancelSteps, []);
  assert.equal(trials[2].cancelUrl, null);
});

test('splits on separator lines and new From: headers', () => {
  assert.equal(splitEmails('From: a\nhello\n---\nFrom: b\nhi').length, 2);
  assert.equal(splitEmails('From: a\nhello\n\nFrom: b\nhi').length, 2);
  assert.equal(splitEmails('just one email').length, 1);
});

test('ignores emails that are not free trials', () => {
  const receipt = 'From: Shop <orders@shop.example>\nSubject: Your receipt\n\nThanks for your order of $25.00.';
  const { trials, ignoredCount } = basicExtract(receipt, today);
  assert.equal(trials.length, 0);
  assert.equal(ignoredCount, 1);
});

test('understands common date formats', () => {
  const cases = [
    ['Your free trial ends on 2026-11-05.', '2026-11-05'],
    ['Your free trial ends Nov 5th, 2026.', '2026-11-05'],
    ['Your free trial ends on 5 November 2026.', '2026-11-05'],
    ['Your free trial ends on 11/05/2026 and costs $5/month.', '2026-11-05'],
    ['Your free trial ends on 05/11/2026 and costs ₹199/month.', '2026-11-05'],
    ['Your free trial ends on 25/11/2026.', '2026-11-25'],
    ['Your free trial ends on November 5.', '2026-11-05'],
  ];
  for (const [text, expected] of cases) {
    assert.equal(basicExtract(`From: Demo <a@demo.example>\n${text}`, today).trials[0]?.chargeDate, expected, text);
  }
});

test('estimates the date from the trial length when no end date is given', () => {
  const email = 'From: Demo <a@demo.example>\nDate: Mon, 28 Sep 2026 10:00:00 +0000\n\nYour 7-day free trial has started.';
  const [trial] = basicExtract(email, today).trials;
  assert.equal(trial.chargeDate, '2026-10-05');
  assert.equal(trial.dateIsEstimated, true);
});

test('reads prices in different currencies and periods', () => {
  const cases = [
    ['then ₹199 per month', 199, 'INR', 'month'],
    ['then €59.99/year', 59.99, 'EUR', 'year'],
    ['then £4.99 a week', 4.99, 'GBP', 'week'],
    ['then 1,299.00 INR', 1299, 'INR', null],
    ['$0.00 today, then $8 per month', 8, 'USD', 'month'],
  ];
  for (const [text, price, currency, period] of cases) {
    const [trial] = basicExtract(`From: Demo <a@demo.example>\nYour free trial ends on 2026-11-05, ${text}.`, today).trials;
    assert.deepEqual([trial.price, trial.currency, trial.billingPeriod], [price, currency, period], text);
  }
});

test('says "not in email" instead of guessing', () => {
  const [trial] = basicExtract('Your free trial has started. Enjoy!', today).trials;
  assert.equal(trial.chargeDate, null);
  assert.equal(trial.price, null);
  assert.equal(trial.service, 'Unknown service');
});

test('never turns a dangerous link into a button', () => {
  const [trial] = basicExtract('From: Demo <a@demo.example>\nYour free trial ends on 2026-11-05. Cancel: javascript:alert(1)', today).trials;
  assert.equal(trial.cancelUrl, null);
});
