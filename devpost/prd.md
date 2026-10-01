---
doc: prd
status: draft
---

# Trial Trap — Product Requirements

A one-page web app for students and freshers: paste your free-trial signup emails, and see every trial that's about to charge you, when, how much, and how to cancel, before the money leaves your account.
Source: `scope.md > Who It's For`, `scope.md > The Unique Kernel`.

## The Core Journey
1. **Arrive.** The user opens Trial Trap in their browser. They see the headline "Never pay for a trial you forgot," a big paste box, and two buttons: **Find my trials** and **Try sample emails**.
2. **Add emails.** They paste one or more signup emails into the box (any format, copied straight from Gmail/Outlook), or click **Try sample emails** to fill the box with three realistic examples.
3. **Find trials.** They click **Find my trials**. A short "Reading your emails…" state shows for a few seconds.
4. **See the countdown.** Trial cards appear, sorted by soonest charge. At the top, a bold banner shows money at risk, e.g. **"$47.97 will be charged in the next 7 days."**
5. **Act on a trial.** On each card they can **Add to calendar** (downloads a reminder for the day before it charges), open **How to cancel** (steps and link), or click **I cancelled it ✓**.
6. **Come back.** When they reopen the page later, their trials are still there and the countdowns have moved on. New emails they paste are added to the list without duplicating existing trials.

Success = the user can see, for every trial in their pasted emails, the exact date it charges and how much, and get a calendar reminder in one click. Source: `scope.md > What "Working" Looks Like`.

## Screens and Layout
One page, top to bottom:
1. **Header:** logo text "Trial Trap 🪤" and the tagline.
2. **Paste area:** a large text box ("Paste one or more trial emails here…") with **Find my trials** (primary) and **Try sample emails** (secondary) below it, plus a small privacy note: "Your emails are only used to find trials and aren't stored anywhere except your own browser."
3. **Money-at-risk banner:** appears once at least one active trial exists.
4. **Trial list:** a column of cards on a phone, two columns on a laptop.
5. **Cancelled section:** a collapsed "Cancelled (2)" list at the bottom.
6. **Footer:** a "Clear all" link.

## Look and Feel
From `scope.md > Inspiration & Identity`: a calm friend tapping you on the shoulder, not a scary finance app.
- Clean, card-based, plenty of white space, rounded corners, soft shadows.
- One bold number at the top (money at risk).
- Urgency colours on each card: **red** = charges within 3 days, **amber** = within 14 days, **green** = later. Colour is never the only signal; cards also say "in 2 days".
- Friendly, plain-English copy ("Heads up! Spotify charges you on Friday").
- A rounded, friendly sans-serif font; works in light mode, and looks good on a phone.

## Features and Behavior

### Finding trials in emails
- As a student, I want to paste messy signup emails and have the trials pulled out for me, so that I don't have to type anything in.
  - [ ] Pasting 1–3 emails and clicking **Find my trials** produces one card per trial found.
  - [ ] Each card shows: service name, trial end / first charge date, price after the trial with currency and billing period (e.g. "$15.99/month"), and cancel steps or a cancel link if the email had them.
  - [ ] A field the email doesn't mention shows "Not in email" instead of a made-up value.
  - [ ] An email that mentions a trial length but no end date ("your 7-day free trial has started") gets its end date calculated from the date the email was sent, and the card says "estimated".
  - [ ] Emails that aren't about a free trial (e.g. a normal receipt or newsletter) are ignored, and the user is told "1 email didn't look like a trial."

### Sample emails
- As a first-time visitor or a judge, I want to try it without my own emails, so I can see it work in seconds.
  - [ ] **Try sample emails** fills the paste box with three realistic, differently formatted trial emails (a streaming service, a design tool, a food-delivery pass), with trial end dates relative to today so the urgency colours always show a mix.

### The countdown
- As a student, I want to see what's about to charge me first, so I know what to deal with now.
  - [ ] Cards are sorted by charge date, soonest first.
  - [ ] Each card shows a countdown ("in 2 days", "tomorrow", "today", "charged 3 days ago").
  - [ ] Card colour follows the urgency rules in **Look and Feel**.
  - [ ] The banner adds up the prices of active trials charging in the next 7 days, per currency.

### Calendar reminder
- As a student who forgets, I want a reminder in my real calendar, so my phone warns me in time.
  - [ ] **Add to calendar** downloads a `.ics` file that opens in Google Calendar, Outlook and Apple Calendar.
  - [ ] The event is on the day before the charge, titled "Cancel [Service] trial — charges [price] tomorrow", with the cancel steps in the description and a pop-up alert.

### How to cancel
- [ ] **How to cancel** expands the card to show the steps from the email, plus the cancel link as a button if one was found.
- [ ] If the email had no steps, it shows "The email didn't say how to cancel. Try your account settings on [service]'s website."

### Marking as cancelled
- [ ] **I cancelled it ✓** moves the card to the Cancelled section and removes it from the money-at-risk total.
- [ ] A cancelled trial can be moved back with **Undo**.

### Remembering trials
- [ ] Trials stay after refreshing or reopening the page in the same browser.
- [ ] Pasting the same email again doesn't create a duplicate card (same service + same charge date = same trial).
- [ ] **Clear all** removes every saved trial after a confirmation.

## States and Boundaries
- **First use / empty:** only the paste area shows, with a one-line "How it works: paste → find → get reminded."
- **Reading:** the button shows "Reading your emails…" and is disabled; the page doesn't freeze.
- **Nothing found:** "We couldn't find a free trial in that text. Try pasting the whole email, including the dates."
- **Empty paste:** clicking **Find my trials** with an empty box says "Paste an email first, or try the sample emails."
- **Smart reading unavailable:** if the AI service is down or not set up, the app still finds trials using its built-in reader and shows a small note that results may be less accurate.
- **Past charge date:** a trial whose date has passed shows "Charged [date] — check your bank" in grey and isn't counted in the banner.
- **Persistence:** saved only in this browser on this device; nothing is stored on a server.

## Product Decisions
- **Paste emails, don't connect Gmail** — the team chose the smallest thing that proves the kernel; Gmail sign-in setup would eat days. (scope)
- **Warn before the charge, not after** — the reason this isn't another bank-based subscription tracker. (scope kernel)
- **Show the cancel steps, don't cancel for the user** — every service is different and it's risky. (scope cut)
- **No accounts** — trials live in the user's own browser. (scope cut)
- **Assumption (proposed by Claude, approved with this doc):** a built-in sample-emails button, so judges and first-time users can see it work without their own emails.
- **Assumption (proposed by Claude, approved with this doc):** "next 7 days" is the window for the money-at-risk banner.

## What We're Building
Everything in **Features and Behavior** and **States and Boundaries** above: paste or sample emails → find trials → sorted countdown cards with urgency colours and money-at-risk banner → calendar reminder, cancel steps, mark cancelled → remembered in the browser.

## Deferred From the POC
- **Connecting Gmail/Outlook** — needs sign-in setup and app approval; pasting proves the idea.
- **Reminders sent by email or push notification** — needs accounts and a server that runs on a schedule; the calendar file gives a real reminder today.
- **Syncing across devices** — needs accounts.
- **Screenshot or photo upload** — a second input type; text paste is enough to prove the kernel.

## Possible Later Enhancements
- A forwarding address: forward any trial email to trap@… and it appears in your list.
- A "you saved $X this year" counter for cancelled trials.
- Shared lists for roommates or families.

## Non-Goals
- **Cancelling subscriptions for the user** — risky and different for every service.
- **Reading bank statements** — a different product with privacy and compliance issues.
- **Tracking normal paid subscriptions** — only trials that are about to start charging.
- **A mobile app** — the web page works in a phone browser.

## Open Questions
- Whose AI key powers the "smart reading" for the demo? *Must be answered before the build's AI step; the app works without it using the built-in reader.*
