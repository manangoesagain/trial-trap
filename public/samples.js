// Three realistic sample emails from fictional services (the ".example" web addresses
// are reserved for examples), with dates relative to today so the cards always show
// one trial charging soon, one this month and one later.

import { addDays } from './dates.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return { year, month, day, weekday };
}

// "Sat, 26 Sep 2026 09:14:00 +0000", the way email headers write dates.
function headerDate(iso) {
  const { year, month, day, weekday } = parts(iso);
  return `${weekday}, ${day} ${MONTHS[month - 1].slice(0, 3)} ${year} 09:14:00 +0000`;
}

// "October 3, 2026"
function longDate(iso) {
  const { year, month, day } = parts(iso);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// "26 Oct 2026"
function shortDate(iso) {
  const { year, month, day } = parts(iso);
  return `${day} ${MONTHS[month - 1].slice(0, 3)} ${year}`;
}

export function sampleEmails(today) {
  return `From: StreamBox <hello@streambox.example>
Subject: Welcome to StreamBox Plus! Your free trial has started
Date: ${headerDate(addDays(today, -5))}

Hi there,

Thanks for starting your free trial of StreamBox Plus. Enjoy unlimited movies and series on any screen.

Your free trial ends on ${longDate(addDays(today, 2))}. After that, you'll be charged $15.99/month unless you cancel.

To cancel, go to Account > Membership and choose "Cancel plan" before your trial ends:
https://streambox.example/account/cancel

Happy streaming,
The StreamBox Team

---

From: "PixelForge" <no-reply@pixelforge.example>
Subject: Your 14-day free trial of PixelForge Pro has started
Date: ${headerDate(addDays(today, -5))}

Hey creator!

Your 14-day free trial of PixelForge Pro has started. You now have every brush, template and export format.

When your trial is over, your plan continues at USD 12.99 per month.

Manage or cancel anytime in Settings → Billing → Cancel subscription.
https://pixelforge.example/settings/billing

— The PixelForge team

---

From: MunchPass <team@munchpass.example>
Subject: Your MunchPass trial is live 🍔
Date: ${headerDate(today)}

Free delivery on every order, starting now!

Your MunchPass free trial runs until ${shortDate(addDays(today, 25))}. From then on, membership is billed at $9.99 a month.

Questions? Just reply to this email.
`;
}
