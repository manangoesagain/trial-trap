import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, googleCalendarUrl, reminderDate, reminderText } from '../public/calendar.js';

const today = '2026-10-01';
const trial = {
  id: 'streambox-2026-10-03',
  service: 'StreamBox Plus',
  chargeDate: '2026-10-03',
  price: 15.99,
  currency: 'USD',
  billingPeriod: 'month',
  cancelSteps: ['Go to Account > Membership, then choose "Cancel plan"; it takes a minute.'],
  cancelUrl: 'https://streambox.example/account/cancel',
};

test('reminds the day before, but never in the past', () => {
  assert.equal(reminderDate('2026-10-03', today), '2026-10-02');
  assert.equal(reminderDate('2026-10-01', today), '2026-10-01');
  assert.equal(reminderText(trial, today).title, 'Cancel StreamBox Plus trial: charges $15.99 tomorrow');
  assert.equal(reminderText({ ...trial, chargeDate: today }, today).title, 'Cancel StreamBox Plus trial: charges $15.99 today');
});

test('Google Calendar link has the right title, time and steps', () => {
  const url = new URL(googleCalendarUrl(trial, today));
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('text'), 'Cancel StreamBox Plus trial: charges $15.99 tomorrow');
  assert.equal(url.searchParams.get('dates'), '20261002T090000/20261002T091500');
  assert.match(url.searchParams.get('details'), /How to cancel:\n- Go to Account/);
  assert.match(url.searchParams.get('details'), /Cancel here: https:\/\/streambox\.example\/account\/cancel/);
});

test('calendar file is valid: escaped text, short lines, alarm included', () => {
  const ics = buildIcs(trial, today, new Date('2026-10-01T12:00:00Z'));
  const lines = ics.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(lines.includes('DTSTART:20261002T090000'));
  assert.ok(lines.includes('DTSTAMP:20261001T120000Z'));
  assert.ok(lines.includes('BEGIN:VALARM'));
  assert.ok(lines.every((line) => new TextEncoder().encode(line).length <= 75), 'no line longer than 75 bytes');
  const unfolded = ics.replace(/\r\n /g, '');
  assert.match(unfolded, /SUMMARY:Cancel StreamBox Plus trial: charges \$15\.99 tomorrow/);
  assert.match(unfolded, /then choose "Cancel plan"\; it takes a minute\./);
  assert.match(unfolded, /Membership\\, then/);
  assert.doesNotMatch(unfolded.replace(/\r\n/g, ''), /\n/, 'newlines inside text are escaped');
});

test('works when the email had no price or cancel steps', () => {
  const plain = { ...trial, price: null, currency: null, cancelSteps: [], cancelUrl: null };
  const { title, description } = reminderText(plain, today);
  assert.equal(title, 'Cancel StreamBox Plus trial: charges you tomorrow');
  assert.match(description, /didn't say how to cancel/);
  assert.doesNotMatch(buildIcs(plain, today), /^URL:/m);
});
