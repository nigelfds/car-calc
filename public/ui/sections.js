import { NUMERIC_FIELDS } from './state.js';
import { parseOnDevice } from './prompt-api.js';

// Which state.js fields are numbers. Declared explicitly in state.js
// (exported alongside defaultState) rather than sniffed from any particular
// input element's DOM type or inferred from a runtime default value. A
// <select> reports type "select-one", never "number" — sniffing input.type
// is what let the term dropdown write the string "60" into a field
// defaultState() defines as the number 60. Inferring numeric-ness from
// `typeof defaultValue === 'number'` has its own trap: fields like
// minBootLitres default to null (no filter applied), so that check would
// misclassify them as non-numeric. Driving this off an explicit, declared
// set is robust to both a field becoming a select/radio/range input and a
// numeric field's default being null.

const same = (a, b) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b;

export function applyPreferences(state, preferences) {
  const touched = new Set(state.touched ?? []);
  const next = { ...state };
  const changedFields = [];

  for (const [key, value] of Object.entries(preferences)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (touched.has(key)) continue;
    if (!(key in state)) continue;
    if (same(state[key], value)) continue;
    next[key] = value;
    changedFields.push(key);
  }

  return { state: next, changedFields };
}

// Takes `getState` — a getter, not a state value — for the same reason
// bindFreeText below does: listeners are bound once, at boot, but the state
// they must act on changes on every edit. app.js's boot() reassigns its
// local `state` on every onFieldChange; a listener that closed over the
// `state` *value* passed in at bind time would forever spread that first
// snapshot back in, silently reverting every field but the one most
// recently edited (see the C1 fix note in the project's SDD docs). Reading
// getState() inside the listener, at event time, is what keeps two fields
// edited in sequence both alive — mirrors renderRatesPanel's
// panel._ratesState, refreshed on every call rather than captured once.
export function renderInputs(root, getState, onChange) {
  for (const input of root.querySelectorAll('[data-field]')) {
    const field = input.dataset.field;
    const initial = getState();

    // A checkbox fires `change` rather than `input` when driven by the
    // keyboard, so it is handled before the scalar path below in every case.
    // But "checkbox" covers two different shapes of field: bodyTypes-style
    // boxes toggle membership of an array and each carry their own member in
    // data-value (SUV, Hatch, ...); includePhev-style boxes are a plain
    // boolean field with no member to speak of. data-value's presence is
    // what tells the two apart — without this split, includePhev's initial
    // value (a real `false`, never null/undefined) skipped the `?? []`
    // fallback and called `.includes` on a boolean, throwing inside boot()
    // before render() ever ran (the whole page stayed on its skeleton
    // placeholders).
    if (input.type === 'checkbox') {
      const member = input.dataset.value;

      if (member === undefined) {
        input.checked = Boolean(initial[field]);

        input.addEventListener('change', () => {
          const state = getState();
          const touched = new Set(state.touched ?? []);
          touched.add(field);
          onChange({ ...state, [field]: input.checked, touched: [...touched] });
        });
        continue;
      }

      input.checked = (initial[field] ?? []).includes(member);

      input.addEventListener('change', () => {
        const state = getState();
        const current = new Set(state[field] ?? []);
        if (input.checked) current.add(member); else current.delete(member);
        const touched = new Set(state.touched ?? []);
        touched.add(field);
        onChange({ ...state, [field]: [...current], touched: [...touched] });
      });
      continue;
    }

    if (field in initial && initial[field] !== null) input.value = initial[field];

    input.addEventListener('input', () => {
      const state = getState();
      const raw = input.value;
      // Number('') is 0, which would silently resurrect a cleared numeric
      // field as zero — leave a cleared field as the empty string instead.
      const value = NUMERIC_FIELDS.has(field) && raw !== '' ? Number(raw) : raw;
      const touched = new Set(state.touched ?? []);
      touched.add(field);
      onChange({ ...state, [field]: value, touched: [...touched] });
    });
  }
}

export function highlightChanged(root, changedFields) {
  for (const field of changedFields) {
    const input = root.querySelector(`[data-field="${field}"]`);
    if (!input) continue;
    input.classList.add('field-updated');
    setTimeout(() => input.classList.remove('field-updated'), 1500);
  }
}

// Sentinel distinguishing "the timer won the race" from any real resolved
// value (including a legitimate null from parseOnDevice).
const TIMED_OUT = Symbol('timed-out');

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 10s matches the timeout server/claude.js applies to the Claude call itself.
const DEFAULT_TIER_TIMEOUT_MS = 10000;

export function bindFreeText(root, getState, { onParsed, timeoutMs = DEFAULT_TIER_TIMEOUT_MS }) {
  const textarea = root.querySelector('#free-text');
  const button = root.querySelector('#parse-button');
  const status = root.querySelector('#parse-status');

  button.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    status.textContent = 'Reading your description…';
    button.disabled = true;

    try {
      // Tier 1: on-device, in Chrome. Nothing leaves the machine. A stalled
      // model must not leave the button disabled forever, so this races a
      // timeout and falls through to tier 2 rather than waiting indefinitely.
      let preferences = await withTimeout(parseOnDevice(text), timeoutMs);
      if (preferences === TIMED_OUT) preferences = null;
      let clarifyingQuestion = null;

      // Tier 2: the server, on Haiku. Every other browser lands here. Also
      // capped, via AbortController, so a hung request can't strand the button.
      if (!preferences) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch('/api/parse', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: controller.signal
          });
          const body = await response.json();
          // Tolerate an error response with no preferences key (e.g. a 4xx
          // body of just { error }) instead of leaning on the outer catch.
          preferences = body?.preferences ?? null;
          clarifyingQuestion = body?.clarifyingQuestion ?? null;
        } finally {
          clearTimeout(timer);
        }
      }

      if (!preferences) {
        status.textContent = 'Could not read that — fill the fields in below instead.';
        return;
      }

      const { state, changedFields } = applyPreferences(getState(), preferences);
      highlightChanged(root, changedFields);
      status.textContent = clarifyingQuestion
        ? clarifyingQuestion
        : `Filled in ${changedFields.length} field${changedFields.length === 1 ? '' : 's'} from your description.`;
      onParsed(state);
    } catch (err) {
      // Every tier timed out or failed outright — recover with a status
      // message that says so, rather than a generic one, when we know it's a
      // timeout (an aborted fetch surfaces here as an AbortError).
      status.textContent = err?.name === 'AbortError'
        ? "That's taking too long — fill the fields in below instead."
        : 'Could not read that — fill the fields in below instead.';
    } finally {
      button.disabled = false;
    }
  });
}
