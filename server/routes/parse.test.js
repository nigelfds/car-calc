import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import parseRoute, { mergeParsed } from './parse.js';

test('Claude values win over keyword values', () => {
  const merged = mergeParsed(
    { grossSalary: 100000, monthlyBudget: 500 },
    { grossSalary: 145000, monthlyBudget: 900 }
  );
  assert.equal(merged.grossSalary, 145000);
  assert.equal(merged.monthlyBudget, 900);
});

test('keyword values fill gaps Claude left null', () => {
  const merged = mergeParsed(
    { grossSalary: 145000, minRangeKm: 400 },
    { grossSalary: null, monthlyBudget: 900 }
  );
  assert.equal(merged.grossSalary, 145000);
  assert.equal(merged.monthlyBudget, 900);
  assert.equal(merged.minRangeKm, 400);
});

test('merging with a null Claude result returns the keyword result', () => {
  const merged = mergeParsed({ grossSalary: 145000 }, null);
  assert.equal(merged.grossSalary, 145000);
});

test('mergeParsed does not put clarifyingQuestion into its result', () => {
  const merged = mergeParsed(
    { grossSalary: 100000 },
    { grossSalary: 145000, clarifyingQuestion: 'What is your budget?' }
  );
  assert.equal(merged.grossSalary, 145000);
  assert.equal('clarifyingQuestion' in merged, false);
});

async function withServer(fn) {
  const app = express();
  app.use(express.json());
  app.use('/api/parse', parseRoute);
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await fn(`http://localhost:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('a non-array history does not produce a 500', async () => {
  await withServer(async base => {
    const res = await fetch(`${base}/api/parse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi', history: { foo: 1 } })
    });
    assert.notEqual(res.status, 500);
    const body = await res.json();
    assert.ok(body.error);
  });
});

test('a history array with invalid entries does not produce a 500', async () => {
  await withServer(async base => {
    const res = await fetch(`${base}/api/parse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi', history: [{ role: 'user', content: 42 }] })
    });
    assert.notEqual(res.status, 500);
    const body = await res.json();
    assert.ok(body.error);
  });
});
