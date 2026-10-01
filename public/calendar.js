// Calendar reminders for a trial: a Google Calendar link and a standard .ics file
// for Apple Calendar and Outlook. The reminder is at 9:00 AM the day before the charge
// (or today, if that day has already passed), in the user's own time zone.

import { addDays, daysBetween, formatDate } from './dates.js';
import { formatMoney } from './trials.js';

export function reminderDate(chargeDate, today) {
  const dayBefore = addDays(chargeDate, -1);
  return dayBefore < today ? today : dayBefore;
}

export function reminderText(trial, today) {
  const day = reminderDate(trial.chargeDate, today);
  const gap = daysBetween(day, trial.chargeDate);
  const when = gap === 1 ? 'tomorrow' : gap === 0 ? 'today' : `on ${formatDate(trial.chargeDate)}`;
  const price = trial.price === null ? 'you' : formatMoney(trial.price, trial.currency);
  const title = `Cancel ${trial.service} trial: charges ${price} ${when}`;

  const lines = [`Your ${trial.service} free trial turns into a paid plan on ${formatDate(trial.chargeDate)}.`, ''];
  if (trial.cancelSteps.length) {
    lines.push('How to cancel:', ...trial.cancelSteps.map((step) => `- ${step}`));
  } else {
    lines.push(`The email didn't say how to cancel. Look under Account or Subscription settings on ${trial.service}'s website.`);
  }
  if (trial.cancelUrl) lines.push('', `Cancel here: ${trial.cancelUrl}`);
  lines.push('', 'Reminder from Trial Trap.');

  return { day, title, description: lines.join('\n') };
}

const compact = (iso) => iso.replaceAll('-', '');

export function googleCalendarUrl(trial, today) {
  const { day, title, description } = reminderText(trial, today);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${compact(day)}T090000/${compact(day)}T091500`,
    details: description,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Calendar files must not have lines longer than 75 bytes; longer ones continue
// on the next line after a single space.
function foldLine(line) {
  const encoder = new TextEncoder();
  const parts = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    const limit = parts.length ? 74 : 75;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += character;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function utcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs(trial, today, now = new Date()) {
  const { day, title, description } = reminderText(trial, today);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trial Trap//Trial reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${trial.id}@trial-trap`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${compact(day)}T090000`,
    `DTEND:${compact(day)}T091500`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(trial.cancelUrl ? [`URL:${trial.cancelUrl}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(title)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export function icsFileName(trial) {
  return `cancel-${trial.id}.ics`;
}
