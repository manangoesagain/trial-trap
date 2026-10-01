import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { sampleEmails } from '../public/samples.js';

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function extract(body) {
  return fetch(`${baseUrl}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('finds the three sample trials', async () => {
  const response = await extract({ text: sampleEmails('2026-10-01'), today: '2026-10-01' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.mode, 'basic');
  assert.deepEqual(result.trials.map((t) => t.service), ['StreamBox Plus', 'PixelForge Pro', 'MunchPass']);
});

test('asks for text when the paste is empty', async () => {
  const response = await extract({ text: '   ' });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Paste an email first/);
});

test('rejects very long pastes politely', async () => {
  const response = await extract({ text: 'x'.repeat(50_001) });
  assert.equal(response.status, 413);
});

test('answers broken requests with JSON', async () => {
  const response = await extract('{not json');
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error);
});

test('serves the page', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Trial Trap/);
});
