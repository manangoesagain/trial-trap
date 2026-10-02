import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, countdownText, daysBetween, formatDate, isValidISODate, urgency } from '../public/dates.js';
import { formatTotals, sameTrial, sortTrials, summarize, trialKey } from '../public/trials.js';

test('date maths works across months and years', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(daysBetween('2026-10-01', '2026-10-03'), 2);
  assert.equal(daysBetween('2026-10-01', '2026-09-30'), -1);
  assert.equal(isValidISODate('2026-02-30'), false);
  assert.equal(formatDate('2026-10-03'), 'Sat, Oct 3');
});

test('countdown words and urgency colours', () => {
  assert.deepEqual([0, 1, 2, -1, -3, null].map(countdownText), ['today', 'tomorrow', 'in 2 days', 'charged yesterday', 'charged 3 days ago', 'No date found']);
  assert.deepEqual([0, 3, 4, 14, 15, -1, null].map(urgency), ['soon', 'soon', 'month', 'month', 'later', 'past', 'none']);
});

const trial = (service, chargeDate, price, extra = {}) => ({ service, chargeDate, price, currency: 'USD', status: 'active', ...extra });

test('sorts soonest first with undated trials last', () => {
  const sorted = sortTrials([trial('C', null, 1), trial('B', '2026-10-09', 1), trial('A', '2026-10-03', 1)]);
  assert.deepEqual(sorted.map((t) => t.service), ['A', 'B', 'C']);
});

test('banner totals only count active trials that have not charged yet', () => {
  const summary = summarize([
    trial('StreamBox', '2026-10-03', 15.99),
    trial('PixelForge', '2026-10-10', 12.99),
    trial('MunchPass', '2026-10-26', 9.99),
    trial('Old', '2026-09-20', 50),
    trial('Gone', '2026-10-05', 7, { status: 'cancelled' }),
    trial('Rupees', '2026-10-07', 199, { currency: 'INR' }),
    trial('Free?', '2026-10-08', null),
  ], '2026-10-01');
  assert.deepEqual(summary.atRisk, { USD: 38.97, INR: 199 });
  assert.deepEqual(summary.saved, { USD: 7 });
  assert.equal(summary.next.service, 'StreamBox');
  assert.equal(formatTotals(summary.atRisk), '$38.97 + ₹199.00');
});

test('the same trial pasted twice is recognised, different ones are kept apart', () => {
  const card = (service, chargeDate) => ({ service, chargeDate });
  assert.equal(sameTrial(card('StreamBox', '2026-10-03'), card('Streambox Plus', '2026-10-03')), true);
  assert.equal(sameTrial(card('The Daily Paper', null), card('Daily Paper', null)), true);
  assert.equal(sameTrial(card('StreamBox', '2026-10-03'), card('StreamBox', '2026-11-03')), false);
  assert.equal(sameTrial(card('Nova Music', '2026-10-10'), card('Nova Fitness', '2026-10-10')), false);
  assert.equal(sameTrial(card('हॉटस्टार', '2026-10-10'), card('ज़ी5', '2026-10-10')), false);
  assert.equal(trialKey('The Daily Paper', null), 'dailypaper-nodate');
});
