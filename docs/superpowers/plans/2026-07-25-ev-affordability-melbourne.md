# EV Affordability Calculator (Melbourne) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that compares novated lease, direct car loan, and cash upfront for buying an electric car in Melbourne, showing which wins as the user's monthly budget changes.

**Architecture:** A pure, deterministic calculation core in `calc/` (plain object in, plain object out, no I/O) is imported unchanged by both the browser and the Node test runner. An Express server on Heroku serves static assets and proxies three Claude endpoints that parse free text, rank a shortlist, and narrate results. Claude never produces a dollar figure; it sits outside the calculation wall on both sides of it.

**Tech Stack:** Node 22 LTS, Express 5, `@anthropic-ai/sdk`, `zod`, `node:test`. No bundler, no framework, no build step — native ES modules straight to the browser.

## Global Constraints

- Node 22 LTS pinned in `.nvmrc`; `engines.node: ">=20"` in `package.json`; `"type": "module"`.
- Everything in `calc/` is pure: no `fetch`, no `Date.now()`, no randomness, no imports from `server/`. Dates and tax tables are always passed in as arguments.
- No model ever calculates. Models convert prose to inputs before the maths and narrate figures after it.
- Parsing runs on-device first via Chrome's `LanguageModel` (Prompt API), falling back to `/api/parse` on **Claude Haiku** (`claude-haiku-4-5-20251001`), then to a keyword parser.
- Ranking is **deterministic** — a pure scoring function in `calc/rank.js`, never a model call.
- Explanation is the only reasoning call and uses **Claude Sonnet** (`claude-sonnet-5`).
- The UI must carry a non-dismissible general-advice disclaimer next to the recommendation.
- All money is handled as JavaScript numbers in dollars; round only at display time.
- Every Claude response is validated with zod before anything downstream consumes it.
- The calculator must work fully with the Claude API unavailable.
- Tax year 2026-27 resident rates: nil to $18,200 · 15% to $45,000 · 30% to $135,000 · 37% to $190,000 · 45% above. Medicare levy 2%.
- LCT fuel-efficient threshold 2026-27: **$91,661**. Car limit 2026-27: **$69,883** (GST credit cap **$6,353**).
- ATO minimum residuals: 12mo 65.63% · 24mo 56.25% · 36mo 46.88% · 48mo 37.5% · 60mo 28.13%.
- VIC green passenger car duty: **$8.40 per $200** of dutiable value at every price point.
- FBT phases: full exemption to 31 Mar 2027 · exempt at **$75,000 or less** with a 25% discount above that, 1 Apr 2027 to 31 Mar 2029 · 25% discount for all from 1 Apr 2029. Leases are grandfathered at their start date. The $75,000 cap is inclusive — a car priced at exactly $75,000 keeps the full exemption.
- Not modelled: HELP/HECS, Medicare Levy Surcharge, Division 293, family benefits.
- Test command is always `npm test` (`node --test`). Every task ends green.

---

## File Structure

| File | Responsibility |
|---|---|
| `data/tax-tables.json` | Brackets, LITO, Medicare, LCT, car limit, residuals, FBT phases, VIC duty |
| `data/rates.json` | Finance and running-cost defaults with sources |
| `data/vehicles.json` | 60–80 variants, numeric fields only |
| `data/families.json` | Per-family reviews, pros/cons, source links (images deferred) |
| `calc/tax.js` | Gross salary → tax, Medicare, LITO, take-home |
| `calc/onroad.js` | List price → LCT, VIC stamp duty, rego, drive-away |
| `calc/fbt.js` | Lease start date + value → phase, treatment, FBT liability |
| `calc/loan.js` | Amortisation |
| `calc/resale.js` | Depreciation curve → resale value at end of term |
| `calc/running-costs.js` | Insurance, electricity, rego/tyres/servicing |
| `calc/novated.js` | Lease payment, residual, packaging, net take-home impact |
| `calc/upfront.js` | Cash outlay plus opportunity cost |
| `calc/compare.js` | TCO for all three, reachable vehicle, crossover solver |
| `calc/rank.js` | Deterministic shortlist scoring — no model call |
| `public/ui/prompt-api.js` | Chrome on-device LanguageModel client, availability-gated |
| `server/index.js` | Express boot, static, PORT |
| `server/claude.js` | SDK client, per-route model, timeout, graceful failure |
| `server/schema.js` | zod schemas for every Claude response |
| `server/routes/parse.js` | Free text → filters (Haiku); fallback for non-Chrome browsers |
| `server/routes/explain.js` | Plain-English narration (Sonnet) |
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
  // Verified by simulating the schedule: 60 payments of this amount drive the
  // balance to exactly zero.
  close(monthlyRepayment({ principal: 50000, annualRatePct: 6.5, termMonths: 60 }), 978.31);
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
  // 3.5 years sits halfway between year 3 (0.60) and year 4 (0.53) => 0.565
  close(resaleValue({ driveAwayTotal: 60000, termMonths: 42, depreciationCurve: curve }), 33900);
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
  // The residual is a percentage of the CAR's cost, not the drive-away total.
  // Stamp duty and registration have no resale value, so applying a residual
  // percentage to them would overstate what the car is worth at term end.
  const residual = residualAmount(
    { vehicleCost: vehicleValue, termMonths, residualPctOverride },
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
  const picked = reachableVehicle({ vehicles: fleet, budgetMonthly: 1000, option: 'novated', inputs }, tables);
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

test('GOLDEN: the 48-month residual is 37.5% of the car price, not the drive-away price', () => {
  // $21,000, not $22,212 — stamp duty and rego are excluded from the residual base.
  close(optionCosts({ vehicle: ev5, inputs }, tables).novated.detail.residual, 56000 * 0.375);
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

### Task 12: Research and build the full dataset (parallel fan-out)

A research pass, not automated code, and the only task in the plan that fans out. Each family is researched by its own subagent writing its **own pair of files**, so parallel agents never touch a shared file. `build-dataset.js` then merges the per-family files into the two JSON files the server reads.

**Files:**
- Create: `scripts/build-dataset.js`, `data/families/<familyId>.json` (~43), `data/vehicles/<familyId>.json` (~43)
- Modify: `data/vehicles.json`, `data/families.json` — now **generated**, never hand-edited

**Interfaces:**
- Consumes: `validateVehicle`, `validateFamily` (Task 11)
- Produces: the complete committed dataset

- [ ] **Step 1: Write the merge-and-validate script**

Create `scripts/build-dataset.js`:

```js
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateVehicle, validateFamily } from '../data/schema.js';

const dataDir = new URL('../data/', import.meta.url).pathname;
const readAll = folder => {
  const dir = join(dataDir, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .flatMap(name => {
      const parsed = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      return Array.isArray(parsed) ? parsed : [parsed];
    });
};

const families = readAll('families');
const vehicles = readAll('vehicles');
const familyIds = new Set(families.map(f => f.id));
let failures = 0;

const fail = message => { console.error(`FAIL ${message}`); failures++; };

for (const row of vehicles) {
  const result = validateVehicle(row);
  if (!result.valid) fail(`${row.id ?? 'unknown'}: ${result.errors.join('; ')}`);
  if (!familyIds.has(row.familyId)) fail(`${row.id}: missing family ${row.familyId}`);
}

for (const entry of families) {
  const result = validateFamily(entry);
  if (!result.valid) fail(`family ${entry.id ?? 'unknown'}: ${result.errors.join('; ')}`);
}

const ids = vehicles.map(v => v.id);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicates.length) fail(`duplicate vehicle ids: ${[...new Set(duplicates)].join(', ')}`);

const covered = new Set(vehicles.map(v => v.familyId));
for (const id of familyIds) {
  if (!covered.has(id)) console.warn(`WARN family ${id} has no variants`);
}

if (failures === 0) {
  const sortById = (a, b) => a.id.localeCompare(b.id);
  writeFileSync(join(dataDir, 'vehicles.json'), JSON.stringify([...vehicles].sort(sortById), null, 2) + '\n');
  writeFileSync(join(dataDir, 'families.json'), JSON.stringify([...families].sort(sortById), null, 2) + '\n');
}

console.log(`${vehicles.length} variants across ${families.length} families, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);
```

- [ ] **Step 2: Migrate the Task 11 seed rows into per-family files**

Split the three seed rows and two seed families from Task 11 into `data/vehicles/<familyId>.json` and `data/families/<familyId>.json`. Run `node scripts/build-dataset.js` and confirm it regenerates the two merged files with `0 failures`.

- [ ] **Step 3: Research each family (fanned out, one subagent per family)**

Target families, 43, chosen so the dataset spans both FBT thresholds rather than clustering
below them. The $75,000 and $91,661 boundaries are where the recommendation flips, so families
that straddle a threshold at variant level are the most valuable rows in the set.

**Under ~$50k — exempt in every phase (9):** BYD Dolphin · BYD Atto 3 · MG4 · GWM Ora ·
Hyundai Inster · Leapmotor C10 · Kia EV3 · Chery Omoda E5 · Geely EX5

**~$50–75k — exempt now, still exempt after Apr 2027 (19):** BYD Seal · BYD Sealion 7 · MGS5 ·
Tesla Model 3 · Tesla Model Y · Kia EV5 · Hyundai Kona Electric · Xpeng G6 · Zeekr X ·
Volvo EX30 · Subaru Solterra · Toyota bZ4X · Deepal S07 · Skoda Elroq · Renault Megane E-Tech ·
Nissan Ariya · Mahindra XEV 9e · Mini Cooper E · Jeep Avenger

**~$75–91.7k — exempt today, 25% discount from Apr 2027 (13):** Hyundai Ioniq 5 ·
Hyundai Ioniq 6 · Kia EV6 · Polestar 4 · Volvo EX40 · Zeekr 7X · Xpeng G9 ·
Ford Mustang Mach-E · Skoda Enyaq · BMW iX1 · Mercedes EQA · Mercedes EQB · Audi Q4 e-tron

**Above ~$91.7k — never exempt (2):** Kia EV9 · BMW i4

Band placement above is indicative only, from list price recall — the research pass establishes
the real Victorian pricing, and a family may land in a different band or straddle two. Several
are expected to straddle at variant level (BMW i4 eDrive35 versus M50, Kia EV6 versus EV6 GT),
which is exactly the case the app exists to illuminate.

**Excluded after review, do not research:** Nissan Leaf, Cupra Born and Polestar 2 — each is
either withdrawn from the Australian market or of uncertain current availability, and would
consume a research slot to establish that.

**Established NOT on sale during research — do not re-research:**
- **GWM Ora** — production ended; GWM confirmed the hatch is discontinued and replaced by the
  Ora 5 SUV, a different vehicle on a different platform. Remaining stock is dealer run-out.
- **Xpeng G9** — xpeng.com.au shows register-interest only, with no configurator, variants or
  prices. CarExpert lists only the G6 as XPeng's on-sale Australian model.

If an agent finds its assigned family is not actually on sale in Australia as at the research
date, it must report that and write no files, rather than inventing a plausible row.

Each subagent handles exactly one family and writes exactly two files, `data/families/<id>.json` and `data/vehicles/<id>.json`. It must not touch `vehicles.json`, `families.json`, or any other family's files.

**Vehicles file** — one row per **variant** on sale in Victoria. Variant granularity is the point: a Long Range trim crossing the FBT threshold when the base does not is exactly the case the app exists to catch. Fields per the Task 11 schema: VIC drive-away price, list price, battery kWh, range, consumption, boot litres seats up and down, seats, tow rating, warranty, insurance estimate, and a depreciation curve. Default curve for mainstream EVs is `[1, 0.78, 0.68, 0.60, 0.53, 0.47]`; adjust for families with notably strong or weak resale.

**Families file** — a two-to-three sentence consensus summary in the app's own words, three to five pros, two to five cons, source URLs (preferring CarExpert, Drive, CarsGuide, WhichCar, since verdicts on ride and value are market-specific), and `sourcedAt`.

**Do not research or supply images.** The `images` field is deferred and must be omitted entirely. Spend the effort on pricing accuracy and review quality instead — those are what the app actually reasons about.

Each subagent validates its own two files before reporting, by running `node scripts/build-dataset.js` and confirming its own family produces no `FAIL` lines. A non-zero exit caused by *another* family still in flight is expected and not its concern.

- [ ] **Step 4: Merge and validate the whole dataset**

Run: `node scripts/build-dataset.js`
Expected: `NN variants across ~43 families, 0 failures`, exit code 0, and both merged files rewritten.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — the "every committed vehicle row is valid" and family-reference tests from Task 11 now cover the full dataset.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-dataset.js data/families data/vehicles data/vehicles.json data/families.json
git commit -m "feat: add researched EV dataset with family reviews and press images"
```

---

## Phase 3 — Server

### Task 13: Express server, static hosting, and the keyword fallback parser

The fallback parser is built **before** the Claude endpoint that it backs up, so the server is never in a state where an API failure has no answer.

**Files:**
- Create: `server/index.js`, `server/fallback-parser.js`, `Procfile`, `.env.example`
- Modify: `package.json` (add dependencies)
- Test: `server/fallback-parser.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `parseKeywords(text) -> { bodyTypes, minBootLitres, minRangeKm, seats, grossSalary, monthlyBudget, termMonths }` with `null` for anything not found

- [ ] **Step 1: Install dependencies**

```bash
npm install express@^5 zod@^3 @anthropic-ai/sdk
```

- [ ] **Step 2: Write the failing test**

Create `server/fallback-parser.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKeywords } from './fallback-parser.js';

test('extracts salary written with a k suffix', () => {
  assert.equal(parseKeywords('I earn $145k a year').grossSalary, 145000);
});

test('extracts salary written in full', () => {
  assert.equal(parseKeywords('my salary is $145,000').grossSalary, 145000);
});

test('extracts a monthly budget', () => {
  assert.equal(parseKeywords('I can spend about $900 a month').monthlyBudget, 900);
});

test('distinguishes annual salary from monthly budget in one sentence', () => {
  const r = parseKeywords('I earn $145k and can spend about $900 a month on a car');
  assert.equal(r.grossSalary, 145000);
  assert.equal(r.monthlyBudget, 900);
});

test('recognises body types', () => {
  assert.deepEqual(parseKeywords('looking for an SUV').bodyTypes, ['SUV']);
  assert.deepEqual(parseKeywords('a small hatchback please').bodyTypes, ['Hatch']);
});

test('infers a boot requirement from a dog', () => {
  const r = parseKeywords('I need a big boot for my large dog');
  assert.ok(r.minBootLitres >= 500);
});

test('extracts a range requirement', () => {
  assert.equal(parseKeywords('I want at least 400km of range').minRangeKm, 400);
});

test('extracts a loan term in years', () => {
  assert.equal(parseKeywords('over 5 years').termMonths, 60);
});

test('returns nulls for text with nothing extractable', () => {
  const r = parseKeywords('something nice please');
  assert.equal(r.grossSalary, null);
  assert.equal(r.monthlyBudget, null);
  assert.deepEqual(r.bodyTypes, []);
});
```

- [ ] **Step 3: Write the fallback parser**

Create `server/fallback-parser.js`:

```js
const BODY_TYPES = [
  { match: /\bsuv\b/i, value: 'SUV' },
  { match: /\bsedan\b/i, value: 'Sedan' },
  { match: /\bhatch(back)?\b/i, value: 'Hatch' },
  { match: /\bwagon\b/i, value: 'Wagon' },
  { match: /\bute\b/i, value: 'Ute' }
];

function toNumber(raw) {
  return Number(raw.replace(/[$,\s]/g, ''));
}

export function parseKeywords(text) {
  const result = {
    bodyTypes: [],
    minBootLitres: null,
    minRangeKm: null,
    seats: null,
    grossSalary: null,
    monthlyBudget: null,
    termMonths: null
  };
  if (typeof text !== 'string') return result;

  const monthly = text.match(/\$?([\d,.]+)\s*k?\s*(?:per month|a month|\/month|pm\b|monthly)/i);
  if (monthly) {
    const value = toNumber(monthly[1]);
    result.monthlyBudget = /k/i.test(monthly[0]) ? value * 1000 : value;
  }

  const salary = text.match(/\$?([\d,.]+)\s*k\b|\$([\d,]{5,})/i);
  if (salary) {
    const raw = salary[1] ?? salary[2];
    const value = toNumber(raw);
    const scaled = salary[1] ? value * 1000 : value;
    if (scaled !== result.monthlyBudget && scaled >= 20000) result.grossSalary = scaled;
  }

  for (const { match, value } of BODY_TYPES) {
    if (match.test(text)) result.bodyTypes.push(value);
  }

  if (/\bdog\b|\bpram\b|\bcamping\b|\bbig boot\b|\blarge boot\b/i.test(text)) {
    result.minBootLitres = /\blarge dog\b|\bbig dog\b|\bcrate\b/i.test(text) ? 500 : 400;
  }

  const range = text.match(/(\d{3})\s*(?:\+)?\s*km/i);
  if (range) result.minRangeKm = Number(range[1]);

  const seats = text.match(/(\d)\s*seat/i);
  if (seats) result.seats = Number(seats[1]);

  const years = text.match(/(\d)\s*year/i);
  if (years) result.termMonths = Number(years[1]) * 12;

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 73 tests total.

- [ ] **Step 5: Create the server**

Create `server/index.js`:

```js
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDataset } from '../data/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const readJson = name =>
  JSON.parse(readFileSync(join(here, '..', 'data', name), 'utf8'));

const dataset = loadDataset({
  vehicles: readJson('vehicles.json'),
  families: readJson('families.json')
});

if (dataset.skipped.length > 0) {
  console.warn(`Skipped ${dataset.skipped.length} invalid vehicle rows:`);
  for (const s of dataset.skipped) console.warn(`  ${s.id}: ${s.errors.join('; ')}`);
}

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(join(here, '..', 'public')));

app.get('/api/dataset', (req, res) => {
  res.json({
    vehicles: dataset.vehicles,
    families: dataset.families,
    rates: readJson('rates.json'),
    tables: readJson('tax-tables.json'),
    aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY)
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, vehicles: dataset.vehicles.length });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));

export { app, dataset };
```

Create `Procfile`:

```
web: node server/index.js
```

Create `.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

- [ ] **Step 6: Verify the server boots and serves the dataset**

Run: `node server/index.js &` then `curl -s localhost:3000/api/health`
Expected: `{"ok":true,"vehicles":NN}` where NN matches the dataset size. Confirm it boots **without** `ANTHROPIC_API_KEY` set and reports `aiEnabled: false` from `/api/dataset`. Stop the server afterwards.

- [ ] **Step 7: Commit**

```bash
git add server/index.js server/fallback-parser.js server/fallback-parser.test.js Procfile .env.example package.json package-lock.json
git commit -m "feat: add Express server, dataset endpoint and keyword fallback parser"
```

---

### Task 14: Claude client and response schemas

One model per job: Haiku for structured extraction, Sonnet for the single call that needs reasoning. `askClaude` takes the model as an argument rather than hardcoding one.

**Files:**
- Create: `server/claude.js`, `server/schema.js`
- Test: `server/schema.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `askClaude({ system, messages, tool, timeoutMs = 10000 }) -> object | null` — returns the validated tool input, or `null` on any failure (no key, timeout, network error, malformed response). It never throws.
  - `parseSchema`, `explainSchema` — zod schemas
  - `MODELS` — `{ parse: 'claude-haiku-4-5-20251001', explain: 'claude-sonnet-5' }`
  - `clampParsed(parsed) -> parsed` — clamps numeric fields to sane ranges per the spec

- [ ] **Step 1: Write the failing test**

Create `server/schema.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchema, explainSchema, clampParsed } from './schema.js';

test('a well-formed parse result validates', () => {
  const result = parseSchema.safeParse({
    bodyTypes: ['SUV'],
    minBootLitres: 500,
    minRangeKm: 400,
    seats: 5,
    grossSalary: 145000,
    monthlyBudget: 900,
    termMonths: 60,
    clarifyingQuestion: null
  });
  assert.equal(result.success, true);
});

test('an unknown body type is rejected', () => {
  const result = parseSchema.safeParse({ bodyTypes: ['Spaceship'] });
  assert.equal(result.success, false);
});

test('a parse result may omit every optional field', () => {
  assert.equal(parseSchema.safeParse({}).success, true);
});

test('explain results require non-empty prose', () => {
  assert.equal(explainSchema.safeParse({ explanation: 'Because you are in the 37% bracket.' }).success, true);
  assert.equal(explainSchema.safeParse({ explanation: '' }).success, false);
});

test('an implausible salary is clamped, not rejected', () => {
  assert.equal(clampParsed({ grossSalary: 99000000 }).grossSalary, 1000000);
  assert.equal(clampParsed({ grossSalary: 200 }).grossSalary, 20000);
});

test('an implausible budget is clamped', () => {
  assert.equal(clampParsed({ monthlyBudget: 500000 }).monthlyBudget, 10000);
});

test('the term is snapped to a supported ATO lease term', () => {
  assert.equal(clampParsed({ termMonths: 50 }).termMonths, 48);
  assert.equal(clampParsed({ termMonths: 999 }).termMonths, 60);
});

test('clamping leaves absent fields absent', () => {
  assert.deepEqual(clampParsed({}), {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './schema.js'`.

- [ ] **Step 3: Write the schemas**

Create `server/schema.js`:

```js
import { z } from 'zod';

const BODY_TYPES = ['SUV', 'Sedan', 'Hatch', 'Wagon', 'Ute'];
const TERMS = [12, 24, 36, 48, 60];

export const parseSchema = z.object({
  bodyTypes: z.array(z.enum(BODY_TYPES)).optional(),
  minBootLitres: z.number().nullable().optional(),
  minRangeKm: z.number().nullable().optional(),
  seats: z.number().int().nullable().optional(),
  grossSalary: z.number().nullable().optional(),
  monthlyBudget: z.number().nullable().optional(),
  termMonths: z.number().int().nullable().optional(),
  clarifyingQuestion: z.string().nullable().optional()
});

export const explainSchema = z.object({
  explanation: z.string().min(1)
});

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function clampParsed(parsed) {
  const out = { ...parsed };
  if (typeof out.grossSalary === 'number') out.grossSalary = clamp(out.grossSalary, 20000, 1000000);
  if (typeof out.monthlyBudget === 'number') out.monthlyBudget = clamp(out.monthlyBudget, 100, 10000);
  if (typeof out.minBootLitres === 'number') out.minBootLitres = clamp(out.minBootLitres, 0, 3000);
  if (typeof out.minRangeKm === 'number') out.minRangeKm = clamp(out.minRangeKm, 0, 1000);
  if (typeof out.seats === 'number') out.seats = clamp(out.seats, 2, 9);
  if (typeof out.termMonths === 'number') {
    out.termMonths = TERMS.reduce((best, t) =>
      Math.abs(t - out.termMonths) < Math.abs(best - out.termMonths) ? t : best
    );
  }
  return out;
}
```

- [ ] **Step 4: Write the Claude client**

Create `server/claude.js`:

```js
import Anthropic from '@anthropic-ai/sdk';

// Model per job, not one model for everything.
// HAIKU: structured extraction — narrow, well-specified, high volume, cheap.
//        Only reached when the browser's on-device Prompt API is unavailable.
// SONNET: the explanation — the one job that genuinely needs reasoning.
export const MODELS = {
  parse: 'claude-haiku-4-5-20251001',
  explain: 'claude-sonnet-5'
};

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export const aiEnabled = () => client !== null;

/**
 * Calls Claude and returns the validated tool input, or null on any failure.
 * Never throws — every caller has a working fallback path.
 */
export async function askClaude({ model, system, messages, tool, schema, timeoutMs = 10000 }) {
  if (!client) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name }
    }, { signal: controller.signal });

    const block = response.content.find(c => c.type === 'tool_use');
    if (!block) return null;

    const validated = schema.safeParse(block.input);
    return validated.success ? validated.data : null;
  } catch (error) {
    console.warn(`Claude call failed: ${error.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 82 tests total.

- [ ] **Step 6: Commit**

```bash
git add server/claude.js server/schema.js server/schema.test.js
git commit -m "feat: add Claude client with validation, timeout and graceful failure"
```

---

### Task 15: Deterministic ranking, and the two Claude endpoints

Ranking is a **pure scoring function**, not a model call. Given the same inputs it returns the same order every time, it costs nothing, it works offline, and it is unit-testable — none of which is true of a model-ranked list. Only two jobs remain for Claude: parsing (Haiku, and only when the browser's on-device Prompt API is unavailable) and explaining (Sonnet).

**Files:**
- Create: `calc/rank.js`, `server/routes/parse.js`, `server/routes/explain.js`
- Modify: `server/index.js` (mount the routes)
- Test: `calc/rank.test.js`, `server/routes/parse.test.js`

**Interfaces:**
- Consumes: `askClaude` and `MODELS` (Task 14), `parseKeywords` (Task 13), schemas (Task 14)
- Produces:
  - `scoreVehicle(vehicle, preferences) -> number` — higher is better
  - `rankVehicles(vehicles, preferences, limit = 5) -> [{ vehicle, score, reasons }]`
  - two mounted Express routers. Each response carries `source: 'claude' | 'fallback' | 'none'` so the UI can show what happened.

- [ ] **Step 0: Write the failing test for deterministic ranking**

Create `calc/rank.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreVehicle, rankVehicles } from './rank.js';

const car = (id, over = {}) => ({
  id, listPrice: 55000, bootLitresSeatsUp: 450, rangeKm: 450,
  warrantyYears: 5, seats: 5, bodyType: 'SUV', ...over
});

test('a bigger boot scores higher when boot space is wanted', () => {
  const prefs = { minBootLitres: 500 };
  assert.ok(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), prefs) >
    scoreVehicle(car('small', { bootLitresSeatsUp: 520 }), prefs)
  );
});

test('boot space barely matters when it was never mentioned', () => {
  const prefs = {};
  const spread = Math.abs(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), prefs) -
    scoreVehicle(car('small', { bootLitresSeatsUp: 300 }), prefs)
  );
  const bootSpread = Math.abs(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), { minBootLitres: 500 }) -
    scoreVehicle(car('small', { bootLitresSeatsUp: 300 }), { minBootLitres: 500 })
  );
  assert.ok(spread < bootSpread, 'an unstated preference carries less weight');
});

test('longer range scores higher when range is wanted', () => {
  const prefs = { minRangeKm: 400 };
  assert.ok(
    scoreVehicle(car('far', { rangeKm: 600 }), prefs) >
    scoreVehicle(car('near', { rangeKm: 410 }), prefs)
  );
});

test('ranking is deterministic — same input, same order, every time', () => {
  const fleet = [car('a'), car('b', { bootLitresSeatsUp: 600 }), car('c', { rangeKm: 520 })];
  const prefs = { minBootLitres: 500, minRangeKm: 400 };
  const first = rankVehicles(fleet, prefs).map(r => r.vehicle.id);
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(rankVehicles(fleet, prefs).map(r => r.vehicle.id), first);
  }
});

test('ranking respects the limit', () => {
  const fleet = Array.from({ length: 12 }, (_, i) => car(`v${i}`));
  assert.equal(rankVehicles(fleet, {}, 3).length, 3);
});

test('each result carries human-readable reasons', () => {
  const ranked = rankVehicles([car('a', { bootLitresSeatsUp: 700 })], { minBootLitres: 500 });
  assert.ok(Array.isArray(ranked[0].reasons));
  assert.ok(ranked[0].reasons.length > 0);
  assert.equal(typeof ranked[0].reasons[0], 'string');
});

test('an empty fleet ranks to an empty list', () => {
  assert.deepEqual(rankVehicles([], { minBootLitres: 500 }), []);
});

test('ties break on a stable, documented rule rather than array order', () => {
  const fleet = [car('zzz'), car('aaa')];
  assert.deepEqual(rankVehicles(fleet, {}).map(r => r.vehicle.id), ['aaa', 'zzz']);
});
```

- [ ] **Step 0b: Run it and confirm it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './rank.js'`.

- [ ] **Step 0c: Write the deterministic ranker**

Create `calc/rank.js`:

```js
// Deterministic shortlist scoring. No model call: same inputs always give the
// same order, it costs nothing, and it works with no network.
//
// Each dimension contributes a 0..1 normalised value times a weight. A weight
// is raised when the user actually expressed that preference, so an unstated
// preference still nudges but never dominates.

const WEIGHTS = {
  boot: { stated: 3.0, unstated: 0.5 },
  range: { stated: 2.5, unstated: 0.8 },
  warranty: { stated: 0, unstated: 0.6 },
  value: { stated: 0, unstated: 1.0 }
};

const ratio = (value, reference) =>
  reference > 0 ? Math.min(1, value / reference) : 0;

export function scoreVehicle(vehicle, preferences = {}) {
  const bootWanted = typeof preferences.minBootLitres === 'number';
  const rangeWanted = typeof preferences.minRangeKm === 'number';

  const bootWeight = bootWanted ? WEIGHTS.boot.stated : WEIGHTS.boot.unstated;
  const rangeWeight = rangeWanted ? WEIGHTS.range.stated : WEIGHTS.range.unstated;

  // Normalise against generous ceilings so the scale is stable across fleets.
  const boot = ratio(vehicle.bootLitresSeatsUp, 900);
  const range = ratio(vehicle.rangeKm, 700);
  const warranty = ratio(vehicle.warrantyYears, 10);
  // Cheaper is better, all else equal.
  const value = 1 - ratio(vehicle.listPrice, 120000);

  return (
    boot * bootWeight +
    range * rangeWeight +
    warranty * WEIGHTS.warranty.unstated +
    value * WEIGHTS.value.unstated
  );
}

function reasonsFor(vehicle, preferences) {
  const reasons = [];
  if (typeof preferences.minBootLitres === 'number') {
    reasons.push(`${vehicle.bootLitresSeatsUp}L boot, ${vehicle.bootLitresSeatsUp - preferences.minBootLitres}L more than you asked for`);
  }
  if (typeof preferences.minRangeKm === 'number') {
    reasons.push(`${vehicle.rangeKm}km range`);
  }
  if (vehicle.warrantyYears >= 7) {
    reasons.push(`${vehicle.warrantyYears}-year warranty`);
  }
  if (reasons.length === 0) {
    reasons.push(`${vehicle.rangeKm}km range, ${vehicle.bootLitresSeatsUp}L boot`);
  }
  return reasons;
}

export function rankVehicles(vehicles, preferences = {}, limit = 5) {
  return vehicles
    .map(vehicle => ({
      vehicle,
      score: scoreVehicle(vehicle, preferences),
      reasons: reasonsFor(vehicle, preferences)
    }))
    // Ties break on id, so the order never depends on input array order.
    .sort((a, b) => b.score - a.score || a.vehicle.id.localeCompare(b.vehicle.id))
    .slice(0, limit);
}
```

- [ ] **Step 0d: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS, including the eight new ranking tests.

- [ ] **Step 1: Write the failing test**

Create `server/routes/parse.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeParsed } from './parse.js';

test('Claude values win over keyword values', () => {
  const merged = mergeParsed(
    { grossSalary: 100000, monthlyBudget: 500 },
    { grossSalary: 145000, monthlyBudget: 900 }
  );
  assert.equal(merged.grossSalary, 145000);
  assert.equal(merged.monthlyBudget, 900);
});

test('keyword values fill gaps Claude left null', () => {
  const merged = mergeParsed(
    { grossSalary: 145000, minRangeKm: 400 },
    { grossSalary: null, monthlyBudget: 900 }
  );
  assert.equal(merged.grossSalary, 145000);
  assert.equal(merged.monthlyBudget, 900);
  assert.equal(merged.minRangeKm, 400);
});

test('merging with a null Claude result returns the keyword result', () => {
  const merged = mergeParsed({ grossSalary: 145000 }, null);
  assert.equal(merged.grossSalary, 145000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './parse.js'`.

- [ ] **Step 3: Write the parse route**

Create `server/routes/parse.js`:

```js
import express from 'express';
import { askClaude, aiEnabled, MODELS } from '../claude.js';
import { parseSchema, clampParsed } from '../schema.js';
import { parseKeywords } from '../fallback-parser.js';

const TOOL = {
  name: 'record_preferences',
  description: 'Record the car preferences and financial details stated by the user.',
  input_schema: {
    type: 'object',
    properties: {
      bodyTypes: { type: 'array', items: { type: 'string', enum: ['SUV', 'Sedan', 'Hatch', 'Wagon', 'Ute'] } },
      minBootLitres: { type: ['number', 'null'] },
      minRangeKm: { type: ['number', 'null'] },
      seats: { type: ['integer', 'null'] },
      grossSalary: { type: ['number', 'null'], description: 'Annual salary before tax in AUD' },
      monthlyBudget: { type: ['number', 'null'], description: 'Monthly car spend from take-home pay in AUD' },
      termMonths: { type: ['integer', 'null'] },
      clarifyingQuestion: {
        type: ['string', 'null'],
        description: 'One short question, only if the input is too vague to act on. Otherwise null.'
      }
    }
  }
};

const SYSTEM = `You extract structured car-buying preferences from a person's description.
You never calculate costs, taxes, or affordability — a separate deterministic engine does that.
Convert natural phrasing into numbers: "145k" means 145000; "big boot for a large dog" implies
minBootLitres of at least 500. Set a field to null when the user did not indicate it. Ask a
clarifying question only when the input is too vague to filter on at all.`;

export function mergeParsed(keywordResult, claudeResult) {
  if (!claudeResult) return keywordResult;
  const merged = { ...keywordResult };
  for (const [key, value] of Object.entries(claudeResult)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && value.length === 0) continue;
      merged[key] = value;
    }
  }
  return merged;
}

const router = express.Router();

router.post('/', async (req, res) => {
  const { text, history = [] } = req.body ?? {};
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'text is required' });
  }

  const keywordResult = parseKeywords(text);

  const claudeResult = await askClaude({
    model: MODELS.parse,
    system: SYSTEM,
    messages: [...history, { role: 'user', content: text }],
    tool: TOOL,
    schema: parseSchema
  });

  const merged = clampParsed(mergeParsed(keywordResult, claudeResult));
  res.json({
    preferences: merged,
    clarifyingQuestion: claudeResult?.clarifyingQuestion ?? null,
    source: claudeResult ? 'claude' : (aiEnabled() ? 'fallback' : 'none')
  });
});

export default router;
```

- [ ] **Step 4: Write the explain route**

Create `server/routes/explain.js`:

```js
import express from 'express';
import { askClaude, MODELS } from '../claude.js';
import { explainSchema } from '../schema.js';

const TOOL = {
  name: 'explain_recommendation',
  description: 'Explain in plain English why the winning financing option won.',
  input_schema: {
    type: 'object',
    properties: {
      explanation: {
        type: 'string',
        description: 'Two to four sentences. Use only the figures supplied. No new numbers.'
      }
    },
    required: ['explanation']
  }
};

const SYSTEM = `You explain a car financing recommendation to an Australian buyer in plain English.
Every dollar figure has already been computed and is supplied to you. Use only those figures —
never calculate, estimate, or introduce a number that is not given. Mention the balloon payment
when a novated lease wins, since buyers routinely overlook it. Do not give financial advice.`;

const router = express.Router();

router.post('/', async (req, res) => {
  const { result } = req.body ?? {};
  if (!result) return res.status(400).json({ error: 'result is required' });

  const explanation = await askClaude({
    model: MODELS.explain,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(result, null, 2) }],
    tool: TOOL,
    schema: explainSchema
  });

  res.json({
    explanation: explanation?.explanation ?? null,
    source: explanation ? 'claude' : 'none'
  });
});

export default router;
```

- [ ] **Step 5: Mount the routes**

In `server/index.js`, add the imports below the existing ones:

```js
import parseRoute from './routes/parse.js';
import explainRoute from './routes/explain.js';
```

and mount them immediately after the `express.static` line:

```js
app.use('/api/parse', parseRoute);
app.use('/api/explain', explainRoute);
```

- [ ] **Step 6: Run tests and verify the endpoint works without a key**

Run: `npm test`
Expected: PASS, 85 tests total.

Run, with no `ANTHROPIC_API_KEY` in the environment:
```bash
node server/index.js &
curl -s -X POST localhost:3000/api/parse -H 'content-type: application/json' \
  -d '{"text":"I earn $145k and can spend about $900 a month, want an SUV with a big boot for my dog"}'
```
Expected: JSON with `grossSalary: 145000`, `monthlyBudget: 900`, `bodyTypes: ["SUV"]`, `minBootLitres: 500`, and `source: "none"` — proving the keyword fallback fully covers a missing API key. Stop the server afterwards.

- [ ] **Step 7: Commit**

```bash
git add calc/rank.js calc/rank.test.js server/routes server/index.js
git commit -m "feat: add deterministic ranking plus parse and explain endpoints"
```

---

## Phase 4 — User interface

Mobile-first throughout. Three sections stack vertically on a phone and become columns from 900px.

### Task 16: HTML shell, styles, and URL-backed state

**Files:**
- Create: `public/index.html`, `public/styles.css`, `public/ui/state.js`
- Test: `public/ui/state.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `defaultState(rates) -> state` where state is
    `{ grossSalary, monthlyBudget, termMonths, savings, annualKm, leaseStartDate, deposit, leaseRatePct, loanRatePct, adminFeeAnnual, opportunityRatePct, residualPctOverride, bodyTypes, minBootLitres, minRangeKm, seats, freeText }`
  - `toQueryString(state, defaults) -> string` — omits anything still at its default, keeping shared URLs short
  - `fromQueryString(search, defaults) -> state`

- [ ] **Step 1: Write the failing test**

Create `public/ui/state.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, toQueryString, fromQueryString } from './state.js';

const rates = {
  loanRatePct: 6.5, leaseRatePct: 7.5, adminFeeAnnual: 1020,
  opportunityRatePct: 4.5, defaultAnnualKm: 15000
};

test('default state draws its rates from rates.json', () => {
  const s = defaultState(rates);
  assert.equal(s.loanRatePct, 6.5);
  assert.equal(s.leaseRatePct, 7.5);
  assert.equal(s.annualKm, 15000);
});

test('a state at defaults serialises to an empty query string', () => {
  const defaults = defaultState(rates);
  assert.equal(toQueryString(defaults, defaults), '');
});

test('only changed fields are serialised', () => {
  const defaults = defaultState(rates);
  const changed = { ...defaults, grossSalary: 145000, monthlyBudget: 900 };
  const query = toQueryString(changed, defaults);
  assert.ok(query.includes('grossSalary=145000'));
  assert.ok(query.includes('monthlyBudget=900'));
  assert.ok(!query.includes('loanRatePct'));
});

test('a round trip preserves changed values', () => {
  const defaults = defaultState(rates);
  const changed = { ...defaults, grossSalary: 145000, bodyTypes: ['SUV'], leaseRatePct: 8.2 };
  const restored = fromQueryString(toQueryString(changed, defaults), defaults);
  assert.equal(restored.grossSalary, 145000);
  assert.equal(restored.leaseRatePct, 8.2);
  assert.deepEqual(restored.bodyTypes, ['SUV']);
});

test('an unknown query parameter is ignored', () => {
  const defaults = defaultState(rates);
  const restored = fromQueryString('?grossSalary=145000&evil=1', defaults);
  assert.equal(restored.grossSalary, 145000);
  assert.equal(restored.evil, undefined);
});

test('a non-numeric value for a numeric field falls back to the default', () => {
  const defaults = defaultState(rates);
  const restored = fromQueryString('?grossSalary=abc', defaults);
  assert.equal(restored.grossSalary, defaults.grossSalary);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './state.js'`.

- [ ] **Step 3: Write the state module**

Create `public/ui/state.js`:

```js
const ARRAY_FIELDS = new Set(['bodyTypes']);
const STRING_FIELDS = new Set(['leaseStartDate', 'freeText']);

export function defaultState(rates) {
  return {
    grossSalary: 100000,
    monthlyBudget: 900,
    termMonths: 60,
    savings: 0,
    annualKm: rates.defaultAnnualKm,
    leaseStartDate: '2026-07-25',
    deposit: 0,
    leaseRatePct: rates.leaseRatePct,
    loanRatePct: rates.loanRatePct,
    adminFeeAnnual: rates.adminFeeAnnual,
    opportunityRatePct: rates.opportunityRatePct,
    residualPctOverride: null,
    bodyTypes: [],
    minBootLitres: null,
    minRangeKm: null,
    seats: null,
    freeText: ''
  };
}

const same = (a, b) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b;

export function toQueryString(state, defaults) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === '' || same(value, defaults[key])) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function fromQueryString(search, defaults) {
  const params = new URLSearchParams(search);
  const state = { ...defaults };

  for (const key of Object.keys(defaults)) {
    if (!params.has(key)) continue;
    const raw = params.get(key);

    if (ARRAY_FIELDS.has(key)) {
      state[key] = raw ? raw.split(',') : [];
    } else if (STRING_FIELDS.has(key)) {
      state[key] = raw;
    } else {
      const parsed = Number(raw);
      state[key] = Number.isFinite(parsed) ? parsed : defaults[key];
    }
  }
  return state;
}
```

- [ ] **Step 4: Write the HTML shell**

Create `public/index.html` with the three-section structure: a header, then `<section id="about">`, `<section id="afford">`, `<section id="cars">`, then a mobile sticky summary bar `<div id="summary-bar">`.

**The general-advice disclaimer is required, not optional.** Add a `<p class="disclaimer">` immediately beneath the recommendation in section 2 — next to the number it qualifies, not buried in a footer — reading:

> **General information only.** This tool does not take account of your objectives, financial situation or needs. It is not personal financial, tax or credit advice. Figures are estimates based on published rates and your inputs, and will differ from a real quote. Consider seeking advice from a licensed adviser before deciding.

It must not be dismissible. Also add a shorter line in the page footer: *"General information only — not personal financial advice."* And note the FBT caveat the spec requires, near the novated verdict: *"An FBT-exempt lease still creates a Reportable Fringe Benefits Amount, which can affect HELP repayments and the Medicare Levy Surcharge. This tool does not model that."* Section 1 contains a `<textarea id="free-text">` with the placeholder `I earn $145k and can spend about $900 a month. I want an SUV with a big boot for my dog.` above the numeric fields. Load `ui/app.js` as `<script type="module">`.

Create `public/styles.css` with a single-column layout by default and `@media (min-width: 900px) { .sections { display: grid; grid-template-columns: 250px 1fr 236px; gap: 1rem; } }`. Hide `#summary-bar` above 900px. Include a `.field-updated` class with a brief background highlight for the parse hand-off.

- [ ] **Step 5: Run tests and view the page**

Run: `npm test`
Expected: PASS, 91 tests total.

Run: `node server/index.js &` then open `http://localhost:3000`
Expected: three stacked sections with the textarea showing the placeholder. Narrow the window below 900px and confirm the columns stack.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/styles.css public/ui/state.js public/ui/state.test.js
git commit -m "feat: add HTML shell, responsive styles and URL-backed state"
```

---

### Task 17: Section 1 — inputs, on-device parsing, and the visible hand-off

Parsing runs in **three tiers**, best-available first. Tier 1 is Chrome's built-in `LanguageModel`, on-device: nothing about the user's salary leaves their machine, there is no per-query cost and no network latency. Tier 2 is `POST /api/parse` (Haiku) for every other browser. Tier 3 is the keyword parser, which always works.

**Files:**
- Create: `public/ui/prompt-api.js`, `public/ui/sections.js`
- Test: `public/ui/prompt-api.test.js`, `public/ui/sections.test.js`

**Interfaces:**
- Consumes: state module (Task 16), `POST /api/parse` (Task 15)
- Produces:
  - `PARSE_SCHEMA` — the JSON schema handed to `responseConstraint`
  - `isPromptApiAvailable() -> Promise<boolean>` — feature-detects and checks `LanguageModel.availability()`
  - `parseOnDevice(text) -> Promise<object|null>` — returns parsed preferences, or `null` on any failure
  - `applyPreferences(state, preferences) -> { state, changedFields }` — returns which fields changed so the UI can highlight them
  - `renderInputs(root, state, onChange)` — binds the numeric fields
  - `bindFreeText(root, state, { onParsed })` — runs the three-tier parse and applies the result

- [ ] **Step 0: Write the failing test for the on-device client**

Create `public/ui/prompt-api.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARSE_SCHEMA, isPromptApiAvailable, parseOnDevice } from './prompt-api.js';

// The Prompt API is a browser global. These tests stub it, so they run in node
// and prove the availability gating and failure handling without a browser.
const withStub = async (stub, fn) => {
  globalThis.LanguageModel = stub;
  try { return await fn(); } finally { delete globalThis.LanguageModel; }
};

test('reports unavailable when the global is missing entirely', async () => {
  delete globalThis.LanguageModel;
  assert.equal(await isPromptApiAvailable(), false);
});

test('reports unavailable when the model cannot be provided', async () => {
  await withStub({ availability: async () => 'unavailable' }, async () => {
    assert.equal(await isPromptApiAvailable(), false);
  });
});

test('reports available only when the model is ready to use', async () => {
  await withStub({ availability: async () => 'available' }, async () => {
    assert.equal(await isPromptApiAvailable(), true);
  });
  await withStub({ availability: async () => 'downloadable' }, async () => {
    assert.equal(await isPromptApiAvailable(), false);
  });
});

test('the schema constrains the fields the engine consumes', () => {
  assert.equal(PARSE_SCHEMA.type, 'object');
  for (const field of ['grossSalary', 'monthlyBudget', 'bodyTypes', 'minBootLitres']) {
    assert.ok(field in PARSE_SCHEMA.properties, `${field} missing from schema`);
  }
});

test('parses a stringified JSON response from the session', async () => {
  const stub = {
    availability: async () => 'available',
    create: async () => ({
      prompt: async () => JSON.stringify({ grossSalary: 145000, bodyTypes: ['SUV'] }),
      destroy() {}
    })
  };
  await withStub(stub, async () => {
    const result = await parseOnDevice('I earn $145k, want an SUV');
    assert.equal(result.grossSalary, 145000);
    assert.deepEqual(result.bodyTypes, ['SUV']);
  });
});

test('returns null rather than throwing when the session fails', async () => {
  const stub = {
    availability: async () => 'available',
    create: async () => { throw new Error('model gone'); }
  };
  await withStub(stub, async () => {
    assert.equal(await parseOnDevice('anything'), null);
  });
});

test('returns null when the model emits unparseable output', async () => {
  const stub = {
    availability: async () => 'available',
    create: async () => ({ prompt: async () => 'not json at all', destroy() {} })
  };
  await withStub(stub, async () => {
    assert.equal(await parseOnDevice('anything'), null);
  });
});

test('always destroys the session, even when prompting throws', async () => {
  let destroyed = false;
  const stub = {
    availability: async () => 'available',
    create: async () => ({
      prompt: async () => { throw new Error('boom'); },
      destroy() { destroyed = true; }
    })
  };
  await withStub(stub, async () => {
    await parseOnDevice('anything');
    assert.equal(destroyed, true, 'session must not leak');
  });
});
```

- [ ] **Step 0b: Run it and confirm it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './prompt-api.js'`.

- [ ] **Step 0c: Write the on-device client**

Create `public/ui/prompt-api.js`:

```js
// Chrome's built-in Prompt API, on-device. Desktop Chrome only, and only once
// the model has downloaded — so this is strictly an enhancement. Every failure
// path returns null and the caller falls back to the server.

export const PARSE_SCHEMA = {
  type: 'object',
  properties: {
    bodyTypes: {
      type: 'array',
      items: { type: 'string', enum: ['SUV', 'Sedan', 'Hatch', 'Wagon', 'Ute'] }
    },
    minBootLitres: { type: ['number', 'null'] },
    minRangeKm: { type: ['number', 'null'] },
    seats: { type: ['integer', 'null'] },
    grossSalary: { type: ['number', 'null'] },
    monthlyBudget: { type: ['number', 'null'] },
    termMonths: { type: ['integer', 'null'] }
  },
  additionalProperties: false
};

const SYSTEM = `You extract car-buying preferences from a person's description.
Convert natural phrasing into numbers: "145k" means 145000; "big boot for a large dog"
implies minBootLitres of at least 500. A salary is annual; a budget is monthly.
Use null for anything the person did not indicate. Never calculate costs or taxes.`;

export async function isPromptApiAvailable() {
  try {
    if (typeof globalThis.LanguageModel === 'undefined') return false;
    return (await globalThis.LanguageModel.availability()) === 'available';
  } catch {
    return false;
  }
}

export async function parseOnDevice(text) {
  if (!(await isPromptApiAvailable())) return null;

  let session = null;
  try {
    session = await globalThis.LanguageModel.create({
      initialPrompts: [{ role: 'system', content: SYSTEM }]
    });
    const raw = await session.prompt(text, { responseConstraint: PARSE_SCHEMA });
    return JSON.parse(raw);
  } catch {
    return null;
  } finally {
    session?.destroy?.();
  }
}
```

- [ ] **Step 0d: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS, including the eight new on-device tests.

Manual edits always win over parsed text: a field the user has touched is recorded in `state.touched` and is never overwritten by a parse.

- [ ] **Step 1: Write the failing test**

Create `public/ui/sections.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPreferences } from './sections.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './sections.js'`.

- [ ] **Step 3: Write the implementation**

Create `public/ui/sections.js`. `applyPreferences` is the pure, tested part; the DOM binding below it is thin.

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 95 tests total.

- [ ] **Step 5: Commit**

```bash
git add public/ui/prompt-api.js public/ui/prompt-api.test.js public/ui/sections.js public/ui/sections.test.js
git commit -m "feat: add on-device parsing with server and keyword fallbacks"
```

---

### Task 18: Section 2 — slider, verdict, totals and rates panel

**Files:**
- Create: `public/ui/slider.js`
- Test: `public/ui/slider.test.js`

**Interfaces:**
- Consumes: `optionCosts`, `reachableVehicle` (Task 9), state (Task 16)
- Produces:
  - `verdictAt({ vehicles, budgetMonthly, inputs }, tables) -> { winner, options, vehicle }` — `winner` is `null` when no option can reach anything
  - `renderVerdict(root, verdict)`, `renderRatesPanel(root, state, onChange)`

- [ ] **Step 1: Write the failing test**

Create `public/ui/slider.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verdictAt } from './slider.js';

const tables = JSON.parse(readFileSync(new URL('../../data/tax-tables.json', import.meta.url)));

const vehicle = (id, listPrice) => ({
  id, listPrice, consumptionKwhPer100km: 16, insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
});

const inputs = {
  grossSalary: 145000, savings: 15000, termMonths: 48, annualKm: 15000,
  leaseStartDate: '2026-07-25', leaseRatePct: 7.5, loanRatePct: 6.5,
  opportunityRatePct: 4.5, adminFeeAnnual: 1020, deposit: 0
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './slider.js'`.

- [ ] **Step 3: Write the implementation**

Create `public/ui/slider.js`:

```js
import { optionCosts, reachableVehicle } from '../../calc/compare.js';

const OPTIONS = ['novated', 'loan', 'upfront'];

export function verdictAt({ vehicles, budgetMonthly, inputs }, tables) {
  const options = {};
  let best = null;
  let bestVehicle = null;

  for (const option of OPTIONS) {
    const vehicle = reachableVehicle({ vehicles, budgetMonthly, option, inputs }, tables);
    if (!vehicle) {
      options[option] = { option, tco: null, vehicle: null };
      continue;
    }
    const costs = optionCosts({ vehicle, inputs }, tables)[option];
    options[option] = { option, tco: costs.tco, monthlyCost: costs.monthlyCost, vehicle, detail: costs.detail };

    if (best === null || costs.tco < options[best].tco) {
      best = option;
      bestVehicle = vehicle;
    }
  }

  return { winner: best, options, vehicle: bestVehicle };
}

const money = value => `$${Math.round(value).toLocaleString('en-AU')}`;

export function renderVerdict(root, verdict) {
  const panel = root.querySelector('#verdict');
  if (!verdict.winner) {
    panel.innerHTML = '<p>No option reaches a matching car at this budget. Try raising it.</p>';
    return;
  }

  const winner = verdict.options[verdict.winner];
  const labels = { novated: 'Novated lease', loan: 'Direct loan', upfront: 'Buy upfront' };
  const runnerUp = Object.values(verdict.options)
    .filter(o => o.tco !== null && o.option !== verdict.winner)
    .sort((a, b) => a.tco - b.tco)[0];

  panel.innerHTML = `
    <div class="winner">🏆 ${labels[verdict.winner]} — ${verdict.vehicle.make} ${verdict.vehicle.model}</div>
    <div class="detail">${money(winner.tco)} total over the term${
      runnerUp ? `, saving ${money(runnerUp.tco - winner.tco)} versus ${labels[runnerUp.option].toLowerCase()}` : ''
    }</div>
    <div class="totals">${OPTIONS.map(o => {
      const entry = verdict.options[o];
      return `<div class="total${o === verdict.winner ? ' is-winner' : ''}">
        <span>${labels[o]}</span>
        <strong>${entry.tco === null ? 'out of reach' : money(entry.tco)}</strong>
      </div>`;
    }).join('')}</div>`;
}

export function renderRatesPanel(root, state, onChange) {
  for (const input of root.querySelectorAll('#rates-panel [data-field]')) {
    const field = input.dataset.field;
    input.value = state[field];
    input.addEventListener('input', () => {
      onChange({ ...state, [field]: Number(input.value) });
    });
  }

  for (const button of root.querySelectorAll('#rates-panel [data-reset]')) {
    button.addEventListener('click', () => {
      const field = button.dataset.reset;
      onChange({ ...state, [field]: state.defaults[field] });
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 99 tests total.

- [ ] **Step 5: Commit**

```bash
git add public/ui/slider.js public/ui/slider.test.js
git commit -m "feat: add budget slider verdict and editable rates panel"
```

---

### Task 19: The crossover chart

Two renderings of the same data: SVG lines on desktop, a single winner band on mobile, because three thin lines in 96px of height is not legible on a phone.

**Files:**
- Create: `public/ui/crossover-chart.js`
- Test: `public/ui/crossover-chart.test.js`

**Interfaces:**
- Consumes: `crossoverSeries` (Task 9)
- Produces:
  - `toPolylines(series, { width, height }) -> { novated, loan, upfront }` — each an SVG `points` string, with gaps where an option is unreachable
  - `toWinnerBands(series) -> [{ option, fromPct, toPct }]`

- [ ] **Step 1: Write the failing test**

Create `public/ui/crossover-chart.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPolylines, toWinnerBands } from './crossover-chart.js';

const series = {
  points: [
    { budget: 400, novated: 50000, loan: 55000, upfront: null },
    { budget: 800, novated: 60000, loan: 62000, upfront: null },
    { budget: 1200, novated: 75000, loan: 72000, upfront: null }
  ],
  crossovers: [{ budget: 1200, from: 'novated', to: 'loan' }]
};

test('each option becomes an SVG points string', () => {
  const lines = toPolylines(series, { width: 400, height: 200 });
  assert.equal(typeof lines.novated, 'string');
  assert.equal(lines.novated.split(' ').length, 3);
});

test('an option with no reachable car produces an empty line', () => {
  const lines = toPolylines(series, { width: 400, height: 200 });
  assert.equal(lines.upfront, '');
});

test('the cheapest point sits lower on screen than the dearest', () => {
  const lines = toPolylines(series, { width: 400, height: 200 });
  const ys = lines.novated.split(' ').map(pair => Number(pair.split(',')[1]));
  assert.ok(ys[0] > ys[2], 'a lower cost is a larger y in SVG coordinates');
});

test('winner bands cover the full width and change at the crossover', () => {
  const bands = toWinnerBands(series);
  assert.equal(bands[0].fromPct, 0);
  assert.equal(bands[bands.length - 1].toPct, 100);
  assert.ok(bands.length >= 2, 'the winner changes at least once');
  assert.equal(bands[0].option, 'novated');
  assert.equal(bands[bands.length - 1].option, 'loan');
});

test('a series with a single leader produces one band', () => {
  const flat = { points: [
    { budget: 400, novated: 50000, loan: 55000, upfront: null },
    { budget: 800, novated: 60000, loan: 65000, upfront: null }
  ], crossovers: [] };
  const bands = toWinnerBands(flat);
  assert.equal(bands.length, 1);
  assert.equal(bands[0].option, 'novated');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './crossover-chart.js'`.

- [ ] **Step 3: Write the implementation**

Create `public/ui/crossover-chart.js`:

```js
const OPTIONS = ['novated', 'loan', 'upfront'];

function bounds(series) {
  const values = series.points
    .flatMap(p => OPTIONS.map(o => p[o]))
    .filter(v => v !== null);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function toPolylines(series, { width, height }) {
  const { min, max } = bounds(series);
  const span = max - min || 1;
  const lastIndex = series.points.length - 1 || 1;
  const lines = {};

  for (const option of OPTIONS) {
    const coordinates = series.points
      .map((point, index) => {
        if (point[option] === null) return null;
        const x = (index / lastIndex) * width;
        const y = height - ((point[option] - min) / span) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter(Boolean);
    lines[option] = coordinates.join(' ');
  }
  return lines;
}

export function toWinnerBands(series) {
  const leaderAt = point => {
    const priced = OPTIONS.filter(o => point[o] !== null);
    if (priced.length === 0) return null;
    return priced.reduce((best, cur) => (point[cur] < point[best] ? cur : best));
  };

  const bands = [];
  const total = series.points.length - 1 || 1;

  series.points.forEach((point, index) => {
    const leader = leaderAt(point);
    if (leader === null) return;
    const pct = (index / total) * 100;
    const last = bands[bands.length - 1];

    if (last && last.option === leader) {
      last.toPct = pct;
    } else {
      if (last) last.toPct = pct;
      bands.push({ option: leader, fromPct: pct, toPct: pct });
    }
  });

  if (bands.length > 0) {
    bands[0].fromPct = 0;
    bands[bands.length - 1].toPct = 100;
  }
  return bands;
}

export function renderChart(root, series) {
  const isMobile = root.clientWidth < 900;
  const target = root.querySelector('#crossover');

  if (isMobile) {
    const bands = toWinnerBands(series);
    target.innerHTML = `<div class="winner-band">${bands.map(b =>
      `<span class="band band-${b.option}" style="left:${b.fromPct}%;width:${b.toPct - b.fromPct}%"></span>`
    ).join('')}</div>`;
    return;
  }

  const width = 600;
  const height = 200;
  const lines = toPolylines(series, { width, height });
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="chart">${
    OPTIONS.filter(o => lines[o]).map(o =>
      `<polyline class="line line-${o}" points="${lines[o]}" fill="none" stroke-width="2" />`
    ).join('')
  }</svg>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 104 tests total.

- [ ] **Step 5: Commit**

```bash
git add public/ui/crossover-chart.js public/ui/crossover-chart.test.js
git commit -m "feat: add crossover chart with mobile winner band"
```

---

### Task 20: Section 3 cards, app wiring, and Heroku deploy

**Files:**
- Create: `public/ui/cars.js`, `public/ui/app.js`, `README.md`
- Test: `public/ui/cars.test.js`

**Interfaces:**
- Consumes: everything above
- Produces: a running, deployed application

- [ ] **Step 1: Write the failing test**

Create `public/ui/cars.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterVehicles, cardModel } from './cars.js';
import { rankVehicles } from '../../calc/rank.js';

const fleet = [
  { id: 'a', familyId: 'fa', make: 'Kia', model: 'EV5', bodyType: 'SUV', bootLitresSeatsUp: 513, rangeKm: 400, seats: 5, listPrice: 56000 },
  { id: 'b', familyId: 'fb', make: 'BYD', model: 'Dolphin', bodyType: 'Hatch', bootLitresSeatsUp: 345, rangeKm: 340, seats: 5, listPrice: 34000 }
];
const families = [
  { id: 'fa', summary: 'Roomy electric SUV.', pros: ['Big boot'], cons: ['Slow charging'], sources: ['https://x'], images: ['https://press/a.jpg'] }
];

test('body type filters the fleet', () => {
  assert.deepEqual(filterVehicles(fleet, { bodyTypes: ['SUV'] }).map(v => v.id), ['a']);
});

test('a boot minimum excludes cars that fall short', () => {
  assert.deepEqual(filterVehicles(fleet, { minBootLitres: 500 }).map(v => v.id), ['a']);
});

test('filters combine', () => {
  assert.equal(filterVehicles(fleet, { bodyTypes: ['SUV'], minRangeKm: 500 }).length, 0);
});

test('an empty filter returns everything', () => {
  assert.equal(filterVehicles(fleet, {}).length, 2);
});

test('a card carries its family review when one exists', () => {
  const card = cardModel(fleet[0], families);
  assert.equal(card.summary, 'Roomy electric SUV.');
  assert.equal(card.image, 'https://press/a.jpg');
});

test('a card without a family still renders', () => {
  const card = cardModel(fleet[1], families);
  assert.equal(card.summary, null);
  assert.equal(card.image, null);
  assert.equal(card.make, 'BYD');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './cars.js'`.

- [ ] **Step 3: Write the cars module**

Create `public/ui/cars.js`:

```js
export function filterVehicles(vehicles, filters) {
  return vehicles.filter(v => {
    if (filters.bodyTypes?.length && !filters.bodyTypes.includes(v.bodyType)) return false;
    if (filters.minBootLitres && v.bootLitresSeatsUp < filters.minBootLitres) return false;
    if (filters.minRangeKm && v.rangeKm < filters.minRangeKm) return false;
    if (filters.seats && v.seats < filters.seats) return false;
    return true;
  });
}

export function cardModel(vehicle, families) {
  const family = families.find(f => f.id === vehicle.familyId) ?? null;
  return {
    ...vehicle,
    summary: family?.summary ?? null,
    pros: family?.pros ?? [],
    cons: family?.cons ?? [],
    sources: family?.sources ?? [],
    image: family?.images?.[0] ?? null
  };
}

const SILHOUETTES = {
  SUV: 'M10,40 L20,20 L60,20 L75,40 Z',
  Sedan: 'M10,40 L25,22 L60,22 L78,40 Z',
  Hatch: 'M10,40 L22,20 L55,20 L68,40 Z',
  Wagon: 'M10,40 L22,20 L65,20 L78,40 Z',
  Ute: 'M10,40 L22,20 L45,20 L50,32 L78,32 L78,40 Z'
};

export function renderCards(root, cards) {
  root.innerHTML = cards.map(card => `
    <article class="car-card" data-id="${card.id}">
      <div class="car-image">
        ${card.image
          ? `<img src="${card.image}" alt="${card.make} ${card.model}" loading="lazy"
                  onerror="this.replaceWith(document.querySelector('#silhouette-${card.bodyType}').cloneNode(true))">`
          : `<svg viewBox="0 0 88 50" class="silhouette"><path d="${SILHOUETTES[card.bodyType] ?? SILHOUETTES.Sedan}" /></svg>`}
      </div>
      <div class="car-body">
        <h3>${card.make} ${card.model} ${card.variant ?? ''}</h3>
        <p class="car-specs">${card.bootLitresSeatsUp}L boot · ${card.rangeKm}km · $${Math.round(card.listPrice / 1000)}k</p>
        ${card.summary ? `<details>
          <summary>Why this one</summary>
          <p>${card.summary}</p>
          ${card.pros.length ? `<ul class="pros">${card.pros.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
          ${card.cons.length ? `<ul class="cons">${card.cons.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
          ${card.sources.length ? `<p class="sources">${card.sources.map(s => `<a href="${s}" rel="noopener">review</a>`).join(' · ')}</p>` : ''}
        </details>` : ''}
      </div>
    </article>`).join('');
}
```

Add a hidden `<svg>` sprite in `index.html` containing one `<svg id="silhouette-SUV">` element per body type, so the `onerror` fallback has something to clone.

- [ ] **Step 3b: Wire the deterministic ranker into the shortlist**

`public/ui/cars.js` filters; `calc/rank.js` orders. Import `rankVehicles` and use it to order the filtered list before rendering, passing the parsed preferences so a stated need for boot space or range actually moves the order. Do not call any API to rank — the ordering must be reproducible and must work offline.

- [ ] **Step 4: Write the app wiring**

Create `public/ui/app.js` that: fetches `/api/dataset` once; builds state from the URL via `fromQueryString`; on any state change recomputes `verdictAt` and `crossoverSeries` locally and re-renders sections 2 and 3 plus the sticky summary bar; writes the new query string with `history.replaceState`; and calls `/api/explain` only after a *parse*, never on a slider drag. Ranking is local and deterministic, so it re-runs freely. Wrap the explain call in `try/catch` so a failure leaves the numbers untouched.

**Performance requirement:** `crossoverSeries` was measured at roughly 17ms for 80 vehicles across 25 budget steps, which exceeds a 16ms frame. Do NOT recompute on raw `input` events. Debounce the slider or schedule recomputation with `requestAnimationFrame`, so dragging stays smooth.

- [ ] **Step 5: Verify the whole app end to end**

Run: `npm test`
Expected: PASS, 110 tests total.

Run: `node server/index.js &` then open `http://localhost:3000`
Expected: type the placeholder sentence, click parse, watch the fields highlight, drag the slider and see the verdict change without any network request in the Network tab. Confirm the app is fully usable with `ANTHROPIC_API_KEY` unset.

- [ ] **Step 6: Write the README**

Create `README.md` covering: what the app does, the general-advice disclaimer stated prominently near the top (the same wording as the UI: general information only, not personal financial, tax or credit advice, figures are estimates and will differ from a real quote), local setup (`nvm use`, `npm install`, `.env`, `npm start`), `npm test`, how to refresh the dataset (`node scripts/build-dataset.js`), and where each default rate came from.

- [ ] **Step 7: Deploy to Heroku**

```bash
brew install heroku/brew/heroku
heroku login
heroku create
heroku config:set ANTHROPIC_API_KEY=sk-ant-...
git push heroku main
heroku open
```

Expected: the app loads on the Heroku URL. Verify `/api/health` returns the dataset size and that a parse request succeeds with the key set.

- [ ] **Step 8: Commit**

```bash
git add public/ui/cars.js public/ui/cars.test.js public/ui/app.js public/index.html README.md
git commit -m "feat: add car cards, app wiring and deployment docs"
```

---

## Plan self-review

**Spec coverage.** Every section of the spec maps to a task: tax → 2; on-road → 3; FBT phases → 4; loan → 5; resale and running costs → 6; novated → 7; upfront → 8; comparison basis and crossover semantics → 9; golden cases → 10; dataset schema, families, images → 11–12; server, key handling, fallbacks → 13–15; the three Claude endpoints → 15; UI sections, mobile stacking, parse hand-off, sticky bar, chart and winner band → 16–20; Heroku and `.gitignore` → 20 and the existing repo state.

**Deliberate gap.** The spec's "one-line RFBA caveat in the UI" is copy, not logic, and belongs in the `index.html` written in Task 16 — noted here so it is not forgotten: it must appear near the novated verdict.

**Type consistency.** `optionCosts` returns `{ novated, loan, upfront }` keyed by option name in Tasks 9, 18 and 20. `leaseStartDate` is an ISO string everywhere, never a `Date`. `driveAwayTotal` is the name used by `novatedQuote`, `upfrontQuote` and `resaleValue`. `runningCosts` returns both `totalIncGst` and `totalExGst`, and Task 7 consumes the ex-GST figure for packaging while Tasks 8 and 9 use the inc-GST figure for post-tax paths — that asymmetry is intentional and is what makes the packaging benefit correct.

**Known deviation from strict TDD.** Tasks 12, 16 (steps 4–5) and 20 (steps 4, 6–7) involve research, markup and deployment that have no meaningful failing test. Their acceptance is the validator run, the browser check, and the deployed URL respectively.
