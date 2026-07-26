import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPreferences, renderInputs, bindFreeText } from './sections.js';

const base = {
  grossSalary: 100000, monthlyBudget: 900, termMonths: 60,
  bodyTypes: [], minBootLitres: null, touched: []
};

test('parsed preferences are applied to untouched fields', () => {
  const { state, changedFields } = applyPreferences(base, { grossSalary: 145000, bodyTypes: ['SUV'] });
  assert.equal(state.grossSalary, 145000);
  assert.deepEqual(state.bodyTypes, ['SUV']);
  assert.ok(changedFields.includes('grossSalary'));
  assert.ok(changedFields.includes('bodyTypes'));
});

test('a field the user has edited is never overwritten', () => {
  const touched = { ...base, touched: ['grossSalary'] };
  const { state, changedFields } = applyPreferences(touched, { grossSalary: 145000 });
  assert.equal(state.grossSalary, 100000, 'the manual value survives');
  assert.ok(!changedFields.includes('grossSalary'));
});

test('null preferences leave the state alone', () => {
  const { state, changedFields } = applyPreferences(base, { grossSalary: null, seats: null });
  assert.equal(state.grossSalary, 100000);
  assert.equal(changedFields.length, 0);
});

test('a value identical to the current one is not reported as changed', () => {
  const { changedFields } = applyPreferences(base, { grossSalary: 100000 });
  assert.equal(changedFields.length, 0);
});

// --- renderInputs: coercion is driven by state's own type, not DOM type ---

function fakeInput(field, initial) {
  let handler = null;
  return {
    dataset: { field },
    value: initial,
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { handler = fn; },
    fire() { handler(); }
  };
}

test('a <select> bound to a numeric state field coerces its value to a Number', () => {
  const state = { termMonths: 60, touched: [] };
  const input = fakeInput('termMonths', '60');
  const root = { querySelectorAll: () => [input] };
  let received;
  renderInputs(root, () => state, next => { received = next; });

  input.value = '48'; // simulates picking a different <option>
  input.fire();

  assert.equal(received.termMonths, 48);
  assert.equal(typeof received.termMonths, 'number');
});

test('a string state field (e.g. leaseStartDate) is left as a string', () => {
  const state = { leaseStartDate: '2026-07-25', touched: [] };
  const input = fakeInput('leaseStartDate', '2026-07-25');
  const root = { querySelectorAll: () => [input] };
  let received;
  renderInputs(root, () => state, next => { received = next; });

  input.value = '2026-08-01';
  input.fire();

  assert.equal(received.leaseStartDate, '2026-08-01');
  assert.equal(typeof received.leaseStartDate, 'string');
});

test('a numeric field whose default is null (minBootLitres) still coerces to a Number when bound', () => {
  // minBootLitres defaults to null in state.js, so `typeof value === 'number'`
  // would have misclassified it as non-numeric — this pins the explicit
  // NUMERIC_FIELDS declaration in state.js against that regression.
  const state = { minBootLitres: null, touched: [] };
  const input = fakeInput('minBootLitres', '');
  const root = { querySelectorAll: () => [input] };
  let received;
  renderInputs(root, () => state, next => { received = next; });

  input.value = '400';
  input.fire();

  assert.equal(received.minBootLitres, 400);
  assert.equal(typeof received.minBootLitres, 'number');
});

test('clearing a numeric field does not silently coerce to 0', () => {
  const state = { grossSalary: 100000, touched: [] };
  const input = fakeInput('grossSalary', '100000');
  const root = { querySelectorAll: () => [input] };
  let received;
  renderInputs(root, () => state, next => { received = next; });

  input.value = '';
  input.fire();

  assert.notEqual(received.grossSalary, 0);
  assert.equal(received.grossSalary, '');
});

// --- C1 regression: renderInputs must read state live, not close over a
// stale snapshot from bind time. app.js binds renderInputs's listeners
// once at boot and reassigns its own local `state` on every onChange; a
// getter is how the listener sees each edit's up-to-date state rather than
// forever spreading the very first state object it was bound with. Before
// this fix, editing a second field silently discarded the first (touched
// was rebuilt from the stale object every time too, so it was always a
// single-element array no matter how many fields had actually been
// edited).
test('firing input on two different fields in sequence keeps both edits and accumulates touched', () => {
  let state = { grossSalary: 100000, monthlyBudget: 900, touched: [] };
  const salaryInput = fakeInput('grossSalary', '100000');
  const budgetInput = fakeInput('monthlyBudget', '900');
  const root = { querySelectorAll: () => [salaryInput, budgetInput] };

  let received;
  // Mirrors app.js's boot(): onChange reassigns the same `state` the
  // getter reads, so renderInputs is exercised exactly as it's really used.
  renderInputs(root, () => state, next => { received = next; state = next; });

  salaryInput.value = '200000';
  salaryInput.fire();
  assert.equal(received.grossSalary, 200000, 'the salary edit is applied');
  assert.equal(received.monthlyBudget, 900, 'budget is untouched so far');
  assert.deepEqual(received.touched, ['grossSalary']);

  budgetInput.value = '1500';
  budgetInput.fire();
  assert.equal(received.grossSalary, 200000, 'the salary edit must survive editing a second field');
  assert.equal(received.monthlyBudget, 1500, 'the budget edit is applied');
  assert.deepEqual(received.touched, ['grossSalary', 'monthlyBudget'], 'touched accumulates both fields');
});

// --- bindFreeText: timeouts on both tiers ---

async function withGlobals({ LanguageModel, fetch: fetchImpl }, fn) {
  const hadLM = 'LanguageModel' in globalThis;
  const originalLM = globalThis.LanguageModel;
  const originalFetch = globalThis.fetch;

  if (LanguageModel === undefined) delete globalThis.LanguageModel;
  else globalThis.LanguageModel = LanguageModel;
  globalThis.fetch = fetchImpl;

  try {
    return await fn();
  } finally {
    if (hadLM) globalThis.LanguageModel = originalLM;
    else delete globalThis.LanguageModel;
    globalThis.fetch = originalFetch;
  }
}

function fakeFreeTextRoot(text) {
  const textarea = { value: text };
  let clickHandler = null;
  const button = { disabled: false, addEventListener(type, fn) { clickHandler = fn; } };
  const status = { textContent: '' };
  const elements = { '#free-text': textarea, '#parse-button': button, '#parse-status': status };
  return {
    root: { querySelector: sel => elements[sel] },
    button,
    status,
    click: () => clickHandler()
  };
}

const neverResolvingSession = {
  availability: async () => 'available',
  create: async () => ({ prompt: () => new Promise(() => {}), destroy() {} })
};

test('a stalled on-device model times out and falls through to the server tier', async () => {
  const { root, button, status, click } = fakeFreeTextRoot('I earn 145k, want an SUV');

  await withGlobals(
    {
      LanguageModel: neverResolvingSession,
      fetch: async () => ({
        json: async () => ({ preferences: { grossSalary: 145000 }, clarifyingQuestion: null })
      })
    },
    async () => {
      let parsedState;
      bindFreeText(root, () => ({ grossSalary: 100000, touched: [] }), {
        onParsed: s => { parsedState = s; },
        timeoutMs: 20
      });
      await click();

      assert.equal(button.disabled, false, 'button must be re-enabled');
      assert.equal(parsedState.grossSalary, 145000, 'tier 2 result was applied');
      assert.ok(!status.textContent.includes('too long'));
    }
  );
});

test('a stalled server request times out, re-enables the button and reports it', async () => {
  const { root, button, status, click } = fakeFreeTextRoot('I earn 145k, want an SUV');

  await withGlobals(
    {
      LanguageModel: neverResolvingSession,
      fetch: (url, opts) => new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
    },
    async () => {
      let onParsedCalled = false;
      bindFreeText(root, () => ({ grossSalary: 100000, touched: [] }), {
        onParsed: () => { onParsedCalled = true; },
        timeoutMs: 20
      });
      await click();

      assert.equal(button.disabled, false, 'button must be re-enabled after every tier times out');
      assert.equal(onParsedCalled, false);
      assert.match(status.textContent, /too long/);
    }
  );
});

test('a server response with no preferences key is tolerated without throwing', async () => {
  const { root, button, status, click } = fakeFreeTextRoot('mumble mumble');

  await withGlobals(
    {
      LanguageModel: undefined,
      fetch: async () => ({ json: async () => ({ error: 'AI unavailable' }) })
    },
    async () => {
      let onParsedCalled = false;
      bindFreeText(root, () => ({ grossSalary: 100000, touched: [] }), {
        onParsed: () => { onParsedCalled = true; },
        timeoutMs: 20
      });
      await click();

      assert.equal(button.disabled, false);
      assert.equal(onParsedCalled, false);
      assert.match(status.textContent, /Could not read/);
    }
  );
});
