import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARSE_SCHEMA, isPromptApiAvailable, parseOnDevice } from './prompt-api.js';

// The Prompt API is a browser global. These tests stub it, so they run in node
// and prove the availability gating and failure handling without a browser.
const withStub = async (stub, fn) => {
  globalThis.LanguageModel = stub;
  try { return await fn(); } finally { delete globalThis.LanguageModel; }
};

test('reports unavailable when the global is missing entirely', async () => {
  delete globalThis.LanguageModel;
  assert.equal(await isPromptApiAvailable(), false);
});

test('reports unavailable when the model cannot be provided', async () => {
  await withStub({ availability: async () => 'unavailable' }, async () => {
    assert.equal(await isPromptApiAvailable(), false);
  });
});

test('reports available only when the model is ready to use', async () => {
  await withStub({ availability: async () => 'available' }, async () => {
    assert.equal(await isPromptApiAvailable(), true);
  });
  await withStub({ availability: async () => 'downloadable' }, async () => {
    assert.equal(await isPromptApiAvailable(), false);
  });
});

test('the schema constrains the fields the engine consumes', () => {
  assert.equal(PARSE_SCHEMA.type, 'object');
  for (const field of ['grossSalary', 'monthlyBudget', 'bodyTypes', 'minBootLitres']) {
    assert.ok(field in PARSE_SCHEMA.properties, `${field} missing from schema`);
  }
});

test('parses a stringified JSON response from the session', async () => {
  const stub = {
    availability: async () => 'available',
    create: async () => ({
      prompt: async () => JSON.stringify({ grossSalary: 145000, bodyTypes: ['SUV'] }),
      destroy() {}
    })
  };
  await withStub(stub, async () => {
    const result = await parseOnDevice('I earn $145k, want an SUV');
    assert.equal(result.grossSalary, 145000);
    assert.deepEqual(result.bodyTypes, ['SUV']);
  });
});

test('returns null rather than throwing when the session fails', async () => {
  const stub = {
    availability: async () => 'available',
    create: async () => { throw new Error('model gone'); }
  };
  await withStub(stub, async () => {
    assert.equal(await parseOnDevice('anything'), null);
  });
});

test('returns null when the model emits unparseable output', async () => {
  const stub = {
    availability: async () => 'available',
    create: async () => ({ prompt: async () => 'not json at all', destroy() {} })
  };
  await withStub(stub, async () => {
    assert.equal(await parseOnDevice('anything'), null);
  });
});

test('always destroys the session, even when prompting throws', async () => {
  let destroyed = false;
  const stub = {
    availability: async () => 'available',
    create: async () => ({
      prompt: async () => { throw new Error('boom'); },
      destroy() { destroyed = true; }
    })
  };
  await withStub(stub, async () => {
    await parseOnDevice('anything');
    assert.equal(destroyed, true, 'session must not leak');
  });
});
