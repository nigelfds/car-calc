# PHEV research wave — batch plan

Prepared 2026-07-28. **Batches 1-3 complete.** Batch 4 outstanding.

The calculation side of PHEV support is finished and merged. This is data work only: no code
change should be needed for any family below. `node scripts/build-dataset.js` validates every row,
and a row it rejects is wrong — fix the row, not the schema.

## Where the dataset stands

After batch 3: 30 brands, 60 families, 165 variants.

| Body type | BEV | PHEV |
|---|---|---|
| SUV | 97 | 43 |
| Hatch | 10 | 0 |
| Sedan | 7 | 0 |
| Ute | 0 | 8 |

Twenty PHEV families. **Ute is no longer an empty filter** — it was offered in step 1 and matched
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

**Correction to an earlier claim in this plan.** It said batch 3 is where `isFuelEfficientForLct`
starts to bite. That is wrong, and was verified wrong: the flag changes nothing in the app's output
at any price. LCT is embedded in the advertised list price and `calc/onroad.js` deliberately does
not add it to the total (see the comment there), and the FBT threshold path it feeds only matters
for a car that could be FBT-exempt — which no plug-in hybrid is. Record the flag accurately because
it is a real tax fact and a future BEV wave will need it, but do not spend research effort treating
it as decisive. It is not.

What actually decides a premium PHEV's numbers is the same as everywhere else: list price (bands
the card), `fuelConsumptionL100km` (the petrol half of running cost) and `combinedRangeKm` (the
ranking).

## Batch 3 — premium — **DONE**

All six landed. **Three of the six grade names in this plan were wrong**, which is the batch's
main lesson: a batch plan written from a knowledge cutoff names the grade the *world* sells, not
the grade *Australia* sells. Corrections, for anyone reading the rows later:

| Planned grade | Actually on sale in Australia |
|---|---|
| BMW X1 xDrive30e | **xDrive25e** — the 30e is Europe-only and has never been sold here |
| Mercedes-Benz GLC 300e | **GLC 350e 4MATIC** — the 300e was the previous X253 generation |
| BMW X3 xDrive30i (named as the trap) | No such grade in the current G45 range; the traps are `20 xDrive`, `40d xDrive`, `M50 xDrive` |

The discontinued GLC 300e is still in the federal **VESR database with 2021-2026 dates and a 49km
NEDC range**. A researcher starting from the government database rather than the configurator would
have shipped it. Prefer the manufacturer's live configurator for "what is orderable".

| Family | `familyId` | Grade written |
|---|---|---|
| Volvo XC60 PHEV | `volvo-xc60-phev` | Plus / Ultra T8 Plug-in Hybrid Dark |
| Volvo XC90 PHEV | `volvo-xc90-phev` | Plus / Ultra T8 Plug-in Hybrid Dark |
| BMW X1 PHEV | `bmw-x1-phev` | xDrive25e |
| BMW X3 PHEV | `bmw-x3-phev` | 30e xDrive |
| Mercedes-Benz GLC PHEV | `mercedes-glc-phev` | 350e 4MATIC |
| Lexus NX PHEV | `lexus-nx-phev` | 450h+ Luxury / F Sport AWD |

## Batch 4 — remainder

**Verify the grade name against the live Australian configurator before dispatching.** Batch 3 got
three of six wrong from a knowledge cutoff. The grades below are leads with the same status.

| Family | `familyId` | Expected plug-in grade — confirm, don't assume |
|---|---|---|
| Lexus RX PHEV | `lexus-rx-phev` | `RX450h+` is the plug-in. `RX350h` and `RX500h` are conventional hybrids — the same `+` trap as the NX, and the RX500h's bigger number makes it look like the flagship. |
| Audi Q5 PHEV | `audi-q5-phev` | Audi badges plug-ins `TFSI e`. Confirm the current generation still offers one in Australia — Audi has dropped PHEV grades locally before. |
| Peugeot 3008 PHEV | `peugeot-3008-phev` | The 3008 also sells as a BEV (`e-3008`) and as a mild hybrid. Confirm the plug-in is still imported at all; Peugeot Australia's range has contracted sharply. |
| Land Rover Defender PHEV | `land-rover-defender-phev` | `P400e` is the plug-in. Defender also sells as P300/P400 petrol and D250/D350 diesel. Check which body length the P400e comes in — it may be 110-only, which changes `seats`. |

Batch 4 is four families, not six, so it has budget headroom. Spend it on the two things batch 3
showed are worth it: a **manufacturer-published EV-mode consumption** where one exists, and a
**sourced rather than computed `combinedRangeKm`** (see below — no brand in batch 3 published one).

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

- **Range provenance is the wave's confirmed dominant defect — treat every Australian range figure
  as NEDC until proven otherwise.** This is no longer a worry, it is a measured pattern. Batch 3
  found an NEDC figure being presented as WLTP in **four of six families**, and a fifth case was
  found in already-shipped batch-1 data:

  | Family | Australian figure | Actual WLTP | Optimism |
  |---|---|---|---|
  | Mazda CX-60 | 76 km | 62 km | 23% |
  | Mercedes GLC 350e | 132 km | 107 km | 23% |
  | Volvo XC90 T8 | 77 km | 69 km | 12% |
  | Volvo XC60 T8 | 89 km | 79 km | 13% |
  | Lexus NX450h+ | 87 km | 70-74 km | 18% |

  The dangerous part is that **manufacturers' own Australian sites label these "WLTP"**. Volvo
  Australia claims 77 km "according to WLTP" on a page whose own spec table gives the paired
  electric consumption as "(NEDC)"; BMW Australia's 91 km sits *above* BMW's global WLTP ceiling of
  90 km. So "the manufacturer said WLTP" is not evidence. What works, every time, is the
  **European/UK press pack or spec page for the same model year** — it caught all five.
  A useful tell: if the page's electric-consumption figure is flagged NEDC, the range beside it is
  NEDC too.
- **The same field name means different quantities in different markets.** Volvo UK publishes a
  true charge-depleting WLTP electric consumption; Volvo IE/DE/NL publish the utility-factor-weighted
  number under a near-identical label; Volvo AU publishes the NEDC one. Check the market, not just
  the label.
- **Derived consumption — improving.** Before batch 3 every PHEV row had `consumptionKwhPer100km`
  exactly equal to `batteryKwh / rangeKm * 100`, making the schema's 25% cross-check tautological.
  Batch 3 produced the first rows where it genuinely bites: XC60 (2.2% gap), XC90 (4.6%),
  NX (6.8-12.9%), and X3 corroborated against BMW's published 22.3-24.0 band. Keep asking.
  Where a figure *was* derived, that is now stated in the agent's report rather than silent.
- **Cross-family consistency is not automatic and the validator cannot see it.** The XC60 and XC90
  agents ran in parallel on the *same T8 battery pack* and returned incompatible conventions —
  18.8 kWh gross / AU range against 14.7 kWh usable / UK range. Both rows passed the validator
  independently; only reading the two reports side by side caught it. **When a batch contains two
  families sharing a platform or powertrain, diff their rows before committing.**
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
