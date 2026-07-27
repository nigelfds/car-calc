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

test('a workable budget produces a winner and a vehicle', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1000, inputs }, tables);
  assert.ok(v.winner);
  assert.ok(v.vehicle);
});

test('a budget too small for anything yields no winner', () => {
  const fleet = [vehicle('dear', 95000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 50, inputs }, tables);
  assert.equal(v.winner, null);
});

test('the winner is the option with the lowest TCO among the feasible', () => {
  const fleet = [vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs }, tables);
  const feasible = Object.values(v.options).filter(o => o.tco !== null);
  const lowest = feasible.reduce((best, cur) => (cur.tco < best.tco ? cur : best));
  assert.equal(v.winner, lowest.option);
});

test('upfront is excluded when savings cannot cover the car', () => {
  const fleet = [vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs }, tables);
  assert.equal(v.options.upfront.tco, null);
});

// --- Each option now prices the dearest car IT reaches ------------------
// Superseding the earlier "one car for all three" rule. Each tile answers
// "the most expensive car this way of paying gets you into", so the tiles
// legitimately describe different cars.
//
// The hazard that rule existed to prevent is still real and still guarded,
// two tests below: raw totals cannot be compared across different cars,
// because a cheaper car always costs less, which would crown whichever
// option is stuck shopping lowest. The winner is decided on valueRatio
// instead — resale over total cost — which is scale-free and so survives the
// comparison.

test('each option prices the dearest car it can reach, not one shared car', () => {
  const fleet = [vehicle('cheap', 42500), vehicle('dear', 88900)];
  const wideInputs = { ...inputs, grossSalary: 145000, termMonths: 60, savings: 50000 };
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs: wideInputs }, tables);

  // Cash is capped by $50k of savings so it can only reach the cheap car,
  // while financing reaches the dear one. The tiles must say so.
  assert.equal(v.options.upfront.vehicle.id, 'cheap');
  assert.equal(v.options.novated.vehicle.id, 'dear');
});

test('the winner is the best value ratio, not the smallest total', () => {
  const fleet = [vehicle('cheap', 42500), vehicle('dear', 88900)];
  const wideInputs = { ...inputs, grossSalary: 145000, termMonths: 60, savings: 50000 };
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs: wideInputs }, tables);

  const feasible = Object.values(v.options).filter(o => o.tco !== null);
  const bestRatio = feasible.reduce((best, cur) => (cur.valueRatio > best.valueRatio ? cur : best));
  assert.equal(v.winner, bestRatio.option);
});

// The specific misread that motivated all of this: cash is capped by savings
// to a cheap car, so its total can be the smallest of the three while being
// the worst deal going. A lowest-total rule crowns it; the ratio must not.
// The two cars need different depreciation curves for the inversion to bite —
// with one shared curve, resale scales with price and the effect vanishes.
test('an option stuck on a cheaper car does not win merely for costing less', () => {
  const withCurve = (id, listPrice, depreciationCurve) =>
    ({ ...vehicle(id, listPrice), depreciationCurve });
  const fleet = [
    withCurve('cheap', 46080, [1, 0.55, 0.4, 0.3, 0.22, 0.16]),  // holds value badly
    withCurve('dear', 100000, [1, 0.85, 0.78, 0.72, 0.66, 0.6])  // holds value well
  ];
  const wideInputs = { ...inputs, grossSalary: 100000, termMonths: 60, savings: 50000 };
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 3500, inputs: wideInputs }, tables);

  const cash = v.options.upfront;
  assert.equal(cash.vehicle.id, 'cheap', 'cash is capped by savings to the cheap car');
  assert.ok(cash.tco < v.options.novated.tco, 'and its total really is the smaller number');
  assert.ok(cash.valueRatio < v.options.novated.valueRatio, 'but it retains far less of it');
  assert.notEqual(v.winner, 'upfront', 'costing less on a worse car must not win');
});

test('the headline vehicle is the winning option\'s car', () => {
  const fleet = [vehicle('cheap', 42500), vehicle('dear', 88900)];
  const wideInputs = { ...inputs, grossSalary: 145000, termMonths: 60, savings: 50000 };
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs: wideInputs }, tables);
  assert.equal(v.vehicle.id, v.options[v.winner].vehicle.id);
});

test('an option infeasible for the chosen car renders as unreachable, never as the winner', () => {
  // A single, expensive vehicle: upfront can't be funded by savings, so it
  // must never win and must never carry a numeric tco.
  const fleet = [vehicle('dear', 88900)];
  const tightSavings = { ...inputs, savings: 5000, grossSalary: 145000, termMonths: 60 };
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 2000, inputs: tightSavings }, tables);

  assert.equal(v.options.upfront.tco, null);
  assert.notEqual(v.winner, 'upfront');
  if (v.winner) assert.equal(v.options[v.winner].vehicle.id, v.vehicle.id);
});

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

// --- Naming the lever on an out-of-reach option --------------------------
// All three tiles used to read a bare "out of reach", which hid that the
// fixes differ: a lease or loan needs a bigger monthly budget, cash needs
// the whole drive-away price in savings.

test('a blocked option carries why it is blocked, not just a null total', () => {
  const fleet = [vehicle('cheap', 40000)];
  // Savings well under the car: cash is blocked, financing is not.
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs: { ...inputs, savings: 1000 } }, tables);
  assert.equal(v.options.upfront.tco, null, 'cash is out of reach on these savings');
  assert.equal(v.options.upfront.blocker.kind, 'savings');
  assert.ok(v.options.upfront.blocker.needed > 40000, 'it should quote the drive-away price, not the list price');
});

test('an option blocked by the monthly budget says so', () => {
  const fleet = [vehicle('cheap', 40000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 100000, inputs }, tables);
  // Everything is reachable at an absurd budget, so nothing carries a blocker.
  assert.equal(v.options.loan.blocker, null);
  assert.equal(v.options.novated.blocker, null);
});

test('renderVerdict prints the lever beside an out-of-reach option', () => {
  const fleet = [vehicle('cheap', 40000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs: { ...inputs, savings: 1000 } }, tables);

  let html = '';
  const panel = { set innerHTML(value) { html = value; }, get innerHTML() { return html; } };
  renderVerdict({ querySelector: sel => (sel === '#verdict' ? panel : null) }, v);

  assert.ok(html.includes('out of reach'), 'the blocked option still reads out of reach');
  assert.ok(html.includes('saved'), `expected a savings lever in the markup, got: ${html}`);
  assert.ok(html.includes('total__blocker'), 'expected the blocker to be its own element');
});

// --- The residual balloon -------------------------------------------------
// A novated lease ends with a lump-sum residual. It is inside the total cost,
// but a total is not a cash-flow warning: the affordability test only checks
// the monthly figure, so a budget that comfortably covers the payments can
// still leave a five-figure bill due on the last day of the term.

test('the novated option reports the balloon due at the end of the term', () => {
  const fleet = [vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1500, inputs }, tables);
  assert.ok(v.options.novated.balloon > 0, 'the residual must be reported, not buried in the total');
  assert.equal(v.options.novated.balloon, v.options.novated.detail.residual);
});

test('the balloon is flagged when the car will not be worth enough to cover it', () => {
  // A car that holds value badly: selling it at the end leaves a shortfall
  // the driver has to find in cash.
  const sinker = {
    ...vehicle('sinker', 56000),
    depreciationCurve: [1, 0.4, 0.28, 0.2, 0.15, 0.1]
  };
  const v = verdictAt({ vehicles: [sinker], budgetMonthly: 1500, inputs }, tables);
  const novated = v.options.novated;
  assert.ok(novated.detail.resale < novated.balloon, 'this fixture must actually be underwater');
  assert.equal(novated.balloonCovered, false);
});

test('a car that holds its value covers its own balloon', () => {
  const holder = {
    ...vehicle('holder', 56000),
    depreciationCurve: [1, 0.95, 0.92, 0.9, 0.88, 0.85]
  };
  const v = verdictAt({ vehicles: [holder], budgetMonthly: 1500, inputs }, tables);
  const novated = v.options.novated;
  assert.ok(novated.detail.resale > novated.balloon, 'this fixture must actually be above water');
  assert.equal(novated.balloonCovered, true);
});

test('renderVerdict shows the balloon on the novated tile', () => {
  const fleet = [vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1500, inputs }, tables);
  let html = '';
  const panel = { set innerHTML(value) { html = value; }, get innerHTML() { return html; } };
  renderVerdict({ querySelector: sel => (sel === '#verdict' ? panel : null) }, v);
  assert.ok(/balloon/i.test(html), `expected the balloon named in the tile, got: ${html}`);
});

test('non-novated options carry no balloon', () => {
  const fleet = [vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1500, inputs: { ...inputs, savings: 200000 } }, tables);
  assert.equal(v.options.loan.balloon, null);
  assert.equal(v.options.upfront.balloon, null);
});

// The headline had the same double-count as valueRatio did: it paired the
// NET total with the resale, which reads as though you finished ahead.
test('the headline separates money out of pocket from what you still hold', () => {
  const fleet = [vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1500, inputs }, tables);
  let html = '';
  const panel = { set innerHTML(value) { html = value; }, get innerHTML() { return html; } };
  renderVerdict({ querySelector: sel => (sel === '#verdict' ? panel : null) }, v);

  const winner = v.options[v.winner];
  assert.ok(winner.detail.grossOutlay > winner.tco, 'gross must exceed net for this fixture');
  assert.ok(html.includes('out of pocket'), 'the gross figure must be labelled as money spent');
  assert.ok(html.includes('net cost'), 'and the net figure labelled as net');
});
