# PHEV research wave — batch plan

Prepared 2026-07-28. **Batch 1 complete.** Batches 2-4 outstanding.

The calculation side of PHEV support is finished and merged. This is data work only: no code
change should be needed for any family below. `node scripts/build-dataset.js` validates every row,
and a row it rejects is wrong — fix the row, not the schema.

## Where the dataset stands

After batch 1: 28 brands, 48 models, 141 variants.

| Body type | BEV | PHEV |
|---|---|---|
| SUV | 97 | 19 |
| Hatch | 10 | 0 |
| Sedan | 7 | 0 |
| Ute | 0 | 8 |

Eight PHEV families. **Ute is no longer an empty filter** — it was offered in step 1 and matched
nothing at all until batch 1 landed, and Australia's plug-in ute segment being entirely PHEV is why
no amount of EV research could have filled it.

**Wagon has been dropped from the UI** rather than waiting for data that was never coming. It is
gone from the checkbox, both parse schemas, the fallback parser and the allowed `bodyType` list in
both briefs. A genuine wagon should now be classified as the nearest of SUV / Sedan / Hatch / Ute
and flagged in the report. Re-adding means the checkbox row in `public/index.html` and `BODY_TYPES`
in `server/schema.js`, together.

## Budget: one batch per session

This is the binding constraint, and it is why the batches are six.

The first wave's two families cost roughly 50 tool calls each, a large share of them searches. At a
conservative 20–35 searches per family, **six families is 120–210 searches against a 200-call
session budget.** So:

- **Run exactly one batch per session.** Do not start a second batch in the same session.
- Six agents in one batch run **in parallel** — they write disjoint files and never touch a shared
  one, so there is no conflict. The budget, not concurrency, is what caps the batch.
- If a batch runs short, stop anyway. A seventh family that runs out of searches half way through
  produces a half-researched family, which is worse than no family.
- `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` raises the ceiling if a bigger batch is ever wanted.

WebFetch appears to be budgeted separately and still worked when WebSearch was exhausted, but it is
not a substitute: fetching a known URL cannot find the *second* source the brief requires, and the
one fetch tried during preparation returned drive-away pricing only — the exact trap the brief
warns about, unresolvable without a search.

## Every family below is a LEAD, not a fact

The preparing session's knowledge cutoff predates the research date, and the first EV wave found
families withdrawn, renamed, repriced, or reduced to a single variant against expectation. The
brief already covers this: **if a family is not on sale new in Australia at the research date,
write no files at all and report that finding with evidence.** A batch that returns four families
and two well-evidenced "not on sale" reports is a successful batch.

Watch particularly for: grades that are conventional hybrids rather than plug-ins (no plug, out of
scope), range-extenders where the engine never drives the wheels (out of scope), and nameplates
shared with a BEV or petrol sibling (price the plug-in only).

## Batch 1 — utes and volume sellers — **DONE**

All six landed; see the `data:` commit for batch 1 and that session's reports for each family's
disclosed low-confidence figures.

| Family | `familyId` | Note |
|---|---|---|
| BYD Shark 6 | `byd-shark-6` | Ute. Sibling of the Sealion 6 already in the dataset — anchor insurance and depreciation against it. |
| Ford Ranger PHEV | `ford-ranger-phev` | Ute. Ranger also sells as diesel; price the plug-in only. |
| GWM Cannon Alpha PHEV | `gwm-cannon-alpha-phev` | Ute. |
| Mitsubishi Outlander PHEV | `mitsubishi-outlander-phev` | Long-running nameplate; check the current generation's pricing, not the launch car. Also sold as a petrol Outlander. |
| GWM Haval H6 PHEV | `gwm-haval-h6-phev` | H6 also sells as petrol and as a conventional hybrid. Plug-in only. |
| Jaecoo J7 SHS | `jaecoo-j7-shs` | "SHS" is the plug-in; the J7 also sells as petrol. |

## Batch 2 — mainstream SUVs

| Family | `familyId` | Note |
|---|---|---|
| MG HS PHEV | `mg-hs-phev` | Check MG's unconditional warranty term, not the conditional headline. |
| Chery Tiggo 7 PHEV | `chery-tiggo-7-phev` | Marketed as "Super Hybrid" — confirm it plugs in. |
| Chery Tiggo 8 PHEV | `chery-tiggo-8-phev` | Seven-seat sibling; confirm seat count per variant. |
| Kia Sorento PHEV | `kia-sorento-phev` | Also petrol/diesel/hybrid. Plug-in only. |
| Mazda CX-80 PHEV | `mazda-cx-80-phev` | Sibling of `mazda-cx-60-phev` already in the dataset — anchor against it and note where they genuinely differ. |
| Cupra Formentor PHEV | `cupra-formentor-phev` | |

## Batch 3 — premium

Most likely to straddle the LCT thresholds ($80,809 ordinary, $91,661 fuel-efficient), so
`isFuelEfficientForLct` is load-bearing here rather than decorative.

| Family | `familyId` |
|---|---|
| Volvo XC60 PHEV | `volvo-xc60-phev` |
| Volvo XC90 PHEV | `volvo-xc90-phev` |
| BMW X1 PHEV | `bmw-x1-phev` |
| BMW X3 PHEV | `bmw-x3-phev` |
| Mercedes-Benz GLC PHEV | `mercedes-glc-phev` |
| Lexus NX PHEV | `lexus-nx-phev` |

## Batch 4 — remainder

| Family | `familyId` |
|---|---|
| Lexus RX PHEV | `lexus-rx-phev` |
| Audi Q5 PHEV | `audi-q5-phev` |
| Peugeot 3008 PHEV | `peugeot-3008-phev` |
| Land Rover Defender PHEV | `land-rover-defender-phev` |

## How to dispatch a batch

Six `general-purpose` subagents in a single message so they run in parallel. Each prompt carries:

1. The family name and `familyId` from the table.
2. The path to the brief: `docs/phev-research-brief.md` — "read this first, it is binding".
3. The research date to record.
4. Its own note from the table above, plus any sibling already in the dataset to anchor
   `insuranceAnnual` and `depreciationCurve` against.
5. The hard boundaries, restated: write only its own two files, never an aggregate file, never
   another family's files, never `data/schema.js`, run no git commands.

After the batch returns:

```bash
node scripts/build-dataset.js   # must end "N variants across M families, 0 failures"
npm test
```

Then check in a browser that the new families appear and that ticking **Ute** returns cars for the
first time. Commit the data with a message naming what each agent flagged as low-confidence —
that disclosure is the only record of which figures are soft.

## What to watch across the whole wave

- **Range provenance.** The brief was hardened after the first wave shipped a family on NEDC
  ranges. WLTP EAER is the figure to want. If several families come back NEDC-only, that is worth
  raising before the dataset grows further, because combined range now drives the ranking.
- **Derived consumption.** All ten current PHEV rows have `consumptionKwhPer100km` exactly equal to
  `batteryKwh / rangeKm * 100`, so the schema's 25% cross-check catches nothing for them. The brief
  now asks agents to say which figures they sourced and which they derived.
- **Body-type spread.** Batch 1 closed `Ute`. `Wagon` was dropped rather than left empty. Every
  PHEV so far is an SUV or a ute; if `Hatch` and `Sedan` stay BEV-only that is a real fact about
  the market rather than a gap, but worth noticing if a batch turns one up.
- **Agents finding calculator bugs is a good outcome, not scope creep.** Batch 1's three ute
  agents independently worked out that a ute is a non-passenger vehicle for VIC duty and reported
  that the calculator had no such category — it was billing every ute the passenger rate and
  overstating duty by $814-$1,005 each. That is now fixed and there is a
  `isNonPassengerForVicDuty` flag to set. Keep encouraging agents to report what does not fit
  rather than forcing a value into a field that cannot hold it.
- **The powertrain trap gets worse from batch 2 on.** Batch 1 was mostly plug-in-specific
  nameplates. Batches 2-4 are dominated by models that also sell as petrol, diesel or conventional
  hybrid, where an agent pricing the wrong grade produces a plausible row that is entirely wrong
  and that the schema cannot catch. Require every agent to name the grades it excluded.
