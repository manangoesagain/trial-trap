// The built-in reader: finds free trials in emails with simple patterns, no AI needed.
// It is less clever than the AI reader but always available, so the app never breaks.

import { splitEmails } from './splitEmails.js';
import { readDate, findDates } from './readDates.js';
import { cleanTrials, currencyCode } from './validateTrials.js';
import { addDays, addMonths, daysBetween } from '../public/dates.js';

const TRIAL_HINT = /\bfree trial\b|\btrial (?:period|ends|will end|expires|has started|membership|starts)\b|\d+[- ]?(?:day|week|month)s?[- ](?:free )?trial\b|\btrial\b[^.\n]{0,40}?\b(?:ends?|ending|expires?|expiring|runs? until|is over|is ending)\b/i;
// Newsletters often advertise a trial ("Start your free trial today") without the
// person having one. Those only count when the email also confirms a real trial.
const TRIAL_ADVERT = /\b(?:start|begin|claim|get|try)\s+(?:your|a|our|the)?\s*(?:\d+[- ]?(?:day|week|month)\s+)?free trial\b|\bnot on [^.?\n]{1,30} yet\b/i;
const TRIAL_CONFIRMED = /\b(?:has started|have started|is active|is live|activated|started your|ends?|ending|expires?|expiring|will be (?:charged|billed)|renews?|welcome to|thanks for (?:starting|joining|signing up|subscribing)|trial period)\b/i;

// Words that, just before a date, say whether it is the charge date or something else.
const CHARGE_WORDS = /\b(?:trial|ends?|ending|expir\w*|charg\w*|bill\w*|renew\w*|payments?|until|starting|convert\w*|from|thereafter|then|due)\b/gi;
const OTHER_DATE_WORDS = /\b(?:started|starts|began|begins|signed up|joined|since|activated|created|ordered|purchased|placed|sent|received|wrote)\b/gi;
const RELATIVE_END = /\b(?:ends?|ending|expires?|expiring|will end|will expire|charges?|renews?|bills?|is over|runs? out)\s+(?:at midnight\s+)?(today|tonight|tomorrow|in\s+(\d{1,3})\s+(day|week)s?)\b/i;

// Amounts: "1,299.00", Indian "1,49,900", euro-style "9,99" and plain "15.99".
const AMOUNT = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d{1,2}(?:,\\d{2})+,\\d{3}(?:\\.\\d{1,2})?|\\d+,\\d{2}(?!\\d)|\\d+(?:\\.\\d{1,2})?)';
const MONEY_BEFORE = new RegExp(`(\\b(?:US|CA|AU|NZ|HK|S|C|A)\\$|\\$|₹|€|£|\\bRs\\.?|\\b(?:INR|USD|EUR|GBP|CAD|AUD)\\b)\\s?${AMOUNT}`, 'gi');
const MONEY_AFTER = new RegExp(`${AMOUNT}\\s?(?:(USD|INR|EUR|GBP|CAD|AUD)\\b|(€|₹|£))`, 'gi');
const BARE_MONEY = new RegExp(`(?<![\\w$₹€£.,])(\\d+\\.\\d{2})(?=\\s*(?:\\/\\s*|per\\s+|a\\s+|each\\s+)(?:mo\\b|month|yr\\b|year|week|wk\\b))`, 'gi');
const PERIOD_AFTER = /^\s*(?:\/-\s*)?(?:(?:\/|per|a|each|every)\s*(mo\b|month|yr\b|year|annum|week|wk\b)|(monthly|yearly|annually|weekly)\b)/i;
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

// Gmail and Outlook copies have no "Date:" header, just a line with the received date:
// "Mon, Sep 28, 6:02 PM (3 days ago)" or "Mon 9/28/2026 9:14 AM".
const RECEIVED_LINE = /^\s*(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+[^\n]{3,40}?\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?(?:\s*\([^)]*\))?\s*$/im;
const REPLY_LINE = /^\s*>?\s*on\s+([^\n]{6,60}?\d{4}[^\n]*?)\s+wrote:\s*$/im;
const SENDER_LINE = /^\s*([^<>\n:]{1,60}?)\s*<[^@\s<>]+@[^\s<>]+>\s*$/m;

function headerValue(email, name) {
  const match = new RegExp(`^\\s*${name}:\\s*(.+)$`, 'im').exec(email);
  return match ? match[1].trim() : null;
}

function isTrialEmail(email) {
  if (!TRIAL_HINT.test(email)) return false;
  return !TRIAL_ADVERT.test(email) || TRIAL_CONFIRMED.test(email);
}

// The Gmail/Outlook "received" line of a copied email: only near the top, only in a copy
// without a From: header, and only if its date isn't in the future. Otherwise a line like
// "Saturday, October 10, 2026 at 11:59 PM" is part of the message, maybe the charge date.
function receivedLine(email, todayISO, options) {
  if (headerValue(email, 'from')) return null;
  const top = email.split('\n').slice(0, 10).join('\n');
  const line = RECEIVED_LINE.exec(top)?.[0];
  const date = line && readDate(line, todayISO, options);
  return date && daysBetween(todayISO, date) <= 0 ? { line, date } : null;
}

// When the email was sent, so "14-day trial" can be counted from the right day.
function findSentDate(email, todayISO, options) {
  const line = headerValue(email, 'date') ?? headerValue(email, 'sent') ?? REPLY_LINE.exec(email)?.[1];
  const date = line ? readDate(line, todayISO, options) : receivedLine(email, todayISO, options)?.date;
  return date && daysBetween(todayISO, date) <= 0 ? date : null;
}

// Removes header and "received" lines so their dates aren't mistaken for the charge date.
function emailBody(email, todayISO, options) {
  const received = receivedLine(email, todayISO, options);
  const body = email
    .replace(/^\s*(?:date|sent):.*$/gim, '')
    .replace(new RegExp(REPLY_LINE.source, 'gim'), '');
  return received ? body.replace(received.line, '') : body;
}

// The last keyword before a date (in the same sentence) decides what kind of date it is.
function dateKind(body, date) {
  let before = body.slice(Math.max(0, date.start - 80), date.start);
  const sentenceStart = Math.max(before.search(/[.!?]\s[^.!?]*$/) + 1, before.lastIndexOf('\n\n') + 1);
  before = before.slice(sentenceStart);
  let kind = null;
  let position = -1;
  for (const [words, label] of [[CHARGE_WORDS, 'charge'], [OTHER_DATE_WORDS, 'other']]) {
    for (const match of before.matchAll(words)) {
      if (match.index > position) {
        position = match.index;
        kind = label;
      }
    }
  }
  return kind;
}

function findChargeDate(email, todayISO, sentDate, options) {
  const referenceISO = sentDate ?? todayISO;
  const body = emailBody(email, todayISO, options);
  const dates = findDates(body, referenceISO, options).map((date) => ({ ...date, kind: dateKind(body, date) }));
  const notBefore = (date) => daysBetween(referenceISO, date.iso) >= 0;
  const chosen = dates.find((date) => date.kind === 'charge' && notBefore(date))
    ?? dates.find((date) => date.kind === 'charge')
    ?? dates.find((date) => date.kind !== 'other' && notBefore(date));
  if (chosen) return { chargeDate: chosen.iso, dateIsEstimated: false };

  // "Your trial ends tomorrow" / "ends in 3 days": count from the email's date, or today.
  const relative = RELATIVE_END.exec(body);
  if (relative) {
    const word = relative[1].toLowerCase();
    const days = word === 'tomorrow' ? 1 : word.startsWith('in') ? +relative[2] * (/week/i.test(relative[3]) ? 7 : 1) : 0;
    return { chargeDate: addDays(referenceISO, days), dateIsEstimated: !sentDate };
  }

  const length = /(\d{1,3})[-\s]?(day|week|month)s?\b[^.\n]{0,20}?\btrial\b/i.exec(body)
    ?? /\btrial\b[^.\n]{0,30}?\b(?:for|of|lasts?)\s+(\d{1,3})\s+(day|week|month)s?\b/i.exec(body);
  if (!length) return { chargeDate: null, dateIsEstimated: false };
  const amount = +length[1];
  const unit = length[2].toLowerCase();
  const chargeDate = unit === 'month'
    ? addMonths(referenceISO, amount)
    : addDays(referenceISO, unit === 'week' ? amount * 7 : amount);
  return { chargeDate, dateIsEstimated: true };
}

function readAmount(text) {
  return parseFloat(/^\d+,\d{2}$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, ''));
}

function periodName(word) {
  const text = word.toLowerCase();
  if (/^(?:mo|month|monthly)/.test(text)) return 'month';
  if (/^(?:yr|year|yearly|annum|annually)/.test(text)) return 'year';
  if (/^(?:wk|week|weekly)/.test(text)) return 'week';
  return null;
}

function findPrice(email) {
  const prices = [];
  const add = (match, amountText, currency) => prices.push({
    amount: readAmount(amountText), currency, start: match.index, end: match.index + match[0].length,
  });
  for (const match of email.matchAll(MONEY_BEFORE)) add(match, match[2], currencyCode(match[1].replace(/\s+/g, '')));
  for (const match of email.matchAll(MONEY_AFTER)) add(match, match[1], currencyCode(match[2] ?? match[3]));
  for (const match of email.matchAll(BARE_MONEY)) {
    if (!prices.some((price) => match.index >= price.start && match.index < price.end)) add(match, match[1], null);
  }
  const paid = prices.filter((price) => price.amount > 0).sort((a, b) => a.start - b.start);
  if (!paid.length) return { price: null, currency: null, billingPeriod: null };

  const after = (price) => email.slice(price.end, price.end + 40);
  const before = (price) => email.slice(Math.max(0, price.start - 60), price.start);
  const periodOf = (price) => {
    const match = PERIOD_AFTER.exec(after(price));
    if (match) return periodName(match[1] ?? match[2]);
    if (/^[^.\n]{0,20}?\bbilled (?:annually|yearly)\b/i.test(after(price))) return 'year';
    if (/^[^.\n]{0,20}?\bbilled monthly\b/i.test(after(price))) return 'month';
    return null;
  };
  // "$4.99/mo, billed annually at $59.88": the yearly amount is what actually gets charged.
  const yearly = paid.find((price) => /billed (?:annually|yearly)(?: at| of)?:?\s*$/i.test(before(price)));
  if (yearly) return { price: yearly.amount, currency: yearly.currency, billingPeriod: 'year' };

  const nearCharge = (price) => /after|then|renew|charg|bill|will be|starting|converts?|thereafter/i.test(before(price));
  const chosen = paid.find((price) => periodOf(price)) ?? paid.find(nearCharge) ?? paid[0];
  return { price: chosen.amount, currency: chosen.currency, billingPeriod: periodOf(chosen) };
}

function cleanServiceName(name) {
  const cleaned = name
    .replace(/["'<>]/g, '')
    .split(/\s+[–—|-]\s+|:\s/)[0]
    .replace(/\b(?:has|is|starts?|begins?|was|will|ends?|ending|expires?|runs?|renews?|until|on)\b.*$/i, '')
    .replace(/\s+(?:team|billing|support|no-?reply|notifications?)$/i, '')
    .replace(/[!.,:;-]+$/, '')
    .split(/\s+/)
    .slice(0, 5)
    .join(' ')
    .trim();
  return /^\d/.test(cleaned) ? '' : cleaned;
}

// "Maya from Kettlebase <maya@kettlebase.example>" is about Kettlebase, not Maya.
function senderName(line) {
  const display = line.replace(/<[^>]*>/g, '').replace(/^.*?\bfrom\s+/i, '');
  return cleanServiceName(display);
}

function findService(email) {
  const phrases = [
    /welcome to ([^!.,\n]+)/i,
    /your (?:free )?trial (?:of|for) ([^!.,\n]+)/i,
    /(?:trial of|trial for) ([^!.,\n]+)/i,
    /[Yy]our ([A-Z][\w+&' ]{1,40}?) (?:free )?trial\b/,
  ];
  for (const phrase of phrases) {
    const match = phrase.exec(email);
    const name = match && cleanServiceName(match[1]);
    if (name && !/^(?:your|the|a|our|free)\b|trial/i.test(name)) return name;
  }

  const from = headerValue(email, 'from') ?? SENDER_LINE.exec(email)?.[0];
  if (from) {
    const displayName = senderName(from);
    if (displayName && !displayName.includes('@')) return displayName;
    const domain = /@([a-z0-9-]+)\./i.exec(from);
    if (domain) return domain[1].charAt(0).toUpperCase() + domain[1].slice(1);
  }
  return null;
}

function findCancelSteps(email) {
  const sentences = email
    .replace(URL_PATTERN, 'the link below')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.replace(/^\s*(?:[-*•>]|\d+[.)])\s*/, '').replace(/:$/, '.').trim())
    .filter((sentence) => /cancel/i.test(sentence) && sentence.length >= 8)
    // Keep sentences that say what to do, not warnings like "if you don't cancel, you'll be charged".
    .filter((sentence) => /^(?:to cancel|you can cancel|cancel\b)|\b(?:go to|visit|click|tap|choose|select|open|settings|account|reply|contact|call|email us)\b/i.test(sentence))
    .filter((sentence) => /^(?:to cancel|you can cancel|cancel\b)|\b(?:go to|visit|click|tap)\b/i.test(sentence)
      || !/\b(?:unless|if you (?:do not|don't)|will be (?:charged|billed)|be charged)\b/i.test(sentence));
  return sentences.slice(0, 3);
}

// Prefer a page where you can actually cancel, then your account page, then a help
// article about cancelling. Never a policy page or an "unsubscribe from emails" link.
function findCancelUrl(email) {
  const urls = [...email.matchAll(URL_PATTERN)].map((match) => match[0].replace(/[.,;:!?]+$/, ''));
  const legal = (url) => /polic|terms|legal|privacy|unsubscribe/i.test(url);
  const help = (url) => /help|faq|support/i.test(url);
  return urls.find((url) => /cancel/i.test(url) && !legal(url) && !help(url))
    ?? urls.find((url) => /account|subscription|billing|manage|membership|settings/i.test(url) && !legal(url) && !help(url))
    ?? urls.find((url) => /cancel/i.test(url) && !legal(url))
    ?? null;
}

export function basicExtract(text, todayISO) {
  const emails = splitEmails(text);
  const found = [];
  let ignoredCount = 0;

  for (const email of emails) {
    if (!isTrialEmail(email)) {
      ignoredCount += 1;
      continue;
    }
    const options = { dayFirst: /₹|€|£|\bRs\.?|\bINR\b|\bEUR\b|\bGBP\b/.test(email) };
    const sentDate = findSentDate(email, todayISO, options);
    found.push({
      service: findService(email) ?? 'Unknown service',
      ...findChargeDate(email, todayISO, sentDate, options),
      ...findPrice(email),
      cancelSteps: findCancelSteps(email),
      cancelUrl: findCancelUrl(email),
    });
  }

  return { trials: cleanTrials(found), ignoredCount };
}
