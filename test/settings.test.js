import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readEnvFile } from '../server.js';
import { formatMoney, formatTotals, summarize } from '../public/trials.js';

test('.env is read however Windows saved it', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-trap-'));
  const file = path.join(folder, '.env');
  const content = '# My settings\r\nNVIDIA_API_KEY=nvapi-abc123\r\nAI_MODEL=meta/llama-3.3-70b-instruct\r\n';
  const versions = {
    plain: Buffer.from(content),
    'with a byte-order mark': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content.replace('# My settings\r\n', ''))]),
    'as UTF-16': Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, 'utf16le')]),
  };
  for (const [name, bytes] of Object.entries(versions)) {
    fs.writeFileSync(file, bytes);
    assert.equal(readEnvFile(file).NVIDIA_API_KEY, 'nvapi-abc123', name);
  }
  assert.deepEqual(readEnvFile(path.join(folder, 'missing.env')), {});
  fs.rmSync(folder, { recursive: true });
});

test('a price with no currency in the email is shown without a dollar sign', () => {
  assert.equal(formatMoney(12.99, null), '12.99');
  assert.equal(formatMoney(1499, 'INR'), '₹1,499.00');
  const { atRisk } = summarize([
    { service: 'Tinkerly', chargeDate: '2026-10-20', price: 12.99, currency: null, status: 'active' },
    { service: 'Velora', chargeDate: '2026-10-21', price: 5, currency: 'USD', status: 'active' },
  ], '2026-10-01');
  assert.equal(formatTotals(atRisk), '12.99 + $5.00');
});
