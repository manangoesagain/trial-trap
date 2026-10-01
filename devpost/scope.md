---
doc: scope
status: approved
---

# Trial Trap

Paste your signup emails, and see every free trial that's about to charge you, how much and when, plus exactly how to cancel.

## The Unique Kernel
It turns a messy pile of "Welcome to your free trial!" emails into one **money-at-risk countdown**: "$47 will be charged in the next 7 days. Cancel Spotify by Friday 11:59 PM." Other subscription trackers make you type trials in by hand or link your bank, which only shows charges *after* they happen. Trial Trap catches the trial *before* the first charge, straight from the email you already have.

## Who It's For
A college student or fresher in their first job who signs up for free trials (streaming, design tools, online courses, food delivery passes) to try something or get a discount, then forgets. Today they rely on memory or a phone reminder they never set, and find out from their bank statement. Everyone on the team has been charged by a trial they forgot.

## The Core Loop
They get a "your free trial has started" email → paste it into Trial Trap → it pulls out the service, trial end date, price after the trial, and how to cancel → it lands on their countdown, sorted by what charges soonest → they tap "Add reminder" to put it in their calendar → they come back when the next trial starts, or when the countdown says something is close.

## Inspiration & Identity
Feels like a calm friend tapping you on the shoulder, not a scary finance app. Clean and card-based, with one bold number at the top (money at risk), urgency colours (red = this week, amber = this month, green = later), friendly plain-English copy.

## Why This Matters to the Learner
"Everyone once and then, have forgotten this trial thing in their life." It's a problem the whole team has lived, so they can demo it honestly and explain who it's for.

## What "Working" Looks Like
Open the web page → click "Try sample emails" (or paste real ones) → in a few seconds, three trial cards appear with the service name, cancel-by date, price and cancel steps, sorted by urgency, with a total like "$47 at risk this week" at the top → click "Add to calendar" and a reminder file downloads that opens in Google/Outlook/Apple Calendar.
**The "oh, that's cool" beat:** pasting three messy, different-looking emails and instantly seeing "$47 at risk — cancel Netflix by Friday".

## The POC Boundary
- A single web page, runs on a laptop.
- Paste one or more emails as text, or load built-in sample emails.
- AI extracts per trial: service, trial end date, price after trial, currency, cancel steps/link. Shows "not found" honestly when an email doesn't say.
- Countdown cards sorted by soonest charge, with urgency colours and a "money at risk" total.
- "Add to calendar" download (.ics) with a reminder the day before it charges.
- Mark a trial as "Cancelled ✓", which removes it from the total.
- Trials stay saved in the browser between visits.

## Later
- Connect Gmail/Outlook to find trial emails automatically.
- A forwarding email address (forward trials to trap@...).
- Push or email reminders.
- Photo/screenshot upload of a signup page or receipt.
- Shared "household" view for families or roommates.

## Explicitly Cut
- **User accounts and login:** not needed to prove the kernel, and add hours of setup.
- **Automatic cancelling for the user:** every service is different and it's risky; showing the steps is enough.
- **Bank connection:** a different product, with privacy and compliance headaches.
- **Mobile app:** the web page works on a phone browser and that's enough for the demo.
