import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Keyed by event type, not a single slot. renderInputs binds both 'input' and
// 'blur' to every field, and a stub that keeps only the last handler silently
// runs the wrong one — which is how this stub first failed: the blur listener
// displaced the input listener and five passing tests started exercising code
// they were never about.
function fakeInput(field, initial) {
  const handlers = {};
  return {
    dataset: { field },
    value: initial,
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { handlers[type] = fn; },
    fire(type = 'input') {
      if (!handlers[type]) throw new Error(`nothing bound to '${type}' for ${field}`);
      handlers[type]();
    }
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
// --- Clearing a field that has no meaningful blank state -------------------
// '' is not nullish, so every `?? default` downstream was bypassed and
// Math.max(0, '') became 0. Blanking annualKm meant a car free to run, which
// changed which car the shortlist recommended; blanking the battery share
// meant a plug-in hybrid burning petrol for every kilometre. Both failed
// silently, with the box showing nothing.

test('clearing annual km falls back to the default rather than meaning zero', () => {
  const input = fakeInput('annualKm', '15000');
  let received = null;
  renderInputs(
    { querySelectorAll: () => [input] },
    () => ({ annualKm: 30000 }),
    next => { received = next; },
    { annualKm: 15000 }
  );
  input.value = '';
  input.fire();
  assert.equal(received.annualKm, 15000, 'a cleared distance must not become 0km a year');
});

test('clearing the battery share falls back to the default rather than meaning all petrol', () => {
  const input = fakeInput('phevBatterySharePct', '50');
  let received = null;
  renderInputs(
    { querySelectorAll: () => [input] },
    () => ({ phevBatterySharePct: 80 }),
    next => { received = next; },
    { phevBatterySharePct: 50 }
  );
  input.value = '';
  input.fire();
  assert.equal(received.phevBatterySharePct, 50, 'a cleared share must not become 0% on battery');
});

// The counterpart: blank IS the answer for the optional filters, and for the
// salary, where ui/app.js's hasValidSalary asks for a number rather than
// inventing one. Falling those back to a default would be the worse bug.
test('clearing an optional filter still means "any", not its default', () => {
  for (const field of ['minBootLitres', 'minRangeKm', 'minElectricRangeKm']) {
    const input = fakeInput(field, '500');
    let received = null;
    renderInputs(
      { querySelectorAll: () => [input] },
      () => ({ [field]: 500 }),
      next => { received = next; },
      { [field]: null }
    );
    input.value = '';
    input.fire();
    assert.equal(received[field], '', `${field} must stay clearable to mean "any"`);
  }
});

test('clearing the salary still leaves it blank so the app can ask for one', () => {
  const input = fakeInput('grossSalary', '100000');
  let received = null;
  renderInputs(
    { querySelectorAll: () => [input] },
    () => ({ grossSalary: 100000 }),
    next => { received = next; },
    { grossSalary: 100000 }
  );
  input.value = '';
  input.fire();
  assert.equal(received.grossSalary, '', 'a blank salary must not silently become $100,000');
});

// syncFieldInputs (ui/app.js) skips whatever has focus so it never fights a
// user mid-type, which leaves a cleared box showing nothing while the model
// uses a real number. Blur is where that gap closes.
test('leaving a cleared field restores what the model is actually using', () => {
  const input = fakeInput('annualKm', '15000');
  renderInputs(
    { querySelectorAll: () => [input] },
    () => ({ annualKm: 15000 }),
    () => {},
    { annualKm: 15000 }
  );
  input.value = '';
  input.fire('blur');
  assert.equal(input.value, '15000', 'the box must end up showing the number being used');
});

test('leaving a field alone does not rewrite what the user typed', () => {
  const input = fakeInput('annualKm', '22000');
  renderInputs(
    { querySelectorAll: () => [input] },
    () => ({ annualKm: 22000 }),
    () => {},
    { annualKm: 15000 }
  );
  input.fire('blur');
  // String(): a real DOM input coerces .value to a string, the stub does not,
  // and renderInputs seeds it from state's number at bind time.
  assert.equal(String(input.value), '22000');
});

// A blank optional filter is a legitimate resting state, so blur must not
// stuff a number back into a box the user deliberately emptied.
test('leaving a blank optional filter blank does not repopulate it', () => {
  const input = fakeInput('minBootLitres', '');
  renderInputs(
    { querySelectorAll: () => [input] },
    () => ({ minBootLitres: null }),
    () => {},
    { minBootLitres: null }
  );
  input.fire('blur');
  assert.equal(input.value, '', 'an "any" filter must stay visibly empty');
});

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

// --- Checkbox support: the body-type filter -------------------------------
// bodyTypes, minBootLitres, minRangeKm and seats already drove filterVehicles
// but had no controls at all — they were settable only through the free-text
// parse, so "an SUV with a big boot" did nothing whenever the parse did not
// fire. bodyTypes is an array, so it needs checkboxes, which renderInputs did
// not handle: it bound `input` events and read `.value`.

function fakeCheckbox(field, memberValue, checked) {
  let handler = null;
  return {
    dataset: { field, value: memberValue },
    type: 'checkbox',
    checked,
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { if (type === 'change') handler = fn; },
    fire() { handler(); }
  };
}

test('ticking a body-type box adds it to the bodyTypes array', () => {
  const state = { bodyTypes: [], touched: [] };
  const box = fakeCheckbox('bodyTypes', 'SUV', false);
  let received;
  renderInputs({ querySelectorAll: () => [box] }, () => state, next => { received = next; });

  box.checked = true;
  box.fire();

  assert.deepEqual(received.bodyTypes, ['SUV']);
  assert.ok(received.touched.includes('bodyTypes'));
});

test('unticking removes that body type and leaves the others', () => {
  const state = { bodyTypes: ['SUV', 'Hatch'], touched: [] };
  const box = fakeCheckbox('bodyTypes', 'SUV', true);
  let received;
  renderInputs({ querySelectorAll: () => [box] }, () => state, next => { received = next; });

  box.checked = false;
  box.fire();

  assert.deepEqual(received.bodyTypes, ['Hatch']);
});

test('a box reflects whether its type is already selected', () => {
  const state = { bodyTypes: ['Wagon'], touched: [] };
  const selected = fakeCheckbox('bodyTypes', 'Wagon', false);
  const other = fakeCheckbox('bodyTypes', 'Ute', true);
  renderInputs({ querySelectorAll: () => [selected, other] }, () => state, () => {});

  assert.equal(selected.checked, true, 'a selected type must show as ticked');
  assert.equal(other.checked, false, 'an unselected one must not');
});

test('a checkbox never has its value coerced like a scalar field', () => {
  const state = { bodyTypes: [], touched: [] };
  const box = fakeCheckbox('bodyTypes', 'Sedan', false);
  let received;
  renderInputs({ querySelectorAll: () => [box] }, () => state, next => { received = next; });
  box.checked = true;
  box.fire();
  assert.ok(Array.isArray(received.bodyTypes), 'bodyTypes must stay an array');
});

// --- Checkbox support: a scalar boolean field (includePhev) --------------
// includePhev is the first checkbox whose state field is a plain boolean,
// not an array. Its initial value is always `false` or `true` — never null
// or undefined — so the array branch's `(initial[field] ?? []).includes(...)`
// never fell through to `[]` and instead called `.includes` on a boolean,
// throwing inside renderInputs (and so inside boot(), before render() ever
// ran). fakeScalarCheckbox deliberately omits data-value: that omission is
// what renderInputs now uses to pick this branch, and a stub that carried
// data-value (like fakeCheckbox above) would not have reproduced the bug.

function fakeScalarCheckbox(field, checked) {
  let handler = null;
  return {
    dataset: { field },
    type: 'checkbox',
    checked,
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { if (type === 'change') handler = fn; },
    fire() { handler(); }
  };
}

test('a scalar boolean checkbox reflects true/false from state without throwing', () => {
  const state = { includePhev: false, touched: [] };
  const box = fakeScalarCheckbox('includePhev', false);
  assert.doesNotThrow(() => {
    renderInputs({ querySelectorAll: () => [box] }, () => state, () => {});
  });
  assert.equal(box.checked, false);

  const onState = { includePhev: true, touched: [] };
  const onBox = fakeScalarCheckbox('includePhev', false);
  renderInputs({ querySelectorAll: () => [onBox] }, () => onState, () => {});
  assert.equal(onBox.checked, true, 'a true state value must tick the box');
});

test('ticking a scalar boolean checkbox writes a boolean, not an array or string', () => {
  const state = { includePhev: false, touched: [] };
  const box = fakeScalarCheckbox('includePhev', false);
  let received;
  renderInputs({ querySelectorAll: () => [box] }, () => state, next => { received = next; });

  box.checked = true;
  box.fire();

  assert.equal(received.includePhev, true);
  assert.equal(typeof received.includePhev, 'boolean');
  assert.ok(received.touched.includes('includePhev'));
});

test('unticking a scalar boolean checkbox writes false', () => {
  const state = { includePhev: true, touched: [] };
  const box = fakeScalarCheckbox('includePhev', true);
  let received;
  renderInputs({ querySelectorAll: () => [box] }, () => state, next => { received = next; });

  box.checked = false;
  box.fire();

  assert.equal(received.includePhev, false);
  assert.equal(typeof received.includePhev, 'boolean');
});

// --- Regression: every real checkbox in index.html must survive renderInputs
// The two tests above pin the fix at the unit level, but 379/379 stayed green
// on the branch this fix responds to precisely because every hand-built
// stub in this file already carried data-value — none of them exercised a
// real scalar checkbox. This test reads the actual markup (same
// readFileSync approach as slider.test.js reading tax-tables.json) and
// drives renderInputs against every `[data-field]` checkbox found in it, so
// a future scalar checkbox added straight to index.html without a matching
// stub here still gets caught.

function checkboxesFromHtml(html) {
  const boxes = [];
  const inputTagPattern = /<input\b[^>]*>/g;
  for (const [tag] of html.matchAll(inputTagPattern)) {
    if (!/type=["']checkbox["']/.test(tag)) continue;
    const field = tag.match(/data-field=["']([^"']+)["']/)?.[1];
    if (!field) continue;
    const hasValue = /data-value=["']/.test(tag);
    boxes.push({ field, hasValue });
  }
  return boxes;
}

test('every checkbox in index.html is handled by renderInputs without throwing', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const boxes = checkboxesFromHtml(html);

  // Guards the guard: if the markup pattern ever stops matching (a rewrite
  // to index.html, say), this test must fail loudly rather than silently
  // pass over zero checkboxes.
  assert.ok(boxes.length > 0, 'expected to find at least one checkbox in index.html');
  assert.ok(boxes.some(b => b.hasValue), 'expected at least one array-membership checkbox (bodyTypes)');
  assert.ok(boxes.some(b => !b.hasValue), 'expected at least one scalar checkbox (includePhev)');

  const state = { bodyTypes: [], includePhev: false, touched: [] };
  const inputs = boxes.map(({ field, hasValue }) => {
    const stub = hasValue ? fakeCheckbox(field, 'SUV', false) : fakeScalarCheckbox(field, false);
    return stub;
  });

  assert.doesNotThrow(() => {
    renderInputs({ querySelectorAll: () => inputs }, () => state, () => {});
    for (const input of inputs) input.fire();
  });
});
