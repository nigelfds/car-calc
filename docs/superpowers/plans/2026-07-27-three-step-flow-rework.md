# Three-Step Flow Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the app into three honest steps — step 1 gathers who you are and what you want in a car, step 2 works out how much car your money can buy, step 3 shows the actual cars at that ceiling and what each way of paying costs for them.

**Architecture:** The central change is that **step 2 stops knowing about cars**. Today `crossoverSeries` plots the total cost of a *different car per funding option* at each budget, which is not a comparison at all — a cheaper car always costs less. Replacing it with **purchasing power** (the dearest car price each option can support at a given monthly budget) removes cars from step 2 entirely, makes the FBT cliff appear as the literal shape of the novated line, and hands step 3 a single number to anchor on: the winning option's maximum spend. Step 3 then does all the car work — filtering by stated preferences, and pricing each candidate under all three funding options.

**Tech Stack:** Native ES modules, no bundler, no framework. `node --test` for tests. `calc/` is the pure core, imported unchanged by both Node and the browser. Express serves `public/`.

## Global Constraints

- No bundler, no build step, no new dependencies. `calc/` stays pure — no file reads, no clock, no network.
- Every `calc/` function must be deterministic: same inputs always produce the same output.
- Tests run under `node --test` with no DOM. `renderChart`/`renderVerdict`/`renderCards` are exercised against plain objects that expose only `querySelector`/`innerHTML`, so no rendering code may assume a real DOM node, event API, `DOMPoint`, or `getScreenCTM`.
- Money is rendered through `public/ui/format.js`'s `money()`. Never hand-format currency.
- `listPrice` is always the manufacturer list price before on-road costs. `calc/onroad.js` adds VIC stamp duty and registration.
- Gross outlay is what leaves your pocket; TCO is `grossOutlay - resale`. Any ratio across options divides by gross, never by net (see `valueRatio`).
- SVG font sizes are viewBox units, not pixels. The chart's viewBox renders at roughly 0.8 scale, so a size set here appears ~20% smaller on screen.
- The existing pre-push hook runs the full suite; every task ends green.
- Run `npm test` after every task. The suite is at 308 tests before this plan begins.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `calc/capacity.js` | **New.** Purchasing power: how much car each funding option supports at a given monthly budget. | Create |
| `calc/capacity.test.js` | Tests for the above. | Create |
| `calc/compare.js` | Option costing. Loses `crossoverSeries` (superseded) and `optionEntryPoint` (moves to capacity). | Modify |
| `calc/rank.js` | Shortlist scoring and price bracketing. `bracketAroundPrice` gains a configurable band distribution. | Modify |
| `public/ui/slider.js` | `verdictAt` becomes capacity-based; verdict panel reports max spend per option. | Modify |
| `public/ui/crossover-chart.js` | Plots purchasing power instead of TCO. Keeps markers, wrapping, tooltips. | Modify |
| `public/ui/cars.js` | Card model gains per-option TCO, value-retained ratio, and the lease balloon disclosure. | Modify |
| `public/ui/sections.js` | `renderInputs` gains checkbox support for the body-type filter. | Modify |
| `public/index.html` | Step 1 gains preference controls and loses the budget input. | Modify |
| `public/styles.css` | Styles for the preference controls, the per-card cost table and the balloon note. | Modify |

---

## Task 1: Purchasing power in the pure core

**Files:**
- Create: `calc/capacity.js`, `calc/capacity.test.js`
- Modify: `calc/compare.js` (move `optionEntryPoint` out)

**Interfaces:**
- Consumes: `optionCosts({ vehicle, inputs }, tables)` from `calc/compare.js`
- Produces:
  - `representativeProfile(vehicles) -> { consumptionKwhPer100km, insuranceAnnual, depreciationCurve }`
  - `maxAffordablePrice({ budgetMonthly, option, inputs, profile }, tables) -> number`
  - `purchasingPowerSeries({ inputs, profile, budgetRange }, tables) -> { points: [{ budget, novated, loan, upfront }], crossovers: [{ budget, from, to }] }`

Why a profile: running costs depend on a car's consumption and insurance, so "how much car can I afford" is not perfectly car-free. Using dataset medians makes the curve describe a *typical* EV rather than any specific one, which is the honest way to keep cars out of step 2. The assumption is stated in the UI in Task 5.

- [ ] **Step 1: Write the failing tests**

Create `calc/capacity.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { representativeProfile, maxAffordablePrice, purchasingPowerSeries } from './capacity.js';
import { optionCosts } from './compare.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));

const inputs = {
  grossSalary: 145000, savings: 50000, termMonths: 60, annualKm: 15000,
  leaseStartDate: '2026-07-25', deposit: 0, leaseRatePct: 7.5, loanRatePct: 6.5,
  opportunityRatePct: 4.5, adminFeeAnnual: 1020,
  electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240, residualPctOverride: null
};

const profile = { consumptionKwhPer100km: 16.1, insuranceAnnual: 1900, depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47] };

test('the representative profile is the median of the fleet', () => {
  const fleet = [
    { consumptionKwhPer100km: 14, insuranceAnnual: 1000 },
    { consumptionKwhPer100km: 16, insuranceAnnual: 2000 },
    { consumptionKwhPer100km: 20, insuranceAnnual: 3000 }
  ];
  const got = representativeProfile(fleet);
  assert.equal(got.consumptionKwhPer100km, 16);
  assert.equal(got.insuranceAnnual, 2000);
  assert.ok(Array.isArray(got.depreciationCurve), 'a curve is needed to cost a probe car');
});

test('an empty fleet still yields a usable profile rather than NaN', () => {
  const got = representativeProfile([]);
  assert.ok(got.consumptionKwhPer100km > 0);
  assert.ok(got.insuranceAnnual > 0);
});

test('a bigger budget supports a dearer car on a loan', () => {
  const small = maxAffordablePrice({ budgetMonthly: 700, option: 'loan', inputs, profile }, tables);
  const large = maxAffordablePrice({ budgetMonthly: 1400, option: 'loan', inputs, profile }, tables);
  assert.ok(large > small);
});

// The solver's answer must be a real boundary, not just a number: the price
// it returns has to be affordable, and a step above it must not be.
test('the price returned is affordable and a step above it is not', () => {
  const budget = 900;
  const max = maxAffordablePrice({ budgetMonthly: budget, option: 'loan', inputs, profile }, tables);
  assert.ok(max > 0);

  const monthlyAt = price => {
    const vehicle = { id: 'probe', listPrice: price, ...profile };
    return optionCosts({ vehicle, inputs }, tables).loan.monthlyCost;
  };
  assert.ok(monthlyAt(max) <= budget, 'the returned price must actually fit the budget');
  assert.ok(monthlyAt(max + 500) > budget, 'and $500 more must not');
});

// Cash is bounded by savings, not by the monthly budget, so its capacity is
// a horizontal line — this is the single clearest thing the new chart shows.
test('cash capacity does not move with the monthly budget', () => {
  const low = maxAffordablePrice({ budgetMonthly: 400, option: 'upfront', inputs, profile }, tables);
  const high = maxAffordablePrice({ budgetMonthly: 2700, option: 'upfront', inputs, profile }, tables);
  assert.ok(Math.abs(low - high) < 1, 'savings, not budget, is the constraint');
  assert.ok(low > 40000 && low < 50000, `expected roughly the savings ceiling, got ${low}`);
});

// Above the LCT threshold a novated lease loses its FBT exemption outright,
// so its monthly cost roughly doubles. Capacity therefore stops dead at the
// threshold and stays there until the budget can absorb the unexempted cost.
test('novated capacity plateaus at the FBT threshold', () => {
  const atPlateau = maxAffordablePrice({ budgetMonthly: 1400, option: 'novated', inputs, profile }, tables);
  const wayAbove = maxAffordablePrice({ budgetMonthly: 2200, option: 'novated', inputs, profile }, tables);
  assert.ok(Math.abs(atPlateau - tables.lct.fuelEfficientThreshold) < 200,
    `expected the plateau at the threshold, got ${atPlateau}`);
  assert.equal(atPlateau, wayAbove, 'the plateau holds until the budget clears the unexempted cost');
});

test('a budget too small for anything yields zero capacity', () => {
  const none = maxAffordablePrice({ budgetMonthly: 1, option: 'loan', inputs, profile }, tables);
  assert.ok(none < 1000, `expected effectively nothing, got ${none}`);
});

test('the series produces one point per budget step, with all three options', () => {
  const series = purchasingPowerSeries(
    { inputs, profile, budgetRange: { min: 300, max: 1300, step: 100 } }, tables
  );
  assert.equal(series.points.length, 11);
  for (const point of series.points) {
    assert.ok('budget' in point && 'novated' in point && 'loan' in point && 'upfront' in point);
  }
});

// The meaningful crossover under this model: the budget at which a loan
// starts buying MORE car than a lease capped by the FBT cliff.
test('a crossover is reported where the leading option changes', () => {
  const series = purchasingPowerSeries(
    { inputs, profile, budgetRange: { min: 300, max: 2700, step: 100 } }, tables
  );
  assert.ok(series.crossovers.length > 0, 'loan should overtake novated somewhere in this range');
  for (const crossover of series.crossovers) {
    assert.notEqual(crossover.from, crossover.to);
    assert.ok(crossover.budget >= 300 && crossover.budget <= 2700);
  }
});

test('the leader at a budget is the option supporting the dearest car', () => {
  const series = purchasingPowerSeries(
    { inputs, profile, budgetRange: { min: 900, max: 900, step: 100 } }, tables
  );
  const point = series.points[0];
  const best = ['novated', 'loan', 'upfront'].reduce((a, b) => (point[b] > point[a] ? b : a));
  assert.equal(best, 'novated', 'at $900/mo on this salary the lease buys the most car');
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: failures — `calc/capacity.js` does not exist.

- [ ] **Step 3: Implement `calc/capacity.js`**

```js
import { optionCosts } from './compare.js';

const OPTIONS = ['novated', 'loan', 'upfront'];

// Fallbacks for an empty fleet, so a caller with no data still gets a usable
// curve instead of NaN. Mid-range values for an Australian EV.
const FALLBACK_PROFILE = {
  consumptionKwhPer100km: 16,
  insuranceAnnual: 1800,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
};

const median = numbers => {
  const sorted = [...numbers].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length / 2)];
};

// Running costs depend on a car's consumption and insurance, so "how much car
// can I afford" is not perfectly car-independent. Medians make the answer
// describe a typical EV rather than any particular one, which is what keeps
// step 2 free of specific cars. The UI states the assumption.
export function representativeProfile(vehicles = []) {
  return {
    consumptionKwhPer100km:
      median(vehicles.map(v => v.consumptionKwhPer100km)) ?? FALLBACK_PROFILE.consumptionKwhPer100km,
    insuranceAnnual:
      median(vehicles.map(v => v.insuranceAnnual)) ?? FALLBACK_PROFILE.insuranceAnnual,
    depreciationCurve: FALLBACK_PROFILE.depreciationCurve
  };
}

// Widest price the solver will consider. Above the dataset's dearest car by a
// margin, so a very large budget still reports a real ceiling rather than
// silently pinning to the top of the range.
const SEARCH_CEILING = 250000;
const SEARCH_ITERATIONS = 40; // 250000 / 2^40 is far below $1

// The dearest list price this option supports at this budget. Monthly cost is
// monotonic in price for all three options, so a bisection is exact to within
// the tolerance and costs 40 evaluations rather than scanning.
export function maxAffordablePrice({ budgetMonthly, option, inputs, profile }, tables) {
  const affordable = price => {
    if (price <= 0) return true;
    const vehicle = { id: 'probe', listPrice: price, ...profile };
    const costs = optionCosts({ vehicle, inputs }, tables)[option];
    return costs.feasible && costs.monthlyCost <= budgetMonthly;
  };

  if (!affordable(1)) return 0;

  let low = 1;
  let high = SEARCH_CEILING;
  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (affordable(mid)) low = mid; else high = mid;
  }
  return low;
}

export function purchasingPowerSeries({ inputs, profile, budgetRange }, tables) {
  const { min, max, step } = budgetRange;
  const stepCount = Math.round((max - min) / step) + 1;
  const points = [];

  for (let i = 0; i < stepCount; i++) {
    const budget = min + i * step;
    const point = { budget };
    for (const option of OPTIONS) {
      point[option] = maxAffordablePrice({ budgetMonthly: budget, option, inputs, profile }, tables);
    }
    points.push(point);
  }

  // The leader is whichever option buys the MOST car — the opposite direction
  // to the old cost-based series, where lower won.
  const leaderAt = point => {
    const reachable = OPTIONS.filter(option => point[option] > 0);
    if (reachable.length === 0) return null;
    return reachable.reduce((best, cur) => (point[cur] > point[best] ? cur : best));
  };

  const crossovers = [];
  for (let i = 1; i < points.length; i++) {
    const previous = leaderAt(points[i - 1]);
    const current = leaderAt(points[i]);
    if (previous && current && previous !== current) {
      crossovers.push({ budget: points[i].budget, from: previous, to: current });
    }
  }

  return { points, crossovers };
}
```

- [ ] **Step 4: Move `optionEntryPoint` from `calc/compare.js` into `calc/capacity.js`**

It belongs with capacity, not with costing. Cut the function and its comment block from `calc/compare.js`, paste into `calc/capacity.js`, and update the import in `public/ui/app.js` from `'../../calc/compare.js'` to `'../../calc/capacity.js'`. Move its six tests from `calc/compare.test.js` to `calc/capacity.test.js`, adjusting the import line.

- [ ] **Step 5: Run the tests**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"`
Expected: PASS, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add calc/capacity.js calc/capacity.test.js calc/compare.js calc/compare.test.js public/ui/app.js
git commit -m "feat: add purchasing-power capacity model to the pure core"
```

---

## Task 2: Capacity-based verdict

**Files:**
- Modify: `public/ui/slider.js` (`verdictAt`, `renderVerdict`)
- Test: `public/ui/slider.test.js`

**Interfaces:**
- Consumes: `maxAffordablePrice`, `representativeProfile` (Task 1)
- Produces: `verdictAt({ budgetMonthly, inputs, profile }, tables) -> { winner, maxSpend, options: { [option]: { option, maxSpend, blocker } } }`

The verdict no longer names a car. It answers "how much car can each way of paying get me, and which gets me the most". `maxSpend` is the number step 3 anchors on. `vehicles` is no longer a parameter — that is the whole point of the change.

- [ ] **Step 1: Write the failing tests**

Add to `public/ui/slider.test.js`:

```js
const profile = { consumptionKwhPer100km: 16.1, insuranceAnnual: 1900, depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47] };

test('the verdict reports a maximum spend for each option', () => {
  const v = verdictAt({ budgetMonthly: 1200, inputs, profile }, tables);
  for (const option of ['novated', 'loan', 'upfront']) {
    assert.ok(typeof v.options[option].maxSpend === 'number');
  }
});

test('the winner is the option that buys the most car', () => {
  const v = verdictAt({ budgetMonthly: 1200, inputs, profile }, tables);
  const best = ['novated', 'loan', 'upfront']
    .reduce((a, b) => (v.options[b].maxSpend > v.options[a].maxSpend ? b : a));
  assert.equal(v.winner, best);
  assert.equal(v.maxSpend, v.options[best].maxSpend);
});

test('the verdict names no car — that is step 3\'s job', () => {
  const v = verdictAt({ budgetMonthly: 1200, inputs, profile }, tables);
  assert.equal(v.vehicle, undefined);
});

test('an option that can reach nothing reports zero and a blocker', () => {
  const broke = { ...inputs, savings: 0 };
  const v = verdictAt({ budgetMonthly: 300, inputs: broke, profile }, tables);
  assert.equal(v.options.upfront.maxSpend, 0);
  assert.equal(v.options.upfront.blocker.kind, 'savings');
});

test('no winner when nothing at all is affordable', () => {
  const broke = { ...inputs, savings: 0 };
  const v = verdictAt({ budgetMonthly: 1, inputs: broke, profile }, tables);
  assert.equal(v.winner, null);
});

test('renderVerdict states the ceiling and the option that sets it', () => {
  const v = verdictAt({ budgetMonthly: 1200, inputs, profile }, tables);
  let html = '';
  const panel = { set innerHTML(value) { html = value; }, get innerHTML() { return html; } };
  renderVerdict({ querySelector: sel => (sel === '#verdict' ? panel : null) }, v);
  assert.ok(/up to/i.test(html), 'expected the ceiling phrased as a maximum');
  assert.ok(html.includes('Novated lease'));
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test 2>&1 | grep -E "not ok" | head`
Expected: failures on the new tests.

- [ ] **Step 3: Rewrite `verdictAt` in `public/ui/slider.js`**

Replace the whole existing `verdictAt` (and delete the now-unused `reachableVehicle`/`reachableVehicles`/`rankVehicles` imports in this file) with:

```js
// Step 2 answers one question: how much car will each way of paying get me at
// this budget? No car is named here — that is step 3's job. Keeping cars out
// is what makes the three numbers comparable: they are all "dollars of car",
// where the old total-cost figures each described a different vehicle.
export function verdictAt({ budgetMonthly, inputs, profile }, tables) {
  const options = {};
  let best = null;

  for (const option of OPTIONS) {
    const maxSpend = maxAffordablePrice({ budgetMonthly, option, inputs, profile }, tables);
    // A probe car at the cheapest plausible price tells us which lever is
    // stopping an option that can reach nothing.
    const probe = { id: 'probe', listPrice: 30000, ...profile };
    const costs = optionCosts({ vehicle: probe, inputs }, tables)[option];
    options[option] = {
      option,
      maxSpend,
      blocker: maxSpend > 0 ? null : optionBlocker(costs, budgetMonthly)
    };
    if (maxSpend > 0 && (best === null || maxSpend > options[best].maxSpend)) best = option;
  }

  return { winner: best, maxSpend: best ? options[best].maxSpend : 0, options };
}
```

- [ ] **Step 4: Rewrite `renderVerdict`'s markup**

Replace the winner/detail/totals block with:

```js
  const winner = verdict.options[verdict.winner];
  const labels = { novated: 'Novated lease', loan: 'Direct loan', upfront: 'Buy upfront' };

  panel.innerHTML = `
    <div class="winner">🏆 ${labels[verdict.winner]} — up to ${money(winner.maxSpend)}</div>
    <div class="detail">That is the most car this budget reaches. The cars themselves are below.</div>
    <div class="totals">${OPTIONS.map(o => {
      const entry = verdict.options[o];
      if (entry.maxSpend <= 0) {
        return `<div class="total">
          <span>${labels[o]}</span>
          <strong>out of reach</strong>
          ${entry.blocker ? `<span class="total__blocker">${blockerText(entry.blocker)}</span>` : ''}
        </div>`;
      }
      return `<div class="total${o === verdict.winner ? ' is-winner' : ''}">
        <span>${labels[o]}</span>
        <strong>${money(entry.maxSpend)}</strong>
        <span class="total__reach">most expensive car this way of paying reaches</span>
      </div>`;
    }).join('')}</div>`;
```

- [ ] **Step 5: Update `public/ui/app.js`'s call site**

```js
const profile = representativeProfile(vehicles);
// ...inside render():
const verdict = salaryReady
  ? verdictAt({ budgetMonthly: state.monthlyBudget, inputs, profile }, tables)
  : { winner: null, maxSpend: 0, options: {}, insufficientInput: true };
```

Update `renderSummaryBar` to use `money(winner.maxSpend)` instead of `money(winner.tco)`, and drop its `verdict.vehicle.make/model` reference.

- [ ] **Step 6: Run the tests**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"`
Expected: PASS. Several old `verdictAt` tests will fail because they pass `vehicles` and assert on `tco`/`valueRatio`/`balloon`. Delete the ones asserting the old car-picking contract; keep and adapt the blocker tests.

- [ ] **Step 7: Commit**

```bash
git add public/ui/slider.js public/ui/slider.test.js public/ui/app.js
git commit -m "feat: verdict reports purchasing power per option instead of a car"
```

---

## Task 3: Step 1 preference controls

**Files:**
- Modify: `public/index.html`, `public/ui/sections.js`, `public/styles.css`
- Test: `public/ui/sections.test.js`

**Interfaces:**
- Produces: working `bodyTypes` / `minBootLitres` / `seats` / `minRangeKm` controls writing into the same state fields `filterVehicles` already reads.

These four fields already exist in state and already drive `filterVehicles`, but have **no UI** — today they are only settable through the free-text parse, so "an SUV with a big boot" silently does nothing when `ANTHROPIC_API_KEY` is unset. `renderInputs` also has no checkbox support, which `bodyTypes` needs.

- [ ] **Step 1: Write the failing test**

Add to `public/ui/sections.test.js`:

```js
test('a checked body-type box adds to the bodyTypes array', () => {
  const state = { ...base, bodyTypes: [] };
  const box = {
    dataset: { field: 'bodyTypes', value: 'SUV' },
    type: 'checkbox', checked: true, value: 'SUV',
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    fire() { this.listeners.change?.(); }
  };
  let next = null;
  const root = { querySelectorAll: () => [box], activeElement: null };
  renderInputs(root, () => state, s => { next = s; });
  box.fire();
  assert.deepEqual(next.bodyTypes, ['SUV']);
});

test('unchecking removes that body type and leaves the others', () => {
  const state = { ...base, bodyTypes: ['SUV', 'Hatch'] };
  const box = {
    dataset: { field: 'bodyTypes', value: 'SUV' },
    type: 'checkbox', checked: false, value: 'SUV',
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    fire() { this.listeners.change?.(); }
  };
  let next = null;
  renderInputs({ querySelectorAll: () => [box], activeElement: null }, () => state, s => { next = s; });
  box.fire();
  assert.deepEqual(next.bodyTypes, ['Hatch']);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test 2>&1 | grep "not ok" | head`
Expected: failure — `renderInputs` binds `input` events and reads `.value`, so a checkbox never updates the array.

- [ ] **Step 3: Add checkbox support to `renderInputs`**

In `public/ui/sections.js`, inside the `for (const input of ...)` loop, before the existing `input` listener:

```js
    // Checkboxes carry their own value in data-value and toggle membership of
    // an array field, rather than replacing a scalar. They also fire `change`,
    // not `input`, when driven by the keyboard.
    if (input.type === 'checkbox') {
      const member = input.dataset.value;
      input.checked = (getState()[field] ?? []).includes(member);
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
```

- [ ] **Step 4: Add the controls to `public/index.html`**

Replace the monthly-budget field in section 1 (it moves to step 2 entirely) with a preferences group, placed after `annualKm`:

```html
        <fieldset class="field field--group">
          <legend>Body type</legend>
          <div class="checkbox-row">
            <label class="checkbox"><input type="checkbox" data-field="bodyTypes" data-value="SUV" /> SUV</label>
            <label class="checkbox"><input type="checkbox" data-field="bodyTypes" data-value="Sedan" /> Sedan</label>
            <label class="checkbox"><input type="checkbox" data-field="bodyTypes" data-value="Hatch" /> Hatch</label>
            <label class="checkbox"><input type="checkbox" data-field="bodyTypes" data-value="Wagon" /> Wagon</label>
            <label class="checkbox"><input type="checkbox" data-field="bodyTypes" data-value="Ute" /> Ute</label>
          </div>
          <p class="field__hint">Leave all unticked to consider every body type.</p>
        </fieldset>

        <div class="field">
          <label for="minBootLitres">Minimum boot space</label>
          <div class="field__input">
            <input type="number" id="minBootLitres" name="minBootLitres" data-field="minBootLitres"
              min="0" step="10" inputmode="numeric" placeholder="any" />
            <span class="field__suffix" aria-hidden="true">L</span>
          </div>
          <p class="field__hint">Seats up. A large dog crate needs roughly 500L.</p>
        </div>

        <div class="field">
          <label for="seats">Minimum seats</label>
          <select id="seats" name="seats" data-field="seats">
            <option value="">Any</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
            <option value="7">7+</option>
          </select>
        </div>

        <div class="field">
          <label for="minRangeKm">Minimum range</label>
          <div class="field__input">
            <input type="number" id="minRangeKm" name="minRangeKm" data-field="minRangeKm"
              min="0" step="25" inputmode="numeric" placeholder="any" />
            <span class="field__suffix" aria-hidden="true">km</span>
          </div>
        </div>
```

Delete the whole `<div class="field">` block containing `id="monthlyBudget"`.

- [ ] **Step 5: Style the new controls**

Add to `public/styles.css`:

```css
.field--group { border: none; padding: 0; margin: 0; }
.field--group legend {
  padding: 0;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ink-soft);
  margin-bottom: var(--space-2);
}

.checkbox-row { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); }

.checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.85rem;
  color: var(--ink);
}

.checkbox input { width: auto; }

.field__suffix {
  padding-right: 0.7em;
  color: var(--ink-faint);
  font-size: 0.85rem;
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"`
Expected: PASS.

- [ ] **Step 7: Verify in a browser**

Run `npm start`, open `http://localhost:3000`, tick "SUV", set minimum boot to 500. Section 3 must narrow to SUVs with a 500L+ boot. Confirm the step 1 budget input is gone and the slider still drives everything.

- [ ] **Step 8: Commit**

```bash
git add public/index.html public/ui/sections.js public/ui/sections.test.js public/styles.css
git commit -m "feat: real preference controls in step 1, budget owned by the slider"
```

---

## Task 4: The purchasing-power chart

**Files:**
- Modify: `public/ui/crossover-chart.js`, `public/ui/app.js`, `public/styles.css`
- Test: `public/ui/crossover-chart.test.js`

**Interfaces:**
- Consumes: `purchasingPowerSeries` (Task 1)
- Produces: `renderChart(root, series, budgetMonthly, cliff, entry)` — unchanged signature, new meaning for the y axis.

The plotting code is almost entirely reusable: `toSegments`, `layoutEndLabels`, the markers, the tooltips and the wrapping all work on any `{ points: [{ budget, novated, loan, upfront }] }`. What changes is the y-axis meaning, its label, and the direction of "better".

- [ ] **Step 1: Write the failing tests**

```js
const capacitySeries = {
  points: [
    { budget: 300, novated: 12000, loan: 0, upfront: 47140 },
    { budget: 900, novated: 67342, loan: 27701, upfront: 47140 },
    { budget: 1500, novated: 91661, loan: 56000, upfront: 47140 },
    { budget: 2700, novated: 91661, loan: 115989, upfront: 47140 }
  ],
  crossovers: [{ budget: 2700, from: 'novated', to: 'loan' }]
};

test('the y axis is labelled as car price, not as cost', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, capacitySeries, 900);
    const html = getHtml();
    assert.ok(/most expensive car/i.test(html), 'the axis must name what it measures');
    assert.ok(!/total cost over the term/i.test(html), 'the old cost axis label must be gone');
  });
});

test('a zero-capacity point breaks the line rather than plotting zero', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, capacitySeries, 900);
    // The loan cannot reach anything at $300, which must read as a gap, not
    // as "a loan buys you a $0 car".
    const loanPoints = /class="line line-loan"[^>]*points="([^"]+)"/.exec(getHtml());
    assert.ok(loanPoints, 'expected a loan polyline');
    assert.ok(!loanPoints[1].includes('0.0,'), 'zero capacity must not be plotted as a point');
  });
});

test('the accessible description explains the axes in capacity terms', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, capacitySeries, 900);
    assert.ok(/how much car/i.test(getHtml()));
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test 2>&1 | grep "not ok" | head`

- [ ] **Step 3: Treat zero capacity as a gap**

In `public/ui/crossover-chart.js`, in both `bounds` and `toSegments`, a capacity of `0` means "cannot reach anything", exactly as `null` meant before. Normalise at the top of `renderChart`:

```js
// A capacity of 0 is "this way of paying reaches nothing here", which must
// break the line the way a null did in the old cost series — a plotted zero
// reads as "a free car".
const withGaps = {
  ...series,
  points: series.points.map(point => ({
    ...point,
    novated: point.novated > 0 ? point.novated : null,
    loan: point.loan > 0 ? point.loan : null,
    upfront: point.upfront > 0 ? point.upfront : null
  }))
};
```

Pass `withGaps` to `renderLineChart` and `renderWinnerBand` in place of `series`.

- [ ] **Step 4: Flip the winner-band direction**

`toWinnerBands`'s `leaderAt` currently picks the *lowest* value. Under capacity the leader is the *highest*:

```js
    return priced.reduce((best, cur) => (point[cur] > point[best] ? cur : best));
```

- [ ] **Step 5: Relabel the axes**

```js
    <text class="axis-title axis-title--y" transform="rotate(-90)"
      x="${(-plotHeight / 2).toFixed(1)}" y="${-(margin.left - 14)}"
      text-anchor="middle">Most expensive car you could buy</text>
```

and its hover note:

```js
'The dearest car each way of paying could get you at that budget, before ' +
'on-road costs. Higher is more car. Running costs assume a typical EV from ' +
'this dataset, so treat it as a guide rather than a quote.'
```

Update the SVG `aria-label` to open with `How much car each way of paying reaches, by monthly budget`.

- [ ] **Step 6: Switch `app.js` to the new series**

```js
const series = purchasingPowerSeries({ inputs, profile, budgetRange: BUDGET_RANGE }, tables);
```

Import `purchasingPowerSeries` from `'../../calc/capacity.js'` and drop the `crossoverSeries` import.

- [ ] **Step 7: Delete `crossoverSeries`**

Remove it and its tests from `calc/compare.js` / `calc/compare.test.js`. Nothing else calls it — confirm with `grep -rn "crossoverSeries" calc/ public/ server/`.

- [ ] **Step 8: Run the tests**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"`
Expected: PASS.

- [ ] **Step 9: Verify in a browser**

The novated line must rise then flatten hard at $91,661; cash must be a horizontal line at the savings ceiling; the loan line must start late and cross above novated at a high budget.

- [ ] **Step 10: Commit**

```bash
git add calc/compare.js calc/compare.test.js public/ui/crossover-chart.js public/ui/crossover-chart.test.js public/ui/app.js
git commit -m "feat: chart plots purchasing power instead of cross-car total cost"
```

---

## Task 5: Five cars, bracketed and costed three ways

**Files:**
- Modify: `calc/rank.js`, `public/ui/cars.js`, `public/ui/app.js`, `public/styles.css`
- Test: `calc/rank.test.js`, `public/ui/cars.test.js`

**Interfaces:**
- Consumes: `verdict.maxSpend` (Task 2), `optionCosts` (`calc/compare.js`)
- Produces:
  - `bracketAroundPrice(ranked, anchorPrice, { tolerance, window, counts }) -> [{ band, entry }]` with `counts = { below: 2, at: 2, above: 1 }`
  - `cardModel(vehicle, families, { inputs, tables }) -> { ..., costs: { novated, loan, upfront } }`

- [ ] **Step 1: Write the failing bracket test**

```js
test('the bracket returns two below, two at and one above', () => {
  const ranked = rankVehicles([
    priced('b1', 46000), priced('b2', 47000),
    priced('a1', 53000), priced('a2', 53500),
    priced('x1', 60000), priced('x2', 61000)
  ], {}, 6);
  const bands = bracketAroundPrice(ranked, 53000, { counts: { below: 2, at: 2, above: 1 } });
  assert.deepEqual(bands.map(b => b.band), ['below', 'below', 'at', 'at', 'above']);
  assert.equal(new Set(bands.map(b => b.entry.vehicle.id)).size, 5, 'no car appears twice');
});

test('a band short of cars yields fewer cards rather than borrowing from another', () => {
  const ranked = rankVehicles([priced('a1', 53000)], {}, 1);
  const bands = bracketAroundPrice(ranked, 53000, { counts: { below: 2, at: 2, above: 1 } });
  assert.deepEqual(bands.map(b => b.band), ['at']);
});
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Generalise `bracketAroundPrice` to counts**

Replace the single-pick `picked` Map with per-band arrays:

```js
const DEFAULT_COUNTS = { below: 2, at: 2, above: 1 };

export function bracketAroundPrice(
  ranked,
  anchorPrice,
  { tolerance = BRACKET_TOLERANCE, window = BRACKET_WINDOW, counts = DEFAULT_COUNTS } = {}
) {
  if (!Array.isArray(ranked) || ranked.length === 0) return [];
  if (typeof anchorPrice !== 'number' || !Number.isFinite(anchorPrice) || anchorPrice <= 0) return [];

  const low = anchorPrice * (1 - tolerance);
  const high = anchorPrice * (1 + tolerance);
  const floor = anchorPrice * (1 - window);
  const ceiling = anchorPrice * (1 + window);

  const bandOf = vehicle => {
    const price = vehicle.listPrice;
    if (price < floor || price > ceiling) return null;
    if (price < low) return 'below';
    if (price > high) return 'above';
    return 'at';
  };

  // `ranked` is best-first, so taking the first N in each band gives the best
  // N cars at that price point, not the N closest to the anchor.
  const picked = { below: [], at: [], above: [] };
  for (const entry of ranked) {
    const band = bandOf(entry.vehicle);
    if (band === null) continue;
    if (picked[band].length >= (counts[band] ?? 0)) continue;
    picked[band].push({ band, entry });
  }

  // Cheapest first, so the five read as a price ladder.
  return [...picked.below, ...picked.at, ...picked.above];
}
```

- [ ] **Step 4: Write the failing card-costs test**

In `public/ui/cars.test.js`:

```js
// Hoisted so all three tests below share one fixture.
const costTables = JSON.parse(readFileSync(new URL('../../data/tax-tables.json', import.meta.url)));
const costInputs = {
  grossSalary: 145000, savings: 80000, termMonths: 60, annualKm: 15000,
  leaseStartDate: '2026-07-25', deposit: 0, leaseRatePct: 7.5, loanRatePct: 6.5,
  opportunityRatePct: 4.5, adminFeeAnnual: 1020,
  electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240, residualPctOverride: null
};
const vehicleFixture = {
  id: 'a', familyId: 'fa', make: 'Kia', model: 'EV5', listPrice: 56000,
  consumptionKwhPer100km: 16, insuranceAnnual: 1850, bootLitresSeatsUp: 513,
  rangeKm: 400, seats: 5, bodyType: 'SUV',
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
};

test('a card carries the cost of that car under all three options', () => {
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  for (const option of ['novated', 'loan', 'upfront']) {
    assert.ok(typeof card.costs[option].tco === 'number', `${option} must be costed`);
  }
  assert.ok(card.costs.novated.tco < card.costs.loan.tco, 'packaging beats a loan on this salary');
});

test('an unaffordable cash purchase is marked, not silently costed', () => {
  // Same fixture, savings far below the price.
  const card = cardModel(vehicleFixture, [], {
    inputs: { ...costInputs, savings: 1000 }, tables: costTables
  });
  assert.equal(card.costs.upfront.feasible, false);
});

test('the card model still works with no costing context', () => {
  const card = cardModel(vehicleFixture, []);
  assert.equal(card.costs, null);
});

// The reason valueRatio survives the rework: across five differently-priced
// cars, the total alone cannot say which holds its value.
test('two similarly-priced cars can differ sharply on value retained', () => {
  const holder = { ...vehicleFixture, id: 'holder', depreciationCurve: [1, 0.9, 0.84, 0.79, 0.75, 0.71] };
  const sinker = { ...vehicleFixture, id: 'sinker', depreciationCurve: [1, 0.6, 0.45, 0.35, 0.28, 0.22] };
  const a = cardModel(holder, [], { inputs: costInputs, tables: costTables });
  const b = cardModel(sinker, [], { inputs: costInputs, tables: costTables });
  assert.ok(valueRatio(a.costs.novated) > valueRatio(b.costs.novated) + 0.1,
    'the same price with a very different curve must show a very different ratio');
});
```

- [ ] **Step 5: Extend `cardModel`**

```js
export function cardModel(vehicle, families, context = null) {
  const family = families.find(f => f.id === vehicle.familyId) ?? null;
  // Costing is optional so the model stays usable in tests and in any caller
  // that only needs the review copy.
  const costs = context
    ? optionCosts({ vehicle, inputs: context.inputs }, context.tables)
    : null;
  return {
    ...vehicle,
    summary: family?.summary ?? null,
    pros: family?.pros ?? [],
    cons: family?.cons ?? [],
    sources: family?.sources ?? [],
    costs
  };
}
```

Import `optionCosts` from `'../../calc/compare.js'` at the top of `public/ui/cars.js`.

- [ ] **Step 6: Render the three costs on each card**

In `renderCards`, after the specs line:

```js
        ${card.costs ? `<table class="car-costs">
          <caption>Total cost over the term</caption>
          <tbody>
            ${['novated', 'loan', 'upfront'].map(option => {
              const entry = card.costs[option];
              const label = { novated: 'Novated', loan: 'Loan', upfront: 'Cash' }[option];
              const ratio = valueRatio(entry);
              return `<tr${option === card.winningOption ? ' class="is-winner"' : ''}>
                <th scope="row">${label}</th>
                <td>${entry.feasible ? money(entry.tco) : 'out of reach'}</td>
                <td class="car-costs__ratio">${
                  entry.feasible && ratio !== null ? `keeps ${Math.round(ratio * 100)}c/$1` : ''
                }</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : ''}
```

Add `import { money } from './format.js';` if not already present, and import
`valueRatio` alongside `optionCosts` from `'../../calc/compare.js'`.

`valueRatio` earns its keep here rather than in step 2: these five cards are
five *different* cars at different prices, which is exactly the case where a
raw total misleads. Two cars within $600 of each other on sticker can differ
by 13c in the dollar on what they retain.

- [ ] **Step 7: Wire the anchor and context in `app.js`**

```js
  function renderShortlist(verdict) {
    const matches = filterVehicles(vehicles, state);
    // The ceiling comes from step 2's winning option — one number, no car.
    const anchorPrice = verdict?.maxSpend > 0 ? verdict.maxSpend : null;

    const ranked = collapseToTopPerFamily(
      rankVehicles(matches, state, matches.length),
      matches.length
    );
    const bands = anchorPrice !== null ? bracketAroundPrice(ranked, anchorPrice) : [];
    const context = { inputs: buildInputs(state), tables };

    const cards = bands.map(({ band, entry }) => ({
      ...cardModel(entry.vehicle, families, context),
      band,
      bandLabel: BAND_LABEL[band],
      winningOption: verdict.winner,
      reason: entry.reasons[0],
      otherTrimsText: entry.otherTrims
        ? `${entry.otherTrims.count} other ${entry.otherTrims.count === 1 ? 'trim' : 'trims'} from ${money(entry.otherTrims.fromPrice)}`
        : null
    }));
    renderCards(root, cards, emptyMessage);
  }
```

- [ ] **Step 8: Style the cost table**

```css
.car-costs {
  width: 100%;
  margin-top: var(--space-2);
  border-collapse: collapse;
  font-size: 0.75rem;
}

.car-costs caption {
  text-align: left;
  color: var(--ink-faint);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-bottom: var(--space-1);
}

.car-costs th {
  text-align: left;
  font-weight: 400;
  color: var(--ink-soft);
  padding: 0.15em 0;
}

.car-costs td {
  text-align: right;
  font-family: var(--font-mono);
  padding: 0.15em 0;
}

.car-costs tr.is-winner th,
.car-costs tr.is-winner td {
  font-weight: 600;
  color: var(--ink);
}

/* How much of each dollar survives as resale. Quieter than the total: it is
   a tiebreaker between similarly-priced cars, not the headline. */
.car-costs__ratio {
  color: var(--ink-faint);
  font-size: 0.68rem;
  white-space: nowrap;
}
```

- [ ] **Step 9: Run the tests**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"`
Expected: PASS.

- [ ] **Step 10: Verify in a browser**

Five cards, labelled two "just under", two "at your ceiling", one "if you stretched", each showing three totals with the winning option emphasised.

- [ ] **Step 11: Commit**

```bash
git add calc/rank.js calc/rank.test.js public/ui/cars.js public/ui/cars.test.js public/ui/app.js public/styles.css
git commit -m "feat: five bracketed cars, each costed under all three funding options"
```

---

## Task 6: Move the balloon disclosure into step 3

**Files:**
- Modify: `public/ui/cars.js`, `public/styles.css`
- Test: `public/ui/cars.test.js`

**Interfaces:**
- Consumes: `card.costs.novated.detail.residual` and `.resale` (Task 5)

A novated lease ends with a lump-sum residual. Step 2 used to disclose it, but
step 2 no longer names a car, so there is nothing to compute a residual from —
it belongs on each card, where a real price exists. The affordability test is
still monthly-only, so a five-figure bill on the last day of the term is
otherwise invisible.

- [ ] **Step 1: Write the failing tests**

```js
test('a card discloses the balloon on its novated row', () => {
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  assert.ok(card.balloon > 0, 'the residual must be surfaced, not buried in the total');
  assert.equal(card.balloon, card.costs.novated.detail.residual);
});

test('a card flags a balloon the car will not be worth enough to clear', () => {
  const sinker = { ...vehicleFixture, depreciationCurve: [1, 0.4, 0.28, 0.2, 0.15, 0.1] };
  const card = cardModel(sinker, [], { inputs: costInputs, tables: costTables });
  assert.ok(card.costs.novated.detail.resale < card.balloon, 'fixture must be underwater');
  assert.equal(card.balloonCovered, false);
});

test('a card that holds its value covers its own balloon', () => {
  const holder = { ...vehicleFixture, depreciationCurve: [1, 0.95, 0.92, 0.9, 0.88, 0.85] };
  const card = cardModel(holder, [], { inputs: costInputs, tables: costTables });
  assert.equal(card.balloonCovered, true);
});

test('no costing context means no balloon rather than a crash', () => {
  const card = cardModel(vehicleFixture, []);
  assert.equal(card.balloon, null);
  assert.equal(card.balloonCovered, null);
});

test('renderCards prints the balloon under the cost table', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  renderCards({ querySelector: () => target }, [{ ...card, bandLabel: 'At your ceiling' }]);
  assert.ok(/balloon/i.test(html), `expected the balloon named, got: ${html}`);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test 2>&1 | grep "not ok" | head`

- [ ] **Step 3: Add the fields to `cardModel`**

Inside `cardModel`, after `costs` is computed:

```js
  // The residual is inside the novated total already, but a total is not a
  // cash-flow warning: affordability is tested on the monthly figure alone,
  // so a lease that fits comfortably each month can still leave a five-figure
  // bill due on the last day of the term.
  const balloon = costs ? costs.novated.detail.residual : null;
  const balloonCovered = balloon === null
    ? null
    : costs.novated.detail.resale >= balloon;
```

and add `balloon, balloonCovered` to the returned object.

- [ ] **Step 4: Render it**

Immediately after the `</table>` in `renderCards`:

```js
        ${card.balloon ? `<p class="car-balloon${card.balloonCovered ? '' : ' is-short'}">
          The novated option ends with a ${money(card.balloon)} balloon to own it${
            card.balloonCovered
              ? `, roughly covered by selling it (${money(card.costs.novated.detail.resale)})`
              : ` — more than its projected ${money(card.costs.novated.detail.resale)} resale, so selling would not clear it`
          }.</p>` : ''}
```

- [ ] **Step 5: Style it**

```css
.car-balloon {
  margin: var(--space-2) 0 0;
  font-size: 0.7rem;
  line-height: 1.4;
  color: var(--ink-soft);
}

.car-balloon.is-short {
  color: var(--warn);
  font-weight: 500;
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)|not ok"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/ui/cars.js public/ui/cars.test.js public/styles.css
git commit -m "feat: disclose the lease balloon per car in step 3"
```

---

## Task 7: Reconcile the markers and update the docs

**Files:**
- Modify: `public/ui/crossover-chart.js`, `README.md`, `docs/dataset-research-status.md`

- [ ] **Step 1: Re-point the FBT cliff marker**

Under the capacity chart the cliff is visible as the plateau itself, so the marker's copy must change or it will describe a chart that no longer exists. Update `fbtCliffMarkup`'s explanation to:

```js
  const explanation =
    `FBT cliff at ${money(cliff.cliffPrice)}. A novated lease is FBT-exempt up to this price; ` +
    `one dollar over and the exemption is lost outright, with no taper. That is why the ` +
    `novated line flattens here — until your budget can absorb the unexempted cost, a lease ` +
    `cannot reach a dearer car however much the budget rises.`;
```

- [ ] **Step 2: Re-point the loan entry marker**

```js
  const explanation =
    `The car loan line starts here. Below ${money(entry.budget)}/mo a loan cannot cover even ` +
    `the cheapest car available to you. A longer term or a bigger deposit would lower that ` +
    `and start the line sooner.`;
```

Drop the named car from this copy: under the capacity model the line's start is set by the solver, not by a specific vehicle.

- [ ] **Step 3: Update the README**

Rewrite the "What it does" list to describe the three steps as now built: step 1 gathers earnings, circumstances and car preferences; step 2 sets the budget and shows how much car each funding option reaches; step 3 shows five real cars around that ceiling, each costed three ways.

- [ ] **Step 4: Run the tests and the dataset build**

Run: `npm test && node scripts/build-dataset.js`
Expected: PASS, `114 variants across 40 families, 0 failures`.

- [ ] **Step 5: Commit**

```bash
git add public/ui/crossover-chart.js README.md docs/
git commit -m "docs: describe the three-step flow; re-point chart markers at the capacity chart"
```

---

## Decisions taken with the author

These were open when the plan was drafted and are now settled. Recorded here
because each one is a judgement call a future reader would otherwise re-open.

1. **Cash may win step 2.** Its capacity is flat at the savings ceiling, so at
   low budgets it often buys the most car while draining every dollar of
   savings. That is the correct answer for that range and it is allowed to
   win — the balloon and cost consequences show up per car in step 3, which is
   where the trade-off belongs.
2. **The balloon disclosure moves to step 3.** With no car named in step 2
   there is nothing to compute a residual from. It reappears on each card's
   novated row, where a real car price exists. Covered by Task 6.
3. **`valueRatio` is kept and moves to step 3.** It no longer decides the
   winner, but it is the only figure that separates two similarly-priced cars
   by how well they hold value — 45c per dollar for a Kia EV3 against 32c for
   a Leapmotor C10, both near $53,500. Shown per option on each card.
4. **The typical-EV assumption in step 2 is accepted.** Step 2 uses dataset
   medians for consumption and insurance; step 3 uses each car's real figures.
   The axis tooltip states this.
