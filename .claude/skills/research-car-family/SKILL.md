---
name: research-car-family
description: Research one car family for the car-calc dataset, writing its family, vehicles and provenance files. Use when dispatched to refresh an existing family's prices, grades and specs, to add a new family, or to settle whether a model is on sale in Victoria.
---

# Research one car family

You research **one** family (one model line, e.g. `kia-ev5`) for Melbourne buyers and leave it in
a state the build accepts and a reviewer can audit figure by figure. Many agents run in parallel,
each on its own family.

## Your inputs

The dispatcher gives you:

- **`familyId`**, and the family's make and model.
- **Mode**: `update` (the family is held; refresh it), `new` (not held; research it from scratch)
  or `check` (only settle whether it is orderable in Victoria; write nothing).
- **Research date** (`YYYY-MM-DD`). Missing? Use today's real date from your environment. Every
  `sourcedAt` and `researchedAt` you write is this date.
- **Notes**: leads from the market sweep (prices, grade names, launch timing). Every lead is a
  hypothesis to test. Contradict it in your report when the sources do.
- **Siblings**: held families sharing a platform or brand, to anchor judged fields against.

## Your files

You write exactly these three, all keyed by your `familyId`:

- `data/families/<familyId>.json`
- `data/vehicles/<familyId>.json`
- `data/provenance/<familyId>.json`

Everything else is read-only to you: other families' files, the aggregates `data/vehicles.json`
and `data/families.json`, `data/schema.js`, images, and git. Parallel agents depend on that. When a
schema bound looks genuinely wrong for a real car, report it and leave the schema alone.

## Steps

### 1. Load the rules

Read [field-rules.md](field-rules.md) and [sources.md](sources.md) in full before opening a browser.
They are binding and record every trap earlier waves fell into. In `update` mode also read the
family's three current files (provenance may not exist yet) and its siblings' vehicle rows.

**Done when** you can name, for your family's powertrain and body type, which field rules apply.

### 2. Establish what is orderable

Look your model up in `data/watchlist.json` first: its note records what earlier checks found
(withdrawn grades, expected launch, known traps). Then open the manufacturer's Australian
**Build & Price / configurator** and count the grades a Victorian
buyer can order today. Availability means a live configurator entry with a price; a model on the
nav menu, a register-interest page or an aggregator listing is a lead. Price round-number "extra
grades" as options before believing them. Check one launch review agrees on the count.

- Not orderable (discontinued, run-out with no configurator entry, register-interest only, never
  launched here) → write nothing, in `update` mode delete nothing, and report it as **not on sale**
  with the evidence, any expected date, and a suggested watchlist status (`pre-launch`,
  `not-on-sale`, `unrepresentable`, `out-of-scope`) and recheck date. The orchestrator removes held
  families and keeps the watchlist.
- A held grade has gone → delete that row and say so in the family summary if the range is now thin.
- A new grade → add a row.

**Done when** you have a grade list with a configurator URL for each grade and each excluded grade
has a reason (wagon, REEV, BEV in a PHEV family, cab-chassis, out of bounds, other state only).
In `check` mode, stop here and report the grade list and its evidence.

### 3. Price every grade

Find the **list price before on-road costs** for every grade, re-verified on the research date even
in `update` mode. Follow the price rules in [sources.md](sources.md), including the back-out
procedure when only drive-away exists.

**Done when** every row's `listPrice` has a URL, a basis, and you know whether the source said
"before on-road costs" in words.

### 4. Specs

- `new` mode, or `update` with a changed model year, battery, wheel or grade line-up: source every
  spec field per [field-rules.md](field-rules.md).
- `update` with the model year confirmed unchanged: re-open the URLs in the existing provenance
  where there are some, fix anything that has moved, and mark untouched fields `carried`.

**Done when** every required field on every row has a provenance entry whose value equals the row.

### 5. Write the prose

The family file's `summary`, `pros` and `cons` are what the app shows to justify a recommendation.

- `new`, or a new model year: write them from Australian reviews per [field-rules.md](field-rules.md).
- `update`: keep the existing prose, and rewrite every sentence quoting a price, range, battery,
  grade name or warranty that your rows no longer match. Search the text for `$` and `km`.

Update `sources` to the URLs you actually opened, and `sourcedAt` to the research date.

**Done when** every figure in the prose matches a row, or is plainly about a rival or a past price.

### 6. Write provenance and validate

Write `data/provenance/<familyId>.json` per [provenance.md](provenance.md), then run from the repo
root:

```bash
node scripts/check-provenance.js <familyId>
node scripts/build-dataset.js
```

**Done when** the provenance check passes and no `FAIL` line from the build names your family or
any of your vehicle ids. Failures naming other families belong to agents still writing.

### 7. Report

Return this report, short and factual. The orchestrator copies the low-confidence list into the
commit message and the review, so it is the only record of which figures are soft.

```
FAMILY  <familyId> · mode <update|new|check> · <on sale | not on sale | partial>
GRADES  <grade: list price, basis> per row; added / removed grades vs held
EXCLUDED  <grade: reason> per excluded grade
THRESHOLDS  which rows sit under/over $75,000 and $91,661 (PHEV: also $80,809), and any row
            that crossed one since the held data
RANGE STANDARD  per row: AU-certified / WLTP / NEDC / other, and where it came from
DERIVED  which of batteryKwh / rangeKm / consumptionKwhPer100km were sourced vs derived
BACKED-OUT  any price backed out of drive-away, with the round-trip figure
PROSE  sentences rewritten in update mode, or "new prose"
LOW CONFIDENCE  every figure you judged rather than sourced, least-confident first
WATCHLIST  suggested entries for anything not written (status, expected date, recheck date)
BUILD  provenance check passed; build shows no FAIL for this family
```
