import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verdictAt, renderVerdict, renderRatesPanel } from './slider.js';

const tables = JSON.parse(readFileSync(new URL('../../data/tax-tables.json', import.meta.url)));

const vehicle = (id, listPrice) => ({
  id, listPrice, consumptionKwhPer100km: 16, insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47],
  // rankVehicles (calc/rank.js) needs these to score a vehicle — every
  // dimension but price held equal across fixtures so ranking is driven
  // solely by the one thing under test.
  bootLitresSeatsUp: 450, rangeKm: 450, warrantyYears: 7, seats: 5, bodyType: 'SUV'
});

const inputs = {
  grossSalary: 145000, savings: 15000, termMonths: 48, annualKm: 15000,
  leaseStartDate: '2026-07-25', leaseRatePct: 7.5, loanRatePct: 6.5,
  opportunityRatePct: 4.5, adminFeeAnnual: 1020, deposit: 0,
  electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240
};

// The specific misread that motivated all of this: cash is capped by savings
// --- renderRatesPanel: re-rendering must never steal focus mid-type ---
//
// There's no jsdom here (see sections.test.js's `fakeInput` for the same
// constraint), so this stub has to earn its keep: a real browser blurs and
// discards a focused element the moment an ancestor's innerHTML is
// reassigned, even if the replacement markup is identical. The setter below
// reproduces exactly that — a fresh `generation` of brand-new element
// objects every time it runs, and it clears `root.activeElement` if the
// element being focused belonged to the generation just destroyed. A fix
// that still rebuilds the panel on every render fails this stub the same
// way it fails a real browser; a fix that builds once and only patches
// values afterward passes.
const RATE_FIELD_NAMES = [
  'leaseRatePct', 'loanRatePct', 'adminFeeAnnual', 'opportunityRatePct', 'residualPctOverride', 'deposit'
];

function fakeRatesRoot() {
  let generation = 0;
  let fieldInputs = {};
  let resetButtons = {};

  function fakeInput(field) {
    return {
      dataset: { field },
      value: '',
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      fire() { this.listeners.input?.(); }
    };
  }

  function fakeButton(field) {
    return {
      dataset: { reset: field },
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      click() { this.listeners.click?.(); }
    };
  }

  const panel = {
    set innerHTML(_html) {
      generation++;
      if (root.activeElement && Object.values(fieldInputs).includes(root.activeElement)) {
        root.activeElement = null; // real DOM: removing a focused node blurs it
      }
      fieldInputs = Object.fromEntries(RATE_FIELD_NAMES.map(f => [f, fakeInput(f)]));
      resetButtons = Object.fromEntries(RATE_FIELD_NAMES.map(f => [f, fakeButton(f)]));
    },
    get innerHTML() { return `generation-${generation}`; },
    querySelectorAll(selector) {
      if (selector === '[data-field]') return Object.values(fieldInputs);
      if (selector === '[data-reset]') return Object.values(resetButtons);
      return [];
    },
    get generation() { return generation; }
  };

  const root = {
    activeElement: null,
    querySelector: sel => (sel === '#rates-panel' ? panel : null)
  };

  return { root, panel };
}

const RATES = { leaseRatePct: 7.5, loanRatePct: 6.5, adminFeeAnnual: 1020, opportunityRatePct: 4.5, sources: {} };
const RATES_STATE = { leaseRatePct: 7.5, loanRatePct: 6.5, adminFeeAnnual: 1020, opportunityRatePct: 4.5, residualPctOverride: null, deposit: 0 };

test('a re-render does not rebuild the panel, destroy, or blur the focused input', () => {
  const { root, panel } = fakeRatesRoot();

  renderRatesPanel(root, RATES_STATE, () => {}, RATES);
  assert.equal(panel.generation, 1, 'first render builds the panel once');

  const leaseInput = panel.querySelectorAll('[data-field]').find(i => i.dataset.field === 'leaseRatePct');
  root.activeElement = leaseInput;
  leaseInput.value = '7.25'; // mid-type: the user hasn't finished entering their own quote

  const next = { ...RATES_STATE, loanRatePct: 6.75 }; // a change arriving from elsewhere
  renderRatesPanel(root, next, () => {}, RATES);

  assert.equal(panel.generation, 1, 'a re-render must not tear down and rebuild the panel markup');
  assert.equal(root.activeElement, leaseInput, 'focus must survive the re-render');
  assert.equal(leaseInput.value, '7.25', 'the field being actively edited must not be overwritten mid-type');
});

test('a re-render still updates a field the user is not focused in', () => {
  const { root, panel } = fakeRatesRoot();

  renderRatesPanel(root, RATES_STATE, () => {}, RATES);
  const leaseInput = panel.querySelectorAll('[data-field]').find(i => i.dataset.field === 'leaseRatePct');
  root.activeElement = leaseInput;

  const next = { ...RATES_STATE, loanRatePct: 6.75 };
  renderRatesPanel(root, next, () => {}, RATES);

  const loanInput = panel.querySelectorAll('[data-field]').find(i => i.dataset.field === 'loanRatePct');
  assert.equal(loanInput.value, '6.75', 'a non-focused field must still reflect a state change from elsewhere');
});

test('the reset button still resets a field and never writes undefined into state', () => {
  const { root, panel } = fakeRatesRoot();
  let received = null;

  renderRatesPanel(root, { ...RATES_STATE, leaseRatePct: 9.9 }, next => { received = next; }, RATES);

  const resetButton = panel.querySelectorAll('[data-reset]').find(b => b.dataset.reset === 'leaseRatePct');
  resetButton.click();

  assert.equal(received.leaseRatePct, 7.5, 'reset restores the researched default');

  // No `rates` supplied: the researched-default fields have nothing to
  // reset to, so the guard must refuse to write `undefined` into state.
  renderRatesPanel(root, RATES_STATE, next => { received = next; }, null);
  received = null;
  const resetButtonNoRates = panel.querySelectorAll('[data-reset]').find(b => b.dataset.reset === 'leaseRatePct');
  resetButtonNoRates.click();

  assert.equal(received, null, 'resetting a field with no known default must not call onChange with undefined');
});

// The headline had the same double-count as valueRatio did: it paired the
// --- Step 2 stops knowing about cars --------------------------------------
// The verdict now answers "how much car does each way of paying reach at this
// budget", not "which option is cheapest for this particular car". That is
// what makes the three numbers comparable: they are all dollars of car, where
// the old totals each described a different vehicle.

const capacityProfile = {
  consumptionKwhPer100km: 16.1,
  insuranceAnnual: 1900,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
};

test('the verdict reports a maximum spend for each option', () => {
  const v = verdictAt({ budgetMonthly: 1200, inputs, profile: capacityProfile }, tables);
  for (const option of ['novated', 'loan', 'upfront']) {
    assert.equal(typeof v.options[option].maxSpend, 'number');
  }
});

test('the winner is the option that buys the most car', () => {
  const v = verdictAt({ budgetMonthly: 1200, inputs, profile: capacityProfile }, tables);
  const best = ['novated', 'loan', 'upfront']
    .reduce((a, b) => (v.options[b].maxSpend > v.options[a].maxSpend ? b : a));
  assert.equal(v.winner, best);
  assert.equal(v.maxSpend, v.options[best].maxSpend);
});

test('the verdict names no car — that is step 3\'s job', () => {
  const v = verdictAt({ budgetMonthly: 1200, inputs, profile: capacityProfile }, tables);
  assert.equal(v.vehicle, undefined);
});

test('an option that can reach nothing reports zero and a blocker', () => {
  const broke = { ...inputs, savings: 0 };
  const v = verdictAt({ budgetMonthly: 300, inputs: broke, profile: capacityProfile }, tables);
  assert.equal(v.options.upfront.maxSpend, 0);
  assert.equal(v.options.upfront.blocker.kind, 'savings');
});

test('no winner when nothing at all is affordable', () => {
  const broke = { ...inputs, savings: 0 };
  const v = verdictAt({ budgetMonthly: 1, inputs: broke, profile: capacityProfile }, tables);
  assert.equal(v.winner, null);
});

// Cash is bounded by savings, not by budget, so at a low budget it legitimately
// buys the most car and is allowed to win.
test('cash can win at a low budget when savings outreach the monthly figure', () => {
  const funded = { ...inputs, savings: 60000 };
  const v = verdictAt({ budgetMonthly: 400, inputs: funded, profile: capacityProfile }, tables);
  assert.equal(v.winner, 'upfront');
  assert.ok(v.maxSpend > 50000);
});

test('renderVerdict states the ceiling and the option that sets it', () => {
  const v = verdictAt({ budgetMonthly: 1200, inputs, profile: capacityProfile }, tables);
  let html = '';
  const panel = { set innerHTML(value) { html = value; }, get innerHTML() { return html; } };
  renderVerdict({ querySelector: sel => (sel === '#verdict' ? panel : null) }, v);
  assert.ok(/up to/i.test(html), 'expected the ceiling phrased as a maximum');
  assert.ok(html.includes('Novated lease'));
});
