# Compare Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second tab that compares up to three cars from the existing dataset side by side, calling out the fields that do not compare like for like.

**Architecture:** A pure row-model builder in `calc/spec-compare.js` turns two or three vehicle rows into grouped comparison rows carrying values, a winner index and data-derived caveats. `public/ui/compare-tab.js` renders that model to an HTML string. Selection lives in the URL query string via the existing `state.js` serialiser, so a comparison is shareable and a future "send to Compare" button on tab 1 only has to build a link.

**Tech Stack:** Native ES modules, no bundler, no framework, no build step. Express serves `public/` statically. Tests run on Node's built-in runner (`node --test`).

## Global Constraints

- **Node 22** (pinned in `.nvmrc`). No new dependencies — nothing gets added to `package.json`.
- **No build step.** Every file must run unchanged in both Node and the browser. Use only syntax and globals available in both. No JSX, no TypeScript, no bare-specifier imports.
- **`calc/` stays pure and DOM-free.** It must not import from `public/`. That includes `public/ui/format.js` — the row model returns raw values plus a format tag, and the UI layer formats them.
- **Renderers build an HTML string** and assign it to a container found via `root.querySelector`, matching `renderCards` in `public/ui/cars.js`. This is what lets them be tested in Node against a stub. Never build DOM nodes in a renderer.
- **Listeners bind once** against a stable parent element and use event delegation, matching `bindPresets` in `public/ui/sections.js`. Re-rendering replaces `innerHTML`, so a listener bound to a rendered child would be destroyed.
- **Escape every interpolated string** with the existing `escapeHtml` helper pattern before it reaches `innerHTML`.
- **The comparison is specs only.** No task may read `grossSalary`, `monthlyBudget`, `termMonths`, `savings`, `leaseStartDate` or any rate, and no task may import `calc/compare.js`, `calc/novated.js`, `calc/loan.js` or `calc/upfront.js`. The one permitted money import is `driveAwayPrice` from `calc/onroad.js`.
- **Currency is Australian**, formatted by `money()` from `public/ui/format.js` (`en-AU`, no cents).
- **The FBT/LCT threshold is `tables.lct.fuelEfficientThreshold`** (91661), read from the tables — never hardcoded.
- **The pre-push hook runs the full suite** and refuses the push if it is red. Every task ends green.
- Branch: `feature/compare-tab`. It already exists and the design spec is committed to it.

Spec: `docs/superpowers/specs/2026-07-30-compare-tab-design.md`.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `calc/spec-compare.js` | Pure row model: values, winner selection, caveat rules. No DOM, no formatting. |
| `calc/spec-compare.test.js` | Tests for the above. |
| `public/ui/vehicle-search.js` | Pure `searchVehicles` matching and grouping. |
| `public/ui/vehicle-search.test.js` | Tests for the above. |
| `public/ui/autocomplete.js` | Combobox markup and delegated keyboard/click handling. |
| `public/ui/autocomplete.test.js` | Tests for the above. |
| `public/ui/compare-tab.js` | Renders slots, comparison table, callouts and prose. |
| `public/ui/compare-tab.test.js` | Tests for the above. |
| `public/ui/tabs.js` | Tab switching and ARIA state. |
| `public/ui/tabs.test.js` | Tests for the above. |

**Modify:**

| File | Change |
|---|---|
| `public/ui/state.js` | `tab` and `compare` fields, slot normalisation, tab validation. |
| `public/index.html` | Tablist, two tab panels, compare markup. |
| `public/ui/app.js` | Mount the compare tab, wire tab switching, guard the chart repaint. |
| `public/ui/crossover-chart.js` | Early return on a zero-width container. |
| `public/styles.css` | Tabs, slots, comparison table, callouts, `<700px` layout. |

**Not touched:** `public/ui/cars.js`, `public/ui/sections.js`, `public/ui/slider.js`, and the entire money path in `calc/`.

---

### Task 1: URL state for the tab and the slots

**Files:**
- Modify: `public/ui/state.js`
- Test: `public/ui/state.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `defaultState(rates)` gains `tab: 'find'` and `compare: []`. New exports `TABS` (`['find', 'compare']`), `MAX_COMPARE_SLOTS` (`3`), and `normaliseCompare(ids: string[]): string[]`. `toQueryString` and `fromQueryString` keep their existing signatures.

Three serialisation rules matter here, and all three exist because `toQueryString` compares against defaults by value. An empty slot must serialise as an empty segment so slot position survives a share (`compare=id1,,id3`); trailing empty slots must be trimmed; and an all-empty array must normalise to `[]` so it is dropped from the URL entirely, because three empty slots would otherwise serialise as the literal string `,,`.

- [ ] **Step 1: Write the failing tests**

Append to `public/ui/state.test.js`:

```javascript
import { normaliseCompare, TABS, MAX_COMPARE_SLOTS } from './state.js';

test('an all-empty comparison normalises away entirely', () => {
  assert.deepEqual(normaliseCompare(['', '', '']), []);
  assert.deepEqual(normaliseCompare([]), []);
  assert.deepEqual(normaliseCompare(undefined), []);
});

test('trailing empty slots are trimmed but interior ones are kept', () => {
  assert.deepEqual(normaliseCompare(['a', '', '']), ['a']);
  assert.deepEqual(normaliseCompare(['a', '', 'c']), ['a', '', 'c']);
});

test('no more than three slots survive', () => {
  assert.deepEqual(normaliseCompare(['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
  assert.equal(MAX_COMPARE_SLOTS, 3);
});

test('an empty comparison is absent from the query string', () => {
  const defaults = defaultState(rates);
  assert.equal(toQueryString({ ...defaults, compare: ['', '', ''] }, defaults), '');
});

test('a gapped comparison keeps its slot positions through a round trip', () => {
  const defaults = defaultState(rates);
  const query = toQueryString({ ...defaults, tab: 'compare', compare: ['a', '', 'c'] }, defaults);
  assert.match(query, /compare=a%2C%2Cc/);
  const back = fromQueryString(query, defaults);
  assert.deepEqual(back.compare, ['a', '', 'c']);
  assert.equal(back.tab, 'compare');
});

test('an unknown tab falls back to the default rather than routing nowhere', () => {
  const defaults = defaultState(rates);
  assert.equal(fromQueryString('?tab=nonsense', defaults).tab, 'find');
  assert.deepEqual(TABS, ['find', 'compare']);
});
```

The existing test file already builds a `rates` fixture and imports `defaultState`, `toQueryString` and `fromQueryString` — reuse them rather than redeclaring. If the fixture is named differently, match the existing name.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test public/ui/state.test.js`
Expected: FAIL — `normaliseCompare is not a function`.

- [ ] **Step 3: Implement**

In `public/ui/state.js`, add `'compare'` to `ARRAY_FIELDS` and `'tab'` to `STRING_FIELDS`:

```javascript
const ARRAY_FIELDS = new Set(['bodyTypes', 'compare']);
const STRING_FIELDS = new Set(['leaseStartDate', 'freeText', 'tab']);
```

Add above `defaultState`:

```javascript
export const TABS = ['find', 'compare'];
export const MAX_COMPARE_SLOTS = 3;

// A slot's *position* is meaningful — clearing slot 2 must not promote slot 3
// into it — so an empty slot round-trips through the URL as an empty segment
// ("a,,c"). Trailing empties carry no such information, and an all-empty array
// must collapse to [] or toQueryString's default comparison fails to drop it
// and every visitor gets a "?compare=,," glued to their address bar.
export function normaliseCompare(ids) {
  const slots = (ids ?? [])
    .slice(0, MAX_COMPARE_SLOTS)
    .map(id => (typeof id === 'string' ? id.trim() : ''));
  while (slots.length > 0 && slots[slots.length - 1] === '') slots.pop();
  return slots;
}
```

In `defaultState`'s returned object, add:

```javascript
    // Which tab is showing. In the URL so a comparison can be linked to
    // directly, which is also what lets step 3 hand cars over later.
    tab: 'find',
    // Up to three vehicle ids, by slot. Specs only — nothing here reads the
    // reader's salary, so a shared comparison link carries no income.
    compare: [],
```

In `toQueryString`, normalise before the default comparison:

```javascript
export function toQueryString(state, defaults) {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(state)) {
    const value = key === 'compare' ? normaliseCompare(raw) : raw;
    if (value === null || value === '' || same(value, defaults[key])) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
```

In `fromQueryString`, normalise the array branch and validate the tab:

```javascript
    if (ARRAY_FIELDS.has(key)) {
      const parts = raw ? raw.split(',') : [];
      state[key] = key === 'compare' ? normaliseCompare(parts) : parts;
    } else if (STRING_FIELDS.has(key)) {
      // A tab value that names no panel would leave the page blank, so an
      // unrecognised one falls back rather than routing nowhere.
      state[key] = key === 'tab' && !TABS.includes(raw) ? defaults[key] : raw;
    } else if (BOOLEAN_FIELDS.has(key)) {
```

Leave the rest of the function unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test public/ui/state.test.js`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. `state.js` is imported by `app.js`, so a regression here breaks the app.

- [ ] **Step 6: Commit**

```bash
git add public/ui/state.js public/ui/state.test.js
git commit -m "feat: carry the compare tab and its slots in the URL"
```

---

### Task 2: The row model — values and winners

**Files:**
- Create: `calc/spec-compare.js`
- Test: `calc/spec-compare.test.js`

**Interfaces:**
- Consumes: `driveAwayPrice` from `calc/onroad.js`; `tables` as served by `/api/dataset` (needs `tables.lct.fuelEfficientThreshold`, and whatever `driveAwayPrice` reads).
- Produces:
  - `comparisonRows(vehicles, tables)` → `{ groups: Group[] }`
  - `Group` = `{ key: string, label: string, rows: Row[] }`
  - `Row` = `{ key: string, label: string, unit: string, format: 'money'|'integer'|'decimal1'|'percent'|'text', values: (number|string|null)[], winnerIndex: number|null, caveats: Caveat[] }`
  - `Caveat` = `{ id: string, text: string }` — always `[]` until Task 3.
  - `values` is index-aligned with the `vehicles` argument.
  - `ROW_GROUPS` exported for tests.

Formatting is deliberately not done here. `calc/` must not import `public/ui/format.js` — that would invert the dependency direction the whole codebase rests on. The row carries a `format` tag and the UI layer turns it into text.

- [ ] **Step 1: Write the failing test**

Create `calc/spec-compare.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparisonRows, ROW_GROUPS } from './spec-compare.js';

const tables = JSON.parse(
  readFileSync(new URL('../data/tax-tables.json', import.meta.url), 'utf8')
);

const ev5 = {
  id: 'ev5', make: 'Kia', model: 'EV5', variant: 'Air 2WD LR', bodyType: 'SUV',
  listPrice: 61170, batteryKwh: 88.1, rangeKm: 555, consumptionKwhPer100km: 18,
  bootLitresSeatsUp: 513, bootLitresSeatsDown: 1450, seats: 5, towKg: 1250,
  warrantyYears: 7, insuranceAnnual: 1800,
  depreciationCurve: [1, 0.78, 0.66, 0.57, 0.51, 0.47], sourcedAt: '2026-07-27'
};
const modelY = {
  id: 'my', make: 'Tesla', model: 'Model Y', variant: 'Premium LR AWD', bodyType: 'SUV',
  listPrice: 68900, batteryKwh: 79, rangeKm: 600, consumptionKwhPer100km: 13.5,
  bootLitresSeatsUp: 854, bootLitresSeatsDown: 2100, seats: 5, towKg: 1588,
  warrantyYears: 5, insuranceAnnual: 2550,
  depreciationCurve: [1, 0.74, 0.62, 0.53, 0.47, 0.42], sourcedAt: '2026-07-27'
};

const rowByKey = (model, key) =>
  model.groups.flatMap(g => g.rows).find(r => r.key === key);

test('values are index-aligned with the vehicles passed in', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(rowByKey(model, 'listPrice').values, [61170, 68900]);
  assert.deepEqual(rowByKey(model, 'seats').values, [5, 5]);
});

test('a lower-is-better row picks the smallest', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.equal(rowByKey(model, 'listPrice').winnerIndex, 0);
  assert.equal(rowByKey(model, 'insuranceAnnual').winnerIndex, 0);
});

test('a higher-is-better row picks the largest', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.equal(rowByKey(model, 'bootUp').winnerIndex, 1);
  assert.equal(rowByKey(model, 'warrantyYears').winnerIndex, 0);
});

test('a tie marks no winner', () => {
  const model = comparisonRows([ev5, { ...modelY, listPrice: 61170 }], tables);
  assert.equal(rowByKey(model, 'listPrice').winnerIndex, null);
});

test('rows with no meaningful direction never mark a winner', () => {
  const model = comparisonRows([ev5, modelY], tables);
  for (const key of ['bodyType', 'seats', 'powertrain', 'underThreshold', 'sourcedAt']) {
    assert.equal(rowByKey(model, key).winnerIndex, null, `${key} should not mark a winner`);
  }
});

test('a battery-electric car reports the same figure for electric and total range', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(rowByKey(model, 'electricRange').values, [555, 600]);
  assert.deepEqual(rowByKey(model, 'totalRange').values, [555, 600]);
});

test('resale reads the sixth point of the depreciation curve', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(rowByKey(model, 'resale5yr').values, [0.47, 0.42]);
  assert.equal(rowByKey(model, 'resale5yr').winnerIndex, 0);
});

test('drive-away adds Victorian duty and one year of rego, and excludes LCT', () => {
  const model = comparisonRows([ev5, modelY], tables);
  const [kia] = rowByKey(model, 'driveAway').values;
  // LCT is embedded in the list price, so it is never added on top.
  assert.ok(kia > 61170, 'duty and rego should lift it above list');
  assert.ok(kia < 66000, 'nothing like an LCT-sized addition should appear');
});

test('the threshold row is a plain price test against the tables', () => {
  const dear = { ...modelY, listPrice: 95000 };
  const model = comparisonRows([ev5, dear], tables);
  assert.deepEqual(rowByKey(model, 'underThreshold').values, ['Yes', 'No']);
});

test('the petrol row is omitted when nothing in the set burns petrol', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.equal(rowByKey(model, 'petrolUse'), undefined);
});

test('every group carries a label and at least one row', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(model.groups.map(g => g.key), ROW_GROUPS.map(g => g.key));
  for (const group of model.groups) {
    assert.ok(group.label.length > 0);
    assert.ok(group.rows.length > 0);
  }
});

test('three cars work as well as two', () => {
  const cheap = { ...ev5, id: 'c', make: 'BYD', model: 'Dolphin', listPrice: 29840 };
  const model = comparisonRows([ev5, modelY, cheap], tables);
  assert.equal(rowByKey(model, 'listPrice').values.length, 3);
  assert.equal(rowByKey(model, 'listPrice').winnerIndex, 2);
});

test('caveats are an empty array when nothing is amiss', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(rowByKey(model, 'listPrice').caveats, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test calc/spec-compare.test.js`
Expected: FAIL — cannot find module `./spec-compare.js`.

- [ ] **Step 3: Implement**

Create `calc/spec-compare.js`:

```javascript
// calc/spec-compare.js — the specification comparison behind the Compare tab.
//
// Pure, like everything else in calc/: it takes two or three vehicle rows plus
// the tax tables and returns grouped rows carrying raw values, a winner index
// and any caveats. It does no formatting and touches no DOM, so it runs
// identically under the Node test runner and in the browser.
//
// Formatting deliberately lives in the UI layer (public/ui/compare-tab.js).
// money() is in public/ui/format.js, and importing it here would point calc/
// at public/ — the one dependency direction this codebase does not have.

import { driveAwayPrice } from './onroad.js';

const powertrainOf = v => v.powertrain ?? 'bev';

// A PHEV's rangeKm is electric-only (43-183km across the dataset) where a
// BEV's is the whole trip. combinedRangeKm exists only on a PHEV. Splitting
// range into two rows means each row is genuinely like for like, and the
// caveat only has to explain what "total" assumes.
const totalRangeOf = v =>
  powertrainOf(v) === 'phev' ? v.combinedRangeKm : v.rangeKm;

export const ROW_GROUPS = [
  { key: 'price', label: 'Price' },
  { key: 'practicality', label: 'Practicality' },
  { key: 'energy', label: 'Energy' },
  { key: 'ownership', label: 'Ownership' }
];

// direction: 'higher' | 'lower' | null. null means the row is descriptive and
// no winner is ever marked — more seats is not better, and a body type has no
// ordering at all.
//
// omitWhen lets a row disappear rather than print a column of em-dashes: a
// petrol figure among three battery-electric cars is noise, not information.
const ROW_SPECS = [
  {
    group: 'price', key: 'listPrice', label: 'List price',
    unit: '', format: 'money', direction: 'lower', value: v => v.listPrice
  },
  {
    group: 'price', key: 'driveAway', label: 'Drive-away (Vic, est.)',
    unit: '', format: 'money', direction: 'lower',
    // Every flag defaults the way data/schema.js says an absent one should:
    // a row without them is a BEV, which is green and fuel-efficient and is
    // not a goods vehicle.
    value: (v, tables) => driveAwayPrice({
      listPrice: v.listPrice,
      isGreen: v.isGreenForVicDuty ?? true,
      isFuelEfficient: v.isFuelEfficientForLct ?? true,
      isNonPassenger: v.isNonPassengerForVicDuty ?? false
    }, tables).total
  },
  {
    group: 'price', key: 'underThreshold', label: 'Under the $91,661 threshold',
    unit: '', format: 'text', direction: null,
    // A plain price test. It must NOT call fbtTreatment (calc/fbt.js), which
    // needs a lease start date — an input this tab deliberately does not have.
    value: (v, tables) => v.listPrice <= tables.lct.fuelEfficientThreshold ? 'Yes' : 'No'
  },
  {
    group: 'price', key: 'resale5yr', label: 'Resale after 5 years',
    unit: '', format: 'percent', direction: 'higher',
    value: v => v.depreciationCurve[5] ?? null
  },

  {
    group: 'practicality', key: 'bodyType', label: 'Body type',
    unit: '', format: 'text', direction: null, value: v => v.bodyType
  },
  {
    group: 'practicality', key: 'seats', label: 'Seats',
    unit: '', format: 'integer', direction: null, value: v => v.seats
  },
  {
    group: 'practicality', key: 'bootUp', label: 'Boot, seats up',
    unit: 'L', format: 'integer', direction: 'higher', value: v => v.bootLitresSeatsUp
  },
  {
    group: 'practicality', key: 'bootDown', label: 'Boot, seats down',
    unit: 'L', format: 'integer', direction: 'higher', value: v => v.bootLitresSeatsDown
  },
  {
    group: 'practicality', key: 'towKg', label: 'Braked towing',
    unit: 'kg', format: 'integer', direction: 'higher', value: v => v.towKg
  },

  {
    group: 'energy', key: 'powertrain', label: 'Powertrain',
    unit: '', format: 'text', direction: null,
    value: v => powertrainOf(v) === 'phev' ? 'Plug-in hybrid' : 'Battery electric'
  },
  {
    group: 'energy', key: 'electricRange', label: 'Electric range',
    unit: 'km', format: 'integer', direction: 'higher', value: v => v.rangeKm
  },
  {
    group: 'energy', key: 'totalRange', label: 'Total range',
    unit: 'km', format: 'integer', direction: 'higher', value: totalRangeOf
  },
  {
    group: 'energy', key: 'batteryKwh', label: 'Battery',
    unit: 'kWh', format: 'decimal1', direction: 'higher', value: v => v.batteryKwh
  },
  {
    group: 'energy', key: 'energyUse', label: 'Energy use',
    unit: 'kWh/100km', format: 'decimal1', direction: 'lower',
    value: v => v.consumptionKwhPer100km
  },
  {
    group: 'energy', key: 'petrolUse', label: 'Petrol use',
    unit: 'L/100km', format: 'decimal1', direction: 'lower',
    value: v => v.fuelConsumptionL100km ?? null,
    omitWhen: vehicles => !vehicles.some(v => powertrainOf(v) === 'phev')
  },

  {
    group: 'ownership', key: 'warrantyYears', label: 'Warranty',
    unit: 'years', format: 'integer', direction: 'higher', value: v => v.warrantyYears
  },
  {
    group: 'ownership', key: 'insuranceAnnual', label: 'Insurance (est. annual)',
    unit: '', format: 'money', direction: 'lower', value: v => v.insuranceAnnual
  },
  {
    group: 'ownership', key: 'sourcedAt', label: 'Data sourced',
    unit: '', format: 'text', direction: null, value: v => v.sourcedAt
  }
];

// A winner needs a direction, real numbers, and an outright best. A tie means
// no winner: marking one of two identical figures would invent a difference.
function pickWinner(values, direction) {
  if (!direction) return null;
  const numeric = values
    .map((value, index) => ({ value, index }))
    .filter(entry => typeof entry.value === 'number' && Number.isFinite(entry.value));
  if (numeric.length < 2) return null;

  const better = direction === 'higher'
    ? (a, b) => a > b
    : (a, b) => a < b;

  let best = numeric[0];
  let tied = false;
  for (const entry of numeric.slice(1)) {
    if (better(entry.value, best.value)) {
      best = entry;
      tied = false;
    } else if (entry.value === best.value) {
      tied = true;
    }
  }
  return tied ? null : best.index;
}

export function comparisonRows(vehicles, tables) {
  const specs = ROW_SPECS.filter(spec => !spec.omitWhen?.(vehicles));

  const rows = specs.map(spec => {
    const values = vehicles.map(vehicle => spec.value(vehicle, tables));
    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      format: spec.format,
      values,
      winnerIndex: pickWinner(values, spec.direction),
      caveats: []
    };
  });

  return {
    groups: ROW_GROUPS.map(group => ({
      ...group,
      rows: rows.filter(row => specs.find(s => s.key === row.key).group === group.key)
    }))
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test calc/spec-compare.test.js`
Expected: PASS, all 12 tests.

- [ ] **Step 5: Commit**

```bash
git add calc/spec-compare.js calc/spec-compare.test.js
git commit -m "feat: the specification comparison row model"
```

---

### Task 3: Caveat rules and winner suppression

**Files:**
- Modify: `calc/spec-compare.js`
- Test: `calc/spec-compare.test.js`

**Interfaces:**
- Consumes: `comparisonRows` and the `Row` shape from Task 2.
- Produces: `Row.caveats` is now populated, and a row with any caveat has `winnerIndex === null`. New export `CAVEAT_PRECEDENCE: string[]`.

This is the feature. Five rules, all derived from the data — none written per car.

| Id | Fires when | Applies to |
|---|---|---|
| `mixed-powertrain` | the set holds both a BEV and a PHEV | `totalRange`, `batteryKwh`, `energyUse`, `petrolUse` |
| `phev-present` | the set holds any PHEV | `underThreshold` |
| `ute-vs-other` | the set holds a Ute and a non-Ute | `bootUp`, `bootDown` |
| `ute-present` | the set holds any Ute | `bootDown` |
| `mixed-seats` | more than one distinct seat count | `bootUp`, `bootDown` |

`phev-present` is separate from `mixed-powertrain` on purpose: an all-PHEV comparison would otherwise print "Yes" against the threshold row with no caveat, implying a novated-lease FBT exemption that no PHEV has had since 1 April 2025.

`bootDown` can attract three rules at once, which is a wall of amber. Each row keeps its caveats in precedence order and the renderer shows at most two — the more specific wording subsumes the more general.

- [ ] **Step 1: Write the failing tests**

Append to `calc/spec-compare.test.js`:

```javascript
import { CAVEAT_PRECEDENCE } from './spec-compare.js';

const sealion = {
  id: 'sl6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic ER', bodyType: 'SUV',
  powertrain: 'phev', listPrice: 46990, batteryKwh: 26.6, rangeKm: 140,
  combinedRangeKm: 1340, consumptionKwhPer100km: 19, fuelConsumptionL100km: 5,
  bootLitresSeatsUp: 425, bootLitresSeatsDown: 1200, seats: 5, towKg: 750,
  warrantyYears: 6, insuranceAnnual: 1500,
  depreciationCurve: [1, 0.72, 0.6, 0.5, 0.46, 0.42], sourcedAt: '2026-07-28'
};
const ranger = {
  id: 'rgr', make: 'Ford', model: 'Ranger', variant: 'PHEV Wildtrak', bodyType: 'Ute',
  powertrain: 'phev', listPrice: 86990, batteryKwh: 11.8, rangeKm: 49,
  combinedRangeKm: 800, consumptionKwhPer100km: 24, fuelConsumptionL100km: 8.3,
  bootLitresSeatsUp: 1185, bootLitresSeatsDown: 1185, seats: 5, towKg: 3500,
  warrantyYears: 5, insuranceAnnual: 2400, isNonPassengerForVicDuty: true,
  depreciationCurve: [1, 0.8, 0.7, 0.62, 0.56, 0.5], sourcedAt: '2026-07-28'
};
const sixSeat = { ...modelY, id: 'my6', seats: 6, bootLitresSeatsUp: 536 };

const caveatIds = (model, key) => rowByKey(model, key).caveats.map(c => c.id);

test('mixing a BEV and a PHEV caveats the rows where the numbers mean different things', () => {
  const model = comparisonRows([ev5, sealion], tables);
  assert.deepEqual(caveatIds(model, 'totalRange'), ['mixed-powertrain']);
  assert.deepEqual(caveatIds(model, 'batteryKwh'), ['mixed-powertrain']);
  assert.deepEqual(caveatIds(model, 'energyUse'), ['mixed-powertrain']);
  assert.deepEqual(caveatIds(model, 'petrolUse'), ['mixed-powertrain']);
});

test('the electric range row is like for like and stays uncaveated', () => {
  const model = comparisonRows([ev5, sealion], tables);
  assert.deepEqual(caveatIds(model, 'electricRange'), []);
  assert.equal(rowByKey(model, 'electricRange').winnerIndex, 0);
});

test('an all-electric set caveats nothing', () => {
  const model = comparisonRows([ev5, modelY], tables);
  for (const group of model.groups) {
    for (const row of group.rows) {
      assert.deepEqual(row.caveats, [], `${row.key} should be clean`);
    }
  }
});

test('a caveated row marks no winner', () => {
  const model = comparisonRows([ev5, sealion], tables);
  assert.equal(rowByKey(model, 'totalRange').winnerIndex, null);
  assert.equal(rowByKey(model, 'energyUse').winnerIndex, null);
});

test('the caveat names the car responsible and gives the number', () => {
  const model = comparisonRows([ev5, sealion], tables);
  const [caveat] = rowByKey(model, 'totalRange').caveats;
  assert.match(caveat.text, /Sealion 6/);
  assert.match(caveat.text, /140/);
});

test('any plug-in hybrid caveats the threshold row, even with no BEV present', () => {
  const model = comparisonRows([sealion, ranger], tables);
  assert.deepEqual(caveatIds(model, 'underThreshold'), ['phev-present']);
  assert.match(rowByKey(model, 'underThreshold').caveats[0].text, /1 April 2025/);
});

test('an all-electric set leaves the threshold row alone', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(caveatIds(model, 'underThreshold'), []);
});

test('a ute against a non-ute caveats both boot rows', () => {
  const model = comparisonRows([ev5, ranger], tables);
  assert.ok(caveatIds(model, 'bootUp').includes('ute-vs-other'));
  assert.ok(caveatIds(model, 'bootDown').includes('ute-vs-other'));
  assert.match(rowByKey(model, 'bootUp').caveats[0].text, /tray/);
});

test('a ute in the set caveats seats-down, where every ute repeats its seats-up figure', () => {
  const model = comparisonRows([ranger, { ...ranger, id: 'r2', make: 'GWM', model: 'Cannon Alpha' }], tables);
  assert.deepEqual(caveatIds(model, 'bootDown'), ['ute-present']);
  assert.deepEqual(caveatIds(model, 'bootUp'), []);
});

test('differing seat counts caveat the boot rows', () => {
  const model = comparisonRows([ev5, sixSeat], tables);
  assert.deepEqual(caveatIds(model, 'bootUp'), ['mixed-seats']);
  assert.deepEqual(caveatIds(model, 'bootDown'), ['mixed-seats']);
  assert.match(rowByKey(model, 'bootUp').caveats[0].text, /seat/i);
});

test('caveats on one row come back in precedence order', () => {
  // A ute and a six-seat SUV: ute-vs-other, ute-present and mixed-seats all fire.
  const model = comparisonRows([ranger, sixSeat], tables);
  assert.deepEqual(caveatIds(model, 'bootDown'), ['ute-vs-other', 'ute-present', 'mixed-seats']);
  assert.deepEqual(CAVEAT_PRECEDENCE, [
    'ute-vs-other', 'ute-present', 'mixed-seats', 'mixed-powertrain', 'phev-present'
  ]);
});

test('every caveat text is a non-empty sentence', () => {
  const model = comparisonRows([ev5, sealion, ranger], tables);
  const all = model.groups.flatMap(g => g.rows).flatMap(r => r.caveats);
  assert.ok(all.length > 0);
  for (const caveat of all) {
    assert.ok(caveat.text.length > 20, `${caveat.id} text is too short`);
    assert.ok(caveat.text.trim().endsWith('.'), `${caveat.id} should end in a full stop`);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test calc/spec-compare.test.js`
Expected: FAIL — `CAVEAT_PRECEDENCE` is not exported, and caveat arrays are empty.

- [ ] **Step 3: Implement**

Add to `calc/spec-compare.js`, above `comparisonRows`:

```javascript
// --- Caveats ---------------------------------------------------------------
//
// The dataset has no missing values, so the hard part of comparing two cars is
// never a gap — it is that the same field can mean different things. A PHEV's
// rangeKm is electric-only where a BEV's is the whole trip; a ute's boot is an
// open tray that gains nothing from folding the rear seats; being under
// $91,661 buys a BEV an FBT exemption and buys a PHEV nothing.
//
// Every rule below is derived from the data. None is written per car.

const displayName = v => `${v.make} ${v.model}`;

// "the Sealion 6 and the Ranger". Never more than three, so no cleverness.
function nameList(names) {
  if (names.length === 1) return `the ${names[0]}`;
  if (names.length === 2) return `the ${names[0]} and the ${names[1]}`;
  return `the ${names.slice(0, -1).join(', the ')} and the ${names[names.length - 1]}`;
}

const isUte = v => v.bodyType === 'Ute';
const isPhev = v => powertrainOf(v) === 'phev';

// Ordered most specific first. bootDown can attract three of these at once,
// and the renderer shows only the first two — the specific wording subsumes
// the general, so "that is an open tray" should outrank "seat counts differ".
export const CAVEAT_PRECEDENCE = [
  'ute-vs-other', 'ute-present', 'mixed-seats', 'mixed-powertrain', 'phev-present'
];

const CAVEAT_RULES = [
  {
    id: 'mixed-powertrain',
    rows: ['totalRange', 'batteryKwh', 'energyUse', 'petrolUse'],
    applies: vehicles => vehicles.some(isPhev) && vehicles.some(v => !isPhev(v)),
    text: (vehicles, rowKey) => {
      const phevs = vehicles.filter(isPhev);
      const names = nameList(phevs.map(displayName));
      const isAre = phevs.length === 1 ? 'is' : 'are';
      const verbS = phevs.length === 1 ? 's' : '';
      if (rowKey === 'totalRange') {
        const detail = phevs
          .map(v => `${displayName(v)} ${v.rangeKm}km`)
          .join(', ');
        return `Not like for like — ${names} ${isAre} a plug-in hybrid, so this total ` +
          `assumes a full tank as well as a full battery. On battery alone: ${detail}.`;
      }
      if (rowKey === 'batteryKwh') {
        return `Not like for like — a plug-in hybrid's battery does a different job. ` +
          `${names.charAt(0).toUpperCase()}${names.slice(1)} ${isAre} sized to cover a ` +
          `commute, not the whole trip.`;
      }
      if (rowKey === 'energyUse') {
        return `Not like for like — for ${names} this is electric-mode consumption only. ` +
          `The petrol figure is on the row below.`;
      }
      return `Not like for like — only ${names} burn${verbS} petrol. A battery-electric ` +
        `car has no figure here.`;
    }
  },
  {
    id: 'phev-present',
    rows: ['underThreshold'],
    // Deliberately not folded into mixed-powertrain: an all-PHEV comparison
    // would otherwise read "Yes" with no caveat, implying an exemption that
    // no plug-in hybrid has had since 1 April 2025.
    applies: vehicles => vehicles.some(isPhev),
    text: vehicles => {
      const names = nameList(vehicles.filter(isPhev).map(displayName));
      return `Under $91,661 means no luxury car tax. It does not mean a novated-lease ` +
        `FBT exemption for ${names} — plug-in hybrids lost that on 1 April 2025.`;
    }
  },
  {
    id: 'ute-vs-other',
    rows: ['bootUp', 'bootDown'],
    applies: vehicles => vehicles.some(isUte) && vehicles.some(v => !isUte(v)),
    text: vehicles => {
      const utes = vehicles.filter(isUte);
      const names = nameList(utes.map(displayName));
      const verb = utes.length === 1 ? 'measures' : 'measure';
      return `Not like for like — ${names} ${verb} an open tray, not an enclosed boot.`;
    }
  },
  {
    id: 'ute-present',
    rows: ['bootDown'],
    applies: vehicles => vehicles.some(isUte),
    text: () =>
      `Every ute in the dataset lists the same figure seats up and seats down — a tray ` +
      `gains nothing from folding the rear seats, so this row is not the comparison it looks like.`
  },
  {
    id: 'mixed-seats',
    rows: ['bootUp', 'bootDown'],
    applies: vehicles => new Set(vehicles.map(v => v.seats)).size > 1,
    text: vehicles => {
      const counts = [...new Set(vehicles.map(v => v.seats))].sort((a, b) => a - b).join(' and ');
      return `Not like for like — these cars seat ${counts}, so the litres are measured ` +
        `behind different rows of seats.`;
    }
  }
];

function caveatsFor(rowKey, vehicles) {
  return CAVEAT_PRECEDENCE
    .map(id => CAVEAT_RULES.find(rule => rule.id === id))
    .filter(rule => rule.rows.includes(rowKey) && rule.applies(vehicles))
    .map(rule => ({ id: rule.id, text: rule.text(vehicles, rowKey) }));
}
```

Then replace the row-building block inside `comparisonRows` with:

```javascript
  const rows = specs.map(spec => {
    const values = vehicles.map(vehicle => spec.value(vehicle, tables));
    const caveats = caveatsFor(spec.key, vehicles);
    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      format: spec.format,
      values,
      // If the numbers cannot be read straight across, neither can a "best".
      // Marking one anyway is how a comparison tool tells its first lie.
      winnerIndex: caveats.length > 0 ? null : pickWinner(values, spec.direction),
      caveats
    };
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test calc/spec-compare.test.js`
Expected: PASS, all 24 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add calc/spec-compare.js calc/spec-compare.test.js
git commit -m "feat: caveat rules for fields that do not compare like for like"
```

---

### Task 4: Vehicle search

**Files:**
- Create: `public/ui/vehicle-search.js`
- Test: `public/ui/vehicle-search.test.js`

**Interfaces:**
- Consumes: the vehicle rows from `/api/dataset`.
- Produces: `searchVehicles(vehicles, query, limit = 8)` → `Group[]` where `Group` = `{ modelLabel: string, items: Vehicle[] }`. Also exports `SEARCH_LIMIT = 8`.

Grouping under the model name is the point: four Kia EV5 trims in a flat list is noise. The limit counts **variants**, not groups.

- [ ] **Step 1: Write the failing test**

Create `public/ui/vehicle-search.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchVehicles, SEARCH_LIMIT } from './vehicle-search.js';

const fleet = [
  { id: 'ev5-air', make: 'Kia', model: 'EV5', variant: 'Air 2WD LR', listPrice: 61170, bodyType: 'SUV' },
  { id: 'ev5-earth', make: 'Kia', model: 'EV5', variant: 'Earth AWD', listPrice: 64770, bodyType: 'SUV' },
  { id: 'ev6', make: 'Kia', model: 'EV6', variant: 'Air', listPrice: 59590, bodyType: 'SUV' },
  { id: 'sl6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic', listPrice: 46990, bodyType: 'SUV', powertrain: 'phev' },
  { id: 'my', make: 'Tesla', model: 'Model Y', variant: 'Premium RWD', listPrice: 58900, bodyType: 'SUV' }
];

test('an empty query returns nothing rather than the whole fleet', () => {
  assert.deepEqual(searchVehicles(fleet, ''), []);
  assert.deepEqual(searchVehicles(fleet, '   '), []);
});

test('matching on the model groups every trim under one heading', () => {
  const groups = searchVehicles(fleet, 'ev5');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].modelLabel, 'Kia EV5');
  assert.deepEqual(groups[0].items.map(v => v.id), ['ev5-air', 'ev5-earth']);
});

test('matching on the make returns every model that make sells', () => {
  const groups = searchVehicles(fleet, 'kia');
  assert.deepEqual(groups.map(g => g.modelLabel), ['Kia EV5', 'Kia EV6']);
});

test('the make and model can be typed together', () => {
  const groups = searchVehicles(fleet, 'kia 5');
  assert.deepEqual(groups.map(g => g.modelLabel), ['Kia EV5']);
});

test('the variant is searchable too', () => {
  const groups = searchVehicles(fleet, 'earth');
  assert.deepEqual(groups[0].items.map(v => v.id), ['ev5-earth']);
});

test('matching ignores case and surrounding space', () => {
  assert.equal(searchVehicles(fleet, '  SEALION  ')[0].modelLabel, 'BYD Sealion 6');
});

test('no match returns an empty list, not everything', () => {
  assert.deepEqual(searchVehicles(fleet, 'zzz'), []);
});

test('the limit counts variants across groups, not groups', () => {
  const groups = searchVehicles(fleet, 'kia', 2);
  assert.equal(groups.flatMap(g => g.items).length, 2);
});

test('the default limit is eight', () => {
  assert.equal(SEARCH_LIMIT, 8);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/ui/vehicle-search.test.js`
Expected: FAIL — cannot find module `./vehicle-search.js`.

- [ ] **Step 3: Implement**

Create `public/ui/vehicle-search.js`:

```javascript
// Matching for the compare tab's slot autocomplete. Pure and DOM-free so it
// can be tested directly; the combobox that consumes it lives in
// ui/autocomplete.js.

export const SEARCH_LIMIT = 8;

// Every term has to match somewhere in "make model variant", so "kia 5" finds
// the EV5 and "sealion dynamic" finds one trim. Splitting on whitespace rather
// than substring-matching the whole query is what makes word order irrelevant.
function matches(vehicle, terms) {
  const haystack = `${vehicle.make} ${vehicle.model} ${vehicle.variant ?? ''}`.toLowerCase();
  return terms.every(term => haystack.includes(term));
}

export function searchVehicles(vehicles, query, limit = SEARCH_LIMIT) {
  const terms = String(query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  // An empty box means "no suggestions", not "every car we have". 216 rows
  // dumped under an untouched input is a wall, not a help.
  if (terms.length === 0) return [];

  const hits = vehicles.filter(vehicle => matches(vehicle, terms)).slice(0, limit);

  // Grouped under the model, because four EV5 trims listed flat reads as four
  // unrelated cars. Insertion order is dataset order, which is alphabetical by
  // make — good enough, and stable.
  const groups = [];
  for (const vehicle of hits) {
    const modelLabel = `${vehicle.make} ${vehicle.model}`;
    const existing = groups.find(group => group.modelLabel === modelLabel);
    if (existing) existing.items.push(vehicle);
    else groups.push({ modelLabel, items: [vehicle] });
  }
  return groups;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test public/ui/vehicle-search.test.js`
Expected: PASS, all 9 tests.

- [ ] **Step 5: Commit**

```bash
git add public/ui/vehicle-search.js public/ui/vehicle-search.test.js
git commit -m "feat: grouped vehicle matching for the slot autocomplete"
```

---

### Task 5: The combobox

**Files:**
- Create: `public/ui/autocomplete.js`
- Test: `public/ui/autocomplete.test.js`

**Interfaces:**
- Consumes: `searchVehicles`, `SEARCH_LIMIT` from `./vehicle-search.js`; `money` from `./format.js`.
- Produces:
  - `suggestionsMarkup(groups, activeId)` → HTML string for the listbox.
  - `bindAutocomplete(root, { onSelect })` — binds once, delegated. `onSelect(slotIndex: number, vehicleId: string)`.
  - `renderSuggestions(root, slotIndex, groups, activeId)` — writes markup into slot `slotIndex`'s listbox.

The markup is a string so it can be asserted in Node, matching `renderCards`. Keyboard handling lives on the container, not on rendered children, because re-rendering replaces them.

- [ ] **Step 1: Write the failing test**

Create `public/ui/autocomplete.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionsMarkup } from './autocomplete.js';
import { searchVehicles } from './vehicle-search.js';

const fleet = [
  { id: 'ev5-air', make: 'Kia', model: 'EV5', variant: 'Air 2WD LR', listPrice: 61170, bodyType: 'SUV' },
  { id: 'ev5-earth', make: 'Kia', model: 'EV5', variant: 'Earth AWD', listPrice: 64770, bodyType: 'SUV' },
  { id: 'sl6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic', listPrice: 46990, bodyType: 'SUV', powertrain: 'phev' }
];

test('each option carries the id the click handler needs', () => {
  const html = suggestionsMarkup(searchVehicles(fleet, 'ev5'), null);
  assert.match(html, /data-vehicle-id="ev5-air"/);
  assert.match(html, /data-vehicle-id="ev5-earth"/);
});

test('options are grouped under the model name', () => {
  const html = suggestionsMarkup(searchVehicles(fleet, 'ev5'), null);
  assert.match(html, /Kia EV5/);
  assert.equal(html.match(/role="option"/g).length, 2);
});

test('an option shows enough to pick the right trim without leaving the list', () => {
  const html = suggestionsMarkup(searchVehicles(fleet, 'ev5'), null);
  assert.match(html, /Air 2WD LR/);
  assert.match(html, /\$61,170/);
  assert.match(html, /SUV/);
});

test('a plug-in hybrid is badged and a battery-electric car is not', () => {
  assert.match(suggestionsMarkup(searchVehicles(fleet, 'sealion'), null), /PHEV/);
  assert.doesNotMatch(suggestionsMarkup(searchVehicles(fleet, 'ev5'), null), /PHEV/);
});

test('the active option is the only one flagged for the screen reader', () => {
  const html = suggestionsMarkup(searchVehicles(fleet, 'ev5'), 'ev5-earth');
  assert.equal(html.match(/aria-selected="true"/g).length, 1);
  assert.match(html, /id="opt-ev5-earth"[^>]*aria-selected="true"/);
});

test('no matches produces a spoken empty state rather than a blank box', () => {
  const html = suggestionsMarkup([], null);
  assert.match(html, /No car matches/i);
  assert.doesNotMatch(html, /role="option"/);
});

test('markup escapes anything that could close a tag', () => {
  const nasty = [{ modelLabel: '<script>x</script>', items: [
    { id: 'a"b', make: 'X', model: 'Y', variant: '<img>', listPrice: 1, bodyType: 'SUV' }
  ] }];
  const html = suggestionsMarkup(nasty, null);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img>/);
  assert.match(html, /&lt;script&gt;/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/ui/autocomplete.test.js`
Expected: FAIL — cannot find module `./autocomplete.js`.

- [ ] **Step 3: Implement**

Create `public/ui/autocomplete.js`:

```javascript
// The slot combobox for the compare tab. Markup is built as a string and
// assigned to innerHTML, matching renderCards (ui/cars.js), so it can be
// asserted in Node without a DOM. Every listener binds once on the tab
// container and delegates, matching bindPresets (ui/sections.js) — a listener
// bound to a rendered option would be destroyed by the next keystroke.

import { searchVehicles, SEARCH_LIMIT } from './vehicle-search.js';
import { money } from './format.js';

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

export function suggestionsMarkup(groups, activeId) {
  if (groups.length === 0) {
    return '<p class="ac__empty">No car matches that. Try a make or a model.</p>';
  }
  return groups.map(group => `
    <div class="ac__group" role="group" aria-label="${escapeHtml(group.modelLabel)}">
      <p class="ac__group-label">${escapeHtml(group.modelLabel)}</p>
      ${group.items.map(v => `
        <div class="ac__option" role="option" id="opt-${escapeHtml(v.id)}"
             data-vehicle-id="${escapeHtml(v.id)}"
             aria-selected="${v.id === activeId ? 'true' : 'false'}">
          <span class="ac__variant">${escapeHtml(v.variant ?? '')}</span>
          <span class="ac__meta">${escapeHtml(v.bodyType)} &middot; ${money(v.listPrice)}${
            (v.powertrain ?? 'bev') === 'phev' ? ' &middot; <b>PHEV</b>' : ''
          }</span>
        </div>`).join('')}
    </div>`).join('');
}

export function renderSuggestions(root, slotIndex, groups, activeId) {
  const list = root.querySelector(`#compare-listbox-${slotIndex}`);
  if (!list) return;
  list.innerHTML = suggestionsMarkup(groups, activeId);
  list.hidden = groups.length === 0 && activeId === null ? list.hidden : false;
}

// Bound once, on the compare panel. `getVehicles` is a getter rather than an
// array because the dataset arrives after boot.
export function bindAutocomplete(root, { getVehicles, onSelect }) {
  const panel = root.querySelector('#compare-panel');
  if (!panel) return;

  // Which option the arrow keys have landed on, per slot. Not in app state:
  // it is transient interaction, gone the moment the box closes.
  const active = new Map();

  const slotOf = el => {
    const slot = el.closest?.('[data-slot]');
    return slot ? Number(slot.dataset.slot) : null;
  };

  const optionIds = slotIndex => {
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    return [...(list?.querySelectorAll('[data-vehicle-id]') ?? [])]
      .map(el => el.dataset.vehicleId);
  };

  const close = slotIndex => {
    active.delete(slotIndex);
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    if (list) list.hidden = true;
  };

  const commit = (slotIndex, vehicleId) => {
    if (!vehicleId) return;
    close(slotIndex);
    // Picking commits immediately — there is no Apply button, and the
    // comparison repaints on the spot.
    onSelect(slotIndex, vehicleId);
  };

  panel.addEventListener('input', event => {
    const input = event.target.closest?.('.compare-slot__input');
    if (!input) return;
    const slotIndex = slotOf(input);
    if (slotIndex === null) return;
    const groups = searchVehicles(getVehicles(), input.value, SEARCH_LIMIT);
    active.delete(slotIndex);
    renderSuggestions(root, slotIndex, groups, null);
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    if (list) list.hidden = input.value.trim() === '';
  });

  panel.addEventListener('keydown', event => {
    const input = event.target.closest?.('.compare-slot__input');
    if (!input) return;
    const slotIndex = slotOf(input);
    if (slotIndex === null) return;
    const ids = optionIds(slotIndex);

    if (event.key === 'Escape') { close(slotIndex); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(slotIndex, active.get(slotIndex) ?? ids[0]);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (ids.length === 0) return;

    event.preventDefault();
    const current = ids.indexOf(active.get(slotIndex));
    const step = event.key === 'ArrowDown' ? 1 : -1;
    // Wraps at both ends: from the last option, down returns to the first.
    const next = (current + step + ids.length) % ids.length;
    active.set(slotIndex, ids[next]);
    renderSuggestions(
      root, slotIndex, searchVehicles(getVehicles(), input.value, SEARCH_LIMIT), ids[next]
    );
    input.setAttribute('aria-activedescendant', `opt-${ids[next]}`);
  });

  panel.addEventListener('click', event => {
    const option = event.target.closest?.('[data-vehicle-id]');
    if (option) { commit(slotOf(option), option.dataset.vehicleId); return; }
    const clear = event.target.closest?.('[data-clear-slot]');
    // Clearing empties the slot in place. It must not promote slot 3 into
    // slot 2 — the URL carries position, and a share should survive a clear.
    if (clear) onSelect(Number(clear.dataset.clearSlot), '');
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test public/ui/autocomplete.test.js`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add public/ui/autocomplete.js public/ui/autocomplete.test.js
git commit -m "feat: the slot combobox for picking cars to compare"
```

---

### Task 6: Tabs

**Files:**
- Create: `public/ui/tabs.js`
- Test: `public/ui/tabs.test.js`
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `TABS` from `./state.js`.
- Produces:
  - `applyTab(root, tab)` — sets `aria-selected` on each tab button and `hidden` on each panel.
  - `bindTabs(root, onChange)` — binds once; `onChange(tab: string)` fires on click and on arrow keys.

- [ ] **Step 1: Write the failing test**

Create `public/ui/tabs.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTab } from './tabs.js';

// A stub root just rich enough for applyTab: two tab buttons and two panels.
function stubRoot() {
  const make = tab => ({
    dataset: { tab }, attrs: {}, hidden: false,
    setAttribute(name, value) { this.attrs[name] = value; }
  });
  const buttons = [make('find'), make('compare')];
  const panels = [make('find'), make('compare')];
  return {
    buttons, panels,
    querySelectorAll: selector =>
      selector.includes('tab-button') ? buttons : panels
  };
}

test('the selected tab is the only one marked selected', () => {
  const root = stubRoot();
  applyTab(root, 'compare');
  assert.deepEqual(root.buttons.map(b => b.attrs['aria-selected']), ['false', 'true']);
});

test('only the selected panel is visible', () => {
  const root = stubRoot();
  applyTab(root, 'compare');
  assert.deepEqual(root.panels.map(p => p.hidden), [true, false]);
});

test('switching back hides the other panel again', () => {
  const root = stubRoot();
  applyTab(root, 'compare');
  applyTab(root, 'find');
  assert.deepEqual(root.panels.map(p => p.hidden), [false, true]);
  assert.deepEqual(root.buttons.map(b => b.attrs['aria-selected']), ['true', 'false']);
});

test('only the selected tab is reachable by tabbing into the tablist', () => {
  const root = stubRoot();
  applyTab(root, 'compare');
  assert.deepEqual(root.buttons.map(b => b.attrs.tabindex), ['-1', '0']);
});

test('an unrecognised tab shows the default panel rather than none', () => {
  const root = stubRoot();
  applyTab(root, 'nonsense');
  assert.deepEqual(root.panels.map(p => p.hidden), [false, true]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/ui/tabs.test.js`
Expected: FAIL — cannot find module `./tabs.js`.

- [ ] **Step 3: Implement**

Create `public/ui/tabs.js`:

```javascript
// The two-tab shell. The ARIA tab pattern wants exactly one tab in the page's
// tab order, with the arrow keys moving between them — hence the roving
// tabindex below rather than leaving all buttons focusable.

import { TABS } from './state.js';

export function applyTab(root, tab) {
  // A tab value naming no panel would blank the page. Fall back rather than
  // render nothing; state.js does the same on the way in from the URL.
  const active = TABS.includes(tab) ? tab : TABS[0];

  for (const button of root.querySelectorAll('.tab-button')) {
    const selected = button.dataset.tab === active;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.setAttribute('tabindex', selected ? '0' : '-1');
  }
  for (const panel of root.querySelectorAll('.tab-panel')) {
    panel.hidden = panel.dataset.tab !== active;
  }
}

export function bindTabs(root, onChange) {
  const list = root.querySelector('.tablist');
  if (!list) return;

  list.addEventListener('click', event => {
    const button = event.target.closest?.('.tab-button');
    if (button) onChange(button.dataset.tab);
  });

  list.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const buttons = [...root.querySelectorAll('.tab-button')];
    const current = buttons.findIndex(b => b.getAttribute('aria-selected') === 'true');
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = buttons[(current + step + buttons.length) % buttons.length];
    event.preventDefault();
    onChange(next.dataset.tab);
    next.focus?.();
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test public/ui/tabs.test.js`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Add the markup**

In `public/index.html`, insert a tablist immediately before `<main class="sections">` (line 54):

```html
<div class="tablist" role="tablist" aria-label="How to explore the data">
  <button class="tab-button" type="button" role="tab" data-tab="find"
          id="tab-find" aria-controls="panel-find" aria-selected="true" tabindex="0">
    Find a car
  </button>
  <button class="tab-button" type="button" role="tab" data-tab="compare"
          id="tab-compare" aria-controls="panel-compare" aria-selected="false" tabindex="-1">
    Compare
  </button>
</div>
```

Wrap the existing `<main class="sections">` element in a panel by changing line 54 from
`<main class="sections">` to:

```html
<div class="tab-panel" role="tabpanel" data-tab="find" id="panel-find" aria-labelledby="tab-find">
<main class="sections">
```

and line 413 from `</main>` to:

```html
</main>
</div>
```

Then add the compare panel immediately after that closing `</div>`:

```html
<div class="tab-panel" role="tabpanel" data-tab="compare" id="panel-compare"
     aria-labelledby="tab-compare" hidden>
  <main class="sections" id="compare-panel">
    <section id="compare" aria-labelledby="compare-heading">
      <h2 id="compare-heading" class="section-heading">Compare cars</h2>
      <p class="section-intro">
        Pick up to three cars from the dataset. Specifications only — this tab does not
        cost a car under a lease, a loan or cash, so nothing here depends on what you earn.
      </p>
      <div class="compare-slots" id="compare-slots"></div>
      <div class="compare-bench" id="compare-bench"></div>
      <div class="compare-table" id="compare-table"></div>
      <div class="compare-prose" id="compare-prose"></div>
    </section>
  </main>
</div>
```

Do not touch the three existing sections' own markup.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/ui/tabs.js public/ui/tabs.test.js public/index.html
git commit -m "feat: two-tab shell with the existing flow as the default tab"
```

---

### Task 7: Render the comparison

**Files:**
- Create: `public/ui/compare-tab.js`
- Test: `public/ui/compare-tab.test.js`

**Interfaces:**
- Consumes: `comparisonRows` from `../../calc/spec-compare.js`; `money` from `./format.js`; `suggestionsMarkup` is not needed here.
- Produces:
  - `formatValue(value, format, unit)` → display string; `null` becomes an em-dash.
  - `renderSlots(root, { slots, vehicles })` — writes `#compare-slots`.
  - `renderComparison(root, { vehicles, families, tables, benchIndex })` — writes `#compare-table` and `#compare-prose`. `vehicles` is the array of filled slots only. `benchIndex` is the index within that array that is off-screen, or `null` for desktop. Task 8 adds the bench behaviour; this task renders with `benchIndex = null`.

Below two filled slots the tab shows an empty state rather than a half-drawn table.

- [ ] **Step 1: Write the failing test**

Create `public/ui/compare-tab.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatValue, renderComparison, renderSlots } from './compare-tab.js';

const tables = JSON.parse(readFileSync(new URL('../../data/tax-tables.json', import.meta.url), 'utf8'));

const ev5 = {
  id: 'ev5', make: 'Kia', model: 'EV5', variant: 'Air 2WD LR', bodyType: 'SUV', familyId: 'f-ev5',
  listPrice: 61170, batteryKwh: 88.1, rangeKm: 555, consumptionKwhPer100km: 18,
  bootLitresSeatsUp: 513, bootLitresSeatsDown: 1450, seats: 5, towKg: 1250,
  warrantyYears: 7, insuranceAnnual: 1800,
  depreciationCurve: [1, 0.78, 0.66, 0.57, 0.51, 0.47], sourcedAt: '2026-07-27'
};
const sealion = {
  id: 'sl6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic ER', bodyType: 'SUV', familyId: 'f-sl6',
  powertrain: 'phev', listPrice: 46990, batteryKwh: 26.6, rangeKm: 140,
  combinedRangeKm: 1340, consumptionKwhPer100km: 19, fuelConsumptionL100km: 5,
  bootLitresSeatsUp: 425, bootLitresSeatsDown: 1200, seats: 5, towKg: 750,
  warrantyYears: 6, insuranceAnnual: 1500,
  depreciationCurve: [1, 0.72, 0.6, 0.5, 0.46, 0.42], sourcedAt: '2026-07-28'
};
const families = [
  { id: 'f-ev5', summary: 'Roomy electric SUV.', pros: ['Big boot'], cons: ['Slow charging'], sources: ['https://x'] }
];

// The codebase's renderer convention: a stub whose querySelector hands back
// one innerHTML sink per id (see cars.test.js).
function stubRoot() {
  const targets = {};
  return {
    targets,
    querySelector(selector) {
      const id = selector.replace('#', '');
      targets[id] ??= { innerHTML: '' };
      return targets[id];
    }
  };
}

test('a null value renders as an em-dash, not "null"', () => {
  assert.equal(formatValue(null, 'integer', 'km'), '—');
});

test('money, percent and decimals each format their own way', () => {
  assert.equal(formatValue(61170, 'money', ''), '$61,170');
  assert.equal(formatValue(0.47, 'percent', ''), '47%');
  assert.equal(formatValue(88.1, 'decimal1', 'kWh'), '88.1 kWh');
  assert.equal(formatValue(513, 'integer', 'L'), '513 L');
  assert.equal(formatValue('SUV', 'text', ''), 'SUV');
});

test('fewer than two cars gets an empty state rather than half a table', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5], families, tables, benchIndex: null });
  assert.match(root.targets['compare-table'].innerHTML, /Pick a second car/i);
  assert.doesNotMatch(root.targets['compare-table'].innerHTML, /<table/);
});

test('the table carries a column per car and a row per specification', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  assert.match(html, /Kia EV5/);
  assert.match(html, /BYD Sealion 6/);
  assert.match(html, /List price/);
  assert.match(html, /\$61,170/);
  assert.match(html, /\$46,990/);
});

test('the winner is marked on a clean row', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  assert.match(root.targets['compare-table'].innerHTML, /compare-cell--win/);
});

test('a caveated row prints the caveat and marks no winner', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  assert.match(html, /Not like for like/);
  assert.match(html, /Sealion 6/);
  // The total-range row is caveated, so its cells carry no winner class.
  const totalRange = html.split('data-row="totalRange"')[1].split('data-row="')[0];
  assert.doesNotMatch(totalRange, /compare-cell--win/);
});

test('at most two caveats render on one row', () => {
  const ranger = {
    ...sealion, id: 'rgr', make: 'Ford', model: 'Ranger', bodyType: 'Ute', seats: 5,
    bootLitresSeatsUp: 1185, bootLitresSeatsDown: 1185
  };
  const sixSeat = { ...ev5, id: 'my6', seats: 6 };
  const root = stubRoot();
  renderComparison(root, { vehicles: [ranger, sixSeat], families, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  const bootDown = html.split('data-row="bootDown"')[1].split('data-row="')[0];
  assert.ok((bootDown.match(/compare-caveat/g) ?? []).length <= 2);
});

test('pros and cons come from the family record', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  const html = root.targets['compare-prose'].innerHTML;
  assert.match(html, /Big boot/);
  assert.match(html, /Slow charging/);
});

test('a car with no family record still renders its column', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families: [], tables, benchIndex: null });
  assert.match(root.targets['compare-table'].innerHTML, /Kia EV5/);
  assert.doesNotMatch(root.targets['compare-prose'].innerHTML, /undefined/);
});

test('an empty slot renders an input and a filled slot renders a clear button', () => {
  const root = stubRoot();
  renderSlots(root, { slots: ['ev5', '', ''], vehicles: [ev5, sealion] });
  const html = root.targets['compare-slots'].innerHTML;
  assert.match(html, /Kia EV5/);
  assert.match(html, /data-clear-slot="0"/);
  assert.equal((html.match(/compare-slot__input/g) ?? []).length, 2);
});

test('rendered car names are escaped', () => {
  const root = stubRoot();
  const nasty = { ...ev5, model: '<script>x</script>' };
  renderComparison(root, { vehicles: [nasty, sealion], families, tables, benchIndex: null });
  assert.doesNotMatch(root.targets['compare-table'].innerHTML, /<script>/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/ui/compare-tab.test.js`
Expected: FAIL — cannot find module `./compare-tab.js`.

- [ ] **Step 3: Implement**

Create `public/ui/compare-tab.js`:

```javascript
// Renders the compare tab from the row model in calc/spec-compare.js.
// Formatting lives here rather than in calc/ because money() lives in
// ui/format.js and calc/ must not import from public/.

import { comparisonRows } from '../../calc/spec-compare.js';
import { money } from './format.js';

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

const carName = v => `${v.make} ${v.model}`;

// The row model never formats — it returns raw values and a format tag, so
// that calc/ stays free of both the DOM and en-AU currency.
export function formatValue(value, format, unit) {
  if (value === null || value === undefined) return '—';
  const suffix = unit ? ` ${unit}` : '';
  if (format === 'money') return money(value);
  if (format === 'percent') return `${Math.round(value * 100)}%`;
  if (format === 'decimal1') return `${Number(value).toFixed(1)}${suffix}`;
  if (format === 'integer') return `${Number(value).toLocaleString('en-AU')}${suffix}`;
  return `${value}${suffix}`;
}

export function renderSlots(root, { slots, vehicles }) {
  const target = root.querySelector('#compare-slots');
  if (!target) return;

  target.innerHTML = slots.map((id, index) => {
    const vehicle = id ? vehicles.find(v => v.id === id) : null;
    if (vehicle) {
      return `
      <div class="compare-slot compare-slot--filled" data-slot="${index}">
        <p class="compare-slot__name">${escapeHtml(carName(vehicle))}</p>
        <p class="compare-slot__variant">${escapeHtml(vehicle.variant ?? '')}</p>
        <button type="button" class="compare-slot__clear" data-clear-slot="${index}"
                aria-label="Remove ${escapeHtml(carName(vehicle))} from the comparison">
          Remove
        </button>
      </div>`;
    }
    return `
      <div class="compare-slot" data-slot="${index}">
        <label class="compare-slot__label" for="compare-input-${index}">
          Car ${index + 1}${index === 2 ? ' (optional)' : ''}
        </label>
        <input class="compare-slot__input" id="compare-input-${index}" type="text"
               role="combobox" autocomplete="off" aria-expanded="false"
               aria-controls="compare-listbox-${index}"
               placeholder="Search make, model or variant">
        <div class="ac__list" id="compare-listbox-${index}" role="listbox" hidden></div>
      </div>`;
  }).join('');
}

function caveatMarkup(caveats, columns) {
  // At most two. bootDown can attract three rules at once, and three amber
  // bands under one row is a wall rather than an explanation — the precedence
  // order in calc/spec-compare.js puts the most specific wording first.
  return caveats.slice(0, 2).map(caveat => `
    <tr class="compare-caveat-row">
      <td class="compare-caveat" colspan="${columns + 1}" data-caveat="${escapeHtml(caveat.id)}">
        ${escapeHtml(caveat.text)}
      </td>
    </tr>`).join('');
}

export function renderComparison(root, { vehicles, families, tables, benchIndex = null }) {
  const table = root.querySelector('#compare-table');
  const prose = root.querySelector('#compare-prose');
  if (!table || !prose) return;

  if (vehicles.length < 2) {
    table.innerHTML = `<p class="skeleton-note">Pick a second car to start comparing. ` +
      `Any two cars in the dataset can be compared, whatever their body type.</p>`;
    prose.innerHTML = '';
    return;
  }

  const model = comparisonRows(vehicles, tables);
  const columns = vehicles.length;

  const head = `
    <thead>
      <tr>
        <th scope="col"><span class="visually-hidden">Specification</span></th>
        ${vehicles.map((v, i) => `
          <th scope="col" class="compare-head compare-head--${i}">
            ${escapeHtml(carName(v))}
            <span class="compare-head__variant">${escapeHtml(v.variant ?? '')}</span>
          </th>`).join('')}
      </tr>
    </thead>`;

  const body = model.groups.map(group => `
    <tbody class="compare-group" data-group="${escapeHtml(group.key)}">
      <tr><th class="compare-group__label" colspan="${columns + 1}" scope="colgroup">
        ${escapeHtml(group.label)}
      </th></tr>
      ${group.rows.map(row => `
        <tr data-row="${escapeHtml(row.key)}">
          <th scope="row" class="compare-row__label">${escapeHtml(row.label)}</th>
          ${row.values.map((value, i) => `
            <td class="compare-cell${row.winnerIndex === i ? ' compare-cell--win' : ''}">
              ${escapeHtml(formatValue(value, row.format, row.unit))}
            </td>`).join('')}
        </tr>
        ${caveatMarkup(row.caveats, columns)}`).join('')}
    </tbody>`).join('');

  table.innerHTML = `<table class="compare-grid">${head}${body}</table>`;

  // A variant whose family record is missing renders its table column and
  // simply omits the prose, rather than failing the whole comparison.
  prose.innerHTML = vehicles.map((vehicle, i) => {
    const family = families.find(f => f.id === vehicle.familyId);
    if (!family) return '';
    const list = (items, className) => (items ?? []).length === 0 ? '' : `
      <ul class="${className}">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    return `
      <section class="compare-prose__car compare-prose__car--${i}"
               ${benchIndex === i ? 'data-benched="true"' : ''}>
        <h3>${escapeHtml(carName(vehicle))}</h3>
        ${family.summary ? `<p>${escapeHtml(family.summary)}</p>` : ''}
        ${list(family.pros, 'compare-pros')}
        ${list(family.cons, 'compare-cons')}
        ${(family.sources ?? []).length > 0 ? `<details><summary>Sources</summary><ul>${
          family.sources.map(src =>
            `<li><a href="${escapeHtml(src)}" rel="noopener noreferrer" target="_blank">${escapeHtml(src)}</a></li>`
          ).join('')
        }</ul></details>` : ''}
      </section>`;
  }).join('');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test public/ui/compare-tab.test.js`
Expected: PASS, all 11 tests.

- [ ] **Step 5: Commit**

```bash
git add public/ui/compare-tab.js public/ui/compare-tab.test.js
git commit -m "feat: render the comparison table, caveats and prose"
```

---

### Task 8: The mobile bench and off-screen notes

**Files:**
- Modify: `public/ui/compare-tab.js`
- Test: `public/ui/compare-tab.test.js`

**Interfaces:**
- Consumes: `renderComparison` from Task 7.
- Produces:
  - `renderBench(root, { vehicles, benchIndex, model })` — writes `#compare-bench`.
  - `renderComparison` now honours a non-null `benchIndex`: the benched column is omitted from the table, and a grey "off screen" note appears on any row the benched car wins.
  - `offScreenNote(row, vehicles, benchIndex)` → `string | null`.

This is the correction the mockups forced. Best-in-row is computed by `comparisonRows` across **every** filled slot including the benched one, so a two-up view must not silently re-score what it shows. Without the note, the price row would put the winner marker on a $61,170 car while the actual cheapest sat benched at $46,990 — or, worse, mark nothing at all and leave the reader wondering.

Bench position is view state only. It is never written to the URL: it is an artefact of the viewport, not of the comparison.

- [ ] **Step 1: Write the failing tests**

Append to `public/ui/compare-tab.test.js`:

```javascript
import { renderBench, offScreenNote } from './compare-tab.js';
import { comparisonRows } from '../../calc/spec-compare.js';

const cheap = { ...sealion, id: 'chp', make: 'BYD', model: 'Dolphin', powertrain: 'bev',
  listPrice: 29840, combinedRangeKm: undefined, fuelConsumptionL100km: undefined };

test('the benched car is left out of the table', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion, cheap], families, tables, benchIndex: 2 });
  const html = root.targets['compare-table'].innerHTML;
  assert.match(html, /Kia EV5/);
  assert.doesNotMatch(html, /Dolphin/);
  // Two car columns, not three.
  assert.equal((html.match(/compare-head--/g) ?? []).length, 2);
});

test('a row the benched car wins says so, and names the number', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion, cheap], families, tables, benchIndex: 2 });
  const html = root.targets['compare-table'].innerHTML;
  const priceRow = html.split('data-row="listPrice"')[1].split('data-row="')[0];
  assert.match(priceRow, /compare-offscreen/);
  assert.match(priceRow, /Dolphin/);
  assert.match(priceRow, /\$29,840/);
});

test('no off-screen note on a row a visible car wins', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion, cheap], families, tables, benchIndex: 2 });
  const html = root.targets['compare-table'].innerHTML;
  const warranty = html.split('data-row="warrantyYears"')[1].split('data-row="')[0];
  assert.doesNotMatch(warranty, /compare-offscreen/);
});

test('a caveated row gets no off-screen note, because it has no winner to report', () => {
  const model = comparisonRows([ev5, sealion, cheap], tables);
  const totalRange = model.groups.flatMap(g => g.rows).find(r => r.key === 'totalRange');
  assert.equal(offScreenNote(totalRange, [ev5, sealion, cheap], 1), null);
});

test('desktop passes no bench and gets no notes at all', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion, cheap], families, tables, benchIndex: null });
  assert.doesNotMatch(root.targets['compare-table'].innerHTML, /compare-offscreen/);
  assert.match(root.targets['compare-table'].innerHTML, /Dolphin/);
});

test('the bench names the car and flags that it appears in a callout', () => {
  const root = stubRoot();
  const model = comparisonRows([ev5, sealion, cheap], tables);
  renderBench(root, { vehicles: [ev5, sealion, cheap], benchIndex: 2, model });
  const html = root.targets['compare-bench'].innerHTML;
  assert.match(html, /Dolphin/);
  assert.match(html, /data-bench-index="2"/);
  assert.match(html, /compare-chip__dot/);
});

test('the bench is empty when only two cars are being compared', () => {
  const root = stubRoot();
  const model = comparisonRows([ev5, sealion], tables);
  renderBench(root, { vehicles: [ev5, sealion], benchIndex: null, model });
  assert.equal(root.targets['compare-bench'].innerHTML.trim(), '');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test public/ui/compare-tab.test.js`
Expected: FAIL — `renderBench` and `offScreenNote` are not exported.

- [ ] **Step 3: Implement**

Add to `public/ui/compare-tab.js`:

```javascript
// Best-in-row is scored across every filled slot, including the one that is
// off-screen on a phone (calc/spec-compare.js never sees the bench). So a
// two-up view has to account for a winner it is not showing — otherwise the
// marker lands on the best *visible* car and quietly misreports the set.
export function offScreenNote(row, vehicles, benchIndex) {
  if (benchIndex === null || benchIndex === undefined) return null;
  if (row.caveats.length > 0) return null;
  if (row.winnerIndex !== benchIndex) return null;

  const vehicle = vehicles[benchIndex];
  const value = formatValue(row.values[benchIndex], row.format, row.unit);
  return `Off screen · ${carName(vehicle)} — ${value}, best of the three.`;
}

export function renderBench(root, { vehicles, benchIndex, model }) {
  const target = root.querySelector('#compare-bench');
  if (!target) return;
  if (benchIndex === null || benchIndex === undefined || vehicles.length < 3) {
    target.innerHTML = '';
    return;
  }

  // A dot warns that the benched car appears in at least one callout, so the
  // reader knows before scrolling that it is doing more than sitting out.
  const rows = model.groups.flatMap(group => group.rows);
  const mentioned = rows.some(row =>
    row.winnerIndex === benchIndex ||
    row.caveats.some(caveat => caveat.text.includes(carName(vehicles[benchIndex])))
  );

  target.innerHTML = `
    <p class="compare-bench__hint" id="compare-bench-hint">
      Two fit on screen. Tap the third to swap it in.
    </p>
    ${vehicles.map((vehicle, index) => `
      <button type="button" class="compare-chip${index === benchIndex ? ' compare-chip--benched' : ''}"
              data-bench-index="${index}" aria-describedby="compare-bench-hint"
              ${index === benchIndex ? '' : 'aria-pressed="true"'}>
        ${escapeHtml(carName(vehicle))}${
          index === benchIndex && mentioned ? '<span class="compare-chip__dot" aria-hidden="true"></span>' : ''
        }
      </button>`).join('')}`;
}
```

Change `renderComparison` so the benched column is dropped from the table while the row model still sees every car. Replace the `const model = ...` line and the `body` construction with:

```javascript
  // The row model is always built from ALL filled slots — that is what keeps
  // the winner honest. Only the *rendering* drops the benched column.
  const model = comparisonRows(vehicles, tables);
  const shown = vehicles
    .map((vehicle, index) => ({ vehicle, index }))
    .filter(entry => entry.index !== benchIndex);
  const columns = shown.length;
```

and update `head` to iterate `shown`:

```javascript
        ${shown.map(({ vehicle, index }) => `
          <th scope="col" class="compare-head compare-head--${index}">
            ${escapeHtml(carName(vehicle))}
            <span class="compare-head__variant">${escapeHtml(vehicle.variant ?? '')}</span>
          </th>`).join('')}
```

and the row body to iterate `shown` and append the note:

```javascript
      ${group.rows.map(row => {
        const note = offScreenNote(row, vehicles, benchIndex);
        return `
        <tr data-row="${escapeHtml(row.key)}">
          <th scope="row" class="compare-row__label">${escapeHtml(row.label)}</th>
          ${shown.map(({ index }) => `
            <td class="compare-cell${row.winnerIndex === index ? ' compare-cell--win' : ''}">
              ${escapeHtml(formatValue(row.values[index], row.format, row.unit))}
            </td>`).join('')}
        </tr>
        ${caveatMarkup(row.caveats, columns)}
        ${note ? `<tr class="compare-caveat-row"><td class="compare-offscreen" colspan="${columns + 1}">
          ${escapeHtml(note)}</td></tr>` : ''}`;
      }).join('')}
```

Also mark the benched car's prose as collapsed — it already receives `data-benched="true"`, which Task 10 styles.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test public/ui/compare-tab.test.js`
Expected: PASS, all 18 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/ui/compare-tab.js public/ui/compare-tab.test.js
git commit -m "feat: mobile bench with off-screen notes so the winner never lies"
```

---

### Task 9: Wire it into the app

**Files:**
- Modify: `public/ui/app.js`
- Modify: `public/ui/crossover-chart.js`
- Test: `public/ui/crossover-chart.test.js`

**Interfaces:**
- Consumes: `applyTab`, `bindTabs` (Task 6); `bindAutocomplete` (Task 5); `renderSlots`, `renderComparison`, `renderBench` (Tasks 7–8); `comparisonRows` (Task 2); `normaliseCompare`, `MAX_COMPARE_SLOTS` (Task 1).
- Produces: a working tab. No new exports.

Two hazards to handle. First, `app.js` repaints the crossover chart on `resize` and `orientationchange` regardless of which tab is showing, and measuring a hidden element gives zero widths — so `renderChart` needs an early return, and switching back to tab 1 needs a repaint. Second, an id in the URL that names no car in the dataset must leave the slot empty rather than throw.

- [ ] **Step 1: Write the failing test for the chart guard**

Append to `public/ui/crossover-chart.test.js`:

```javascript
test('a hidden container is not painted, so a resize behind another tab cannot corrupt it', () => {
  const target = { innerHTML: 'untouched', clientWidth: 0, getBoundingClientRect: () => ({ width: 0 }) };
  renderChart({ querySelector: () => target }, series, 900, null, null);
  assert.equal(target.innerHTML, 'untouched');
});
```

Reuse whatever `series` fixture the existing tests in that file build; if it is constructed inline per test, lift one into a module-level constant named `series`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/ui/crossover-chart.test.js`
Expected: FAIL — the chart paints into the zero-width container.

- [ ] **Step 3: Implement the guard**

At the top of `renderChart` in `public/ui/crossover-chart.js`, after the target lookup and its existing null check:

```javascript
  // The compare tab hides this panel with the `hidden` attribute, and the
  // resize/orientationchange listeners in app.js fire whichever tab is
  // showing. A hidden element measures zero, and painting against a zero
  // width bakes a broken layout into the cached SVG. Skip instead; app.js
  // repaints when tab 1 comes back.
  const width = target.clientWidth ?? target.getBoundingClientRect?.().width ?? 0;
  if (width === 0) return;
```

If `renderChart` already reads a width for its own layout, reuse that value rather than measuring twice.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test public/ui/crossover-chart.test.js`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Wire the tab into `app.js`**

Extend the imports at the top of `public/ui/app.js`:

```javascript
import { defaultState, toQueryString, fromQueryString, normaliseCompare, MAX_COMPARE_SLOTS } from './state.js';
import { applyTab, bindTabs } from './tabs.js';
import { bindAutocomplete } from './autocomplete.js';
import { renderSlots, renderComparison, renderBench } from './compare-tab.js';
import { comparisonRows } from '../../calc/spec-compare.js';
```

Add near the other constants at the top of the file:

```javascript
// Below this the comparison drops to two columns and benches the third car.
// Matches the breakpoint in styles.css; a phone cannot show three columns of
// "$61,170" and a row label without one of them being a lie about its width.
const COMPARE_TWO_UP_MAX_PX = 700;
```

Inside `boot`, after the existing `renderShortlist` definition, add:

```javascript
  // Which car is off-screen on a phone. View state only — never in the URL,
  // because it is an artefact of the viewport rather than of the comparison.
  let benchIndex = 2;

  function compareSlots() {
    const slots = normaliseCompare(state.compare);
    while (slots.length < MAX_COMPARE_SLOTS) slots.push('');
    return slots;
  }

  function renderCompareTab() {
    const slots = compareSlots();
    // An id from a shared link that names no car in the dataset leaves its
    // slot empty rather than throwing — the dataset changes, links outlive it.
    const picked = slots.map(id => vehicles.find(v => v.id === id) ?? null).filter(Boolean);

    renderSlots(root, { slots, vehicles });

    const twoUp = typeof window !== 'undefined' && window.innerWidth <= COMPARE_TWO_UP_MAX_PX;
    const bench = twoUp && picked.length === 3
      ? Math.min(benchIndex, picked.length - 1)
      : null;

    renderComparison(root, { vehicles: picked, families, tables, benchIndex: bench });
    renderBench(root, {
      vehicles: picked,
      benchIndex: bench,
      model: picked.length >= 2 ? comparisonRows(picked, tables) : { groups: [] }
    });
  }
```

In `render()`, after `renderShortlist(verdict);`, add:

```javascript
    applyTab(root, state.tab);
    renderCompareTab();
```

Near the other bindings at the bottom of `boot` (beside `bindPresets(root)`), add:

```javascript
  bindTabs(root, tab => {
    state = { ...state, tab };
    render();
    // The chart skips painting while its panel is hidden, so coming back to
    // tab 1 needs one repaint with a real width to measure against.
    if (tab === 'find' && lastSeries) {
      renderChart(root, lastSeries, state.monthlyBudget, lastCliff, lastEntry);
    }
  });

  bindAutocomplete(root, {
    getVehicles: () => vehicles,
    onSelect: (slotIndex, vehicleId) => {
      const slots = compareSlots();
      slots[slotIndex] = vehicleId;
      state = { ...state, compare: normaliseCompare(slots) };
      // Picking commits straight away: the slot and the comparison both
      // repaint on the spot, with no Apply button in between.
      render();
    }
  });

  // Tapping a benched chip swaps it with the right-hand visible column, which
  // is predictable enough to need no extra affordance.
  root.querySelector('#compare-bench')?.addEventListener('click', event => {
    const chip = event.target.closest?.('[data-bench-index]');
    if (!chip) return;
    const tapped = Number(chip.dataset.benchIndex);
    if (tapped === benchIndex) {
      const rightHand = [0, 1, 2].filter(i => i !== benchIndex)[1];
      benchIndex = rightHand;
      renderCompareTab();
    }
  });
```

Finally, extend the existing resize handler so the two-up decision re-runs on rotation. Change `rerenderChartForViewport` to:

```javascript
  const rerenderChartForViewport = debounce(() => {
    if (lastSeries) renderChart(root, lastSeries, state.monthlyBudget, lastCliff, lastEntry);
    // The comparison picks two-up or three-up from the viewport too, and like
    // the chart it only re-runs on a state change without this.
    renderCompareTab();
  }, RESIZE_DEBOUNCE_MS);
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify in the browser**

```bash
npm start
```

Check each of these at `http://localhost:3000`:
1. The page loads on the "Find a car" tab, and all three original steps behave exactly as before.
2. Clicking "Compare" shows the compare panel; the URL gains `?tab=compare`.
3. Typing `ev5` in slot 1 shows grouped suggestions; arrow keys move; Enter picks; the slot fills immediately.
4. Filling slot 2 draws the table.
5. Comparing a BEV against a PHEV shows the amber "Not like for like" band on Total range, and that row marks no winner.
6. Copying the URL into a new tab restores the same comparison.
7. Narrowing the window below 700px benches the third car; tapping its chip swaps it in.
8. Switching back to "Find a car" after a resize leaves the chart correctly drawn, not collapsed.

- [ ] **Step 8: Commit**

```bash
git add public/ui/app.js public/ui/crossover-chart.js public/ui/crossover-chart.test.js
git commit -m "feat: mount the compare tab and stop the chart painting while hidden"
```

---

### Task 10: Styles

**Files:**
- Modify: `public/styles.css`

**Interfaces:**
- Consumes: the class names emitted by Tasks 5–8: `.tablist`, `.tab-button`, `.tab-panel`, `.compare-slots`, `.compare-slot`, `.compare-slot--filled`, `.compare-slot__input`, `.ac__list`, `.ac__group`, `.ac__group-label`, `.ac__option`, `.ac__variant`, `.ac__meta`, `.ac__empty`, `.compare-bench`, `.compare-bench__hint`, `.compare-chip`, `.compare-chip--benched`, `.compare-chip__dot`, `.compare-grid`, `.compare-head`, `.compare-head__variant`, `.compare-group__label`, `.compare-row__label`, `.compare-cell`, `.compare-cell--win`, `.compare-caveat-row`, `.compare-caveat`, `.compare-offscreen`, `.compare-prose__car`, `.compare-pros`, `.compare-cons`.
- Produces: no JS interface.

There is no CSS test. Verification is by eye against the checklist in Step 3.

- [ ] **Step 1: Read the existing conventions**

Before writing anything, read `public/styles.css` and note the custom properties already defined (colours, spacing, the six-step type scale added in commit `ddcab20`) and the existing breakpoints. Reuse them. Do not introduce a new type scale, a new spacing unit or a new accent colour — the six-step scale replaced 24 ad-hoc font sizes, and this feature must not start that again.

- [ ] **Step 2: Write the styles**

Append a clearly commented block to `public/styles.css`. It must cover:

- **Tabs.** A horizontal tablist. The selected tab is distinguished by more than colour alone — a weight change and an underline — so it survives greyscale and colour blindness. A visible `:focus-visible` ring on the buttons.
- **Slots.** Three across on desktop, stacked on mobile. A filled slot shows the car name and its Remove button; an empty slot shows its input.
- **Suggestions.** The listbox absolutely positioned under its input, above the table (`z-index`), with a scroll cap so eight results never push the page around. Group labels visually subordinate to the options under them.
- **Table.** `.compare-grid` at `width: 100%`, with the row-label column fixed and the car columns sharing what is left. `.compare-cell--win` marked by weight plus a small marker glyph — again, not colour alone.
- **Caveats.** `.compare-caveat` in the amber treatment: a tinted background and a left border, spanning the full row width. `.compare-offscreen` in a neutral grey treatment, visually distinct from amber, because the two say different things.
- **Bench.** `.compare-chip` as pill buttons above the table. `.compare-chip--benched` dashed and dimmed. `.compare-chip__dot` a small filled circle in the amber accent.
- **Breakpoint.** At `min-width: 701px` the prose columns sit side by side; below `700px` they stack, and `[data-benched="true"]` prose is collapsed. Keep the breakpoint value in sync with `COMPARE_TWO_UP_MAX_PX` in `app.js` — a comment in each pointing at the other.
- **`.visually-hidden`** if the file does not already define it (the table's first `<th>` uses it).

- [ ] **Step 3: Verify by eye**

```bash
npm start
```

At `http://localhost:3000?tab=compare`:
1. At 1280px wide: three columns, no bench, no horizontal scroll on the body.
2. At 375px wide: two columns, bench chips visible, no horizontal scroll on the body.
3. An amber caveat band and a grey off-screen band are clearly different at a glance.
4. Tab through the whole tab: every button and input takes a visible focus ring, and the tablist takes one Tab stop with arrow keys moving between tabs.
5. The winner marker is still identifiable with the page in greyscale (macOS: System Settings → Accessibility → Display → Colour Filters → Greyscale).
6. Tab 1 is visually unchanged from `main`.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/styles.css
git commit -m "style: the compare tab, its callouts and the two-up mobile layout"
```

---

### Task 11: Document the tab

**Files:**
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: Update the README**

`README.md` currently describes the app as three steps. Add a short section after "What it does" describing the second tab: that it compares up to three cars on specifications only, that it reads no salary or budget so a shared link carries neither, that the slots live in the URL as `?tab=compare&compare=id1,id2,id3`, and that fields which do not compare like for like are called out on the row where they bite rather than silently averaged.

Note the deliberate omission too: it does not cost a car under a lease, a loan or cash — that is what the first tab is for.

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe the compare tab"
```

---

## Self-Review

**Spec coverage** — each spec section against a task:

| Spec section | Task |
|---|---|
| 1. Shell and routing — tab panels, ARIA | 6 |
| 1. URL state, three serialisation rules | 1 |
| 1. Hidden-chart hazard | 9 |
| 2. Slots and autocomplete | 4, 5 |
| 3. Rows — all 18, both flagged rows included | 2 |
| 3. Written material — summary, pros, cons, sources | 7 |
| 4. Caveat rules, precedence, winner suppression | 3 |
| 4. Best-in-row across all filled slots | 2 (scoring), 8 (off-screen note) |
| 5. Desktop three-up / mobile two-up | 8, 9, 10 |
| 5. Both callout types, bench dot, collapsed prose | 8, 10 |
| 6. Modules and conventions | all |
| 7. Testing | every task |
| 8. Out of scope | nothing implements these |

**Type consistency** — `Row` is `{ key, label, unit, format, values, winnerIndex, caveats }` in Tasks 2, 3, 7 and 8. `Caveat` is `{ id, text }` throughout. `benchIndex` is `number | null` in Tasks 7, 8 and 9. `onSelect(slotIndex, vehicleId)` matches between Task 5's `bindAutocomplete` and Task 9's caller, with `''` meaning "clear". `searchVehicles(vehicles, query, limit)` matches between Tasks 4 and 5. `normaliseCompare` and `MAX_COMPARE_SLOTS` are exported in Task 1 and consumed in Task 9.

**Gap found and closed during review:** Task 2's tests originally asserted the group list against a hardcoded array, which would have broken the moment a row moved between groups; it now asserts against the exported `ROW_GROUPS`. Task 8's `renderComparison` change also needed `columns` recomputed from the visible set rather than `vehicles.length`, or every caveat band would have spanned one column too many on mobile — that is now explicit in the Step 3 diff.
