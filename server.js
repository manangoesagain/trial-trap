// The helper server: serves the web page and reads pasted emails at POST /api/extract.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { aiConfigFromEnv, aiExtract, checkModel } from './lib/aiExtract.js';
import { basicExtract } from './lib/basicExtract.js';
import { isValidISODate, todayISO } from './public/dates.js';

const MAX_TEXT_LENGTH = 50_000;
const projectFolder = path.dirname(fileURLToPath(import.meta.url));
const publicFolder = path.join(projectFolder, 'public');

const BASIC_NOTE = 'Basic reading mode: results may be less accurate.';
const FALLBACK_NOTE = 'Smart reading had a problem, so we used basic reading. Results may be less accurate.';

// `ai` is the NVIDIA settings from .env, or null to use only the built-in reader.
export function createApp({ ai = null, aiOptions = {} } = {}) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(express.static(publicFolder));

  app.post('/api/extract', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const today = isValidISODate(req.body?.today) ? req.body.today : todayISO();

    if (!text.trim()) {
      return res.status(400).json({ error: 'Paste an email first, or try the sample emails.' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: 'That is a lot of text. Try pasting fewer emails at a time.' });
    }

    if (ai) {
      try {
        const { trials, ignoredCount } = await aiExtract(text, today, ai, aiOptions);
        return res.json({ trials, ignoredCount, mode: 'ai' });
      } catch (error) {
        // Never log the pasted text or the key, only what went wrong.
        console.warn(`Smart reading failed (${error.name === 'AIError' ? error.message : error.name}), using the built-in reader.`);
        const { trials, ignoredCount } = basicExtract(text, today);
        return res.json({ trials, ignoredCount, mode: 'basic', note: FALLBACK_NOTE });
      }
    }

    const { trials, ignoredCount } = basicExtract(text, today);
    return res.json({ trials, ignoredCount, mode: 'basic', note: BASIC_NOTE });
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
  try {
    process.loadEnvFile(path.join(projectFolder, '.env'));
  } catch {
    // No .env file: smart reading stays off and the built-in reader is used.
  }
  const ai = aiConfigFromEnv();
  const port = Number(process.env.PORT) || 3000;

  createApp({ ai }).listen(port, () => {
    console.log(`Trial Trap is running at http://localhost:${port}`);
    if (!ai) {
      console.log('Smart reading is OFF (no NVIDIA_API_KEY in .env), so the built-in reader is used.');
      return;
    }
    console.log(`Smart reading is ON with NVIDIA model ${ai.model}.`);
    checkModel(ai)
      .then((result) => {
        if (result.found) return console.log('Model found in your NVIDIA catalog. Ready!');
        console.warn(`Heads up: ${result.reason}`);
        if (result.suggestions.length) console.warn(`Similar models you could put in AI_MODEL: ${result.suggestions.join(', ')}`);
      })
      .catch(() => console.warn("Couldn't reach NVIDIA to check the model. Smart reading will fall back to basic reading if it fails."));
  });
}
