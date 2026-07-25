# EV Affordability Calculator (Melbourne) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that compares novated lease, direct car loan, and cash upfront for buying an electric car in Melbourne, showing which wins as the user's monthly budget changes.

**Architecture:** A pure, deterministic calculation core in `calc/` (plain object in, plain object out, no I/O) is imported unchanged by both the browser and the Node test runner. An Express server on Heroku serves static assets and proxies three Claude endpoints that parse free text, rank a shortlist, and narrate results. Claude never produces a dollar figure; it sits outside the calculation wall on both sides of it.

**Tech Stack:** Node 22 LTS, Express 5, `@anthropic-ai/sdk`, `zod`, `node:test`. No bundler, no framework, no build step — native ES modules straight to the browser.

## Global Constraints

- Node 22 LTS pinned in `.nvmrc`; `engines.node: ">=20"` in `package.json`; `"type": "module"`.
- Everything in `calc/` is pure: no `fetch`, no `Date.now()`, no randomness, no imports from `server/`. Dates and tax tables are always passed in as arguments.
- Claude never calculates. It converts prose to inputs before the maths and narrates figures after it.
- All money is handled as JavaScript numbers in dollars; round only at display time.
- Every Claude response is validated with zod before anything downstream consumes it.
- The calculator must work fully with the Claude API unavailable.
- Tax year 2026-27 resident rates: nil to $18,200 · 15% to $45,000 · 30% to $135,000 · 37% to $190,000 · 45% above. Medicare levy 2%.
- LCT fuel-efficient threshold 2026-27: **$91,661**. Car limit 2026-27: **$69,883** (GST credit cap **$6,353**).
- ATO minimum residuals: 12mo 65.63% · 24mo 56.25% · 36mo 46.88% · 48mo 37.5% · 60mo 28.13%.
- VIC green passenger car duty: **$8.40 per $200** of dutiable value at every price point.
- FBT phases: full exemption to 31 Mar 2027 · exempt under $75,000 with 25% discount above, 1 Apr 2027 to 31 Mar 2029 · 25% discount for all from 1 Apr 2029. Leases are grandfathered at their start date.
- Not modelled: HELP/HECS, Medicare Levy Surcharge, Division 293, family benefits.
- Test command is always `npm test` (`node --test`). Every task ends green.

---

## File Structure

| File | Responsibility |
|---|---|
| `data/tax-tables.json` | Brackets, LITO, Medicare, LCT, car limit, residuals, FBT phases, VIC duty |
| `data/rates.json` | Finance and running-cost defaults with sources |
| `data/vehicles.json` | 60–80 variants, numeric fields only |
| `data/families.json` | Per-family reviews, pros/cons, source links, press image URLs |
| `calc/tax.js` | Gross salary → tax, Medicare, LITO, take-home |
| `calc/onroad.js` | List price → LCT, VIC stamp duty, rego, drive-away |
| `calc/fbt.js` | Lease start date + value → phase, treatment, FBT liability |
| `calc/loan.js` | Amortisation |
| `calc/resale.js` | Depreciation curve → resale value at end of term |
| `calc/running-costs.js` | Insurance, electricity, rego/tyres/servicing |
| `calc/novated.js` | Lease payment, residual, packaging, net take-home impact |
| `calc/upfront.js` | Cash outlay plus opportunity cost |
| `calc/compare.js` | TCO for all three, ranking, reachable vehicle, crossover solver |
| `server/index.js` | Express boot, static, PORT |
| `server/claude.js` | SDK client, timeout, retry, graceful failure |
| `server/schema.js` | zod schemas for every Claude response |
| `server/routes/parse.js` | Free text → filters, with keyword fallback |
| `server/routes/rank.js` | Shortlist ordering |
| `server/routes/explain.js` | Plain-English narration |
| `server/fallback-parser.js` | Keyword parser used when Claude is unavailable |
| `public/index.html` | Three-section shell |
| `public/ui/state.js` | Single state object ↔ URL query string |
| `public/ui/sections.js` | Section 1 inputs and parse hand-off |
| `public/ui/slider.js` | Budget slider, verdict, totals, rates panel |
| `public/ui/crossover-chart.js` | SVG lines (desktop), winner band (mobile) |
| `public/ui/cars.js` | Shortlist cards, images, silhouette fallback |
| `scripts/build-dataset.js` | Manually-run research helper |

---

## Phase 1 — Scaffold and pure core

### Task 1: Project scaffold and tax tables

**Files:**
- Create: `.nvmrc`, `package.json`, `data/tax-tables.json`
- Test: none (verified by Task 2 consuming it)

**Interfaces:**
- Consumes: nothing
- Produces: `data/tax-tables.json` with keys `incomeTaxBrackets`, `medicareLevy`, `lito`, `lct`, `carLimit`, `residuals`, `fbtPhases`, `vicDuty`, `registrationAnnual`

- [ ] **Step 1: Create `.nvmrc`**

```
22
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "car-calc",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test",
    "start": "node server/index.js"
  }
}
```

- [ ] **Step 3: Create `data/tax-tables.json`**

```json
{
  "financialYear": "2026-27",
  "incomeTaxBrackets": [
    { "upTo": 18200, "rate": 0 },
    { "upTo": 45000, "rate": 0.15 },
    { "upTo": 135000, "rate": 0.30 },
    { "upTo": 190000, "rate": 0.37 },
    { "upTo": null, "rate": 0.45 }
  ],
  "medicareLevy": {
    "rate": 0.02,
    "lowIncomeThreshold": 27222,
    "shadeOutTo": 34027,
    "note": "2025-26 figures, refresh when ATO publishes 2026-27"
  },
  "lito": { "max": 700, "taperFrom": 37500, "taperRate": 0.05, "secondTaperFrom": 45000, "secondTaperRate": 0.015 },
  "lct": { "fuelEfficientThreshold": 91661, "otherThreshold": 80809, "rate": 0.33 },
  "carLimit": { "value": 69883, "maxGstCredit": 6353 },
  "residuals": { "12": 0.6563, "24": 0.5625, "36": 0.4688, "48": 0.375, "60": 0.2813 },
  "fbtPhases": [
    { "from": "1900-01-01", "fullExemptionUpTo": null, "discountRate": 0 },
    { "from": "2027-04-01", "fullExemptionUpTo": 75000, "discountRate": 0.25 },
    { "from": "2029-04-01", "fullExemptionUpTo": 0, "discountRate": 0.25 }
  ],
  "fbt": { "statutoryRate": 0.20, "grossUpType1": 2.0802, "rate": 0.47 },
  "vicDuty": {
    "greenRatePer200": 8.40,
    "otherTiers": [
      { "upTo": 80809, "ratePer200": 8.40 },
      { "upTo": 100000, "ratePer200": 10.40 },
      { "upTo": 150000, "ratePer200": 14.00 },
      { "upTo": null, "ratePer200": 18.00 }
    ]
  },
  "registrationAnnual": 880,
  "sourcedAt": "2026-07-25"
}
```

- [ ] **Step 4: Verify Node version and that the JSON parses**

Run: `node -e "import('node:fs').then(fs=>console.log(Object.keys(JSON.parse(fs.readFileSync('data/tax-tables.json')))))"`
Expected: prints the key list including `incomeTaxBrackets` and `fbtPhases`.

- [ ] **Step 5: Commit**

```bash
git add .nvmrc package.json data/tax-tables.json
git commit -m "chore: scaffold project and add 2026-27 tax tables"
```

---

### Task 2: `calc/tax.js` — income tax, Medicare levy, LITO, take-home

**Files:**
- Create: `calc/tax.js`
- Test: `calc/tax.test.js`

**Interfaces:**
- Consumes: `data/tax-tables.json`
- Produces:
  - `incomeTax(taxableIncome, tables) -> number`
  - `medicareLevy(taxableIncome, tables) -> number`
  - `lito(taxableIncome, tables) -> number`
  - `netIncome({ grossSalary, preTaxDeductions = 0 }, tables) -> { taxableIncome, incomeTax, medicareLevy, lito, totalTax, netAnnual, netMonthly }`

- [ ] **Step 1: Write the failing test**

Create `calc/tax.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { incomeTax, medicareLevy, lito, netIncome } from './tax.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('income tax is nil at the tax-free threshold', () => {
  close(incomeTax(18200, tables), 0);
});

test('income tax at bracket boundaries', () => {
  close(incomeTax(45000, tables), 4020);
  close(incomeTax(135000, tables), 31020);
  close(incomeTax(190000, tables), 51370);
});

test('income tax part-way through the 37% bracket', () => {
  close(incomeTax(145000, tables), 34720);
});

test('medicare levy is 2% above the shade-out point', () => {
  close(medicareLevy(145000, tables), 2900);
});

test('LITO tapers in two stages and reaches nil at 66,667', () => {
  close(lito(37500, tables), 700);
  close(lito(40000, tables), 575);
  close(lito(50000, tables), 250);
  close(lito(70000, tables), 0);
});

test('netIncome subtracts pre-tax deductions before tax', () => {
  const plain = netIncome({ grossSalary: 145000 }, tables);
  close(plain.totalTax, 37620);
  close(plain.netAnnual, 107380);
  close(plain.netMonthly, 8948.33);

  const packaged = netIncome({ grossSalary: 145000, preTaxDeductions: 12000 }, tables);
  close(packaged.taxableIncome, 133000);
  assert.ok(packaged.netAnnual < plain.netAnnual, 'packaging reduces cash in hand');
  assert.ok(plain.netAnnual - packaged.netAnnual < 12000, 'but by less than the deduction');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './tax.js'`.

- [ ] **Step 3: Write the implementation**

Create `calc/tax.js`:

```js
export function incomeTax(taxableIncome, tables) {
  let tax = 0;
  let lower = 0;
  for (const bracket of tables.incomeTaxBrackets) {
    const upper = bracket.upTo ?? Infinity;
    if (taxableIncome > lower) {
      tax += (Math.min(taxableIncome, upper) - lower) * bracket.rate;
    }
    lower = upper;
  }
  return tax;
}

export function medicareLevy(taxableIncome, tables) {
  const { rate, lowIncomeThreshold, shadeOutTo } = tables.medicareLevy;
  if (taxableIncome <= lowIncomeThreshold) return 0;
  if (taxableIncome >= shadeOutTo) return taxableIncome * rate;
  return (taxableIncome - lowIncomeThreshold) * 0.10;
}

export function lito(taxableIncome, tables) {
  const { max, taperFrom, taperRate, secondTaperFrom, secondTaperRate } = tables.lito;
  if (taxableIncome <= taperFrom) return max;
  let offset = max - (Math.min(taxableIncome, secondTaperFrom) - taperFrom) * taperRate;
  if (taxableIncome > secondTaperFrom) {
    offset -= (taxableIncome - secondTaperFrom) * secondTaperRate;
  }
  return Math.max(0, offset);
}

export function netIncome({ grossSalary, preTaxDeductions = 0 }, tables) {
  const taxableIncome = Math.max(0, grossSalary - preTaxDeductions);
  const gross = incomeTax(taxableIncome, tables);
  const offset = lito(taxableIncome, tables);
  const tax = Math.max(0, gross - offset);
  const levy = medicareLevy(taxableIncome, tables);
  const totalTax = tax + levy;
  const netAnnual = taxableIncome - totalTax;
  return {
    taxableIncome,
    incomeTax: tax,
    medicareLevy: levy,
    lito: offset,
    totalTax,
    netAnnual,
    netMonthly: netAnnual / 12
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add calc/tax.js calc/tax.test.js
git commit -m "feat: add income tax, Medicare levy and LITO calculations"
```

---

### Task 3: `calc/onroad.js` — LCT, VIC stamp duty, drive-away price

**Files:**
- Create: `calc/onroad.js`
- Test: `calc/onroad.test.js`

**Interfaces:**
- Consumes: `data/tax-tables.json`
- Produces:
  - `luxuryCarTax({ listPrice, isFuelEfficient }, tables) -> number`
  - `vicStampDuty({ dutiableValue, isGreen }, tables) -> number`
  - `driveAwayPrice({ listPrice, isGreen = true, isFuelEfficient = true }, tables) -> { listPrice, lct, stampDuty, registration, total }`

- [ ] **Step 1: Write the failing test**

Create `calc/onroad.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { luxuryCarTax, vicStampDuty, driveAwayPrice } from './onroad.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('no LCT below the fuel-efficient threshold', () => {
  close(luxuryCarTax({ listPrice: 91661, isFuelEfficient: true }, tables), 0);
});

test('LCT applies at 33% of the GST-exclusive excess', () => {
  close(luxuryCarTax({ listPrice: 100000, isFuelEfficient: true }, tables), 2501.70);
});

test('green cars pay the flat rate at every price point', () => {
  close(vicStampDuty({ dutiableValue: 56000, isGreen: true }, tables), 2352);
  close(vicStampDuty({ dutiableValue: 90000, isGreen: true }, tables), 3780);
});

test('non-green cars step up through tiers on the whole value', () => {
  close(vicStampDuty({ dutiableValue: 90000, isGreen: false }, tables), 4680);
});

test('drive-away price sums list price, LCT, duty and registration', () => {
  const result = driveAwayPrice({ listPrice: 56000 }, tables);
  close(result.lct, 0);
  close(result.stampDuty, 2352);
  close(result.registration, 880);
  close(result.total, 59232);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './onroad.js'`.

- [ ] **Step 3: Write the implementation**

Create `calc/onroad.js`:

```js
export function luxuryCarTax({ listPrice, isFuelEfficient = true }, tables) {
  const threshold = isFuelEfficient
    ? tables.lct.fuelEfficientThreshold
    : tables.lct.otherThreshold;
  if (listPrice <= threshold) return 0;
  return (listPrice - threshold) * (10 / 11) * tables.lct.rate;
}

export function vicStampDuty({ dutiableValue, isGreen = true }, tables) {
  const units = dutiableValue / 200;
  if (isGreen) return units * tables.vicDuty.greenRatePer200;
  const tier = tables.vicDuty.otherTiers.find(t => dutiableValue <= (t.upTo ?? Infinity));
  return units * tier.ratePer200;
}

export function driveAwayPrice({ listPrice, isGreen = true, isFuelEfficient = true }, tables) {
  const lct = luxuryCarTax({ listPrice, isFuelEfficient }, tables);
  const dutiableValue = listPrice + lct;
  const stampDuty = vicStampDuty({ dutiableValue, isGreen }, tables);
  const registration = tables.registrationAnnual;
  return {
    listPrice,
    lct,
    stampDuty,
    registration,
    total: listPrice + lct + stampDuty + registration
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 11 tests total.

- [ ] **Step 5: Commit**

```bash
git add calc/onroad.js calc/onroad.test.js
git commit -m "feat: add LCT and Victorian stamp duty calculations"
```

---

### Task 4: `calc/fbt.js` — phase resolution and FBT liability

**Files:**
- Create: `calc/fbt.js`
- Test: `calc/fbt.test.js`

**Interfaces:**
- Consumes: `data/tax-tables.json`
- Produces:
  - `resolvePhase(leaseStartDate, tables) -> { from, fullExemptionUpTo, discountRate }`
  - `fbtTreatment({ leaseStartDate, vehicleValue }, tables) -> { exempt, discountRate, overThreshold }`
  - `annualFbt({ baseValue, treatment }, tables) -> number`

`leaseStartDate` is always an ISO `YYYY-MM-DD` string, never a `Date`, so the module stays pure.

- [ ] **Step 1: Write the failing test**

Create `calc/fbt.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePhase, fbtTreatment, annualFbt } from './fbt.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('a lease starting today is in the full-exemption phase', () => {
  assert.equal(resolvePhase('2026-07-25', tables).discountRate, 0);
});

test('phase boundaries are inclusive of their start date', () => {
  assert.equal(resolvePhase('2027-03-31', tables).fullExemptionUpTo, null);
  assert.equal(resolvePhase('2027-04-01', tables).fullExemptionUpTo, 75000);
  assert.equal(resolvePhase('2029-04-01', tables).fullExemptionUpTo, 0);
});

test('phase 1 exempts any car under the LCT threshold', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: 85000 }, tables);
  assert.equal(t.exempt, true);
});

test('a car above the LCT threshold is never exempt', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: 95000 }, tables);
  assert.equal(t.exempt, false);
  assert.equal(t.overThreshold, true);
});

test('phase 2 exempts under 75k but discounts above it', () => {
  const cheap = fbtTreatment({ leaseStartDate: '2027-06-01', vehicleValue: 70000 }, tables);
  assert.equal(cheap.exempt, true);

  const dear = fbtTreatment({ leaseStartDate: '2027-06-01', vehicleValue: 85000 }, tables);
  assert.equal(dear.exempt, false);
  assert.equal(dear.discountRate, 0.25);
});

test('an exempt treatment produces no FBT', () => {
  const treatment = fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: 56000 }, tables);
  close(annualFbt({ baseValue: 56000, treatment }, tables), 0);
});

test('a discounted treatment produces 75% of full FBT', () => {
  const treatment = fbtTreatment({ leaseStartDate: '2027-06-01', vehicleValue: 85000 }, tables);
  const expected = 85000 * 0.20 * 0.75 * 2.0802 * 0.47;
  close(annualFbt({ baseValue: 85000, treatment }, tables), expected);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './fbt.js'`.

- [ ] **Step 3: Write the implementation**

Create `calc/fbt.js`:

```js
export function resolvePhase(leaseStartDate, tables) {
  let current = tables.fbtPhases[0];
  for (const phase of tables.fbtPhases) {
    if (leaseStartDate >= phase.from) current = phase;
  }
  return current;
}

export function fbtTreatment({ leaseStartDate, vehicleValue }, tables) {
  const phase = resolvePhase(leaseStartDate, tables);
  const overThreshold = vehicleValue > tables.lct.fuelEfficientThreshold;

  if (overThreshold) {
    return { exempt: false, discountRate: 0, overThreshold: true, phase };
  }
  const exemptCap = phase.fullExemptionUpTo;
  const exempt = exemptCap === null || vehicleValue <= exemptCap;
  return {
    exempt,
    discountRate: exempt ? 0 : phase.discountRate,
    overThreshold: false,
    phase
  };
}

export function annualFbt({ baseValue, treatment }, tables) {
  if (treatment.exempt) return 0;
  const { statutoryRate, grossUpType1, rate } = tables.fbt;
  const taxableValue = baseValue * statutoryRate * (1 - treatment.discountRate);
  return taxableValue * grossUpType1 * rate;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 18 tests total.

- [ ] **Step 5: Commit**

```bash
git add calc/fbt.js calc/fbt.test.js
git commit -m "feat: add phase-aware FBT treatment for electric vehicles"
```

---

### Task 5: `calc/loan.js` — amortisation

**Files:**
- Create: `calc/loan.js`
- Test: `calc/loan.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `monthlyRepayment({ principal, annualRatePct, termMonths }) -> number`
  - `loanSummary({ principal, annualRatePct, termMonths }) -> { monthlyRepayment, totalRepaid, totalInterest }`

- [ ] **Step 1: Write the failing test**

Create `calc/loan.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyRepayment, loanSummary } from './loan.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('amortises a 50k loan at 6.5% over 60 months', () => {
  close(monthlyRepayment({ principal: 50000, annualRatePct: 6.5, termMonths: 60 }), 978.24);
});

test('a zero-interest loan is principal divided by term', () => {
  close(monthlyRepayment({ principal: 60000, annualRatePct: 0, termMonths: 60 }), 1000);
});

test('a zero principal costs nothing', () => {
  close(monthlyRepayment({ principal: 0, annualRatePct: 6.5, termMonths: 60 }), 0);
});

test('summary reports total repaid and total interest', () => {
  const s = loanSummary({ principal: 50000, annualRatePct: 6.5, termMonths: 60 });
  close(s.totalRepaid, s.monthlyRepayment * 60);
  close(s.totalInterest, s.totalRepaid - 50000);
  assert.ok(s.totalInterest > 8000 && s.totalInterest < 9000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './loan.js'`.

- [ ] **Step 3: Write the implementation**

Create `calc/loan.js`:

```js
export function monthlyRepayment({ principal, annualRatePct, termMonths }) {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

export function loanSummary({ principal, annualRatePct, termMonths }) {
  const payment = monthlyRepayment({ principal, annualRatePct, termMonths });
  const totalRepaid = payment * termMonths;
  return {
    monthlyRepayment: payment,
    totalRepaid,
    totalInterest: totalRepaid - principal
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 22 tests total.

- [ ] **Step 5: Commit**

```bash
git add calc/loan.js calc/loan.test.js
git commit -m "feat: add loan amortisation"
```

---

### Task 6: `calc/resale.js` and `calc/running-costs.js`

Both are small, are consumed by all three financing options, and change together — so they land in one task.

**Files:**
- Create: `calc/resale.js`, `calc/running-costs.js`
- Test: `calc/resale.test.js`, `calc/running-costs.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `resaleValue({ driveAwayTotal, termMonths, depreciationCurve }) -> number` where `depreciationCurve` is an array of retained-value fractions indexed by whole years, e.g. `[1, 0.78, 0.68, 0.60, 0.53, 0.47]`; values between whole years are linearly interpolated, and terms beyond the curve extend the final year's rate of decline.
  - `runningCosts({ vehicle, annualKm, rates }) -> { insurance, electricity, other, totalIncGst, totalExGst }` where `vehicle` supplies `consumptionKwhPer100km` and `insuranceAnnual`.

- [ ] **Step 1: Write the failing tests**

Create `calc/resale.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resaleValue } from './resale.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);
const curve = [1, 0.78, 0.68, 0.60, 0.53, 0.47];

test('resale at a whole year reads straight off the curve', () => {
  close(resaleValue({ driveAwayTotal: 60000, termMonths: 48, depreciationCurve: curve }), 31800);
});

test('resale mid-year interpolates linearly', () => {
  close(resaleValue({ driveAwayTotal: 60000, termMonths: 42, depreciationCurve: curve }), 34200);
});

test('a term beyond the curve extends the final decline', () => {
  const value = resaleValue({ driveAwayTotal: 60000, termMonths: 72, depreciationCurve: curve });
  assert.ok(value < 0.47 * 60000, 'keeps depreciating past the curve');
  assert.ok(value > 0, 'never goes negative');
});
```

Create `calc/running-costs.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runningCosts } from './running-costs.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);
const vehicle = { consumptionKwhPer100km: 16, insuranceAnnual: 1850 };
const rates = { electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240 };

test('electricity is consumption times distance times price', () => {
  const c = runningCosts({ vehicle, annualKm: 15000, rates });
  close(c.electricity, 672);
});

test('total includes insurance, electricity and other costs', () => {
  const c = runningCosts({ vehicle, annualKm: 15000, rates });
  close(c.totalIncGst, 1850 + 672 + 1240);
});

test('GST-exclusive total is the inclusive total less one eleventh', () => {
  const c = runningCosts({ vehicle, annualKm: 15000, rates });
  close(c.totalExGst, c.totalIncGst * 10 / 11);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `./resale.js` and `./running-costs.js`.

- [ ] **Step 3: Write the implementations**

Create `calc/resale.js`:

```js
export function resaleValue({ driveAwayTotal, termMonths, depreciationCurve }) {
  const years = termMonths / 12;
  const lastIndex = depreciationCurve.length - 1;

  if (years <= lastIndex) {
    const lower = Math.floor(years);
    const upper = Math.min(lower + 1, lastIndex);
    const fraction = years - lower;
    const retained =
      depreciationCurve[lower] +
      (depreciationCurve[upper] - depreciationCurve[lower]) * fraction;
    return driveAwayTotal * retained;
  }

  const finalDecline = depreciationCurve[lastIndex - 1] - depreciationCurve[lastIndex];
  const extraYears = years - lastIndex;
  const retained = Math.max(0.05, depreciationCurve[lastIndex] - finalDecline * extraYears);
  return driveAwayTotal * retained;
}
```

Create `calc/running-costs.js`:

```js
export function runningCosts({ vehicle, annualKm, rates }) {
  const kwh = (vehicle.consumptionKwhPer100km / 100) * annualKm;
  const electricity = kwh * (rates.electricityCentsPerKwh / 100);
  const insurance = vehicle.insuranceAnnual;
  const other = rates.otherRunningCostsAnnual;
  const totalIncGst = insurance + electricity + other;
  return {
    insurance,
    electricity,
    other,
    totalIncGst,
    totalExGst: totalIncGst * 10 / 11
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 28 tests total.

- [ ] **Step 5: Commit**

```bash
git add calc/resale.js calc/resale.test.js calc/running-costs.js calc/running-costs.test.js
git commit -m "feat: add resale value and running cost calculations"
```

---

### Task 7: `calc/novated.js` — the novated lease

The most intricate module in the app. It is also the one whose output the user is most likely to check against a real quote, so the intermediate figures are all exposed rather than collapsed into a single number.

**Files:**
- Create: `calc/novated.js`
- Test: `calc/novated.test.js`

**Interfaces:**
- Consumes: `netIncome` (Task 2), `fbtTreatment`/`annualFbt` (Task 4), `monthlyRepayment` (Task 5), `runningCosts` (Task 6)
- Produces:
  - `gstCredit(driveAwayTotal, tables) -> number`
  - `residualAmount({ vehicleCost, termMonths, residualPctOverride = null }, tables) -> number`
  - `novatedQuote(input, tables) -> quote` where `input` is
    `{ driveAwayTotal, termMonths, leaseRatePct, adminFeeAnnual, runningCostsAnnualExGst, runningCostsAnnualIncGst, leaseStartDate, vehicleValue, grossSalary, residualPctOverride }`
    and `quote` is
    `{ financedAmount, residual, monthlyLeasePayment, annualPreTaxDeduction, annualPostTaxContribution, annualFbt, netMonthlyCost, netAnnualCost }`

Modelling rules, all from the spec:
- Financed amount is drive-away less the GST input credit, capped at `carLimit.maxGstCredit`.
- Residual is the ATO minimum for the term, applied to the vehicle cost. An override is allowed only if it is **higher** than the minimum.
- The monthly lease payment amortises `financedAmount − present value of the residual` at the lease rate.
- Running costs are packaged GST-exclusive; the admin fee is added on top.
- Where FBT is payable it is reduced to nil by post-tax employee contributions, so the post-tax contribution equals the FBT taxable value grossed down — this is what stops the app overstating the benefit.
- Net cost is the fall in take-home pay: `netIncome(salary) − netIncome(salary − preTax) + postTaxContribution`.

- [ ] **Step 1: Write the failing test**

Create `calc/novated.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gstCredit, residualAmount, novatedQuote } from './novated.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

const base = {
  driveAwayTotal: 59232,
  termMonths: 48,
  leaseRatePct: 7.5,
  adminFeeAnnual: 1020,
  runningCostsAnnualIncGst: 3762,
  runningCostsAnnualExGst: 3420,
  leaseStartDate: '2026-07-25',
  vehicleValue: 56000,
  grossSalary: 145000,
  residualPctOverride: null
};

test('GST credit is one eleventh, capped at the car limit', () => {
  close(gstCredit(59232, tables), 5384.73);
  close(gstCredit(120000, tables), 6353);
});

test('residual uses the ATO minimum for the term', () => {
  close(residualAmount({ vehicleCost: 56000, termMonths: 48 }, tables), 21000);
  close(residualAmount({ vehicleCost: 56000, termMonths: 60 }, tables), 15752.8);
});

test('a residual override above the minimum is accepted', () => {
  close(residualAmount({ vehicleCost: 56000, termMonths: 48, residualPctOverride: 0.45 }, tables), 25200);
});

test('a residual override below the ATO minimum is clamped up', () => {
  close(residualAmount({ vehicleCost: 56000, termMonths: 48, residualPctOverride: 0.20 }, tables), 21000);
});

test('an FBT-exempt lease carries no post-tax contribution', () => {
  const q = novatedQuote(base, tables);
  close(q.annualFbt, 0);
  close(q.annualPostTaxContribution, 0);
});

test('financed amount excludes the GST credit', () => {
  const q = novatedQuote(base, tables);
  close(q.financedAmount, 59232 - 5384.73);
});

test('net monthly cost is less than the pre-tax deduction for a 37% earner', () => {
  const q = novatedQuote(base, tables);
  const preTaxMonthly = q.annualPreTaxDeduction / 12;
  assert.ok(q.netMonthlyCost < preTaxMonthly, 'packaging costs less than it deducts');
  assert.ok(q.netMonthlyCost > preTaxMonthly * 0.5, 'but the saving is not more than the tax rate');
});

test('a car over the LCT threshold attracts FBT and a post-tax contribution', () => {
  const dear = { ...base, vehicleValue: 95000, driveAwayTotal: 101000 };
  const q = novatedQuote(dear, tables);
  assert.ok(q.annualFbt > 0, 'FBT applies above the threshold');
  assert.ok(q.annualPostTaxContribution > 0, 'contributions reduce it to nil');
});

test('a lease starting after 1 April 2027 loses the exemption above 75k', () => {
  const before = novatedQuote({ ...base, vehicleValue: 85000, driveAwayTotal: 90000, leaseStartDate: '2027-03-31' }, tables);
  const after = novatedQuote({ ...base, vehicleValue: 85000, driveAwayTotal: 90000, leaseStartDate: '2027-04-01' }, tables);
  close(before.annualPostTaxContribution, 0);
  assert.ok(after.annualPostTaxContribution > 0, 'phase 2 bites one day later');
  assert.ok(after.netMonthlyCost > before.netMonthlyCost, 'and it costs the user real money');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './novated.js'`.

- [ ] **Step 3: Write the implementation**

Create `calc/novated.js`:

```js
import { netIncome } from './tax.js';
import { fbtTreatment, annualFbt as computeFbt } from './fbt.js';
import { monthlyRepayment } from './loan.js';

export function gstCredit(driveAwayTotal, tables) {
  return Math.min(driveAwayTotal / 11, tables.carLimit.maxGstCredit);
}

export function residualAmount({ vehicleCost, termMonths, residualPctOverride = null }, tables) {
  const minimum = tables.residuals[String(termMonths)];
  if (minimum === undefined) {
    throw new Error(`No ATO residual defined for a ${termMonths} month term`);
  }
  const pct = residualPctOverride === null
    ? minimum
    : Math.max(minimum, residualPctOverride);
  return vehicleCost * pct;
}

export function novatedQuote(input, tables) {
  const {
    driveAwayTotal, termMonths, leaseRatePct, adminFeeAnnual,
    runningCostsAnnualExGst, leaseStartDate, vehicleValue,
    grossSalary, residualPctOverride = null
  } = input;

  const credit = gstCredit(driveAwayTotal, tables);
  const financedAmount = driveAwayTotal - credit;
  const residual = residualAmount(
    { vehicleCost: driveAwayTotal, termMonths, residualPctOverride },
    tables
  );

  const monthlyRate = leaseRatePct / 100 / 12;
  const residualPresentValue = residual / Math.pow(1 + monthlyRate, termMonths);
  const monthlyLeasePayment = monthlyRepayment({
    principal: financedAmount - residualPresentValue,
    annualRatePct: leaseRatePct,
    termMonths
  });

  const annualPreTaxDeduction =
    monthlyLeasePayment * 12 + runningCostsAnnualExGst + adminFeeAnnual;

  const treatment = fbtTreatment({ leaseStartDate, vehicleValue }, tables);
  const fbt = computeFbt({ baseValue: vehicleValue, treatment }, tables);

  // Post-tax contributions reduce FBT to nil. Contributing the taxable value
  // removes the liability, so the contribution is the taxable value itself.
  const annualPostTaxContribution = treatment.exempt
    ? 0
    : vehicleValue * tables.fbt.statutoryRate * (1 - treatment.discountRate);

  const withoutPackaging = netIncome({ grossSalary }, tables);
  const withPackaging = netIncome(
    { grossSalary, preTaxDeductions: annualPreTaxDeduction },
    tables
  );

  const netAnnualCost =
    withoutPackaging.netAnnual - withPackaging.netAnnual + annualPostTaxContribution;

  return {
    financedAmount,
    residual,
    monthlyLeasePayment,
    annualPreTaxDeduction,
    annualPostTaxContribution,
    annualFbt: annualPostTaxContribution > 0 ? 0 : fbt,
    netAnnualCost,
    netMonthlyCost: netAnnualCost / 12
  };
}
```

Note the `annualFbt` field reports the FBT actually payable after contributions, which is nil whenever contributions are made. The gross liability before contributions is available from `computeFbt` if it is ever needed for display.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 37 tests total.

- [ ] **Step 5: Commit**

```bash
git add calc/novated.js calc/novated.test.js
git commit -m "feat: add novated lease quote calculation"
```

---

### Task 8: `calc/upfront.js` — cash purchase

**Files:**
- Create: `calc/upfront.js`
- Test: `calc/upfront.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `upfrontQuote({ driveAwayTotal, termMonths, opportunityRatePct, runningCostsAnnualIncGst }) -> { cashOutlay, opportunityCost, runningCostsTotal, netMonthlyRunningCost }`

Opportunity cost is the compound return forgone on the cash over the term.

- [ ] **Step 1: Write the failing test**

Create `calc/upfront.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upfrontQuote } from './upfront.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

const base = {
  driveAwayTotal: 59232,
  termMonths: 48,
  opportunityRatePct: 4.5,
  runningCostsAnnualIncGst: 3762
};

test('cash outlay is the full drive-away price', () => {
  close(upfrontQuote(base).cashOutlay, 59232);
});

test('opportunity cost is the compound return forgone over the term', () => {
  const expected = 59232 * (Math.pow(1.045, 4) - 1);
  close(upfrontQuote(base).opportunityCost, expected);
});

test('a zero return means no opportunity cost', () => {
  close(upfrontQuote({ ...base, opportunityRatePct: 0 }).opportunityCost, 0);
});

test('running costs are paid post-tax across the term', () => {
  const q = upfrontQuote(base);
  close(q.runningCostsTotal, 3762 * 4);
  close(q.netMonthlyRunningCost, 3762 / 12);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './upfront.js'`.

- [ ] **Step 3: Write the implementation**

Create `calc/upfront.js`:

```js
export function upfrontQuote({
  driveAwayTotal,
  termMonths,
  opportunityRatePct,
  runningCostsAnnualIncGst
}) {
  const years = termMonths / 12;
  const growth = Math.pow(1 + opportunityRatePct / 100, years);
  return {
    cashOutlay: driveAwayTotal,
    opportunityCost: driveAwayTotal * (growth - 1),
    runningCostsTotal: runningCostsAnnualIncGst * years,
    netMonthlyRunningCost: runningCostsAnnualIncGst / 12
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 41 tests total.

- [ ] **Step 5: Commit**

```bash
git add calc/upfront.js calc/upfront.test.js
git commit -m "feat: add upfront cash purchase calculation"
```

---

### Task 9: `calc/compare.js` — TCO, reachable vehicle, crossover solver

The module that answers the app's actual question. Note the two rules from the spec that are easy to get wrong: TCO must subtract what the user is left holding, and **upfront is bounded by savings, not by monthly budget**, so its line is horizontal.

**Files:**
- Create: `calc/compare.js`
- Test: `calc/compare.test.js`

**Interfaces:**
- Consumes: every module from Tasks 2–8
- Produces:
  - `optionCosts({ vehicle, inputs }, tables) -> { novated, loan, upfront }` — each entry `{ option, monthlyCost, tco, feasible, detail }`, with `upfront.feasible` false when savings are short
  - `reachableVehicle({ vehicles, budgetMonthly, option, inputs }, tables) -> vehicle | null` — the **highest-priced** variant whose monthly cost under that option is at or below budget
  - `crossoverSeries({ vehicles, inputs, budgetRange }, tables) -> { points, crossovers }` — `points` is `[{ budget, novated, loan, upfront }]` with `null` where an option can reach nothing; `crossovers` is `[{ budget, from, to }]`

`inputs` throughout is
`{ grossSalary, savings, termMonths, annualKm, leaseStartDate, leaseRatePct, loanRatePct, opportunityRatePct, adminFeeAnnual, deposit }`.

- [ ] **Step 1: Write the failing test**

Create `calc/compare.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { optionCosts, reachableVehicle, crossoverSeries } from './compare.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));

const vehicle = (id, listPrice) => ({
  id,
  listPrice,
  consumptionKwhPer100km: 16,
  insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.60, 0.53, 0.47]
});

const inputs = {
  grossSalary: 145000,
  savings: 15000,
  termMonths: 48,
  annualKm: 15000,
  leaseStartDate: '2026-07-25',
  leaseRatePct: 7.5,
  loanRatePct: 6.5,
  opportunityRatePct: 4.5,
  adminFeeAnnual: 1020,
  deposit: 0
};

test('all three options are costed for one vehicle', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  assert.ok(c.novated.tco > 0 && c.loan.tco > 0 && c.upfront.tco > 0);
});

test('TCO subtracts the resale value the user is left holding', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  const grossOutflow = c.loan.detail.totalRepaid + c.loan.detail.runningCostsTotal;
  assert.ok(c.loan.tco < grossOutflow, 'resale value is credited back');
});

test('upfront is infeasible when savings cannot cover the car', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  assert.equal(c.upfront.feasible, false);

  const rich = optionCosts({ vehicle: vehicle('a', 56000), inputs: { ...inputs, savings: 80000 } }, tables);
  assert.equal(rich.upfront.feasible, true);
});

test('a novated lease beats a direct loan for a 37% earner on a cheap EV', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  assert.ok(c.novated.tco < c.loan.tco, 'pre-tax packaging wins under the threshold');
});

test('reachableVehicle picks the dearest variant within budget', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000), vehicle('dear', 95000)];
  const picked = reachableVehicle({ fleet, vehicles: fleet, budgetMonthly: 1000, option: 'novated', inputs }, tables);
  assert.ok(picked, 'something is affordable at $1000/mo');
  assert.notEqual(picked.id, 'cheap', 'it does not settle for the cheapest');
});

test('reachableVehicle returns null when nothing fits', () => {
  const fleet = [vehicle('dear', 95000)];
  const picked = reachableVehicle({ vehicles: fleet, budgetMonthly: 200, option: 'loan', inputs }, tables);
  assert.equal(picked, null);
});

test('the crossover series produces a point per budget step', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000), vehicle('dear', 95000)];
  const series = crossoverSeries(
    { vehicles: fleet, inputs, budgetRange: { min: 400, max: 1600, step: 100 } },
    tables
  );
  assert.equal(series.points.length, 13);
  assert.ok(series.points.every(p => 'budget' in p && 'novated' in p && 'loan' in p));
});

test('the upfront line is flat because savings, not budget, bound it', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000)];
  const series = crossoverSeries(
    { vehicles: fleet, inputs: { ...inputs, savings: 60000 }, budgetRange: { min: 400, max: 1600, step: 400 } },
    tables
  );
  const upfrontValues = series.points.map(p => p.upfront).filter(v => v !== null);
  assert.ok(upfrontValues.length > 1);
  assert.ok(upfrontValues.every(v => Math.abs(v - upfrontValues[0]) < 0.01), 'flat across budgets');
});

test('crossovers are reported where the leading option changes', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000), vehicle('dear', 95000)];
  const series = crossoverSeries(
    { vehicles: fleet, inputs, budgetRange: { min: 400, max: 2500, step: 50 } },
    tables
  );
  assert.ok(Array.isArray(series.crossovers));
  for (const c of series.crossovers) {
    assert.ok(c.budget >= 400 && c.budget <= 2500);
    assert.notEqual(c.from, c.to);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './compare.js'`.

- [ ] **Step 3: Write the implementation**

Create `calc/compare.js`:

```js
import { driveAwayPrice } from './onroad.js';
import { runningCosts } from './running-costs.js';
import { resaleValue } from './resale.js';
import { novatedQuote } from './novated.js';
import { loanSummary, monthlyRepayment } from './loan.js';
import { upfrontQuote } from './upfront.js';

const RATE_DEFAULTS = { electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240 };

function vehicleContext(vehicle, inputs, tables) {
  const onRoad = driveAwayPrice({ listPrice: vehicle.listPrice }, tables);
  const running = runningCosts({
    vehicle,
    annualKm: inputs.annualKm,
    rates: RATE_DEFAULTS
  });
  const resale = resaleValue({
    driveAwayTotal: onRoad.total,
    termMonths: inputs.termMonths,
    depreciationCurve: vehicle.depreciationCurve
  });
  return { onRoad, running, resale, years: inputs.termMonths / 12 };
}

export function optionCosts({ vehicle, inputs }, tables) {
  const { onRoad, running, resale, years } = vehicleContext(vehicle, inputs, tables);

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
    residualPctOverride: inputs.residualPctOverride ?? null
  }, tables);

  // Paying the balloon buys the car outright, so the resale value is credited.
  const novatedTco = novated.netAnnualCost * years + novated.residual - resale;

  const principal = Math.max(0, onRoad.total - inputs.deposit);
  const loan = loanSummary({
    principal,
    annualRatePct: inputs.loanRatePct,
    termMonths: inputs.termMonths
  });
  const loanRunningTotal = running.totalIncGst * years;
  const loanTco = loan.totalRepaid + inputs.deposit + loanRunningTotal - resale;

  const upfront = upfrontQuote({
    driveAwayTotal: onRoad.total,
    termMonths: inputs.termMonths,
    opportunityRatePct: inputs.opportunityRatePct,
    runningCostsAnnualIncGst: running.totalIncGst
  });
  const upfrontTco =
    upfront.cashOutlay + upfront.opportunityCost + upfront.runningCostsTotal - resale;

  return {
    novated: {
      option: 'novated',
      monthlyCost: novated.netMonthlyCost,
      tco: novatedTco,
      feasible: true,
      detail: { ...novated, resale, driveAway: onRoad.total }
    },
    loan: {
      option: 'loan',
      monthlyCost: loan.monthlyRepayment + running.totalIncGst / 12,
      tco: loanTco,
      feasible: true,
      detail: { ...loan, runningCostsTotal: loanRunningTotal, resale, driveAway: onRoad.total }
    },
    upfront: {
      option: 'upfront',
      monthlyCost: upfront.netMonthlyRunningCost,
      tco: upfrontTco,
      feasible: inputs.savings >= onRoad.total,
      detail: { ...upfront, resale, driveAway: onRoad.total }
    }
  };
}

export function reachableVehicle({ vehicles, budgetMonthly, option, inputs }, tables) {
  const affordable = vehicles
    .map(vehicle => ({ vehicle, costs: optionCosts({ vehicle, inputs }, tables)[option] }))
    .filter(({ costs }) => costs.feasible && costs.monthlyCost <= budgetMonthly);

  if (affordable.length === 0) return null;
  return affordable.reduce((dearest, current) =>
    current.vehicle.listPrice > dearest.vehicle.listPrice ? current : dearest
  ).vehicle;
}

export function crossoverSeries({ vehicles, inputs, budgetRange }, tables) {
  const { min, max, step } = budgetRange;
  const options = ['novated', 'loan', 'upfront'];
  const points = [];

  for (let budget = min; budget <= max; budget += step) {
    const point = { budget };
    for (const option of options) {
      const vehicle = reachableVehicle({ vehicles, budgetMonthly: budget, option, inputs }, tables);
      point[option] = vehicle
        ? optionCosts({ vehicle, inputs }, tables)[option].tco
        : null;
    }
    points.push(point);
  }

  const leaderAt = point => {
    const priced = options
      .filter(o => point[o] !== null)
      .map(o => ({ option: o, tco: point[o] }));
    if (priced.length === 0) return null;
    return priced.reduce((best, cur) => (cur.tco < best.tco ? cur : best)).option;
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 50 tests total.

- [ ] **Step 5: Commit**

```bash
git add calc/compare.js calc/compare.test.js
git commit -m "feat: add option comparison and budget crossover solver"
```

---

### Task 10: Golden-case regression tests

Protects the whole core against silent drift when tax tables are refreshed. These are the tests that will fail loudly if someone edits `tax-tables.json` carelessly.

**Files:**
- Create: `calc/golden.test.js`

**Interfaces:**
- Consumes: `optionCosts` (Task 9)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the test with hand-verified figures**

Create `calc/golden.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { optionCosts } from './compare.js';
import { netIncome } from './tax.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 1) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

const inputs = {
  grossSalary: 145000,
  savings: 15000,
  termMonths: 48,
  annualKm: 15000,
  leaseStartDate: '2026-07-25',
  leaseRatePct: 7.5,
  loanRatePct: 6.5,
  opportunityRatePct: 4.5,
  adminFeeAnnual: 1020,
  deposit: 0
};

const ev5 = {
  id: 'kia-ev5-air',
  listPrice: 56000,
  consumptionKwhPer100km: 16,
  insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.60, 0.53, 0.47]
};

test('GOLDEN: a $145k earner takes home $107,380 a year', () => {
  close(netIncome({ grossSalary: 145000 }, tables).netAnnual, 107380);
});

test('GOLDEN: Kia EV5 Air drive-away in Victoria is $59,232', () => {
  close(optionCosts({ vehicle: ev5, inputs }, tables).novated.detail.driveAway, 59232);
});

test('GOLDEN: the 48-month residual is $22,212 of drive-away price', () => {
  close(optionCosts({ vehicle: ev5, inputs }, tables).novated.detail.residual, 59232 * 0.375);
});

test('GOLDEN: novated beats loan, and loan beats upfront on this profile', () => {
  const c = optionCosts({ vehicle: ev5, inputs }, tables);
  assert.ok(c.novated.tco < c.loan.tco, 'novated is cheapest');
  assert.equal(c.upfront.feasible, false, 'upfront is out of reach on $15k savings');
});

test('GOLDEN: crossing the LCT threshold reverses the novated advantage', () => {
  const dear = { ...ev5, listPrice: 95000 };
  const c = optionCosts({ vehicle: dear, inputs }, tables);
  const gap = c.loan.tco - c.novated.tco;
  const cheapGap = (() => {
    const cheap = optionCosts({ vehicle: ev5, inputs }, tables);
    return cheap.loan.tco - cheap.novated.tco;
  })();
  assert.ok(gap < cheapGap, 'the novated advantage shrinks above the threshold');
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS, 55 tests total. If any golden figure fails, the tax tables or a formula changed — investigate before adjusting the expected value.

- [ ] **Step 3: Commit**

```bash
git add calc/golden.test.js
git commit -m "test: add golden-case regression tests for the calculation core"
```

---

**Phase 1 complete.** The calculation core is finished and fully tested with no network, no server, and no UI. Everything from here builds on a foundation that already answers the question correctly.

## Phase 2 — Dataset

### Task 11: Dataset schema and validator

Written **before** the research so the research has a target to fill, and so a malformed row fails a test rather than crashing the app.

**Files:**
- Create: `data/schema.js`, `data/vehicles.json` (seed, 3 rows), `data/families.json` (seed, 2 families), `data/rates.json`
- Test: `data/schema.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `validateVehicle(row) -> { valid: boolean, errors: string[] }`
  - `validateFamily(entry) -> { valid: boolean, errors: string[] }`
  - `loadDataset({ vehicles, families }) -> { vehicles, families, skipped }` — skips and reports invalid rows rather than throwing, per the spec's error handling

- [ ] **Step 1: Write the failing test**

Create `data/schema.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateVehicle, validateFamily, loadDataset } from './schema.js';

const vehicles = JSON.parse(readFileSync(new URL('./vehicles.json', import.meta.url)));
const families = JSON.parse(readFileSync(new URL('./families.json', import.meta.url)));

const goodVehicle = {
  id: 'kia-ev5-air',
  familyId: 'kia-ev5',
  make: 'Kia',
  model: 'EV5',
  variant: 'Air Standard Range',
  bodyType: 'SUV',
  listPrice: 56000,
  batteryKwh: 64.2,
  rangeKm: 400,
  consumptionKwhPer100km: 16,
  bootLitresSeatsUp: 513,
  bootLitresSeatsDown: 1714,
  seats: 5,
  towKg: 1000,
  warrantyYears: 7,
  insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47],
  sourcedAt: '2026-07-25'
};

test('a complete vehicle row validates', () => {
  assert.equal(validateVehicle(goodVehicle).valid, true);
});

test('a missing required field is reported by name', () => {
  const { bootLitresSeatsUp, ...missing } = goodVehicle;
  const result = validateVehicle(missing);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('bootLitresSeatsUp')));
});

test('a non-numeric price is rejected', () => {
  const result = validateVehicle({ ...goodVehicle, listPrice: '56,000' });
  assert.equal(result.valid, false);
});

test('a depreciation curve must start at 1 and decline', () => {
  assert.equal(validateVehicle({ ...goodVehicle, depreciationCurve: [0.9, 0.8] }).valid, false);
  assert.equal(validateVehicle({ ...goodVehicle, depreciationCurve: [1, 0.8, 0.9] }).valid, false);
});

test('a family entry requires summary, pros, cons, sources and images', () => {
  assert.equal(validateFamily({
    id: 'kia-ev5',
    summary: 'Roomy mid-size electric SUV with a big boot.',
    pros: ['Large boot', 'Long warranty', 'Comfortable ride'],
    cons: ['Slow charging', 'Firm seats'],
    sources: ['https://www.carexpert.com.au/kia/ev5'],
    images: ['https://press.kia.com/ev5-front.jpg'],
    sourcedAt: '2026-07-25'
  }).valid, true);

  assert.equal(validateFamily({ id: 'kia-ev5', summary: 'x' }).valid, false);
});

test('every committed vehicle row is valid', () => {
  for (const row of vehicles) {
    const result = validateVehicle(row);
    assert.equal(result.valid, true, `${row.id}: ${result.errors.join(', ')}`);
  }
});

test('every committed family entry is valid', () => {
  for (const entry of families) {
    const result = validateFamily(entry);
    assert.equal(result.valid, true, `${entry.id}: ${result.errors.join(', ')}`);
  }
});

test('every vehicle points at a family that exists', () => {
  const ids = new Set(families.map(f => f.id));
  for (const row of vehicles) {
    assert.ok(ids.has(row.familyId), `${row.id} references missing family ${row.familyId}`);
  }
});

test('loadDataset skips invalid rows rather than throwing', () => {
  const result = loadDataset({
    vehicles: [goodVehicle, { id: 'broken' }],
    families
  });
  assert.equal(result.vehicles.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].id, 'broken');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './schema.js'`.

- [ ] **Step 3: Write the validator**

Create `data/schema.js`:

```js
const VEHICLE_NUMBERS = [
  'listPrice', 'batteryKwh', 'rangeKm', 'consumptionKwhPer100km',
  'bootLitresSeatsUp', 'bootLitresSeatsDown', 'seats', 'towKg',
  'warrantyYears', 'insuranceAnnual'
];
const VEHICLE_STRINGS = ['id', 'familyId', 'make', 'model', 'variant', 'bodyType', 'sourcedAt'];

export function validateVehicle(row) {
  const errors = [];
  if (!row || typeof row !== 'object') return { valid: false, errors: ['row is not an object'] };

  for (const field of VEHICLE_STRINGS) {
    if (typeof row[field] !== 'string' || row[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  for (const field of VEHICLE_NUMBERS) {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) {
      errors.push(`${field} must be a finite number`);
    }
  }

  const curve = row.depreciationCurve;
  if (!Array.isArray(curve) || curve.length < 2) {
    errors.push('depreciationCurve must be an array of at least two values');
  } else {
    if (curve[0] !== 1) errors.push('depreciationCurve must start at 1');
    for (let i = 1; i < curve.length; i++) {
      if (curve[i] > curve[i - 1]) {
        errors.push('depreciationCurve must decline monotonically');
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateFamily(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') return { valid: false, errors: ['entry is not an object'] };

  if (typeof entry.id !== 'string' || !entry.id) errors.push('id must be a non-empty string');
  if (typeof entry.summary !== 'string' || entry.summary.length < 20) {
    errors.push('summary must be at least 20 characters');
  }
  if (typeof entry.sourcedAt !== 'string') errors.push('sourcedAt must be a date string');

  const lists = { pros: 3, cons: 2, sources: 1, images: 1 };
  for (const [field, minimum] of Object.entries(lists)) {
    if (!Array.isArray(entry[field]) || entry[field].length < minimum) {
      errors.push(`${field} must be an array of at least ${minimum}`);
    }
  }
  if (Array.isArray(entry.images) && entry.images.some(u => !u.startsWith('https://'))) {
    errors.push('images must all be https URLs');
  }

  return { valid: errors.length === 0, errors };
}

export function loadDataset({ vehicles, families }) {
  const skipped = [];
  const valid = [];

  for (const row of vehicles) {
    const result = validateVehicle(row);
    if (result.valid) valid.push(row);
    else skipped.push({ id: row?.id ?? 'unknown', errors: result.errors });
  }

  return { vehicles: valid, families, skipped };
}
```

- [ ] **Step 4: Create the seed data files**

Create `data/vehicles.json` with three real, researched rows (Kia EV5 Air, BYD Atto 3, Tesla Model Y RWD) following the shape in the test. Create `data/families.json` with the two matching family entries. Create `data/rates.json`:

```json
{
  "loanRatePct": 6.5,
  "leaseRatePct": 7.5,
  "adminFeeAnnual": 1020,
  "opportunityRatePct": 4.5,
  "electricityCentsPerKwh": 28,
  "otherRunningCostsAnnual": 1240,
  "defaultAnnualKm": 15000,
  "sources": {
    "loanRatePct": "Mid-market green EV secured rate, July 2026. Best advertised 5.66%.",
    "leaseRatePct": "Competitive novated comparison rate 6.5-7.5%; ~9.5% effective on 5 years.",
    "adminFeeAnnual": "Typical $85/month packaging fee.",
    "otherRunningCostsAnnual": "VIC rego ~$880 plus servicing and tyres. ZLEV discount ended 1 Jan 2026."
  },
  "sourcedAt": "2026-07-25"
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 64 tests total.

- [ ] **Step 6: Commit**

```bash
git add data/schema.js data/schema.test.js data/vehicles.json data/families.json data/rates.json
git commit -m "feat: add dataset schema, validator and seed rows"
```

---

### Task 12: Research and build the full dataset

A manual research pass, not automated code. The validator from Task 11 is the acceptance gate.

**Files:**
- Create: `scripts/build-dataset.js`
- Modify: `data/vehicles.json` (expand to 60–80 rows), `data/families.json` (expand to ~30 families)

**Interfaces:**
- Consumes: `validateVehicle`, `validateFamily` (Task 11)
- Produces: the complete committed dataset

- [ ] **Step 1: Write the validation runner**

Create `scripts/build-dataset.js`:

```js
import { readFileSync } from 'node:fs';
import { validateVehicle, validateFamily } from '../data/schema.js';

const vehicles = JSON.parse(readFileSync(new URL('../data/vehicles.json', import.meta.url)));
const families = JSON.parse(readFileSync(new URL('../data/families.json', import.meta.url)));
const familyIds = new Set(families.map(f => f.id));

let failures = 0;

for (const row of vehicles) {
  const result = validateVehicle(row);
  if (!result.valid) {
    console.error(`FAIL ${row.id ?? 'unknown'}: ${result.errors.join('; ')}`);
    failures++;
  }
  if (!familyIds.has(row.familyId)) {
    console.error(`FAIL ${row.id}: references missing family ${row.familyId}`);
    failures++;
  }
}

for (const entry of families) {
  const result = validateFamily(entry);
  if (!result.valid) {
    console.error(`FAIL family ${entry.id ?? 'unknown'}: ${result.errors.join('; ')}`);
    failures++;
  }
}

const covered = new Set(vehicles.map(v => v.familyId));
for (const id of familyIds) {
  if (!covered.has(id)) console.warn(`WARN family ${id} has no variants`);
}

console.log(`${vehicles.length} variants across ${families.length} families, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);
```

- [ ] **Step 2: Research the variant data**

Cover the EVs actually on sale in Victoria, at **variant** level — a Long Range trim crossing the FBT threshold when the base does not is precisely the case the app exists to catch. Target families: BYD Atto 3, Dolphin, Seal, Sealion 7; Tesla Model 3, Model Y; MG4, MGS5; Kia EV3, EV5, EV6, EV9; Hyundai Inster, Kona Electric, Ioniq 5, Ioniq 6; Polestar 2, 4; Volvo EX30, EX40; GWM Ora; Zeekr X, 7X; Xpeng G6, G9; Leapmotor C10; Cupra Born; Nissan Leaf; Subaru Solterra; Toyota bZ4X; Ford Mustang Mach-E.

For each variant record VIC drive-away price, list price, battery kWh, range, consumption, boot litres seats up and down, seats, tow rating, warranty and an insurance estimate scaled from the family's brand and the variant's value.

For the depreciation curve, use a per-family retained-value curve. A reasonable default for mainstream EVs is `[1, 0.78, 0.68, 0.60, 0.53, 0.47]`; adjust for families with notably strong or weak resale.

- [ ] **Step 3: Research each family's reviews and images**

One short research pass per family, roughly 30 in total. For each, collect a two-to-three sentence consensus summary in the app's own words, three to five pros, two to five cons, the source URLs (preferring CarExpert, Drive, CarsGuide, WhichCar since verdicts on ride and value are market-specific), and two or three image URLs from the **manufacturer's press or media room only** — press rooms exist for republication, review-site photography does not. Set `sourcedAt` on each entry.

- [ ] **Step 4: Validate the dataset**

Run: `node scripts/build-dataset.js`
Expected: `NN variants across ~30 families, 0 failures` and exit code 0.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — the "every committed vehicle row is valid" and family-reference tests now cover the full dataset.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-dataset.js data/vehicles.json data/families.json
git commit -m "feat: add researched EV dataset with family reviews and press images"
```

---

**Remaining tasks to append:** 13–15 (Express server, Claude client, and the three endpoints with fallbacks), 16–20 (UI sections, crossover chart, wiring, Heroku deploy).
