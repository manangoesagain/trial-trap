import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, loadTrials, mergeTrials, saveTrials } from '../public/storage.js';
import { summarize } from '../public/trials.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

const streambox = { id: 'streambox-2026-10-03', service: 'StreamBox Plus', chargeDate: '2026-10-03', dateIsEstimated: false, price: 15.99, currency: 'USD', billingPeriod: 'month', cancelSteps: [], cancelUrl: null };
const munchpass = { id: 'munchpass-2026-10-26', service: 'MunchPass', chargeDate: '2026-10-26', dateIsEstimated: false, price: 9.99, currency: 'USD', billingPeriod: 'month', cancelSteps: [], cancelUrl: null };

test('pasting again adds only new trials and keeps cancelled ones cancelled', () => {
  const first = mergeTrials([], [streambox], '2026-10-01T10:00:00Z');
  assert.equal(first.added, 1);
  assert.equal(first.trials[0].status, 'active');
  assert.equal(first.trials[0].addedAt, '2026-10-01T10:00:00Z');

  const saved = first.trials.map((trial) => ({ ...trial, status: 'cancelled' }));
  const again = mergeTrials(saved, [{ ...streambox, service: 'Streambox' }, munchpass]);
  assert.equal(again.added, 1);
  assert.equal(again.alreadySaved, 1, '"Streambox" on the same day is the same trial');
  assert.deepEqual(again.trials.map((t) => [t.service, t.status]), [['StreamBox Plus', 'cancelled'], ['MunchPass', 'active']]);
});

test('trials survive a save and load', () => {
  const storage = fakeStorage();
  const { trials } = mergeTrials([], [streambox, munchpass]);
  assert.equal(saveTrials(trials, storage), true);
  assert.deepEqual(loadTrials(storage), trials);
});

test('broken or blocked storage never breaks the page', () => {
  assert.deepEqual(loadTrials(fakeStorage({ [STORAGE_KEY]: 'not json{' })), []);
  assert.deepEqual(loadTrials(fakeStorage({ [STORAGE_KEY]: '{"a":1}' })), []);
  assert.deepEqual(loadTrials(null), []);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadTrials(blocked), []);
  assert.equal(saveTrials([streambox], blocked), false);
});

test('saved data is tidied when loaded', () => {
  const storage = fakeStorage({
    [STORAGE_KEY]: JSON.stringify([
      { ...streambox, cancelUrl: 'javascript:alert(1)', status: 'weird' },
      { ...streambox, service: 'Streambox' },
      { service: '' },
      null,
    ]),
  });
  const trials = loadTrials(storage);
  assert.equal(trials.length, 1);
  assert.equal(trials[0].cancelUrl, null);
  assert.equal(trials[0].status, 'active');
});

test('cancelled trials count as saved money, not money at risk', () => {
  const trials = [{ ...streambox, status: 'cancelled' }, { ...munchpass, status: 'active' }];
  const summary = summarize(trials, '2026-10-01');
  assert.deepEqual(summary.atRisk, { USD: 9.99 });
  assert.deepEqual(summary.saved, { USD: 15.99 });
  assert.equal(summary.next.service, 'MunchPass');
});
