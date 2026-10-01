---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast. The team asked Claude to handle the build ("do everything yourself"); they try the app at the two hands-on checkpoints. They can switch to learn mode any time.

Build order: shown to the team as the six build steps in the game plan; approved with "yes I allow you to proceed" (2026-10-01).

## Slices

- [x] **1. Sample emails turn into trial cards**
  Becomes usable: Run `npm start`, open the page, click **Try sample emails** then **Find my trials**, and see one card per trial with service, charge date, price and billing period. The built-in reader does the work; nothing is saved yet.
  Why now: It is the unique kernel (messy emails in, trials out) working end to end, and it bootstraps the server, page and reader that every later slice builds on.
  PRD ref: `prd.md > The Core Journey` (steps 1–4), `prd.md > Finding trials in emails`, `prd.md > Sample emails`
  Spec ref: `spec.md > Helper server (server.js)`, `spec.md > Built-in reader (lib/basicExtract.js, lib/splitEmails.js)`, `spec.md > Trial checker (lib/validateTrials.js)`, `spec.md > Sample emails (public/samples.js)`, `spec.md > File Structure`
  Build: package.json with Express 5 and zod, the helper server with `POST /api/extract`, the email splitter, built-in reader and trial checker, the three fictional sample emails, and a basic page that posts the text and draws cards. Tests for the reader and the endpoint.
  Verify (mechanical): `npm test` passes; start the server, POST the sample emails to `/api/extract` and confirm three trials (StreamBox, PixelForge Pro, MunchPass) with the expected dates and prices; load the page in a headless browser, click the two buttons and confirm three cards render.
  Learner check: Look at the screenshot of the page after clicking **Try sample emails** and **Find my trials**: do the three cards show the right service, date and price?
  Commit: `Turn sample emails into trial cards`

- [x] **2. The countdown**
  Becomes usable: Cards sit in a timeline sorted by soonest charge, with red/amber/green urgency, a badge and a countdown ("in 2 days"), and the banner shows money at risk and the next charge.
  Why now: The countdown is what makes the list useful at a glance, and it is the "oh, that's cool" moment in the demo.
  PRD ref: `prd.md > The countdown`, `prd.md > Look and Feel`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Page logic (public/app.js)`, `spec.md > Look and Feel`, `spec.md > Web page (public/index.html, public/styles.css)`
  Build: `public/dates.js` (countdown and urgency maths), sorting and per-currency totals, banner, urgency styling and the full look and feel.
  Verify (mechanical): `npm test` passes, including date and total tests (today/tomorrow/past/no date, per-currency sums); headless browser shows the banner "$38.97" and cards in red, amber, green order.
  Learner check: In the screenshot, can you tell in two seconds which trial needs attention first?
  Commit: `Add countdown timeline and money-at-risk banner`

- [x] **3. Smart reading with NVIDIA-hosted AI**
  Becomes usable: With `NVIDIA_API_KEY` in `.env`, messy real emails are read by the AI; without it, or if the AI fails, the built-in reader takes over and the page says "Basic reading mode".
  Why now: It's the riskiest part (an external service Claude can't reach from its workspace), so it is built and tested against a stand-in before the polish work.
  PRD ref: `prd.md > Finding trials in emails`, `prd.md > States and Boundaries` (Smart reading unavailable, Privacy)
  Spec ref: `spec.md > AI reader (lib/aiExtract.js)`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`
  Build: `lib/aiExtract.js` with prompt, JSON schema (`nvext.guided_json`), retry without it, reply cleaning and validation; start-up model check; `.env.example`; mode note on the page.
  Verify (mechanical): API tests against a stand-in NVIDIA server: a good reply gives mode `ai`; a 400 on `nvext` retries without it; garbage, 429 and timeouts fall back to `basic`; the key never appears in logs or responses.
  Learner check: At the first laptop checkpoint, put your NVIDIA key in `.env`, restart, paste a real trial email, and confirm the terminal says smart reading is on and the card is right.
  Commit: `Add smart reading with NVIDIA-hosted AI and fallback`

- [x] **4. Add to calendar and how to cancel**
  Becomes usable: Each card has **Add to calendar** (Google Calendar link, plus an Apple/Outlook file) and **How to cancel** with the steps and cancel link.
  Why now: Turning "when" into a reminder and "how" into steps is the second half of the kernel.
  PRD ref: `prd.md > Calendar reminder`, `prd.md > How to cancel`
  Spec ref: `spec.md > Calendar reminders (public/calendar.js)`
  Build: `public/calendar.js` (Google link and `.ics` with alarm), the calendar menu and the expandable cancel steps.
  Verify (mechanical): Calendar tests: the reminder is 9:00 AM the day before (never in the past), text is escaped, lines are folded, the alarm is present, and the Google link has the right title and dates; headless browser downloads the `.ics` and opens the Google link URL.
  Learner check: Click **Add to calendar → Google Calendar** on the red card and confirm the event shows up the day before the charge.
  Commit: `Add calendar reminders and cancel steps`

- [x] **5. Cancel, remove, remember**
  Becomes usable: **I cancelled it ✓** with Undo and a "saved" total, **Remove** with Undo, trials saved between visits, no duplicates when pasting again, **Clear all**, and friendly empty, nothing-found, past and all-clear states.
  Why now: Makes it a tool you can keep using rather than a one-shot demo, and protects trust when a reading is wrong.
  PRD ref: `prd.md > Marking as cancelled`, `prd.md > Fixing mistakes`, `prd.md > Remembering trials`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Trial storage (public/storage.js)`, `spec.md > Data Model`, `spec.md > Page logic (public/app.js)`
  Build: `public/storage.js` and `public/trials.js` (merge, duplicate key, totals), cancelled section, undo toast, clear all, all remaining states.
  Verify (mechanical): Tests for merge and duplicate keys; headless browser: cancel moves a card and updates totals, reload keeps everything, re-pasting the samples adds no duplicates, clear all empties the page.
  Learner check: Cancel one trial, refresh the page, and paste the samples again: is everything where you expect?
  Commit: `Remember trials, add cancel and remove with undo`

- [x] **6. Polish and README**
  Becomes usable: Looks finished on a laptop and a phone, has a how-it-works strip and footer notes, and the README explains what it is and how to run it on Windows, with a screenshot.
  Why now: Design is a judging criterion and the tie-breaker; the README is what judges see in the repo.
  PRD ref: `prd.md > Look and Feel`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Spacing, phone layout, focus states, accessibility labels, README with screenshot and run steps.
  Verify (mechanical): `npm test` passes; headless screenshots at 1280px and 390px wide look right with no horizontal scrolling; `git ls-files` contains no `.env` or learner profile.
  Learner check: Final kick-the-tires on your laptop (see Hands-on Checkpoints).
  Commit: `Polish layout and write README`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2, from screenshots in the project thread (the team can't run it until the GitHub repo exists)
- [ ] Final kick-the-tires exploration and feedback completed — on the team's laptop, including a real NVIDIA key test

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- Badge for 4–14 days says "Within 2 weeks" instead of "This month" — the window is 14 days, so "This month" would be wrong when it crosses into the next month.
- Added `public/trials.js` (duplicate key, sorting, totals, money formatting) alongside `public/dates.js` — the server and the page both need these, so they live in one shared file instead of inside `storage.js` and `app.js`.
- "How to cancel" opens a full-width panel under the card's buttons instead of a dropdown, so it never sits on top of the calendar menu; the calendar menu closes when you click elsewhere.
- "Clear all trials" sits just under the trial list and only shows when there are trials, rather than in the page footer, so it is next to the things it removes.
