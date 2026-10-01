// People often paste several emails at once. Split them on separator lines
// ("---", "===="), wherever a new "From:" or "Subject:" header starts, and between
// emails copied from Gmail (subject line, then "Inbox"). A forwarded email stays in one piece.

const SEPARATOR = /^\s*(?:-{3,}|={3,}|\*{3,})\s*$/;
const FORWARD_MARKER = /^\s*(?:-+\s*(?:forwarded message|original message)\s*-+|_{5,}|begin forwarded message:)\s*$/i;
const FROM_HEADER = /^\s*from:\s/i;
const SUBJECT_HEADER = /^\s*subject:\s/i;
const OTHER_HEADER = /^\s*(?:from|to|cc|bcc|date|sent|reply-to):\s/i;
const GMAIL_INBOX = /^\s*inbox\s*$/i;

export function splitEmails(text) {
  const emails = [];
  let current = [];
  let insideForward = false;

  const hasText = (lines) => lines.some((line) => line.trim());
  const finishEmail = (lines = current) => {
    const email = lines.join('\n').trim();
    if (email) emails.push(email);
  };
  const lastTextLine = () => {
    for (let index = current.length - 1; index >= 0; index -= 1) if (current[index].trim()) return index;
    return -1;
  };

  for (const line of String(text).split(/\r?\n/)) {
    if (SEPARATOR.test(line)) {
      finishEmail();
      current = [];
      insideForward = false;
      continue;
    }
    if (FORWARD_MARKER.test(line)) {
      insideForward = true;
      current.push(line);
      continue;
    }
    if (FROM_HEADER.test(line) && hasText(current)) {
      if (insideForward) {
        insideForward = false;
      } else {
        finishEmail();
        current = [];
      }
    } else if (SUBJECT_HEADER.test(line) && hasText(current)) {
      // A Subject: right after other headers belongs to the same email.
      const previous = lastTextLine();
      if (!OTHER_HEADER.test(current[previous]) && !insideForward) {
        finishEmail();
        current = [];
      }
    } else if (GMAIL_INBOX.test(line)) {
      // In a Gmail copy the subject is the line just above "Inbox": it starts a new email.
      const subject = lastTextLine();
      if (subject > 0 && hasText(current.slice(0, subject))) {
        finishEmail(current.slice(0, subject));
        current = current.slice(subject);
      }
    }
    current.push(line);
  }
  finishEmail();
  return emails;
}
