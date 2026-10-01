---
doc: prd
status: draft
---

# Trial Trap — Product Requirements

A one-page web app for students and freshers: paste your free-trial signup emails, and see every trial that's about to charge you, when, how much, and how to cancel, before the money leaves your account.
Source: `scope.md > Who It's For`, `scope.md > The Unique Kernel`.

## The Core Journey
1. **Arrive.** The user opens Trial Trap in their browser. They see the headline "Never pay for a trial you forgot," a three-step strip (Paste → Find → Get reminded), a big paste box, and two buttons: **Find my trials** and **Try sample emails**.
2. **Add emails.** They paste one or more signup emails (any format, copied straight from Gmail/Outlook), or click **Try sample emails** to fill the box with three fictional examples.
3. **Find trials.** They click **Find my trials**. The button shows "Reading your emails…" for a few seconds.
4. **See the countdown.** Trial cards appear as a timeline, soonest charge first. At the top, a bold banner shows the money at risk and the next charge: **"$38.97 at risk. Next charge in 2 days: StreamBox, $15.99."**
5. **Act on a trial.** On each card they can **Add to calendar** (a reminder the day before it charges), open **How to cancel** (steps and link), click **I cancelled it ✓**, or remove a card that was read wrongly.
6. **Come back.** When they reopen the page later, their trials are still there and the countdowns have moved on. New emails are added to the list without duplicating existing trials.

Success = for every trial in the pasted emails, the user sees the date it charges, how much, and how to cancel, and can get a calendar reminder in one click. Source: `scope.md > What "Working" Looks Like`.

## Screens and Layout
One page, top to bottom, in a single centred column (max about 720px wide), because a countdown reads best as one list in time order:
1. **Header:** "Trial Trap 🪤" and the tagline.
2. **How it works strip:** Paste → Find → Get reminded (three small icons with one line each).
3. **Paste area:** large text box ("Paste one or more trial emails here…"), **Find my trials** (primary), **Try sample emails** (secondary), and a short, honest privacy note (see **States and Boundaries > Privacy**).
4. **Money-at-risk banner:** appears once at least one active trial exists.
5. **Trial timeline:** one card per trial, soonest first.
6. **Cancelled section:** collapsed "Cancelled (2) · $25.98 saved".
7. **Footer:** "Clear all" link and a one-line note that the sample emails and brands are fictional.

## Look and Feel
From `scope.md > Inspiration & Identity`: a calm friend tapping you on the shoulder, not a scary finance app.
- Clean, card-based, plenty of white space, rounded corners, soft shadows.
- One bold number at the top (money at risk).
- Urgency colours on each card: **red** = charges within 3 days, **amber** = within 14 days, **green** = later. Colour is never the only signal: every card also says "in 2 days" and has a text badge ("Soon", "This month", "Later").
- Friendly, plain-English copy ("Heads up! StreamBox charges you on Friday", "You're all clear 🎉").
- A rounded, friendly font; looks good on a laptop and in a phone browser.

## Features and Behavior

### Finding trials in emails
- As a student, I want to paste messy signup emails and have the trials pulled out for me, so that I don't have to type anything in.
  - [ ] Pasting 1–5 emails and clicking **Find my trials** produces one card per trial found.
  - [ ] Each card shows: service name, charge date, price after the trial with currency and billing period (e.g. "$15.99/month"), and whether cancel steps or a cancel link were found.
  - [ ] A field the email doesn't mention shows "Not in email" instead of a made-up value.
  - [ ] An email that gives a trial length but no end date ("your 7-day free trial has started") gets an estimated charge date: counted from the email's date if one is in the pasted text, otherwise from the day it was pasted. The card says "estimated".
  - [ ] Text that isn't about a free trial (a normal receipt, a newsletter) is ignored, and the user is told "1 email didn't look like a free trial."

### Sample emails
- As a first-time visitor or a judge, I want to try it without my own emails, so I can see it work in seconds.
  - [ ] **Try sample emails** fills the box with three realistic, differently formatted emails from **fictional** services (StreamBox, a streaming service; PixelForge Pro, a design tool; MunchPass, a food-delivery pass), with dates relative to today so the cards always show red, amber and green.

### The countdown
- As a student, I want to see what's about to charge me first, so I know what to deal with now.
  - [ ] Cards are sorted by charge date, soonest first; cards with no date go last.
  - [ ] Each card shows a countdown: "today", "tomorrow", "in 2 days", or "charged 3 days ago".
  - [ ] Card colour and badge follow the urgency rules in **Look and Feel**.
  - [ ] The banner shows the total price of all active trials that haven't charged yet (one total per currency) and names the next one to charge.

### Calendar reminder
- As a student who forgets, I want a reminder in my real calendar, so my phone warns me in time.
  - [ ] **Add to calendar** offers **Google Calendar** (opens a pre-filled event to save) and **Apple / Outlook** (downloads a calendar file).
  - [ ] The event is at 9:00 AM on the day before the charge, titled "Cancel [Service] trial: charges [price] tomorrow", with the cancel steps and link in the description. The downloaded file includes a pop-up alert.

### How to cancel
- [ ] **How to cancel** expands the card to show the steps from the email, plus the cancel link as a button if one was found.
- [ ] If the email had no steps, it says "The email didn't say how to cancel. Look under Account or Subscription settings on [service]'s website."

### Marking as cancelled
- [ ] **I cancelled it ✓** moves the card to the Cancelled section, removes it from the money-at-risk total and adds its price to "saved".
- [ ] A cancelled trial can be moved back with **Undo**.

### Fixing mistakes
- [ ] Each card has a small **Remove** (×) for a trial that was read wrongly, with Undo for a few seconds.

### Remembering trials
- [ ] Trials stay after refreshing or reopening the page in the same browser.
- [ ] Pasting the same email again doesn't create a duplicate card ("StreamBox" and "Streambox Plus" with the same charge date count as one).
- [ ] **Clear all** removes every saved trial after a confirmation.

## States and Boundaries
- **First use / empty:** only the header, how-it-works strip and paste area show.
- **Reading:** the button says "Reading your emails…" and is disabled; the page doesn't freeze.
- **Nothing found:** "We couldn't find a free trial in that text. Try pasting the whole email, including the dates."
- **Empty paste:** "Paste an email first, or try the sample emails."
- **Smart reading unavailable:** if AI reading isn't set up or fails, the app still finds trials with its built-in reader and shows a small note: "Basic reading mode, results may be less accurate."
- **Past charge date:** shows "Charged [date], check your bank" in grey and isn't counted in the banner.
- **All clear:** if every trial is cancelled or past, the banner says "You're all clear 🎉".
- **Privacy:** when AI reading is on, pasted text is sent to Claude (Anthropic) to be read and isn't kept by Trial Trap; trials are saved only in this browser. The note on the page says exactly this and recommends removing anything sensitive before pasting.
- **Persistence:** saved only in this browser on this device; nothing is stored on a server.

## Product Decisions
- **Paste emails, don't connect Gmail.** The team chose the smallest thing that proves the kernel, because Gmail sign-in setup would eat days. (scope)
- **Warn before the charge, and say how to cancel.** This is the difference from reminder apps and bank-based trackers. (scope kernel)
- **Show the cancel steps, don't cancel for the user.** Every service is different and it's risky. (scope cut)
- **No accounts.** Trials live in the user's own browser. (scope cut)
- **Assumption (proposed by Claude, approved with this doc):** fictional sample emails, so judges can try it instantly and the video shows no real brands (the hackathon rules forbid third-party trademarks in the video).
- **Assumption (proposed by Claude, approved with this doc):** the banner totals all upcoming trials and names the next one, rather than a fixed "next 7 days" window, so the number always matches what's on screen.
- **Assumption (proposed by Claude, approved with this doc):** a Remove button, so a wrong reading can't stick around and spoil trust in the list.

## What We're Building
Everything in **Features and Behavior** and **States and Boundaries** above: paste or sample emails → find trials → timeline cards with urgency colours and money-at-risk banner → calendar reminder, cancel steps, mark cancelled, remove → remembered in the browser.

## Deferred From the POC
- **Connecting Gmail/Outlook:** needs sign-in setup and app approval; pasting proves the idea.
- **Reminders sent by email or push notification:** needs accounts and a server running on a schedule; the calendar reminder works today.
- **Editing a trial's details by hand:** Remove covers wrong readings for now.
- **Syncing across devices:** needs accounts.
- **Screenshot or photo upload:** a second input type; text is enough to prove the kernel.

## Possible Later Enhancements
- A forwarding address: forward any trial email to trap@… and it appears in your list.
- A "you saved $X this year" counter.
- Shared lists for roommates or families.

## Non-Goals
- **Cancelling subscriptions for the user:** risky and different for every service.
- **Reading bank statements:** a different product with privacy and compliance issues.
- **Tracking ordinary paid subscriptions:** only trials that are about to start charging.
- **A mobile app:** the web page works in a phone browser.

## Open Questions
- Whose Anthropic API key powers smart reading for the demo video? *Not blocking: the app is built and tested with the built-in reader first, and smart reading switches on when a key is added.*
