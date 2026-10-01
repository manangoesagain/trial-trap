// The helper server: serves the web page and reads pasted emails at POST /api/extract.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { basicExtract } from './lib/basicExtract.js';
import { isValidISODate, todayISO } from './public/dates.js';

const MAX_TEXT_LENGTH = 50_000;
const publicFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(express.static(publicFolder));

  app.post('/api/extract', (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const today = isValidISODate(req.body?.today) ? req.body.today : todayISO();

    if (!text.trim()) {
      return res.status(400).json({ error: 'Paste an email first, or try the sample emails.' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: 'That is a lot of text. Try pasting fewer emails at a time.' });
    }

    const { trials, ignoredCount } = basicExtract(text, today);
    return res.json({ trials, ignoredCount, mode: 'basic' });
  });

  // Bad or oversized requests get a friendly JSON message instead of an HTML error page.
  app.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode ?? 500;
    const error = status === 413
      ? 'That is a lot of text. Try pasting fewer emails at a time.'
      : status < 500 ? 'That request did not look right. Please try again.' : 'Something went wrong on our side. Please try again.';
    if (status >= 500) console.error(err.message);
    res.status(status).json({ error });
  });

  return app;
}

const startedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (startedDirectly) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.log(`Trial Trap is running at http://localhost:${port}`);
  });
}
