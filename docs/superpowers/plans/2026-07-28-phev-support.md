# PHEV Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user opt plug-in hybrids into the dataset from step 1, and cost them honestly — no FBT exemption, petrol in the running costs, and a battery-share assumption the user controls.

**Architecture:** A `powertrain` field on each vehicle row (absent means `'bev'`, so the existing 114 rows are untouched) drives four things: the FBT exemption path, a petrol term in running costs, the LCT/stamp-duty flags that `calc/onroad.js` already accepts but nothing passes, and whether the row survives `filterVehicles` at all. Step 2 is deliberately unchanged — its ceiling and chart keep using a BEV-only median profile — so the only new inconsistency (a PHEV priced at the ceiling is not affordable at the ceiling) is handled by disclosure on the step 3 card rather than by moving the car.

**Tech Stack:** Native ES modules, no bundler. `node --test` for tests. `calc/` stays pure — no file reads, no DOM, no network. Browser imports the same `calc/` modules unchanged.

## Global Constraints

- `calc/` must remain pure: no `fs`, no DOM, no network. Rates and tax tables arrive as plain arguments from `ui/app.js`'s `buildInputs` and the injected `tables`.
- `data/vehicles.json` and `data/families.json` are GENERATED. Never hand-edit them. Edit `data/vehicles/<familyId>.json` and `data/families/<familyId>.json`, then run `node scripts/build-dataset.js`.
- A row with no `powertrain` field is a BEV. This is load-bearing: it is what keeps the existing 40 families from needing a migration.
- **A PHEV must never be able to silently acquire the FBT exemption.** The schema enforces this from both directions (Task 1) — that failure mode is worth thousands of dollars in a wrong answer.
- `rangeKm` means *electric* range for every powertrain. For a BEV that is also its total range. `combinedRangeKm` is the extra field PHEVs carry.
- The FBT exemption for PHEVs ended **1 April 2025** (barring a pre-existing binding commitment, which this tool does not model).
- Site framing ("What's the best EV I could get?") is explicitly **out of scope** — deferred by the author.
- Run `npm test` before every commit. The repo has a pre-push hook that blocks pushes on red tests.
- Commit after each task. Do not push.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `data/schema.js` | Validation + plausibility bounds | Modify — powertrain field, per-powertrain bounds, cross-field rules |
| `data/tax-tables.json` | Tax constants | Modify — `phevFbtExemptionEnded` |
| `data/rates.json` | Editable market rates | Modify — `petrolCentsPerLitre` |
| `calc/fbt.js` | FBT exemption decision | Modify — powertrain-aware |
| `calc/running-costs.js` | Annual running cost | Modify — petrol term, battery share |
| `calc/onroad.js` | LCT, stamp duty, drive-away | Unchanged — flags already exist, callers start passing them |
| `calc/compare.js` | Per-option costs | Modify — thread powertrain and flags through |
| `calc/capacity.js` | Purchasing power for step 2 | Unchanged. Callers pass a BEV-only pool |
| `public/ui/state.js` | State shape and URL round-trip | Modify — `includePhev`, `phevBatterySharePct`, `minElectricRangeKm`, `petrolCentsPerLitre` |
| `public/ui/cars.js` | Filter, card model, card markup | Modify — powertrain filter, PHEV disclosure |
| `public/ui/app.js` | Wiring | Modify — BEV-only profile, toggle-aware floor, conditional controls |
| `public/index.html` | Markup | Modify — toggle, plus a PHEV-only group holding minimum electric range and battery share |
| `public/styles.css` | Styling | Modify — warning row, conditional group |
| `docs/phev-research-brief.md` | Research brief for the dispatch job | Create |

---

## Task 1: Powertrain in the schema

**Files:**
- Modify: `data/schema.js`
- Test: `data/schema.test.js`

**Interfaces:**
- Produces: vehicle rows may carry `powertrain: 'bev' | 'phev'`, and when `'phev'`, the required fields `combinedRangeKm`, `fuelConsumptionL100km`, `isFuelEfficientForLct`, `isGreenForVicDuty`. Absent `powertrain` means `'bev'`. `POWERTRAINS` is exported as `['bev', 'phev']`.

**Why the bounds must vary by powertrain:** the current bounds reject real PHEVs outright — `batteryKwh: [15, 200]` (PHEVs run 10–30kWh) and `rangeKm: [100, 1000]` (PHEV electric range is 40–110km). And the existing consistency check `batteryKwh / rangeKm × 100 ≈ consumptionKwhPer100km` is a BEV identity that only holds for a PHEV if `rangeKm` is its *electric* range — which is why the Global Constraints fix that meaning.

- [ ] **Step 1: Write the failing tests**

Add to `data/schema.test.js`:

```js
import { validateVehicle, POWERTRAINS } from './schema.js';

// A row that says nothing about its powertrain is a BEV. This is what keeps
// the existing 40 families from needing a migration.
test('a row with no powertrain is still valid and treated as a BEV', () => {
  const row = bevRow();
  delete row.powertrain;
  assert.equal(validateVehicle(row).valid, true);
});

test('powertrain must be one of the known values', () => {
  const result = validateVehicle({ ...bevRow(), powertrain: 'diesel' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /powertrain/);
});

test('POWERTRAINS names exactly the two supported drivetrains', () => {
  assert.deepEqual(POWERTRAINS, ['bev', 'phev']);
});

// The dangerous failure mode: a PHEV that forgets to say so is scored as an
// FBT-exempt EV, which is wrong by thousands of dollars. Closed from both
// directions rather than trusting the author to remember.
test('PHEV-only fields without powertrain: phev is rejected', () => {
  const result = validateVehicle({ ...bevRow(), fuelConsumptionL100km: 6.8 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /powertrain/);
});

test('powertrain phev without its required fields is rejected', () => {
  const result = validateVehicle({ ...bevRow(), powertrain: 'phev' });
  assert.equal(result.valid, false);
  for (const field of ['combinedRangeKm', 'fuelConsumptionL100km', 'isFuelEfficientForLct', 'isGreenForVicDuty']) {
    assert.match(result.errors.join(' '), new RegExp(field), `expected ${field} to be required`);
  }
});

test('a complete PHEV row validates', () => {
  assert.equal(validateVehicle(phevRow()).valid, true);
});

// A PHEV's electric range and battery are both far below the BEV floors.
test('PHEV battery and electric range use their own bounds', () => {
  const row = phevRow({ batteryKwh: 11.8, rangeKm: 55, consumptionKwhPer100km: 21 });
  assert.equal(validateVehicle(row).valid, true, validateVehicle(row).errors.join('; '));
});

test('a BEV still may not have a 55km range', () => {
  const result = validateVehicle(bevRow({ rangeKm: 55 }));
  assert.equal(result.valid, false);
});

test('combined range must exceed electric range', () => {
  const result = validateVehicle(phevRow({ rangeKm: 84, combinedRangeKm: 80 }));
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /combinedRangeKm/);
});

test('the electric consistency check uses electric range for a PHEV', () => {
  // 11.8kWh over 84km implies 14.0kWh/100km; stating 25 is a real error.
  const result = validateVehicle(phevRow({ batteryKwh: 11.8, rangeKm: 84, consumptionKwhPer100km: 25 }));
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /consumptionKwhPer100km/);
});
```

Add these fixture helpers near the top of `data/schema.test.js`, beside whatever row builder already exists there:

```js
const bevRow = (over = {}) => ({
  id: 'test-bev', familyId: 'test', make: 'Test', model: 'Car', variant: 'Base',
  bodyType: 'SUV', sourcedAt: '2026-07-28',
  listPrice: 55000, batteryKwh: 60, rangeKm: 450, consumptionKwhPer100km: 13.3,
  bootLitresSeatsUp: 450, bootLitresSeatsDown: 1200, seats: 5, towKg: 750,
  warrantyYears: 5, insuranceAnnual: 1600,
  depreciationCurve: [1, 0.75, 0.64, 0.56, 0.49, 0.43],
  ...over
});

const phevRow = (over = {}) => ({
  ...bevRow(),
  id: 'test-phev', powertrain: 'phev',
  batteryKwh: 18.1, rangeKm: 84, consumptionKwhPer100km: 21.5,
  combinedRangeKm: 760, fuelConsumptionL100km: 6.8,
  isFuelEfficientForLct: true, isGreenForVicDuty: true,
  ...over
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test data/schema.test.js`
Expected: FAIL — `POWERTRAINS` is not exported, and PHEV rows are rejected by `batteryKwh`/`rangeKm` bounds.

- [ ] **Step 3: Implement**

In `data/schema.js`, add near the other constants:

```js
export const POWERTRAINS = ['bev', 'phev'];

// Absent means BEV — that is what keeps the existing 40 families from needing
// a migration. Everything downstream reads powertrain through this.
export const powertrainOf = row => row?.powertrain ?? 'bev';

// Fields that only a PHEV carries. Their presence on a row that has not
// declared powertrain: 'phev' is an error, not a harmless extra: the
// dangerous direction of this mistake is a PHEV being costed as an
// FBT-exempt EV, so the check runs both ways.
const PHEV_ONLY_FIELDS = [
  'combinedRangeKm', 'fuelConsumptionL100km', 'isFuelEfficientForLct', 'isGreenForVicDuty'
];

// A PHEV's battery and electric range are both far below anything a BEV
// could plausibly have, so one shared bound cannot serve both. rangeKm is
// electric range for every powertrain (for a BEV that is also its total),
// which is what keeps the batteryKwh/rangeKm consistency check below valid
// for both.
const PHEV_BOUNDS = {
  batteryKwh: [8, 60],
  rangeKm: [30, 200],
  combinedRangeKm: [300, 1500],
  fuelConsumptionL100km: [1, 15]
};

const boundsFor = (row, field) =>
  (powertrainOf(row) === 'phev' && PHEV_BOUNDS[field]) || NUMERIC_BOUNDS[field];
```

In `validateVehicle`, after the string-field loop, add:

```js
  const powertrain = powertrainOf(row);
  if (!POWERTRAINS.includes(powertrain)) {
    errors.push(`powertrain must be one of ${POWERTRAINS.join(', ')}, got ${row.powertrain}`);
  }

  const strayPhevFields = PHEV_ONLY_FIELDS.filter(f => row[f] !== undefined);
  if (powertrain !== 'phev' && strayPhevFields.length > 0) {
    errors.push(
      `${strayPhevFields.join(', ')} only belong on a plug-in hybrid — set powertrain: "phev" or remove them`
    );
  }
  if (powertrain === 'phev') {
    for (const field of ['combinedRangeKm', 'fuelConsumptionL100km']) {
      const value = row[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${field} must be a finite number on a plug-in hybrid`);
        continue;
      }
      const [min, max] = PHEV_BOUNDS[field];
      if (value < min || value > max) {
        errors.push(`${field} must be between ${min} and ${max}, got ${value}`);
      }
    }
    for (const field of ['isFuelEfficientForLct', 'isGreenForVicDuty']) {
      if (typeof row[field] !== 'boolean') {
        errors.push(`${field} must be true or false on a plug-in hybrid — it decides which tax rate applies`);
      }
    }
    if (
      typeof row.combinedRangeKm === 'number' && typeof row.rangeKm === 'number' &&
      row.combinedRangeKm <= row.rangeKm
    ) {
      errors.push(
        `combinedRangeKm (${row.combinedRangeKm}) must exceed rangeKm (${row.rangeKm}), which is the electric-only range`
      );
    }
  }
```

Then change the numeric loop to use the per-powertrain bounds. Replace:

```js
    const [min, max] = NUMERIC_BOUNDS[field];
```

with:

```js
    const [min, max] = boundsFor(row, field);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test data/schema.test.js`
Expected: PASS.

- [ ] **Step 5: Confirm the existing dataset still builds**

Run: `node scripts/build-dataset.js`
Expected: `114 variants across 40 families, 0 failures`, and `git diff --stat data/vehicles.json data/families.json` shows no change.

- [ ] **Step 6: Commit**

```bash
git add data/schema.js data/schema.test.js
git commit -m "feat: accept a powertrain field with per-powertrain bounds"
```

---

## Task 2: PHEVs lose the FBT exemption

**Files:**
- Modify: `calc/fbt.js`, `data/tax-tables.json`
- Test: `calc/fbt.test.js`

**Interfaces:**
- Consumes: `powertrain` from Task 1.
- Produces: `fbtTreatment({ leaseStartDate, vehicleValue, powertrain }, tables)` returns `{ exempt, discountRate, overThreshold, phevIneligible, phase }`. `powertrain` defaults to `'bev'`.

**Domain note:** Australia's FBT exemption for electric cars covered BEVs, PHEVs and hydrogen FCEVs from 1 July 2022. PHEVs ceased to be eligible from **1 April 2025** unless there was a pre-existing binding financial commitment — which this tool does not model, and says so. This is the single most consequential difference between a PHEV and a BEV on this site, because the novated lease advantage is built entirely on that exemption.

- [ ] **Step 1: Write the failing tests**

Add to `calc/fbt.test.js`:

```js
test('a BEV under the threshold is exempt, as before', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000 }, tables);
  assert.equal(t.exempt, true);
  assert.equal(t.phevIneligible, false);
});

test('a PHEV leased after 1 April 2025 is not exempt at any price', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'phev' }, tables);
  assert.equal(t.exempt, false);
  assert.equal(t.phevIneligible, true);
  assert.equal(t.discountRate, 0, 'not a discount — the exemption is simply gone');
});

// The cut-off is a date, not a blanket rule, and the tables own it.
test('a PHEV leased before the cut-off keeps the exemption', () => {
  const t = fbtTreatment({ leaseStartDate: '2025-03-31', vehicleValue: 60000, powertrain: 'phev' }, tables);
  assert.equal(t.exempt, true);
  assert.equal(t.phevIneligible, false);
});

test('an omitted powertrain is treated as a BEV', () => {
  const without = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000 }, tables);
  const explicit = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'bev' }, tables);
  assert.deepEqual(without, explicit);
});

// An ineligible PHEV pays real FBT, which is the whole point.
test('an ineligible PHEV accrues FBT where an equivalent BEV accrues none', () => {
  const phev = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'phev' }, tables);
  const bev = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'bev' }, tables);
  assert.ok(annualFbt({ baseValue: 60000, treatment: phev }, tables) > 0);
  assert.equal(annualFbt({ baseValue: 60000, treatment: bev }, tables), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test calc/fbt.test.js`
Expected: FAIL — `phevIneligible` is undefined and the PHEV comes back exempt.

- [ ] **Step 3: Add the date to the tax tables**

In `data/tax-tables.json`, add after the `"fbtPhases"` array:

```json
  "phevFbtExemptionEnded": "2025-04-01",
```

- [ ] **Step 4: Implement**

Replace `fbtTreatment` in `calc/fbt.js`:

```js
// Plug-in hybrids were eligible for the electric-car FBT exemption until
// 1 April 2025 and are not eligible after it. A pre-existing binding
// financial commitment could carry the exemption past that date; this tool
// does not model that, and the UI says so.
//
// This is not a discount, it is the absence of the exemption: an ineligible
// PHEV pays FBT on the full statutory formula, which is why discountRate
// stays 0 rather than becoming 1.
export function fbtTreatment({ leaseStartDate, vehicleValue, powertrain = 'bev' }, tables) {
  const phase = resolvePhase(leaseStartDate, tables);
  const overThreshold = vehicleValue > tables.lct.fuelEfficientThreshold;
  const phevIneligible =
    powertrain === 'phev' && leaseStartDate >= tables.phevFbtExemptionEnded;

  if (phevIneligible || overThreshold) {
    return { exempt: false, discountRate: 0, overThreshold, phevIneligible, phase };
  }
  const exemptCap = phase.fullExemptionUpTo;
  const exempt = exemptCap === null || vehicleValue <= exemptCap;
  return {
    exempt,
    discountRate: exempt ? 0 : phase.discountRate,
    overThreshold: false,
    phevIneligible: false,
    phase
  };
}
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. Existing callers pass no `powertrain`, so they take the BEV path unchanged.

- [ ] **Step 6: Commit**

```bash
git add calc/fbt.js calc/fbt.test.js data/tax-tables.json
git commit -m "feat: PHEVs lose the FBT exemption from 1 April 2025"
```

---

## Task 3: Petrol in the running costs

**Files:**
- Modify: `calc/running-costs.js`, `data/rates.json`
- Test: `calc/running-costs.test.js`

**Interfaces:**
- Consumes: `fuelConsumptionL100km` and `powertrain` from Task 1.
- Produces: `runningCosts({ vehicle, annualKm, batterySharePct = 100, rates })` returns `{ insurance, electricity, petrol, other, totalIncGst, totalExGst }`. `rates` gains `petrolCentsPerLitre`.

**Why this is the most sensitive number on a PHEV card:** a plug-in hybrid driven mostly on battery costs about what a BEV costs to run; driven mostly on petrol it costs about what a petrol car costs. Real-world studies consistently find private PHEVs achieve a substantially lower electric share than their type-approval figures assume. The share is therefore a user input (Task 5), not a constant we pick for them.

- [ ] **Step 1: Write the failing tests**

Add to `calc/running-costs.test.js`:

```js
const rates = { electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240, petrolCentsPerLitre: 195 };

const phev = {
  powertrain: 'phev', consumptionKwhPer100km: 21.5, fuelConsumptionL100km: 6.8,
  insuranceAnnual: 1700
};

test('a BEV burns no petrol whatever the battery share says', () => {
  const bev = { consumptionKwhPer100km: 16, insuranceAnnual: 1600 };
  const costs = runningCosts({ vehicle: bev, annualKm: 15000, batterySharePct: 40, rates });
  assert.equal(costs.petrol, 0, 'a BEV has no combustion side to run');
  assert.equal(costs.electricity, (16 / 100) * 15000 * 0.28);
});

test('a PHEV at 100% battery share burns no petrol', () => {
  const costs = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 100, rates });
  assert.equal(costs.petrol, 0);
  assert.equal(costs.electricity, (21.5 / 100) * 15000 * 0.28);
});

test('a PHEV at 0% battery share runs entirely on petrol', () => {
  const costs = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 0, rates });
  assert.equal(costs.electricity, 0);
  assert.equal(costs.petrol, (6.8 / 100) * 15000 * 1.95);
});

test('the split is proportional to the battery share', () => {
  const costs = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 60, rates });
  assert.equal(costs.electricity, (21.5 / 100) * 9000 * 0.28);
  assert.equal(costs.petrol, (6.8 / 100) * 6000 * 1.95);
});

// The share is the biggest lever on a PHEV's running cost, which is exactly
// why the user owns it rather than the code assuming it.
test('battery share materially moves a PHEV total', () => {
  const mostlyElectric = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 80, rates });
  const mostlyPetrol = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 20, rates });
  assert.ok(mostlyPetrol.totalIncGst > mostlyElectric.totalIncGst * 1.15,
    'a 60-point swing in battery share should move the total by more than 15%');
});

test('battery share defaults to fully electric, matching the BEV-only behaviour it replaced', () => {
  assert.deepEqual(
    runningCosts({ vehicle: phev, annualKm: 15000, rates }),
    runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 100, rates })
  );
});

test('an out-of-range battery share is clamped rather than producing negative kilometres', () => {
  const high = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 140, rates });
  const low = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: -20, rates });
  assert.equal(high.petrol, 0);
  assert.equal(low.electricity, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test calc/running-costs.test.js`
Expected: FAIL — `costs.petrol` is undefined.

- [ ] **Step 3: Add the rate**

In `data/rates.json`, add `"petrolCentsPerLitre": 195,` beside `electricityCentsPerKwh`, and add to `sources`:

```json
    "petrolCentsPerLitre": "Melbourne 91 unleaded, cycle-averaged estimate July 2026. Only used for plug-in hybrids.",
```

- [ ] **Step 4: Implement**

Replace `calc/running-costs.js`:

```js
// A plug-in hybrid runs on two fuels, and the split between them moves its
// running cost more than any other single figure — mostly-battery is about
// what a BEV costs, mostly-petrol is about what a petrol car costs. The share
// is therefore an input the user sets, not a constant chosen here: real-world
// studies consistently find private PHEVs fall well short of the electric
// share their type-approval figures assume.
//
// A BEV ignores the share entirely. It has no combustion side, so there is
// nothing for the petrol term to describe.
export function runningCosts({ vehicle, annualKm, batterySharePct = 100, rates }) {
  const isPhev = vehicle.powertrain === 'phev';
  const share = isPhev ? Math.min(100, Math.max(0, batterySharePct)) / 100 : 1;

  const electricKm = annualKm * share;
  const petrolKm = annualKm - electricKm;

  const kwh = (vehicle.consumptionKwhPer100km / 100) * electricKm;
  const electricity = kwh * (rates.electricityCentsPerKwh / 100);

  const litres = isPhev ? (vehicle.fuelConsumptionL100km / 100) * petrolKm : 0;
  const petrol = litres * ((rates.petrolCentsPerLitre ?? 0) / 100);

  const insurance = vehicle.insuranceAnnual;
  const other = rates.otherRunningCostsAnnual;
  const totalIncGst = insurance + electricity + petrol + other;
  return {
    insurance,
    electricity,
    petrol,
    other,
    totalIncGst,
    totalExGst: totalIncGst * 10 / 11
  };
}
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. Existing callers pass no `batterySharePct`, so BEVs are unaffected.

- [ ] **Step 6: Commit**

```bash
git add calc/running-costs.js calc/running-costs.test.js data/rates.json
git commit -m "feat: cost the petrol side of a plug-in hybrid"
```

---

## Task 4: Thread powertrain through the cost comparison

**Files:**
- Modify: `calc/compare.js`
- Test: `calc/compare.test.js`

**Interfaces:**
- Consumes: `fbtTreatment` (Task 2), `runningCosts` (Task 3), `driveAwayPrice` (`calc/onroad.js`, unchanged).
- Produces: `optionCosts({ vehicle, inputs }, tables)` where `inputs` gains `phevBatterySharePct`. Each option's `detail` gains `phevIneligible: boolean`.

**Note on `calc/onroad.js`:** `driveAwayPrice`, `vicStampDuty` and `luxuryCarTax` already accept `isGreen` and `isFuelEfficient`, both defaulting to `true`, and **nothing has ever passed `false`**. This task is where they start being passed. No change to `calc/onroad.js` itself.

- [ ] **Step 1: Write the failing tests**

Add to `calc/compare.test.js`:

```js
const phevVehicle = {
  id: 'test-phev', powertrain: 'phev', listPrice: 60000,
  batteryKwh: 18.1, rangeKm: 84, consumptionKwhPer100km: 21.5,
  combinedRangeKm: 760, fuelConsumptionL100km: 6.8,
  isFuelEfficientForLct: true, isGreenForVicDuty: true,
  insuranceAnnual: 1700, depreciationCurve: [1, 0.72, 0.61, 0.53, 0.46, 0.40]
};

test('a novated lease on a PHEV costs more than on an equivalent BEV', () => {
  const bevVehicle = { ...phevVehicle, id: 'test-bev', powertrain: 'bev' };
  delete bevVehicle.combinedRangeKm;
  delete bevVehicle.fuelConsumptionL100km;
  delete bevVehicle.isFuelEfficientForLct;
  delete bevVehicle.isGreenForVicDuty;

  const phevCost = optionCosts({ vehicle: phevVehicle, inputs }, tables).novated;
  const bevCost = optionCosts({ vehicle: bevVehicle, inputs }, tables).novated;
  assert.ok(phevCost.monthlyCost > bevCost.monthlyCost,
    'losing the FBT exemption must show up in the monthly figure');
});

test('the PHEV ineligibility is reported so the card can disclose it', () => {
  const costs = optionCosts({ vehicle: phevVehicle, inputs }, tables);
  assert.equal(costs.novated.detail.phevIneligible, true);
});

test('a BEV reports itself as eligible', () => {
  assert.equal(optionCosts({ vehicle, inputs }, tables).novated.detail.phevIneligible, false);
});

test('the battery share reaches the running costs through optionCosts', () => {
  const electric = optionCosts({ vehicle: phevVehicle, inputs: { ...inputs, phevBatterySharePct: 100 } }, tables);
  const petrol = optionCosts({ vehicle: phevVehicle, inputs: { ...inputs, phevBatterySharePct: 0 } }, tables);
  assert.notEqual(electric.loan.tco, petrol.loan.tco, 'the share must not be dropped on the way through');
});

// These two flags have existed on calc/onroad.js since the beginning and were
// never passed by anything. A PHEV that is not a "green passenger car" for
// VIC duty pays the higher tiered rate.
test('a PHEV that is not green for VIC duty pays more on-road', () => {
  const green = optionCosts({ vehicle: phevVehicle, inputs }, tables);
  const notGreen = optionCosts({
    vehicle: { ...phevVehicle, isGreenForVicDuty: false }, inputs
  }, tables);
  assert.ok(notGreen.upfront.detail.driveAway > green.upfront.detail.driveAway);
});

test('a PHEV outside the fuel-efficient LCT threshold is reported as such', () => {
  const dear = { ...phevVehicle, listPrice: 88000, isFuelEfficientForLct: false };
  const costs = optionCosts({ vehicle: dear, inputs }, tables);
  assert.ok(costs.novated.detail.driveAway > 0, 'still costs out, just under the lower threshold');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test calc/compare.test.js`
Expected: FAIL — `phevIneligible` is undefined and the PHEV/BEV novated costs are identical.

- [ ] **Step 3: Implement**

In `calc/compare.js`, replace `vehicleContext`:

```js
function vehicleContext(vehicle, inputs, tables) {
  // The isGreen / isFuelEfficient flags have been on driveAwayPrice since the
  // beginning with nothing ever passing them, because every car in the
  // dataset was a BEV and every BEV qualifies for both. A PHEV may qualify
  // for neither, so this is where they finally get passed. A row without them
  // is a BEV (see data/schema.js) and keeps the true defaults.
  const onRoad = driveAwayPrice({
    listPrice: vehicle.listPrice,
    isGreen: vehicle.isGreenForVicDuty ?? true,
    isFuelEfficient: vehicle.isFuelEfficientForLct ?? true
  }, tables);
  const running = runningCosts({
    vehicle,
    annualKm: inputs.annualKm,
    // Ignored outright for a BEV; for a PHEV it is the single biggest lever
    // on the figure. Defaulting to 100 keeps a caller that has not been
    // updated producing the same answer it always did.
    batterySharePct: inputs.phevBatterySharePct ?? 100,
    rates: {
      electricityCentsPerKwh: inputs.electricityCentsPerKwh,
      otherRunningCostsAnnual: inputs.otherRunningCostsAnnual,
      petrolCentsPerLitre: inputs.petrolCentsPerLitre
    }
  });
  const resale = resaleValue({
    driveAwayTotal: onRoad.total,
    termMonths: inputs.termMonths,
    depreciationCurve: vehicle.depreciationCurve
  });
  return { onRoad, running, resale, years: inputs.termMonths / 12 };
}
```

In `optionCosts`, pass the powertrain into the novated quote:

```js
  const novated = novatedQuote({
    driveAwayTotal: onRoad.total,
    termMonths: inputs.termMonths,
    leaseRatePct: inputs.leaseRatePct,
    adminFeeAnnual: inputs.adminFeeAnnual,
    runningCostsAnnualExGst: running.totalExGst,
    runningCostsAnnualIncGst: running.totalIncGst,
    leaseStartDate: inputs.leaseStartDate,
    vehicleValue: vehicle.listPrice,
    grossSalary: inputs.grossSalary,
    residualPctOverride: inputs.residualPctOverride ?? null,
    powertrain: vehicle.powertrain ?? 'bev'
  }, tables);
```

Then add `phevIneligible` to each of the three `detail` objects in the return, reading it off the novated quote:

```js
  const phevIneligible = novated.treatment?.phevIneligible ?? false;
```

and include `phevIneligible` in `novated.detail`, `loan.detail` and `upfront.detail` alongside `driveAway`.

- [ ] **Step 4: Pass the powertrain through the novated quote**

In `calc/novated.js`, accept `powertrain = 'bev'` in `novatedQuote`'s destructured argument, pass it into the `fbtTreatment` call:

```js
  const treatment = fbtTreatment({ leaseStartDate, vehicleValue, powertrain }, tables);
```

and add `treatment` to the returned object so `compare.js` can read `phevIneligible` off it.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, including `calc/golden.test.js` — no BEV figure may move.

- [ ] **Step 6: Commit**

```bash
git add calc/compare.js calc/compare.test.js calc/novated.js
git commit -m "feat: thread powertrain, battery share and tax flags through optionCosts"
```

---

## Task 5: The step 1 toggle and battery-share control

**Files:**
- Modify: `public/ui/state.js`, `public/index.html`, `public/styles.css`
- Test: `public/ui/state.test.js`

**Interfaces:**
- Produces: state gains `includePhev: false`, `phevBatterySharePct: 50` and `minElectricRangeKm: null`. `BOOLEAN_FIELDS` is added to `public/ui/state.js` so the URL round-trip does not coerce `false` to `NaN`.

**Careful — an existing trap:** `fromQueryString` currently sends anything not in `ARRAY_FIELDS` or `STRING_FIELDS` through `Number(raw)`. `Number('false')` is `NaN`, so without a boolean branch the toggle would silently reset on every page load from a shared URL.

- [ ] **Step 1: Write the failing tests**

Add to `public/ui/state.test.js`:

```js
test('plug-in hybrids are excluded until asked for', () => {
  const state = defaultState(rates);
  assert.equal(state.includePhev, false);
  assert.equal(state.phevBatterySharePct, 50);
  assert.equal(state.minElectricRangeKm, null, 'no electric-range filter until one is set');
});

// Number('false') is NaN. Without a boolean branch the toggle would silently
// reset every time someone opened a shared link.
test('the toggle survives a round trip through the URL', () => {
  const defaults = defaultState(rates);
  const state = { ...defaults, includePhev: true, phevBatterySharePct: 70 };
  const restored = fromQueryString(toQueryString(state, defaults), defaults);
  assert.equal(restored.includePhev, true);
  assert.equal(restored.phevBatterySharePct, 70);
});

test('an explicit false in the URL does not become NaN', () => {
  const defaults = defaultState(rates);
  const restored = fromQueryString('?includePhev=false', defaults);
  assert.equal(restored.includePhev, false);
});

test('the default toggle stays out of the query string', () => {
  const defaults = defaultState(rates);
  assert.equal(toQueryString({ ...defaults }, defaults).includes('includePhev'), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test public/ui/state.test.js`
Expected: FAIL — `includePhev` is undefined.

- [ ] **Step 3: Implement the state**

In `public/ui/state.js`:

```js
const ARRAY_FIELDS = new Set(['bodyTypes']);
const STRING_FIELDS = new Set(['leaseStartDate', 'freeText']);
// Declared for the same reason as NUMERIC_FIELDS below: fromQueryString sends
// anything unlisted through Number(), and Number('false') is NaN — the toggle
// would silently reset every time a shared link was opened.
const BOOLEAN_FIELDS = new Set(['includePhev']);
```

Add `'phevBatterySharePct'` and `'minElectricRangeKm'` to `NUMERIC_FIELDS`. Add to `defaultState`:

```js
    // Plug-in hybrids are opt-in: they are not EVs, they do not get the FBT
    // exemption, and including them silently would change every answer on
    // the page for a user who never asked for them.
    includePhev: false,
    // Only consulted for a PHEV. 50% is a starting point, not a claim — the
    // control exists precisely because the honest answer is personal.
    phevBatterySharePct: 50,
    // Filters on electric-only range. Meaningless for a BEV, where it would
    // duplicate minRangeKm, so the control is hidden with the rest.
    minElectricRangeKm: null,
```

In `fromQueryString`, add the boolean branch before the numeric fallback:

```js
    } else if (BOOLEAN_FIELDS.has(key)) {
      state[key] = raw === 'true';
    } else {
```

- [ ] **Step 4: Add the markup**

In `public/index.html`, inside `.field-group--prefs` after the body-type fieldset:

```html
        <!-- Opt-in, and hidden behind it: the extra range figure and the
             battery-share control are meaningless for a battery-electric car,
             so they only appear once plug-in hybrids are actually in play.
             ui/app.js toggles the hidden attribute on #phev-options. -->
        <div class="field field--checkbox">
          <label class="checkbox">
            <input type="checkbox" id="includePhev" data-field="includePhev" /> Include plug-in hybrids
          </label>
          <p class="field__hint">PHEVs lost the FBT exemption on 1 April 2025, so a novated lease
            costs considerably more than for an EV.</p>
        </div>

        <div id="phev-options" class="phev-options" hidden>
          <!-- Electric range only makes sense as a filter once plug-in
               hybrids are in the pool: for a BEV it is the same number as
               "Minimum range" above, so showing both would be two controls
               for one fact. -->
          <div class="field">
            <label for="minElectricRangeKm">Minimum electric range</label>
            <div class="field__input">
              <input type="number" id="minElectricRangeKm" name="minElectricRangeKm"
                data-field="minElectricRangeKm" min="0" step="10" inputmode="numeric" placeholder="any" />
              <span class="field__suffix" aria-hidden="true">km</span>
            </div>
            <p class="field__hint">How far it goes before the engine starts. Set this to your daily
              commute if you want to drive mostly on electricity.</p>
          </div>

          <div class="field">
            <label for="phevBatterySharePct">Share of driving on battery</label>
            <div class="field__input">
              <input type="number" id="phevBatterySharePct" name="phevBatterySharePct"
                data-field="phevBatterySharePct" min="0" max="100" step="5" inputmode="numeric" />
              <span class="field__suffix" aria-hidden="true">%</span>
            </div>
            <p class="field__hint">Short daily trips you can charge for. This swings a plug-in
              hybrid's fuel bill further than any other figure here.</p>
          </div>
        </div>
```

Then update the existing "Minimum range" hint so its meaning is unambiguous once PHEVs are in play:

```html
          <p class="field__hint">For a plug-in hybrid this is its combined range on a full
            battery and a full tank.</p>
```

- [ ] **Step 5: Style it**

In `public/styles.css`, beside the other `.field-group--prefs` rules:

```css
/* Indented under the toggle that reveals it, so the relationship is visible
   rather than implied by proximity alone. */
.phev-options {
  margin-top: var(--space-3);
  padding-left: var(--space-3);
  border-left: 2px solid var(--hairline);
}

.phev-options[hidden] { display: none; }
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add public/ui/state.js public/ui/state.test.js public/index.html public/styles.css
git commit -m "feat: add the plug-in hybrid toggle and battery-share control"
```

---

## Task 6: Filter, rank and card the PHEVs

**Files:**
- Modify: `public/ui/cars.js`, `public/styles.css`
- Test: `public/ui/cars.test.js`

**Interfaces:**
- Consumes: `includePhev` and `phevBatterySharePct` (Task 5), `phevIneligible` (Task 4).
- Produces: `filterVehicles` honours `includePhev`, applies `minRangeKm` against combined range for a PHEV, and applies `minElectricRangeKm` to PHEVs only. `cardModel` returns `powertrain`, `phevIneligible` and `novatedOverBudget`. `renderCards` shows a warning row and a disclosure line.

**The banding decision, decided by the author:** PHEVs keep their price band. The card carries the disclosure and flags the novated row when the real monthly cost exceeds the budget. This is why `cardModel` needs `monthlyBudget` in its context.

- [ ] **Step 1: Write the failing tests**

Add to `public/ui/cars.test.js`:

```js
const phev = (over = {}) => ({
  id: 'p1', familyId: 'p', make: 'Test', model: 'PHEV', variant: 'Base',
  bodyType: 'SUV', powertrain: 'phev', listPrice: 60000,
  rangeKm: 84, combinedRangeKm: 760, bootLitresSeatsUp: 500, seats: 5, ...over
});
const bev = (over = {}) => ({
  id: 'b1', familyId: 'b', make: 'Test', model: 'BEV', variant: 'Base',
  bodyType: 'SUV', listPrice: 60000, rangeKm: 450,
  bootLitresSeatsUp: 500, seats: 5, ...over
});

test('plug-in hybrids are excluded unless asked for', () => {
  const out = filterVehicles([bev(), phev()], { includePhev: false });
  assert.deepEqual(out.map(v => v.id), ['b1']);
});

test('plug-in hybrids appear when asked for', () => {
  const out = filterVehicles([bev(), phev()], { includePhev: true });
  assert.deepEqual(out.map(v => v.id), ['b1', 'p1']);
});

// A user asking for 400km means "before I have to stop", and a PHEV genuinely
// does that on a tank. Judging it on its 84km electric range would exclude
// every plug-in hybrid from any range filter worth setting.
test('the range filter judges a PHEV on combined range, not electric range', () => {
  const out = filterVehicles([phev()], { includePhev: true, minRangeKm: 400 });
  assert.deepEqual(out.map(v => v.id), ['p1'], '760km combined clears a 400km bar');
});

test('a BEV is still judged on its own range', () => {
  assert.equal(filterVehicles([bev({ rangeKm: 300 })], { minRangeKm: 400 }).length, 0);
});

test('a PHEV whose combined range is short is still excluded', () => {
  const out = filterVehicles([phev({ combinedRangeKm: 350 })], { includePhev: true, minRangeKm: 400 });
  assert.equal(out.length, 0);
});

// The separate control, for someone buying a PHEV to commute on electricity.
test('the electric-range filter judges a PHEV on its electric range', () => {
  assert.equal(filterVehicles([phev({ rangeKm: 84 })], { includePhev: true, minElectricRangeKm: 60 }).length, 1);
  assert.equal(filterVehicles([phev({ rangeKm: 42 })], { includePhev: true, minElectricRangeKm: 60 }).length, 0);
});

// A BEV's electric range is its whole range, so this filter would silently
// become a second, stricter minRangeKm for every EV on the list.
test('the electric-range filter never applies to a BEV', () => {
  const out = filterVehicles([bev({ rangeKm: 450 })], { includePhev: true, minElectricRangeKm: 600 });
  assert.deepEqual(out.map(v => v.id), ['b1']);
});

test('a card reports its powertrain and FBT status', () => {
  const card = cardModel(phev(), [], { inputs, tables, monthlyBudget: 1200 });
  assert.equal(card.powertrain, 'phev');
  assert.equal(card.phevIneligible, true);
});

// The card sits under "At your budget" because it is banded on price, so the
// one thing it must not do is stay quiet about not being affordable there.
test('a card flags a novated cost above the budget', () => {
  const card = cardModel(phev(), [], { inputs, tables, monthlyBudget: 1 });
  assert.equal(card.novatedOverBudget, true);
});

test('a card within budget is not flagged', () => {
  const card = cardModel(bev(), [], { inputs, tables, monthlyBudget: 100000 });
  assert.equal(card.novatedOverBudget, false);
});

test('the rendered PHEV card discloses the lost exemption and the date', () => {
  const target = { innerHTML: '' };
  renderCards({ querySelector: () => target }, [cardModel(phev(), [], { inputs, tables, monthlyBudget: 1 })]);
  assert.match(target.innerHTML, /FBT exemption/i);
  assert.match(target.innerHTML, /1 April 2025/);
});

test('a BEV card says nothing about FBT eligibility', () => {
  const target = { innerHTML: '' };
  renderCards({ querySelector: () => target }, [cardModel(bev(), [], { inputs, tables, monthlyBudget: 100000 })]);
  assert.ok(!/FBT exemption/i.test(target.innerHTML));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test public/ui/cars.test.js`
Expected: FAIL — PHEVs are not filtered and `card.powertrain` is undefined.

- [ ] **Step 3: Implement the filter**

In `public/ui/cars.js`:

```js
export function filterVehicles(vehicles, filters) {
  return vehicles.filter(v => {
    const isPhev = v.powertrain === 'phev';
    // Opt-in. A plug-in hybrid is not an EV, does not get the FBT exemption,
    // and would change every answer on the page for someone who never asked.
    if (isPhev && !filters.includePhev) return false;
    if (filters.bodyTypes?.length && !filters.bodyTypes.includes(v.bodyType)) return false;
    if (filters.minBootLitres && v.bootLitresSeatsUp < filters.minBootLitres) return false;
    // "Minimum range" means "how far before I have to stop", which for a
    // plug-in hybrid is the tank as well as the battery. Its 84km electric
    // range answers a different question — the one the scorer asks.
    const rangeForFilter = isPhev ? (v.combinedRangeKm ?? v.rangeKm) : v.rangeKm;
    if (filters.minRangeKm && rangeForFilter < filters.minRangeKm) return false;
    // PHEVs only. A BEV's electric range is its whole range, so applying this
    // to one would just be a second, stricter minRangeKm applied behind the
    // user's back.
    if (isPhev && filters.minElectricRangeKm && v.rangeKm < filters.minElectricRangeKm) return false;
    if (filters.seats && v.seats < filters.seats) return false;
    return true;
  });
}
```

- [ ] **Step 4: Implement the card model**

In `cardModel`, after the `balloonCovered` calculation:

```js
  const powertrain = vehicle.powertrain ?? 'bev';
  const phevIneligible = costs?.novated.detail.phevIneligible ?? false;
  // Cards are banded on list price, so a PHEV can legitimately sit under
  // "At your budget" while costing more per month than the budget allows —
  // the budget was worked out from an FBT-exempt EV. Saying so on the card is
  // what keeps the band label honest.
  const novatedOverBudget = costs && typeof context?.monthlyBudget === 'number'
    ? costs.novated.monthlyCost > context.monthlyBudget
    : false;
```

and add `powertrain`, `phevIneligible` and `novatedOverBudget` to the returned object.

- [ ] **Step 5: Implement the markup**

In `costTableMarkup`, mark the novated row when over budget — inside the row map, for `option === 'novated' && card.novatedOverBudget`, append:

```js
`<span class="cost-row__warn">over your budget</span>`
```

In `renderCards`, after `costTableMarkup(card)`:

```js
        ${card.phevIneligible ? `<p class="car-phev-note">Plug-in hybrids lost the FBT exemption on
          1 April 2025, so a novated lease costs far more than for an equivalent EV.</p>` : ''}
```

And change the specs line so a PHEV's two range figures are both visible:

```js
        <p class="car-specs">${card.bootLitresSeatsUp}L boot &middot; ${
          card.powertrain === 'phev'
            ? `${card.rangeKm}km electric, ${card.combinedRangeKm}km combined`
            : `${card.rangeKm}km range`
        } &middot; ${money(card.listPrice)}</p>
```

- [ ] **Step 6: Style it**

```css
.cost-row__warn {
  display: block;
  font-size: 0.7rem;
  color: var(--warn);
  font-weight: 500;
}

.car-phev-note {
  margin: var(--space-2) 0 0;
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--warn);
}
```

- [ ] **Step 7: Run tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add public/ui/cars.js public/ui/cars.test.js public/styles.css
git commit -m "feat: filter, card and disclose plug-in hybrids in the shortlist"
```

---

## Task 7: Wire it into the app

**Files:**
- Modify: `public/ui/app.js`

**Interfaces:**
- Consumes: everything from Tasks 1–6.

**The two rules that keep step 2 honest:** the representative profile stays BEV-only whatever the toggle says (the author's decision — the ceiling is an EV ceiling), but the floor price follows the toggle (otherwise the chart's "a loan reaches nothing below $X" marker contradicts a cheaper PHEV sitting in step 3).

- [ ] **Step 1: Keep the step 2 profile on BEVs only**

Where `profile` and `floorPrice` are set at boot, replace with:

```js
  // Step 2's ceiling is an EV ceiling and stays one whatever the PHEV toggle
  // says: the whole point of the median profile is that it is stable while
  // the user drags the slider, and it is the FBT-exempt case the headline
  // number describes. A PHEV's real cost is worked out per car in step 3.
  const bevOnly = vehicles.filter(v => (v.powertrain ?? 'bev') === 'bev');
  const profile = representativeProfile(bevOnly);
```

- [ ] **Step 2: Make the floor follow the toggle**

`floorPrice` cannot be computed once at boot any more. Move it inside `render()`, before the `purchasingPowerSeries` call:

```js
      // Unlike the profile, this one does follow the toggle. It is the price
      // of the cheapest car that can actually be bought, and it is what
      // places the "a loan reaches nothing below $X" marker on the chart —
      // if a cheaper PHEV is on the shortlist, that marker would otherwise
      // contradict the card sitting right beneath it.
      const floorPrice = cheapestPrice(filterVehicles(vehicles, state));
```

Delete the boot-time `const floorPrice = cheapestPrice(vehicles);`.

- [ ] **Step 3: Pass the new inputs through**

In `buildInputs`, add:

```js
    petrolCentsPerLitre: state.petrolCentsPerLitre,
    // Ignored for every BEV; the dominant term for a PHEV.
    phevBatterySharePct: state.phevBatterySharePct,
```

Add `petrolCentsPerLitre: rates.petrolCentsPerLitre` to `defaultState` in `public/ui/state.js` and `'petrolCentsPerLitre'` to `NUMERIC_FIELDS`.

- [ ] **Step 4: Pass the budget into the card context**

In `renderShortlist`, change the context to carry the budget so `novatedOverBudget` can be computed:

```js
    const context = { inputs: buildInputs(state), tables, monthlyBudget: state.monthlyBudget };
```

- [ ] **Step 5: Reveal the PHEV controls with the toggle**

In `render()`, after `syncFieldInputs`:

```js
    // The battery-share control is meaningless without a plug-in hybrid to
    // apply it to, so it only exists once the toggle is on.
    const phevOptions = root.querySelector('#phev-options');
    if (phevOptions) phevOptions.hidden = !state.includePhev;
```

`syncFieldInputs` writes `input.value`, which does nothing for a checkbox. Add a checkbox branch to it:

```js
    if (input.type === 'checkbox' && !Array.isArray(value)) {
      if (input.checked !== Boolean(value)) input.checked = Boolean(value);
      continue;
    }
```

- [ ] **Step 6: Verify in the browser**

Run: `npm start`, open `http://localhost:3000/`.
Expected, with no PHEV data yet (that arrives in Task 8):
- The "Include plug-in hybrids" checkbox appears in step 1.
- Ticking it reveals the battery-share field; unticking hides it.
- The shortlist is unchanged (no PHEVs in the dataset yet).
- Reloading with `?includePhev=true` keeps the box ticked and the field visible.

- [ ] **Step 7: Run tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add public/ui/app.js public/ui/state.js
git commit -m "feat: wire the PHEV toggle through the app"
```

---

## Task 8: Dispatch the PHEV research (run last)

**Files:**
- Create: `docs/phev-research-brief.md`
- Create (by agents): `data/families/<familyId>.json`, `data/vehicles/<familyId>.json`

**This task is prepared now and dispatched at the end**, once Tasks 1–7 are green — the author's instruction. Two families only, chosen to exercise opposite ends of the flow:

| Family | `familyId` | What it tests |
|---|---|---|
| BYD Sealion 6 | `byd-sealion-6` | The cheap end. Should land near or below the current $29,990 floor, exercising the toggle-aware floor price from Task 7. |
| Mazda CX-60 PHEV | `mazda-cx-60-phev` | The dear end. Sits near the LCT fuel-efficient threshold and should trigger both the `novatedOverBudget` flag and the `isFuelEfficientForLct` path. |

- [ ] **Step 1: Write the brief**

Create `docs/phev-research-brief.md`, based on `docs/ev-family-research-brief.md` with these changes:

- Research date: the date of dispatch.
- Replace lesson 4 ("Exclude anything that isn't a pure battery-electric car") with its inverse: **this** brief is for plug-in hybrids only, and a pure BEV or a range-extender (REEV/EREV) grade found in the range must be excluded and reported.
- Require `"powertrain": "phev"` on every vehicle row.
- Require the four PHEV fields with their exact meanings:
  - `rangeKm` — **electric-only** range (WLTP EAER where published; say which standard).
  - `combinedRangeKm` — electric plus a full tank.
  - `fuelConsumptionL100km` — the **combustion-mode** figure, *not* the combined-cycle label number, which assumes a full battery and understates real petrol use. If only the combined-cycle figure is published, say so explicitly in the report.
  - `consumptionKwhPer100km` — electric consumption, which must satisfy the schema's `batteryKwh / rangeKm × 100` check within 25%.
- Require `isFuelEfficientForLct` (LCT fuel-efficient threshold applies at ≤3.5L/100km combined) and `isGreenForVicDuty` (VIC green passenger car duty rate), each with the source that establishes it.
- Note that `data/schema.js` now enforces PHEV-specific bounds, so a row that fails `node scripts/build-dataset.js` is wrong and must be fixed, not worked around.
- Keep every hard boundary from the EV brief verbatim: write only the two files, never touch the aggregates or another family's files, run no git commands, omit `images`.

- [ ] **Step 2: Dispatch both agents in parallel**

Two `general-purpose` subagents in a single message, one per family. Each prompt: the family name and `familyId` from the table above, the path to `docs/phev-research-brief.md`, and the instruction to return a report naming its sources, the standard behind each range figure, and anything it excluded.

- [ ] **Step 3: Build and validate**

Run: `node scripts/build-dataset.js`
Expected: `~120 variants across 42 families, 0 failures`. Any failure is a data error — fix the per-family file, never the schema, unless the bound is genuinely wrong for real cars.

- [ ] **Step 4: Verify end to end in the browser**

Run: `npm start`, then check:
- With the toggle off, the shortlist and the header counts are exactly as before.
- With it on, the header variant count rises and PHEVs appear in the shortlist.
- A PHEV card shows two range figures, the FBT disclosure, and a novated total visibly higher than a similarly priced EV's.
- Dragging the battery share from 100% to 0% visibly moves the PHEV's three totals and does not move any EV's.
- The step 2 ceiling does **not** move when the toggle is flipped (the profile is BEV-only), but the chart's loan-entry marker **does** if a PHEV is now the cheapest car.

- [ ] **Step 5: Commit**

```bash
node scripts/build-dataset.js
git add data/families/ data/vehicles/ data/families.json data/vehicles.json docs/phev-research-brief.md
git commit -m "data: add BYD Sealion 6 and Mazda CX-60 PHEV"
```

---

## Deferred

- **Site framing.** "What's the best EV I could get?" with PHEVs on is a mismatch the author has parked deliberately. Revisit once the flow is proven.
- **The rest of the PHEV market.** Two families prove the flow. Ford Ranger PHEV, BYD Shark 6, Mitsubishi Outlander, GWM Haval H6, Jaecoo J7 SHS and MG HS are the obvious next wave, and `bodyType: 'Ute'` currently has no cars at all behind it.
- **Pre-existing binding commitments.** A PHEV lease committed before 1 April 2025 keeps the exemption. Not modelled, and the card says so.
- **Reportable Fringe Benefits.** Already unmodelled for BEVs and called out in the disclaimers; an ineligible PHEV changes the arithmetic but not the omission.
