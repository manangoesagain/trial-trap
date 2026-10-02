// Emails written the way people really paste them from Gmail and Outlook.
// All brands here are made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basicExtract } from '../lib/basicExtract.js';

const today = '2026-10-01';

function read(text) {
  return basicExtract(text, today);
}

function summary(trial) {
  return [trial.service, trial.chargeDate, trial.dateIsEstimated, trial.price, trial.currency, trial.billingPeriod];
}

test('Gmail copies: the received date is not the charge date', () => {
  const gmail = 'Welcome to Glowfit - your free trial starts now\nInbox\n\nGlowfit <hello@glowfit.example>\n\t\nMon, Sep 28, 6:02 PM (3 days ago)\n\t\nto me\n\nThanks for joining Glowfit!\n\nYour free trial ends on October 12, 2026. After that we will charge $14.99 per month to the card on file.';
  assert.deepEqual(summary(read(gmail).trials[0]), ['Glowfit', '2026-10-12', false, 14.99, 'USD', 'month']);

  const friend = 'From: Pawpal <hi@pawpal.example>\nSubject: Welcome!\n\nThanks for joining Pawpal on September 28. Refer a friend by September 30 to get a bonus month. Your free trial ends on October 20, 2026, then $4.99/month.';
  assert.equal(read(friend).trials[0].chargeDate, '2026-10-20');

  const started = 'From: Glimmer <team@glimmer.example>\nYour free trial started on September 28, 2026 and ends on October 28, 2026. Then $6/month.';
  assert.equal(read(started).trials[0].chargeDate, '2026-10-28');
});

test('a trial length is counted from the date the email was received', () => {
  const gmail = 'Welcome aboard, Priya!\nInbox\n\nSnapdeck <hello@snapdeck.example>\n\t\nMon, Sep 28, 9:14 AM (3 days ago)\n\t\nto me\n\nYour 14-day free trial of Snapdeck Pro has started.\nAfter that, it is $8/month.';
  assert.deepEqual(summary(read(gmail).trials[0]), ['Snapdeck Pro', '2026-10-12', true, 8, 'USD', 'month']);

  const reply = 'Hi, how do I stop this?\n\nOn Mon, Sep 28, 2026 at 9:14 AM Snapdeck <support@snapdeck.example> wrote:\n> Your 14-day free trial of Snapdeck Pro has started.\n> After it ends, you will be billed $8/month.';
  assert.equal(read(reply).trials[0].chargeDate, '2026-10-12');
});

test('"ends tomorrow", "ends in 3 days" and 15-Oct-2026', () => {
  const tomorrow = 'From: Zappit <reminders@zappit.example>\nDate: Thu, 1 Oct 2026 08:00:00 +0000\nSubject: Your free trial ends tomorrow\n\nHeads up! Your free trial ends tomorrow. After that, you will be charged $6.99/month unless you cancel.';
  assert.deepEqual(summary(read(tomorrow).trials[0]), ['Zappit', '2026-10-02', false, 6.99, 'USD', 'month']);

  const inDays = 'From: Orbitly <billing@orbitly.example>\nDate: Thu, 1 Oct 2026 08:00:00 +0000\nSubject: Your Orbitly trial ends in 3 days\n\nJust a reminder: your free trial ends in 3 days. Then your plan continues at $12.99/month.';
  assert.equal(read(inDays).trials[0].chargeDate, '2026-10-04');

  const dashed = 'From: Bharatflix <noreply@bharatflix.example>\nSubject: Free trial activated\n\nYour free trial ends on 15-Oct-2026. Thereafter ₹199/month will be charged.';
  assert.deepEqual(summary(read(dashed).trials[0]), ['Bharatflix', '2026-10-15', false, 199, 'INR', 'month']);
});

test('service names from common wording', () => {
  const cases = [
    ['From: Tunely <no-reply@tunely.example>\nSubject: Trial reminder\n\nYour free trial of Tunely Premium ends on October 5, 2026. After that, you will pay $9.99/month.', 'Tunely Premium'],
    ['From: hello@harborfit.example\nSubject: Welcome to Harbor Fit – your free trial has started\n\nYour free trial ends on October 20, 2026, then $15/month.', 'Harbor Fit'],
    ['From: Spindle <hello@spindle.example>\nSubject: You are in!\n\nEnjoy a free trial for 30 days, then $5/month.', 'Spindle'],
    ['From: Maya from Kettlebase <maya@kettlebase.example>\nSubject: Your free trial has started\n\nYour free trial ends on October 15, 2026. Then $19/month.', 'Kettlebase'],
  ];
  for (const [email, name] of cases) assert.equal(read(email).trials[0].service, name, email);
});

test('prices in more formats', () => {
  const cases = [
    ['After that, you will be charged €9,99/month.', 9.99, 'EUR', 'month'],
    ['After that, Wolkenfilm costs 9,99 € per month.', 9.99, 'EUR', 'month'],
    ['Then ₹ 149 per month.', 149, 'INR', 'month'],
    ['After that it is 12.99 per month.', 12.99, null, 'month'],
    ['Then CA$9.99/month.', 9.99, 'CAD', 'month'],
    ['Then just $4.99/mo, billed annually at $59.88.', 59.88, 'USD', 'year'],
    ['Your Annual plan will then renew at $59.99, billed annually.', 59.99, 'USD', 'year'],
    ['Then $12.99 monthly.', 12.99, 'USD', 'month'],
    ['After that you will be charged Rs. 499/- per month.', 499, 'INR', 'month'],
    ['Then ₹1,499/month.', 1499, 'INR', 'month'],
  ];
  for (const [text, price, currency, period] of cases) {
    const [trial] = read(`From: Velora <service@velora.example>\nYour free trial ends on 20 October 2026. ${text}`).trials;
    assert.deepEqual([trial.price, trial.currency, trial.billingPeriod], [price, currency, period], text);
  }
});

test('trial emails that say "expire" or "runs until" are not ignored', () => {
  const cases = [
    ['From: Driftly <billing@driftly.example>\nSubject: Your Driftly trial is ending soon\n\nJust a reminder: your trial will expire on October 8, 2026. On that day we will start billing $9.99/month.', 'Driftly', '2026-10-08'],
    ['From: Tunely <no-reply@tunely.example>\nSubject: Trial reminder\n\nYour trial of Tunely Premium expires on October 5, 2026. After that, you will pay $9.99/month.', 'Tunely Premium', '2026-10-05'],
    ['From: Tunely <no-reply@tunely.example>\nSubject: Thanks for trying Tunely\n\nYour trial for Tunely Premium runs until October 5, 2026, then $9.99/month.', 'Tunely Premium', '2026-10-05'],
  ];
  for (const [email, service, date] of cases) {
    const { trials, ignoredCount } = read(email);
    assert.equal(ignoredCount, 0, email);
    assert.deepEqual([trials[0].service, trials[0].chargeDate, trials[0].price], [service, date, 9.99]);
  }
});

test('a newsletter advertising a trial is ignored', () => {
  const newsletter = "From: Tunely <news@tunely.example>\nSubject: 10 playlists for your autumn\n\nFall is here! Check out this week's top playlists.\nNot on Premium yet? Start your 30-day free trial today and listen ad-free.\nUnsubscribe: https://tunely.example/email/unsubscribe?id=abc";
  assert.deepEqual(read(newsletter), { trials: [], ignoredCount: 1 });
});

test('a forwarded email gives one card, not two', () => {
  const gmail = 'Fwd: Your free trial of Lumenly Pro has started\nInbox\n\nPriya Sharma\n\t\nWed, Sep 30, 8:00 PM (1 day ago)\n\t\nto me\n\n---------- Forwarded message ---------\nFrom: Lumenly <billing@lumenly.example>\nDate: Mon, Sep 28, 2026 at 9:14 AM\nSubject: Your free trial of Lumenly Pro has started\nTo: <priya@mail.example>\n\nYour free trial of Lumenly Pro ends on Oct 12, 2026. After that, Lumenly Pro is $11.99/month.';
  const outlook = 'From: Priya Sharma <priya@mail.example>\nSent: Wednesday, September 30, 2026 8:00 PM\nTo: Arjun Rao <arjun@mail.example>\nSubject: FW: Your free trial of Lumenly Pro has started\n\nCan you check this one?\n\n________________________________\nFrom: Lumenly <billing@lumenly.example>\nSent: Monday, September 28, 2026 9:14 AM\nTo: Priya Sharma <priya@mail.example>\nSubject: Your free trial of Lumenly Pro has started\n\nYour free trial of Lumenly Pro ends on Oct 12, 2026. After that, Lumenly Pro is $11.99/month.';
  for (const email of [gmail, outlook]) {
    const { trials } = read(email);
    assert.equal(trials.length, 1);
    assert.deepEqual(summary(trials[0]), ['Lumenly Pro', '2026-10-12', false, 11.99, 'USD', 'month']);
  }
});

test('emails pasted back to back without a --- line are kept apart', () => {
  const gmail = 'Your Tunely Premium free trial has started\nInbox\n\nTunely <no-reply@tunely.example>\n\t\nMon, Sep 28, 9:14 AM (3 days ago)\n\t\nto me\n\nYour free trial of Tunely Premium ends on October 5, 2026. After that, you will pay $9.99/month.\n\nYour Glowfit trial is live\nInbox\n\nGlowfit <hello@glowfit.example>\n\t\nTue, Sep 29, 7:30 PM (2 days ago)\n\t\nto me\n\nYour free trial of Glowfit ends on October 20, 2026. Then $14.99 per month.';
  const subjects = 'Subject: Your free trial of Tunely Premium\nYour free trial of Tunely Premium ends on October 5, 2026. After that, you will pay $9.99/month.\n\nSubject: Your free trial of Glowfit\nYour free trial of Glowfit ends on October 20, 2026. Then $14.99 per month.';
  for (const paste of [gmail, subjects]) {
    assert.deepEqual(read(paste).trials.map((t) => [t.service, t.chargeDate, t.price]), [
      ['Tunely Premium', '2026-10-05', 9.99],
      ['Glowfit', '2026-10-20', 14.99],
    ]);
  }
});

test('cancel links and steps point at what actually cancels', () => {
  const links = 'From: Quokka Cloud <billing@quokkacloud.example>\nSubject: Your free trial of Quokka Cloud\n\nYour free trial ends on October 20, 2026, then $3.99/month.\nManage subscription: https://quokkacloud.example/manage?utm_source=trial_email&utm_campaign=t1\nRead our cancellation policy: https://quokkacloud.example/legal/cancellation-policy';
  assert.equal(read(links).trials[0].cancelUrl, 'https://quokkacloud.example/manage?utm_source=trial_email&utm_campaign=t1');

  const warning = 'From: Bramble <billing@bramble.example>\nSubject: Your free trial has started\n\nYour free trial ends on October 20, 2026. If you do not cancel before then, your account will be charged $7.99/month.\nTo cancel, go to Settings > Plan.';
  assert.deepEqual(read(warning).trials[0].cancelSteps, ['To cancel, go to Settings > Plan.']);
});

test('two services that share a first word and a date are both found', () => {
  const paste = 'From: Nova Music <hello@novamusic.example>\nWelcome to Nova Music! Your free trial ends on October 10, 2026. After that you will be charged $5.99/month.\n---\nFrom: Nova Fitness <hello@novafitness.example>\nWelcome to Nova Fitness! Your free trial ends on October 10, 2026. After that you will be charged $8.99/month.';
  assert.deepEqual(read(paste).trials.map((t) => [t.service, t.price]), [['Nova Music', 5.99], ['Nova Fitness', 8.99]]);
});
