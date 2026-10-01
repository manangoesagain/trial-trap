// Tests the AI reader against a stand-in for NVIDIA's API, so no real key is needed.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { aiConfigFromEnv, checkModel, parseReply } from '../lib/aiExtract.js';
import { createApp } from '../server.js';
import { sampleEmails } from '../public/samples.js';

const KEY = 'nvapi-test-secret-key';
const today = '2026-10-01';

const goodReply = {
  trials: [
    { service: 'StreamBox Plus', chargeDate: '2026-10-03', dateIsEstimated: false, price: 15.99, currency: 'USD', billingPeriod: 'month', cancelSteps: ['Go to Account > Membership', 'Choose "Cancel plan"'], cancelUrl: 'https://streambox.example/account/cancel' },
    { service: 'PixelForge Pro', chargeDate: '2026-10-10', dateIsEstimated: true, price: 12.99, currency: 'USD', billingPeriod: 'monthly', cancelSteps: [], cancelUrl: 'javascript:alert(1)' },
  ],
  ignoredCount: 1,
};

// What the stand-in does on the next request, and every request it received.
let behaviour;
let requests;
let standIn;
let app;
let appUrl;

function chatReply(content) {
  return { choices: [{ message: { role: 'assistant', content } }] };
}

before(async () => {
  standIn = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      requests.push({ url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
      behaviour(req, res, requests.at(-1));
    });
  });
  await new Promise((resolve) => standIn.listen(0, resolve));
  const ai = { apiKey: KEY, model: 'meta/llama-3.3-70b-instruct', baseUrl: `http://127.0.0.1:${standIn.address().port}/v1` };
  app = createApp({ ai, aiOptions: { timeoutMs: 300 } }).listen(0);
  await new Promise((resolve) => app.once('listening', resolve));
  appUrl = `http://127.0.0.1:${app.address().port}`;
});

after(() => {
  app.close();
  standIn.close();
});

beforeEach(() => {
  requests = [];
});

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function extract(text = sampleEmails(today)) {
  const response = await fetch(`${appUrl}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, today }),
  });
  const raw = await response.text();
  assert.ok(!raw.includes(KEY), 'the key must never be sent back to the page');
  return JSON.parse(raw);
}

test('uses the AI reply when it is good, and cleans it', async () => {
  behaviour = (req, res) => sendJson(res, 200, chatReply(JSON.stringify(goodReply)));
  const result = await extract();

  assert.equal(result.mode, 'ai');
  assert.equal(result.ignoredCount, 1);
  assert.deepEqual(result.trials.map((t) => t.service), ['StreamBox Plus', 'PixelForge Pro']);
  assert.equal(result.trials[1].billingPeriod, 'month');
  assert.equal(result.trials[1].cancelUrl, null, 'unsafe links are dropped');

  const [request] = requests;
  assert.equal(request.url, '/v1/chat/completions');
  assert.equal(request.headers.authorization, `Bearer ${KEY}`);
  assert.equal(request.body.model, 'meta/llama-3.3-70b-instruct');
  assert.ok(request.body.nvext.guided_json, 'asks NVIDIA to enforce the JSON shape');
  assert.match(request.body.messages.at(-1).content, /Today's date: 2026-10-01/);
});

test('asks again without the JSON-shape option if the model rejects it', async () => {
  behaviour = (req, res, request) => (request.body.nvext
    ? sendJson(res, 400, { detail: 'nvext not supported' })
    : sendJson(res, 200, chatReply(JSON.stringify(goodReply))));
  const result = await extract();

  assert.equal(result.mode, 'ai');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.nvext, undefined);
  assert.equal(requests[1].body.messages.length, 1, 'second try sends one plain user message');
});

test('falls back to the built-in reader when the AI says nonsense', async () => {
  behaviour = (req, res) => sendJson(res, 200, chatReply('Sorry, I cannot help with that.'));
  const result = await extract();

  assert.equal(result.mode, 'basic');
  assert.match(result.note, /Smart reading had a problem/);
  assert.equal(result.trials.length, 3);
});

test('falls back when NVIDIA is busy (429)', async () => {
  behaviour = (req, res) => sendJson(res, 429, { detail: 'Too many requests' });
  const result = await extract();
  assert.equal(result.mode, 'basic');
  assert.equal(result.trials.length, 3);
});

test('falls back when the AI takes too long', async () => {
  behaviour = (req, res) => setTimeout(() => sendJson(res, 200, chatReply(JSON.stringify(goodReply))), 1000);
  const result = await extract();
  assert.equal(result.mode, 'basic');
});

test('reads JSON wrapped in code fences or after thinking text', () => {
  const fenced = parseReply('```json\n' + JSON.stringify(goodReply) + '\n```');
  assert.equal(fenced.trials.length, 2);
  const thinking = parseReply('<think>The user wants {trials}...</think>\n' + JSON.stringify(goodReply));
  assert.equal(thinking.trials.length, 2);
  assert.throws(() => parseReply('{"trials": "nope"}'), /did not match/);
});

test('settings come from .env, and smart reading is off without a key', () => {
  assert.equal(aiConfigFromEnv({}), null);
  assert.equal(aiConfigFromEnv({ NVIDIA_API_KEY: '  ' }), null);
  assert.deepEqual(aiConfigFromEnv({ NVIDIA_API_KEY: 'nvapi-x', AI_MODEL: 'some/model' }), {
    apiKey: 'nvapi-x', model: 'some/model', baseUrl: 'https://integrate.api.nvidia.com/v1',
  });
});

test('start-up check finds the model or suggests close names', async () => {
  behaviour = (req, res) => sendJson(res, 200, { data: [{ id: 'meta/llama-3.3-70b-instruct' }, { id: 'meta/llama-4-maverick-17b-128e-instruct' }, { id: 'nvidia/nemotron-ultra' }] });
  const baseUrl = `http://127.0.0.1:${standIn.address().port}/v1`;

  assert.equal((await checkModel({ apiKey: KEY, model: 'meta/llama-3.3-70b-instruct', baseUrl })).found, true);
  const missing = await checkModel({ apiKey: KEY, model: 'meta/llama-9-instruct', baseUrl });
  assert.equal(missing.found, false);
  assert.deepEqual(missing.suggestions, ['meta/llama-3.3-70b-instruct', 'meta/llama-4-maverick-17b-128e-instruct']);
});

test('an odd field from the AI is cleaned up instead of losing the trial', () => {
  const odd = { ...goodReply.trials[0], price: '15.99', currency: '₹', cancelSteps: 'Go to Account > Membership', dateIsEstimated: 'false', chargeDate: 'October 3, 2026' };
  const { trials, ignoredCount } = parseReply(JSON.stringify({ trials: [odd], ignoredCount: null }));
  assert.deepEqual(
    [trials[0].price, trials[0].currency, trials[0].chargeDate, trials[0].dateIsEstimated, trials[0].cancelSteps, ignoredCount],
    [15.99, 'INR', '2026-10-03', false, ['Go to Account > Membership'], 0],
  );
  for (const chargeDate of ['2026/10/03', '2026-10-3', '2026-10-03T00:00:00Z']) {
    assert.equal(parseReply(JSON.stringify({ trials: [{ ...odd, chargeDate }] })).trials[0].chargeDate, '2026-10-03', chargeDate);
  }
});

test('if the AI finds trials but none are usable, the built-in reader takes over', async () => {
  behaviour = (req, res) => sendJson(res, 200, chatReply(JSON.stringify({ trials: [{ service: '' }, { price: 5 }], ignoredCount: 0 })));
  const result = await extract();
  assert.equal(result.mode, 'basic');
  assert.match(result.note, /Smart reading had a problem/);
  assert.equal(result.trials.length, 3);
});

test('a key pasted with quotes or an invisible space still works', () => {
  assert.equal(aiConfigFromEnv({ NVIDIA_API_KEY: ' "nvapi-abc123​" ' }).apiKey, 'nvapi-abc123');
  assert.equal(aiConfigFromEnv({ NVIDIA_API_KEY: '“nvapi-abc123”' }).apiKey, 'nvapi-abc123');
});

test('start-up check says when the key cannot use the model', async () => {
  const baseUrl = `http://127.0.0.1:${standIn.address().port}/v1`;
  behaviour = (req, res, request) => (request.url.endsWith('/models')
    ? sendJson(res, 200, { data: [{ id: 'meta/llama-3.3-70b-instruct' }] })
    : sendJson(res, 403, { detail: 'Authorization failed' }));
  const refused = await checkModel({ apiKey: KEY, model: 'meta/llama-3.3-70b-instruct', baseUrl });
  assert.equal(refused.found, false);
  assert.match(refused.reason, /won't let your key use it/);
  assert.equal(requests.at(-1).body.max_tokens, 5, 'the test message is tiny');

  const odd = await checkModel({ apiKey: 'nvapi-abc def', model: 'meta/llama-3.3-70b-instruct', baseUrl });
  assert.match(odd.reason, /unexpected character/);
});
