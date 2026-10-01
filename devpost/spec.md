---
doc: spec
status: draft
---

# Trial Trap — Technical Spec

## How This Works, In Plain Language
Trial Trap has two pieces that both run on your laptop:

1. **The web page** (what you see in the browser). It holds the paste box, shows the trial cards, makes the calendar files, and remembers your trials in the browser's own storage, so there's no database and no login.
2. **A small helper program on your laptop** (the "server"). When you click **Find my trials**, the page sends the pasted text to this helper. The helper asks an AI (Claude) to read the emails and return a tidy list: service, charge date, price, how to cancel. The helper exists for one reason: the AI needs a secret key, and a secret key must never sit inside a web page where anyone could copy it.

If no AI key is set up, or the AI is unreachable, the helper falls back to a **built-in reader** that looks for patterns like "trial ends on…" and "$9.99/month". It's less clever than the AI but means the app always works, including for judges.

Why this shape: it's the smallest setup that keeps the key safe, runs on Windows with one command, and needs no accounts, database or hosting.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. The user opens `http://localhost:3000` → the helper sends the web page → the page loads saved trials from browser storage and draws any cards.
2. The user clicks **Try sample emails** → the page fills the box with three built-in sample emails whose dates are set relative to today.
3. The user clicks **Find my trials** → the page sends the text to the helper at `/api/extract`.
4. The helper splits the text into separate emails and asks Claude to pull out the trials as structured data. If that fails, it uses the built-in reader.
5. The helper sends back a list of trials → the page checks for duplicates, saves them to browser storage, sorts them by charge date, and draws the cards and the money-at-risk banner.
6. The user clicks **Add to calendar** → the page builds a `.ics` calendar file right in the browser and downloads it.
7. The user clicks **I cancelled it ✓** → the page updates the trial in storage and redraws.

## Stack
- **Node.js 20 or newer** — required by the hackathon anyway; runs the helper. https://nodejs.org/
- **Express 4** — the simplest, best-documented way to run a small web server in Node. https://expressjs.com/
- **Anthropic SDK for JavaScript** (`@anthropic-ai/sdk`) — talks to Claude. https://docs.claude.com/en/api/client-sdks
- **Claude Haiku 4.5** — fast and cheap, good at pulling details out of text. https://docs.claude.com/en/docs/about-claude/models
- **dotenv** — loads the secret key from a `.env` file that git ignores. https://github.com/motdotla/dotenv
- **Plain HTML, CSS and JavaScript** for the page — no framework and no build step, so there's less to install and less to break.
- **Node's built-in test runner** (`node --test`) for checking the built-in reader and the date logic.

Rationale: recommended by Claude for a team new to coding; proposed for the team's agreement with this doc.

## Where It Runs and How Someone Tries It
- Runs locally on Windows, macOS or Linux with Node.js 20+.
- Setup, once:
  1. `npm install`
  2. Optional, for smart reading: copy `.env.example` to `.env` and put an Anthropic API key in it (`ANTHROPIC_API_KEY=...`). Without it, the built-in reader is used.
- Start: `npm start`, then open **http://localhost:3000**.
- Demo recording: record the browser window at localhost:3000 (see `6-ship`).
- Submission needs a short demo video (on YouTube or Vimeo) and the public GitHub repo. No deployment planned.

## Look and Feel
From `prd.md > Look and Feel`.
- **Font:** "Nunito" from Google Fonts (rounded and friendly), falling back to the system sans-serif.
- **Colours:** warm off-white background (#FAF7F2), dark ink text (#1F2933), one accent colour, teal (#0F766E), for primary buttons. Urgency: red (#DC2626) within 3 days, amber (#D97706) within 14 days, green (#16A34A) later, shown as a coloured left edge plus a small coloured badge. Grey for past or cancelled.
- **Shape:** 16px rounded cards, soft shadow, generous padding; max content width 960px; 1 column on phones, 2 on laptops.
- **Banner:** large bold number, friendly sentence underneath.
- **Copy tone:** friendly and plain ("Heads up!", "You're all clear 🎉").

## Components

### Web page (`public/index.html`, `public/styles.css`)
Layout and styling for header, paste area, banner, card grid, cancelled section, footer.
PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`.

### Page logic (`public/app.js`)
Handles buttons, calls `/api/extract`, merges new trials with saved ones, sorts, renders cards and the banner, handles cancel/undo/clear all, shows the empty, loading, error and nothing-found states.
PRD ref: `prd.md > The countdown`, `prd.md > Marking as cancelled`, `prd.md > Remembering trials`, `prd.md > States and Boundaries`.

### Trial storage (`public/storage.js`)
Saves and loads trials from browser localStorage; builds the duplicate key (service + charge date).
PRD ref: `prd.md > Remembering trials`.

### Calendar file maker (`public/calendar.js`)
Builds a standard `.ics` file: an all-day event the day before the charge, with a pop-up alarm, and the cancel steps in the description.
PRD ref: `prd.md > Calendar reminder`.

### Sample emails (`public/samples.js`)
Three realistic, fictional sample emails (a streaming service, a design tool, a food-delivery pass) with dates filled in relative to today: about 2, 9 and 25 days away.
PRD ref: `prd.md > Sample emails`.

### Helper server (`server.js`)
Serves the `public/` folder and offers one endpoint: `POST /api/extract` with `{ text, today }` → `{ trials, ignoredCount, mode }`, where `mode` is `"ai"` or `"basic"`. Limits pasted text to 50,000 characters.
PRD ref: `prd.md > Finding trials in emails`.

### AI reader (`lib/aiExtract.js`)
Sends the emails to Claude with clear instructions and a strict output format (tool use, so the answer is always valid data). Tells it to never guess: missing fields are `null`. Tells it today's date so "7-day trial" can be turned into an estimated date.
PRD ref: `prd.md > Finding trials in emails`.

### Built-in reader (`lib/basicExtract.js`)
Fallback with no AI: splits emails, finds the service name from the "From"/subject line, dates in common formats, "N-day trial", prices like `$9.99`/`₹199`/`€5` with "/month" or "/year", and links containing "cancel" or "account".
PRD ref: `prd.md > States and Boundaries` (Smart reading unavailable).

## Data Model
A trial, as stored in the browser (`localStorage` key `trialtrap.trials.v1`, a JSON list):
```json
{
  "id": "spotify-2026-10-04",
  "service": "Spotify Premium",
  "chargeDate": "2026-10-04",
  "dateIsEstimated": false,
  "price": 11.99,
  "currency": "USD",
  "billingPeriod": "month",
  "cancelSteps": ["Go to spotify.com/account", "Click 'Cancel Premium'"],
  "cancelUrl": "https://www.spotify.com/account",
  "status": "active",
  "addedAt": "2026-10-01T21:40:00Z"
}
```
- `status` is `active` or `cancelled`. Past dates are worked out when drawing, not stored.
- Data lives only in that browser. Clearing browser data or using another device starts empty.
- The helper server stores nothing.

## File Structure
```
trial-trap/
├── server.js             # helper server: serves the page + /api/extract
├── lib/
│   ├── aiExtract.js      # asks Claude to read the emails
│   ├── basicExtract.js   # built-in reader, no AI needed
│   └── splitEmails.js    # splits a big paste into separate emails
├── public/
│   ├── index.html        # the page
│   ├── styles.css        # look and feel
│   ├── app.js            # page logic and rendering
│   ├── storage.js        # save/load trials in the browser
│   ├── calendar.js       # makes .ics reminder files
│   └── samples.js        # the three sample emails
├── test/
│   ├── basicExtract.test.js
│   └── calendar.test.js
├── .env.example          # ANTHROPIC_API_KEY= (no real key)
├── package.json          # npm start / npm test
├── README.md             # what it is + how to run it
├── LICENSE               # MIT
└── devpost/              # scope, PRD, spec, checklist (learner profile is git-ignored)
```

## External Services and Dependencies
**Anthropic Claude API (optional)**
- Call: Messages API, model `claude-haiku-4-5`, with one tool `save_trials` whose input schema is the trial list above; `tool_choice` forces that tool.
- Key: `ANTHROPIC_API_KEY` in `.env`, read only by the server. Never sent to the browser or committed.
- Cost: a few emails cost a fraction of a cent per run with Haiku.
- Docs: https://docs.claude.com/en/api/messages and https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview
- Without a key, the app uses the built-in reader.

No other services, no database, no hosting.

## Important Failure Modes
- **No API key, or the AI call fails or times out (15 s)** → the built-in reader runs; a small note says "Smart reading is off, results may be less accurate."
- **An email has no clear date or price** → the card shows "Not in email"; a trial with no date at all sorts to the bottom with a grey "No date found" badge and isn't counted in the banner.
- **Different currencies** → the banner shows one total per currency ("$27.98 + ₹199").

## What Was Simplified and Why
- **Browser storage** instead of a database with accounts — no login needed and nothing to host. The fuller version would need sign-up, a database and a server online.
- **Calendar file download** instead of sending reminders — works with every calendar today, no server running in the background. The fuller version would need accounts, email sending and a scheduled job.
- **Paste text** instead of connecting Gmail — Gmail access needs Google app review. Fuller version: Google sign-in and the Gmail API.
- **Sample emails are clearly fictional examples**, labelled as samples on the page.

## Decisions and Open Issues
- **Stack (Node + Express + plain HTML/JS + Claude Haiku with a built-in fallback)** — recommended by Claude because the team is new to coding: one install command, nothing to host, and the key stays secret. Tradeoff: it only runs on someone's laptop, so judges see it in the video. *Needs the team's OK.*
- **Learner uncertainty: "What is an API key and where does it go?"** A key is like a password that lets the app use Claude and charges usage to its owner. It goes in a `.env` file on the laptop, which git is set to ignore, so it never lands on GitHub. Check during the build: `git status` never lists `.env`.
- **Open (from `prd.md > Open Questions`):** whose Anthropic key runs smart reading for the demo video. Not blocking: the app is built and tested with the built-in reader first.
