import { parseOnDevice } from './prompt-api.js';

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

export function renderInputs(root, state, onChange) {
  for (const input of root.querySelectorAll('[data-field]')) {
    const field = input.dataset.field;
    if (field in state && state[field] !== null) input.value = state[field];

    input.addEventListener('input', () => {
      const raw = input.value;
      const value = input.type === 'number' ? Number(raw) : raw;
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

export function bindFreeText(root, getState, { onParsed }) {
  const textarea = root.querySelector('#free-text');
  const button = root.querySelector('#parse-button');
  const status = root.querySelector('#parse-status');

  button.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    status.textContent = 'Reading your description…';
    button.disabled = true;

    try {
      // Tier 1: on-device, in Chrome. Nothing leaves the machine.
      let preferences = await parseOnDevice(text);
      let clarifyingQuestion = null;

      // Tier 2: the server, on Haiku. Every other browser lands here.
      if (!preferences) {
        const response = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await response.json();
        preferences = data.preferences;
        clarifyingQuestion = data.clarifyingQuestion;
      }

      const data = { preferences, clarifyingQuestion };
      const { state, changedFields } = applyPreferences(getState(), data.preferences);
      highlightChanged(root, changedFields);
      status.textContent = data.clarifyingQuestion
        ? data.clarifyingQuestion
        : `Filled in ${changedFields.length} field${changedFields.length === 1 ? '' : 's'} from your description.`;
      onParsed(state);
    } catch {
      status.textContent = 'Could not read that — fill the fields in below instead.';
    } finally {
      button.disabled = false;
    }
  });
}
