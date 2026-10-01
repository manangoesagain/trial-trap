// People often paste several emails at once. Split them on separator lines
// ("---", "====") and wherever a new "From:" header starts.

const SEPARATOR = /^\s*(?:-{3,}|={3,}|_{3,}|\*{3,})\s*$/;
const FROM_HEADER = /^\s*from:\s/i;

export function splitEmails(text) {
  const emails = [];
  let current = [];

  const finishEmail = () => {
    const email = current.join('\n').trim();
    if (email) emails.push(email);
    current = [];
  };

  for (const line of String(text).split(/\r?\n/)) {
    if (SEPARATOR.test(line)) {
      finishEmail();
      continue;
    }
    if (FROM_HEADER.test(line) && current.some((previous) => previous.trim())) finishEmail();
    current.push(line);
  }
  finishEmail();
  return emails;
}
