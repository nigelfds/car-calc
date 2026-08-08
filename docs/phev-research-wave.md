# PHEV research wave — batch plan

Prepared 2026-07-28. **Batches 1-6 complete.** Batches 7-9 outstanding.

**The wave is not finished. It is roughly 58% of the market.** Batch 4's fifth agent surveyed
what is actually on sale rather than researching a family, and the answer changed the plan: the
22 families this document was built from came from one session's recollection and were never
checked against the market. See [The survey](#the-survey--why-there-is-a-batch-5) below.
Batch 5 landed all six of its families, including the two the survey called out as the wave's
largest omissions — the Toyota RAV4 PHEV and the dataset's first plug-in sedan.

The calculation side of PHEV support is finished and merged. This is data work only: no code
change should be needed for any family below. `node scripts/build-dataset.js` validates every row,
and a row it rejects is wrong — fix the row, not the schema.

## Where the dataset stands

After batch 6: 33 brands, 75 families, 192 variants.

| Body type | BEV | PHEV |
|---|---|---|
| SUV | 97 | 69 |
| Hatch | 10 | 0 |
| Sedan | 7 | 1 |
| Ute | 0 | 8 |

Thirty-five PHEV families. **Ute is no longer an empty filter** — it was offered in step 1 and matched
nothing at all until batch 1 landed, and Australia's plug-in ute segment being entirely PHEV is why
no amount of EV research could have filled it.

**The PHEV `Sedan` cell is no longer empty either.** The BYD Seal 6 Essential ($34,990) is the
first, landed in batch 5, and it is currently the only one — the Mercedes C 350e in batch 8 is the
other known candidate. One row is enough to prove the filter works but not enough to make it
useful, so treat the sedan cell as opened rather than filled.

**Wagon is dropped from the UI, and wagons are out of scope — decided, not pending.**

It was originally dropped on the premise that no wagon was on sale. Batch 4's market survey
disproved that premise: three plug-in wagons are on sale (BYD Seal 6 Touring, Cupra Leon VZe
Sportstourer, and Skoda Superb PHEV, which is wagon-only here). Presented with that, the author's
call is to leave wagons out regardless.

So this is now a scope boundary rather than a data gap. **Do not research wagon-only models, and
for a family sold as both, take only the non-wagon variants.** Do not classify a wagon as the
nearest of the four — that would return it to someone filtering for SUV or Hatch and make it
compete on boot space against a different shape of car. A missing car is honest; a miscategorised
one is not. Skoda Superb PHEV is therefore permanently out; BYD Seal 6 contributes its sedan
only.
Two of the three land in batch 6, so the decision is due before then.

**The empty PHEV `Sedan` cell was never a fact about the market, and batch 5 proved it.** The BYD
Seal 6 sedan landed at $34,990; the Mercedes C 350e (batch 8) is the other known plug-in sedan.
Do not conclude from the table above that plug-in hybrids are only SUVs and utes — conclude that
the dataset had only researched SUVs and utes.

## Budget: one batch per session

> **Amended 2026-08-08 — the six-family cap is no longer binding.** The session search
> ceiling has been raised, and batches 7 and 8 have been **merged into a single batch 7 of
> eleven families**. The reasoning below is kept because it is still the right reasoning —
> the batch size is a function of the search budget, not of anything about the families —
> but the arithmetic now supports eleven rather than six. The BEV wave did the same merge
> (its batches 7 and 9) and it worked: eleven families, one session, no family half-researched.
> **Everything else in this section still holds, especially "if a batch runs short, stop
> anyway".** A larger ceiling raises the cap; it does not make a half-researched family
> acceptable.

This is the binding constraint, and it is why the batches were six.

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

## Batch 2 — mainstream SUVs — **DONE**

| Family | `familyId` | Note |
|---|---|---|
| MG HS PHEV | `mg-hs-phev` | Check MG's unconditional warranty term, not the conditional headline. |
| Chery Tiggo 7 PHEV | `chery-tiggo-7-phev` | Marketed as "Super Hybrid" — confirm it plugs in. |
| Chery Tiggo 8 PHEV | `chery-tiggo-8-phev` | Seven-seat sibling; confirm seat count per variant. |
| Kia Sorento PHEV | `kia-sorento-phev` | Also petrol/diesel/hybrid. Plug-in only. |
| Mazda CX-80 PHEV | `mazda-cx-80-phev` | Sibling of `mazda-cx-60-phev` already in the dataset — anchor against it and note where they genuinely differ. |
| Cupra Formentor PHEV | `cupra-formentor-phev` | |

## Batch 3 — premium — **DONE**

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

## Batch 4 — remainder — **DONE**

Three of four landed. Peugeot was correctly found not on sale and no files were written for it.
The fourth agent's slot was spent on a market survey instead of a family, which is what produced
batches 5-8.

| Family | `familyId` | Grade written |
|---|---|---|
| Lexus RX PHEV | `lexus-rx-phev` | 450h+ Luxury / Sports Luxury AWD |
| Audi Q5 PHEV | `audi-q5-phev` | e-hybrid quattro 270kW, SUV and Sportback |
| Land Rover Defender PHEV | `land-rover-defender-phev` | 110 P300e X-Dynamic SE / HSE |
| Peugeot 3008 PHEV | — | **Not on sale. No files.** |

**Three of the four planned grade names were wrong**, so the wave's running total is five of ten.
The lesson from batch 3 held and got stronger: a plan written from a knowledge cutoff names the
grade the *world* sells, not the grade *Australia* sells.

| Planned grade | Actually on sale in Australia |
|---|---|
| Audi `Q5 TFSI e` | **Q5 e-hybrid quattro** — Audi retired the `TFSI e` badge with the PPC-platform car |
| Land Rover Defender `P400e` | **P300e**, 221kW not 297kW. The plan's `P300`/`P400` petrol badges are stale too — MY26 renamed them `P425` |
| Lexus `RX450h+` | Correct as planned — the only one of the four that was |

**Peugeot: PHEVs are gone brand-wide, not just from the 3008.** Peugeot Australia axed plug-in
hybrids across the entire local range in September 2024; the current 3008's "Hybrid" badge is a
48V mild hybrid. The agent checked the two `3008 Plug-In Hybrid` strings on Peugeot Australia's
own page and confirmed they are global-template boilerplate, not a local offer — the same class of
trap as the GLC 300e sitting in VESR with current dates. Do not re-check Peugeot in a later batch.

**Two traps found in the Defender that no schema could catch.** First, CarExpert's *article prose*
says P400e while its own price table says P300e; the agent settled it against Land Rover's UK 26MY
spec PDF, which has no P400e column at all. Second, the agent published Land Rover's own Australian
boot figures (853/2127 L) and flagged them as LR's **"wet" liquid-simulated volumes**, roughly 20%
above the VDA dry convention every other row uses. `calc/rank.js` scores `bootLitresSeatsUp` and
awards a "biggest boot of this group" reason at weight 3.5, so the wet figure would have won the
Defender that headline over every PHEV SUV in the dataset — next largest is 612 L — on a
measurement basis it alone used. Swapped to the dry pair (670/1759) before committing. **Boot
figures are a units trap in the same family as gross-vs-usable battery: check the convention, not
just the number.**

## The survey — why there is a batch 5

Batch 4's fifth agent researched no family. It was asked one question: **which plug-in hybrids are
actually on sale new in Australia today?** The answer is the most consequential finding of the
whole wave.

- The dataset has **23 PHEV families**. The market has roughly **50 models across 35 brands**.
- **About 30 in-scope families remain unresearched** — five more sessions at six per batch.
- The single largest omission is the **Toyota RAV4 PHEV**: Toyota Australia's first-ever plug-in,
  on the country's best-selling SUV nameplate, on sale since late June 2026, and Toyota expects one
  in three RAV4s sold to be the plug-in. It was never on this plan's list.

The 22 families this document was built from were recalled, not surveyed. That is the process
defect worth remembering: **every later batch in this wave was planned by the same method that
missed the best-selling plug-in in the country.** Survey first next time.

The survey also produced a large **confirmed-absent** list, which is worth as much as the gap list
because it stops the next session re-checking. Selling no PHEV in Australia at all: **Jeep**
(Grand Cherokee 4xe withdrawn, Compass 4xe withdrawn ~May 2026, Wrangler 4xe never offered here —
though `jeep.com.au` still runs a live 4xe page with no price, stale marketing rather than
availability), **Hyundai**, **Peugeot**, **Renault**, **Mini**, **Kia**, **Subaru**, **Honda**,
**Nissan**, **Genesis**, **Polestar**, **LDV**, **Deepal**, **XPeng**, **KGM/SsangYong**.
Also gone: **Mitsubishi Eclipse Cross PHEV** (discontinued March 2025 over ADR 98/00 AEB, yet still
listed at $47,790 in an April 2026 "cheapest PHEV" roundup), Mazda's CX-70/CX-90 PHEVs (paused),
and everything Volvo beyond XC60/XC90.

**REEVs found and deliberately excluded** (engine never drives the wheels, out of scope per the
brief): Leapmotor C10 and B10, Forthing Taikon 5. All three appear in Australian "cheapest PHEV"
lists. Nissan **e-Power** and Honda **e:HEV** are series hybrids with no plug; Porsche's **911
T-Hybrid** and Mercedes' **GLC 53 / GLE 53** are mild hybrids. None belong here.

## Batch 5 — volume sellers — **DONE**

All six landed, 13 variants. See commit `9d76ef1` for each family's disclosed low-confidence
figures — that commit message is the only record of which numbers are soft.

| Family | `familyId` | Grade written |
|---|---|---|
| Toyota RAV4 PHEV | `toyota-rav4-phev` | XSE 2WD / XSE AWD / GR Sport AWD |
| BYD Sealion 5 | `byd-sealion-5` | Essential / Premium |
| BYD Seal 6 | `byd-seal-6` | Essential — **sedan only**, Touring correctly excluded |
| Geely Starray EM-i | `geely-starray-em-i` | Complete / Inspire Extended Range |
| GWM Haval H6 GT PHEV | `gwm-haval-h6-gt-phev` | Ultra PHEV Hi4 |
| BYD Sealion 8 | `byd-sealion-8` | Dynamic FWD / Dynamic AWD / Premium AWD |

**Grade names: three of six wrong, so the wave's running total is eight of sixteen.** The pattern
holds exactly — a plan written from a knowledge cutoff names the grade the *world* sells, not the
grade *Australia* sells. Batch 5's failures were of a new kind, though: not renamed badges but
**wrong grade counts**, which is more dangerous because it silently merges or invents cars.

| Planned | Actually on sale in Australia |
|---|---|
| Seal 6 `Essential / Premium`, $34,990-$39,990 | **Essential only** as a sedan. The "Premium" is the *Touring* — the plan was quoting a sedan price and a wagon price as one band |
| Sealion 8 `Dynamic / Premium` | **Three** grades: Dynamic splits FWD/AWD across two different powertrains (19.0 kWh DM-i vs 35.6 kWh DM-p, 103 km vs 152 km). Collapsing them would have merged two unlike cars |
| Starray `Complete / Inspire`, ~$37,490-$39,990 | **Complete / Inspire Extended Range.** The MY26 Inspire was superseded in late May 2026, so the price band was stale too |
| RAV4, Sealion 5, H6 GT | Correct as planned |

### The batch-5 range warning was wrong, and this is the batch's main lesson

The warning said Chinese brands would have no European press pack and "no WLTP exists" would
usually be the honest answer. **Four of six families carry genuine WLTP.**

| Family | Standard used | Australian NEDC figure rejected |
|---|---|---|
| Toyota RAV4 | WLTP 121 / 113 km | 154 / 144 km NEDC, Toyota AU's own spec table |
| BYD Sealion 5 | WLTP 62 / 85 km, **BYD UK** | 71 / 100 km NEDC |
| BYD Seal 6 | WLTP 55 km | 70 km NEDC, BYD AU's own site — a 21% gap |
| Geely Starray EM-i | WLTP 83 / 136 km, **UK Pro/Max/Ultra** | — |
| BYD Sealion 8 | **NEDC 103 / 152 km** | no WLTP exists |
| GWM Haval H6 GT | **NEDC 183 km** | no WLTP exists |

**BYD and Geely both sell in the UK and both publish WLTP there.** So the rule is not "Chinese
brands have no press pack" — it is the same rule batches 3 and 4 already established: *check which
market and which spec published the number*. Look for a UK arm before concluding none exists.

The two genuine NEDC families each established the absence rather than assuming it, which is what
makes them trustworthy: **the Tang L (Sealion 8) is not sold in Europe or the UK at all**, and
CarsGuide recorded the H6 GT's WLTP as "pending" 18 months ago with none published since. That
matches the brief's existing finding for the standard Haval H6 and Cannon Alpha — GWM appears to
have no WLTP homologation for any Australian PHEV.

**RACV publishes editorial NEDC-to-WLTP conversions** ("152km NEDC, or about 130km WLTP"). The
Sealion 8 agent declined to adopt them. That is correct and should stay the rule: a conversion is
not a homologated figure, and adopting one would put an estimate where a source belongs.

### Aggregator spec databases are a systematically worse source than launch reviews

Batch 5 hit this three times in three different aggregators, and it is a distinct failure mode from
"the brand site is stale" that batch 4 documented:

- **carsales' research grid** listed all four Essential/Premium × Sedan/Wagon permutations for the
  Seal 6. Only two exist. The grid is database permutations, not availability — it would have
  produced three phantom rows.
- **CarsGuide's spec database** priced the RAV4 GR Sport at $66,430 (transposed from $66,340) on a
  page that also claimed a nickel-metal-hydride battery. The agent discarded the whole record
  rather than just the price, which is the right response to a source caught in one clear error.
- **CarsGuide's price widget** showed a $34,990-$38,990 sedan band for the Seal 6, contradicted by
  BYD Australia's own site and by CarExpert's spec URLs, which literally contain `-sedan-fwd-` and
  `-station-wagon-fwd-`.

Prefer the manufacturer configurator for *what is orderable* and an Australian launch review for
*what the numbers are*. Treat an auto-generated spec grid as a lead only.

### A cross-family inconsistency this batch found but did not fix

**`byd-sealion-6` and `byd-sealion-5` disagree on range standard for the same 18.3 kWh pack.**

| Row | Battery | Range | Standard |
|---|---|---|---|
| `byd-sealion-5-premium` (batch 5) | 18.3 kWh | 85 km | WLTP, BYD UK |
| `byd-sealion-6-essential` (pre-wave) | 18.3 kWh | 92 km | unverified |

The Sealion 5 is the smaller, lighter car (1785 kg) and gets *less* range from the same pack. That
is backwards, and the likeliest explanation is that the Sealion 6's 92 km is NEDC. **This was not
fixed** — re-researching a shipped family was outside batch 5's scope and its budget. It is a
one-family job for a later session: verify the Sealion 6's three ranges against BYD UK and correct
them if they are NEDC. Note this is the XC60/XC90 defect the doc already warns about, except it
crosses a batch boundary, so diffing within a batch would never have caught it. **When a batch adds
a family that shares a platform with an already-shipped one, diff against the shipped row too.**

### Other findings worth carrying

- **The powertrain trap arrived exactly as predicted, and the RAV4 is the sharpest case yet.** The
  XSE name spans both powertrains: **XSE Hybrid AWD is $58,340 and XSE PHEV 2WD is $58,840**, $500
  apart and different cars. An agent anchoring on price would have written the conventional hybrid
  and produced a plausible row that was entirely wrong.
- **The clearest proof yet of why the ADR/VESR label rule exists.** Toyota's label gives 184 Wh/km
  against a 154 km NEDC range, which multiplies out to **28.3 kWh — more energy than the 22.7 kWh
  gross pack physically holds**. That is not one estimate disagreeing with another; it is
  arithmetic proof the label is a different quantity.
- **`consumptionKwhPer100km` is derived on all six families**, so the schema's 25% cross-check is
  tautological on every new row. Batch 3's progress on this did not carry: the figure is only
  independently sourceable when a manufacturer publishes EV-mode consumption, and none of these six
  does. Keep asking, but do not expect it from volume brands.
- **GWM sells on drive-away only and has no published RRP.** The H6 GT's list price had to be
  triangulated from CarsGuide's MSRP field against carsales' indicative drive-away minus a $2,000
  campaign, landing on $52,990 — the same number as the campaign drive-away, because GWM absorbs
  the on-road allowance. It is the batch's least-confident figure and is flagged as such in the
  commit. Batch 7's two GWM Tanks will hit the same problem.

## Batch 6 — mainstream Chinese and Volkswagen Group — **DONE**

All six landed, 9 variants, no family withdrawn. See commit `951d77b` for each family's disclosed
low-confidence figures — that commit message is the only record of which numbers are soft.

| Family | `familyId` | Grade written |
|---|---|---|
| Chery Tiggo 9 Super Hybrid | `chery-tiggo-9-phev` | Elite FWD / Ultimate AWD |
| Jaecoo J8 SHS | `jaecoo-j8-shs` | SHS Summit AWD — sole SHS grade |
| Omoda 9 SHS | `omoda-9-shs` | SHS Virtue AWD — sole grade |
| VW Tiguan eHybrid | `vw-tiguan-phev` | 150TSI eHybrid Elegance / 200TSI eHybrid R-Line |
| VW Tayron eHybrid | `vw-tayron-phev` | 150TSI eHybrid Elegance / 200TSI eHybrid R-Line |
| Skoda Kodiaq PHEV | `skoda-kodiaq-phev` | Select Plug-in Hybrid — sole PHEV grade |

**Grade names: five of six wrong, so the wave's running total is thirteen of twenty-two.** Batch 5's
new failure mode is now the *only* failure mode — every one of batch 6's errors was a wrong grade
**count**, not a wrong badge. The Chery is two grades where the plan implied one; the Jaecoo and the
Omoda are single-grade where the plan implied a range; both VWs are two-grade. Only the Kodiaq's
"local badging is PHEV, not iV" note was right as written, and it was right because a previous
session had already checked it. **Counting grades on the configurator is now the highest-yield check
in the batch prompt.**

### The UK-arm rule is now proven, not provisional

Batch 5 found that BYD and Geely publish WLTP in the UK. Batch 6 tested the generalisation against
the three brands the plan was least confident about, and **all three have UK arms and all three
publish WLTP**. Five of six families carry genuine WLTP; the survey's "169km NEDC" leads were
replaceable in every case they applied to.

| Family | Standard used | Australian NEDC figure rejected |
|---|---|---|
| Chery Tiggo 9 Ultimate | WLTP 146 km, corroborated by **Parkers/Autocar UK** | 170 km NEDC |
| Jaecoo J8 | WLTP 134 km, **UK-market SHS-P** | 169 km NEDC — AU publishes nothing else |
| Omoda 9 | WLTP 145 km, four AU sources | 169 km NEDC, still Omoda AU's headline |
| VW Tiguan | WLTP 117 / 113 km | — |
| VW Tayron | WLTP 116 / 113 km | — |
| Skoda Kodiaq | WLTP 110 km | — |
| Chery Tiggo 9 **Elite** | **NEDC 90 km** | no WLTP exists |

**So stop treating "Chinese brand" as a proxy for "no WLTP".** The real predictor is whether the
brand sells the *same variant* in the UK or Europe. The one NEDC row in this batch proves the point
from the other direction: the Tiggo 9 **Elite** is NEDC-only not because Chery lacks a UK arm but
because **the UK took the 34.5 kWh AWD and not the 18.7 kWh FWD**. Ask which variant Europe
imported, not which brand.

That row is also the batch's worst figure and is worth knowing about before anyone trusts it. The
Ultimate's own NEDC-to-WLTP ratio (170 → 146) implies the Elite's true range is nearer **77 km than
90 km**, so the Elite currently looks equal to the Tiggo 7/8 — which carry genuine 90 km WLTP from
Chery UK — when it is almost certainly worse.

### The cross-family diff earned its place in the checklist

Batch 5 recorded the Sealion 5/6 inconsistency but could not act on it because it crossed a batch
boundary. **Batch 6 contained the clash inside one batch and it was caught and fixed before the
commit.** Four rows in the dataset now run the same VW Group 1.5 TSI eHybrid, and their
charge-sustaining figures came back ordered backwards by mass:

| Row | Kerb | As reported | Committed |
|---|---|---|---|
| `cupra-formentor-phev-vze` (batch 2) | 1730 kg | 6.5 | 6.5 |
| `vw-tiguan-phev` | 1873 kg | 7.0 | 7.0 |
| `vw-tayron-phev` | 1930 kg | **6.3 / 6.6** | **7.0** |
| `skoda-kodiaq-phev` | 1985 kg | 7.0 | 7.0 |

Three agents drew three different figures from the same 5.5–8.0 spread of real-world reviews,
because **no VW Group market publishes a charge-sustaining figure for any of these cars**. Each was
defensible alone; together they gave the heavier Tayron 70 km *more* combined range than the smaller
Tiguan on an identical 45 L tank, and `combinedRangeKm` drives the shortlist ranking. The Tayron was
reconciled to 7.0 on both grades — its own agent's second data point was Parkers at 7.06, and it had
flagged its inter-grade split as "judged, not sourced" — and `combinedRangeKm` recomputed to 759 and
756.

**The generalisable rule: when a batch contains families sharing a powertrain, diff the *judged*
fields, not just the sourced ones.** The validator cannot see across rows, and every one of these
four rows passed independently. Sourced fields agreed perfectly here — all four record 19.7 kWh
usable and all four are WLTP. It was the field nobody could source that diverged.

### 19.7 kWh is the USABLE figure, and the batch prompt said otherwise

The prompts for all three VW Group families warned that 19.7 kWh is the gross figure and told agents
to hunt for a smaller usable one. **That was wrong**, and two agents said so directly: VW's own press
pack says "19.7-kWh (net)", with 25.7 kWh gross. An agent that obeyed the prompt would have chased a
number that does not exist, or invented one.

Worth carrying for the rest of the VW Group: **Skoda Australia's MY26 spec sheet prints a single
number under a "High Voltage Battery Capacity (Gross / Nett)" heading, and that number is the
gross.** A label naming both quantities is not evidence of which one is printed.

### Other findings worth carrying

- **The ADR/VESR label trap fired on four of six families and was correctly refused every time.**
  Jaecoo 19.3, Omoda 19.3, Tayron 14.0–14.4, Kodiaq 148 Wh/km. The Tayron's is the cleanest proof
  yet after the RAV4's: 14.4 × 116 km = 16.7 kWh, **less energy than the 19.7 kWh usable pack**, so
  it cannot be a charge-depleting figure. The Kodiaq's 148 Wh/km sits 17% below battery ÷ range.
- **`consumptionKwhPer100km` was derived on five of six families**, so the schema's 25% cross-check
  is tautological on those rows. The exception is the **Skoda Kodiaq**, where Škoda publishes a
  charge-depleting band of 17.2–20.5 kWh/100km and the derived 17.9 falls inside it. That matches
  the pattern batches 3 and 5 established — European brands sometimes publish a usable figure,
  volume and Chinese brands do not — and it is the only genuine check in the batch.
- **The seat-count trap is real and it is a VW Group trap specifically.** Both the Tayron and the
  Kodiaq are seven-seat nameplates whose plug-in grade is **five seats only**, because the battery
  occupies the third-row well. The Kodiaq agent proved it from Škoda's own spec sheet, where the
  "luggage capacity behind 3rd row" cell is `—` for the PHEV and 289 L for every petrol grade.
  Anyone copying a family-level seat count would have put a five-seater in front of seven-seat
  buyers. Expect the same on any PHEV derivative of a three-row SUV.
- **The powertrain price trap appeared in both VWs and inverted between them.** VW sells a petrol
  **150TSI Elegance** alongside a plug-in **150TSI eHybrid Elegance** in both ranges: in the Tiguan
  the petrol is $3,000 *cheaper*, in the Tayron $2,000 *cheaper*. Near-identical names, and price
  alone identifies neither. Both agents named the excluded grade explicitly, which is exactly what
  the "name what you excluded" requirement is for.
- **GWM's no-RRP problem did not generalise to the other Chinese brands.** All three published or
  had recoverable list prices; the drive-away figures were present but never the only figure. Batch
  7's two GWM Tanks will still hit it.
- **Skoda advertises two different drive-away prices for the same car** — $68,990 on the April 2026
  spec sheet and $59,990 on the current website, roughly $9,000 apart within months of launch.
  Neither is the $63,490 list price. This is the drive-away rule's clearest illustration so far:
  the drive-away number is a campaign, not a property of the car.

## Batch 6 — original plan, kept for context

**One of batch 5's two warnings survived; the other was disproved — read the batch 5 section before
dispatching.**

- **Drive-away pricing is common and the warning stands.** GWM in particular publishes no RRP at
  all.
- **"There is no European press pack behind the Chinese brands" is wrong.** Batch 5 found genuine
  WLTP for four of six families, including two Chinese ones, because **BYD and Geely both sell in
  the UK and publish WLTP there**. Chery, Jaecoo and Omoda all have UK arms too — check them before
  accepting an NEDC figure. Skoda and VW are European outright, so their press packs are not in
  doubt at all; for those two the NEDC worry barely applies and the survey's "169km NEDC" leads for
  the Chery/Jaecoo/Omoda cars should be treated as leads to *replace*, not to record.

Also: batch 5's grade-name failures were **wrong grade counts** rather than wrong badges — a
family sold in three grades listed as two, and a wagon price quoted inside a sedan band. Count the
grades on the configurator, do not just match the names.

| Family | `familyId` | Expected plug-in grade — confirm, don't assume |
|---|---|---|
| Chery Tiggo 9 Super Hybrid | `chery-tiggo-9-phev` | Anchor against `chery-tiggo-7-phev` and `chery-tiggo-8-phev` already in the dataset. Survey quotes ~170km electric as NEDC. |
| Jaecoo J8 SHS | `jaecoo-j8-shs` | "SHS" is the plug-in, as with the J7. Anchor against `jaecoo-j7-shs`. Survey quotes 169km NEDC. |
| Omoda 9 SHS | `omoda-9-shs` | New nameplate to the dataset. Survey quotes 169km NEDC. |
| VW Tiguan eHybrid | `vw-tiguan-phev` | Tiguan also sells as petrol — plug-in grades only. |
| VW Tayron eHybrid | `vw-tayron-phev` | Seven-seat Tiguan sibling; confirm seat count per variant. |
| Skoda Kodiaq PHEV | `skoda-kodiaq-phev` | **Skoda Australia dropped the "iV" suffix** — local badging is just "PHEV", so anything keyed to "Kodiaq iV" will never match the configurator. |

## Batch 7 — off-roaders and premium — **MERGED WITH BATCH 8, RESTRUCTURED 2026-08-08**

**Eleven families in one batch, not five plus six.** The session search ceiling has been raised, so
the old six-family cap no longer binds; see the amended budget section above. There is no batch 8
any more — its six families are stream 2 below, and its heading is retained only as a pointer.

**Run the two verifications FIRST, with cheap dedicated agents, before any family work.** Both can
remove work from the batch, and one of them can remove two families outright:

1. **The Denza architecture check** — are the B5 and B8 true PHEVs, or range-extenders? Detail below.
   A negative removes two of the eleven.
2. **The JAC Hunter PHEV on-sale check** — pulled forward from batch 9 on 2026-08-08, because its
   entry there reads "showrooms **August 2026**", which is now. At $49,988 it would be **Australia's
   cheapest PHEV ute**, and the PHEV `Ute` cell holds only three families. It is the one item in the
   batch 9 re-check pass with a live, dated reason to be checked now rather than later. If it is on
   sale, research it as a twelfth family; if not, record the evidenced negative and leave it.

**Why this batch leads the remaining wave.** Stream 2 carries the `Sedan` work. The PHEV `Sedan`
cell holds exactly one family (`byd-seal-6`), and this document already describes it as "opened
rather than filled". The Mercedes C 350e is a sedan, and under the binding liftback/fastback rule so
is the Audi A5 e-hybrid — so this batch can take that cell from one family to three. That is the
same structural argument that made batch 1 the highest-value batch of the BEV wave.

### Stream 1 — off-roaders (the original batch 7)

Five families. **The Denza question must be settled first and may remove two of them.**

| Family | `familyId` | Expected plug-in grade — confirm, don't assume |
|---|---|---|
| GWM Tank 300 Hi4-T | `gwm-tank-300-phev` | Anchor against the GWM families already in the dataset. Survey quotes 115km NEDC. **GWM is the one brand batch 6 did not clear**: no RRP and, on batches 1 and 5's evidence, no WLTP homologation for any Australian PHEV. Establish both absences rather than assuming them. |
| GWM Tank 500 Hi4-T | `gwm-tank-500-phev` | Ultra Hi4-T. Survey quotes 120km NEDC. Same GWM caveats as the Tank 300. |
| Denza B5 | `denza-b5` | **Verify it is a true PHEV before writing anything.** |
| Denza B8 | `denza-b8` | **Same verification.** |
| Cupra Terramar VZe | `cupra-terramar-phev` | Anchor against `cupra-formentor-phev` already in the dataset. **Batch 6 added three more rows on the same VW Group 1.5 TSI eHybrid** — `vw-tiguan-phev`, `vw-tayron-phev`, `skoda-kodiaq-phev`. All four record 19.7 kWh **usable** (25.7 gross) and 7.0 or 6.5 L/100km charge-sustaining; diff against them and match the convention rather than re-deriving it. |

**The Denza check, and why it is a stop condition.** Both use BYD's DMO off-road platform, and the
survey could not confirm first-hand that the engine mechanically drives the wheels. If it only
charges the battery they are range-extenders (REEV), which the brief puts out of scope, and neither
should be written. Establish this before researching either — a REEV costed as a PHEV would be
wrong in a way the schema cannot catch, because every field would validate.

**Batch 5 settled the same question for the Geely Starray and the method it used is the one to
copy.** Two Australian reviews described the Starray's engine as running "as a generator", which
read literally would have made it a REEV and put it out of scope. That prose was wrong — or rather,
it described normal operation, not the architecture's limit. What settled it was **the motor
layout**: Geely's own technology page gives a **P1 + P3** arrangement, which by definition includes
an engine-to-output path, and UK reviews confirmed the engine drives the front wheels directly in
Power mode. So:

- **Do not settle this on review prose.** "Acts as a generator" and "mostly drives the wheels
  electrically" are descriptions of behaviour, not of architecture, and both appear in reviews of
  cars that are unambiguously PHEVs.
- **Settle it on the motor topology.** P1-only is a range-extender. Any P2/P3/P4 motor, or a
  published mechanical/direct-drive mode, means the engine can reach the wheels.
- The confirmed REEVs the survey already excluded — Leapmotor C10 and B10, Forthing Taikon 5 — are
  the negative controls to check any method against.

Skoda Superb PHEV was originally listed here and is **permanently out**: wagon-only in Australia,
and wagons are out of scope.

### Stream 2 — premium (the former batch 8, absorbed 2026-08-08)

Note the **sedans**. The near-empty PHEV `Sedan` cell is an artefact of nobody looking, not a fact
about the market, and batches 5 and this stream are what fix it. `mercedes-c-350e-phev` is a sedan
outright; `audi-a5-phev` is a liftback, and **liftbacks and fastbacks are `Sedan`** — that decision
is binding and settled, so do not re-litigate it or file the A5 as a hatch.

| Family | `familyId` | Expected plug-in grade — confirm, don't assume |
|---|---|---|
| Mercedes-Benz C 350e | `mercedes-c-350e-phev` | **A sedan.** Anchor against `mercedes-glc-phev` already in the dataset. |
| Mercedes-Benz GLA 250e | `mercedes-gla-phev` | Same anchor. |
| BMW X5 xDrive50e | `bmw-x5-phev` | Anchor against `bmw-x1-phev` / `bmw-x3-phev`. Check it is under the $250,000 bound. |
| Porsche Cayenne E-Hybrid | `porsche-cayenne-phev` | **Base E-Hybrid only** — the Turbo E-Hybrid is over the $250,000 bound and is excluded below. |
| Alfa Romeo Tonale | `alfa-romeo-tonale-phev` | Tonale also sells as a mild hybrid — plug-in only. |
| Audi A5 e-hybrid | `audi-a5-phev` | Anchor against `audi-q5-phev` already in the dataset. Note **TFSI e is a retired badge** — batch 4 found the Q5 is now "e-hybrid". |

## Batch 9 — the re-check pass — **THINNED 2026-08-08**

**Now five candidates, not six** — the JAC Hunter was pulled forward into batch 7, being the only one
with a live dated reason to be checked now. With batches 7 and 8 merged, this is the **last batch of
the PHEV wave**, and it is a verification pass rather than research: expect to spend most of it
writing evidenced negatives. Note the BEV wave's on-sale/run-out flag has come back negative six
times out of six, so calibrate expectations accordingly and treat a negative as the batch working.

Run this last, and expect most of it to produce nothing. These were pre-launch or borderline at the
time of the batch-4 survey, so the job is to establish whether each is now on sale and research only
those that are. **A batch that writes two families and eight evidenced "still not on sale" reports
has done its job** — and the reports are what stop batch 10 re-checking the same dead ends.

| Family | `familyId` | Status at survey |
|---|---|---|
| ~~JAC Hunter PHEV~~ | `jac-hunter-phev` | **PULLED FORWARD INTO BATCH 7 on 2026-08-08** — its "showrooms August 2026" date has arrived, and at $49,988 it would be Australia's cheapest PHEV ute against a `Ute` cell holding only three families. Do not re-check it here; batch 7 either wrote it or recorded an evidenced negative |
| Omoda 7 PHEV | `omoda-7-phev` | Pre-launch. |
| Chery Stockman PHEV | `chery-stockman-phev` | Diesel PHEV ute, pre-launch. |
| GWM Haval Jolion Max PHEV | `gwm-haval-jolion-phev` | Pre-launch. |
| Zeekr 9X | `zeekr-9x` | Confirmed for Australia, not on sale at survey. |
| Zeekr 8X | `zeekr-8x` | Same. |

**Ford Transit Custom PHEV is out of scope** — a true plug-in hybrid, but a commercial van rather
than a passenger carrier, and there is no body type that fits it honestly.

**Above the $250,000 `listPrice` bound and therefore unrepresentable — do not research:** Range
Rover P460e, BMW XM Label, Porsche Cayenne Turbo E-Hybrid, all four Panamera E-Hybrids, Ferrari
296/849, McLaren Artura, **Lamborghini's entire Australian range** (Urus SE, Temerario, Revuelto)
and **Bentley's whole new-generation Continental/Flying Spur range**, both of which are now
PHEV-only. Worth knowing that two whole brands sell nothing but plug-in hybrids here and the app
cannot represent either.

**Borderline, re-check rather than research:** JAC Hunter PHEV ($49,988, reservable, showrooms
August 2026 — would be Australia's cheapest PHEV ute); Zeekr 9X/8X (confirmed for Australia, not on
sale); Omoda 7 PHEV, Chery Stockman diesel PHEV ute, GWM Haval Jolion Max PHEV (all pre-launch);
Ford Transit Custom PHEV (a true PHEV but a commercial van, not a passenger carrier).

## How to run a batch — paste this into a new session

One batch per session. Substitute the batch number; everything else is the same every time, which
is the point — this replaces a hand-written prompt per batch.

```
Run batch N of the PHEV research wave for car-calc.

Read docs/phev-research-wave.md for batch N's family table and its batch-specific
warnings, and docs/phev-research-brief.md for the binding field rules. Both carry
the accumulated findings of every earlier batch — do not re-derive them, and do not
re-litigate decisions they record.

Before dispatching:
  - Confirm `node scripts/build-dataset.js` reports 0 failures.
  - If the batch section names a stop condition (batch 7's Denza check), settle it
    first. It may remove families from the batch.
  - If the batch section names a data fix to apply first, do it and commit it
    separately, before the batch.

Then dispatch one general-purpose subagent per family, all in a single message so
they run in parallel. Each agent gets: its family name and familyId, its row's note
from the table verbatim, the path to the brief introduced as "read this first, it is
binding", the research date, any sibling already in the dataset to anchor
insuranceAnnual and depreciationCurve against, and the hard boundaries — write only
its own two files under data/families/ and data/vehicles/, never an aggregate file,
never another family's files, never data/schema.js, and run no git commands.

Require every agent to report: the grade names it EXCLUDED and why, which standard
each range figure came from, which of batteryKwh / rangeKm / consumptionKwhPer100km
it sourced versus derived, and its least-confident figure named outright.

When they return:
  - node scripts/build-dataset.js  (must end "0 failures")
  - npm test
  - Restart any dev server. It caches the dataset at boot and will otherwise serve
    stale rows — this has caught three sessions already. Check with
    `lsof -nP -iTCP:3000 -sTCP:LISTEN`, not `ps | grep`, and confirm the page
    header's variant count matches the build output.
  - Load the page in a browser with ?includePhev=true and confirm the new families
    render. Do not substitute an API check for this; a green API and a broken page
    have happened on this project.
  - Commit the data with a message naming each agent's low-confidence figures. That
    disclosure is the only record of which figures are soft.
  - Update this doc: mark batch N done, refresh the coverage table, and record
    anything later batches should know.

Stop after batch N. The search budget covers one batch per session, and a family that
runs out of searches half way through is worse than no family.
```

### The five rules that have each already caught something

Restate these in the agent prompts. Every one comes from a batch that got it wrong first.

1. **`listPrice` is the manufacturer list price, never drive-away.** The single most common error,
   and for the Chinese brands drive-away is the *default* quoted figure.
2. **Never use the ADR/VESR label for `consumptionKwhPer100km`.** Kia's was 30.7% from its own
   battery and range and would have failed the validator; Lexus's was 39% low against measured.
3. **A published figure may still be the wrong quantity.** Volvo publishes three different ones
   under nearly identical labels across its own markets. If a figure disagrees with usable battery ÷
   range by more than a few percent, suspect the quantity before the arithmetic.
4. **`batteryKwh` is usable, not gross.** Two families shipped gross and spent the validator's
   whole tolerance on a definitional mismatch.
5. **Grade names are leads.** Thirteen of twenty-two have now failed verification across batches
   3-6 — `TFSI e` is retired, `P400e` no longer exists, and `NX450h+` differs from `NX350h` by one
   character. **Since batch 5 the failures have been wrong grade *counts* rather than wrong badges**,
   which is more dangerous because it silently merges or invents cars. Count the grades on the
   configurator; do not just match the names.

### What a good batch looks like

Not "six families landed". A batch that writes three families, reports two as evidenced "not on
sale", and stops on one because a stop condition failed has done its job — batch 4 wrote three of
four and its most valuable output was the survey that showed the wave was 40% finished. Families
that cannot be entered honestly should not be entered.

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
  | Lexus RX450h+ | 85 km | 67 km | 27% |
  | Defender P300e | 52 km | 48 km | 8% |

  **Batch 5 confirmed the pattern again and widened where to look.** Four of its six families had
  genuine WLTP available, and in every case the Australian figure was the optimistic one: RAV4
  154→121 km (27%), Sealion 5 100→85 km (18%), Seal 6 70→55 km (27%). The new part is *where the
  WLTP came from* — **BYD UK and Geely UK**, for brands this plan had assumed had no European
  presence at all. Before recording an NEDC figure, check whether the brand has a UK arm.

  **Batch 6 tested that on the three brands the plan was least sure of — Chery, Jaecoo, Omoda — and
  all three had UK arms publishing WLTP.** Five of six families carry genuine WLTP and the
  Australian figure was optimistic every time: Tiggo 9 170→146 km (16%), Jaecoo J8 169→134 km (26%),
  Omoda 9 169→145 km (17%). **The rule is now: the predictor is not the brand, it is whether the
  UK or Europe imported the *same variant*.** Batch 6's one NEDC row proves it from the other side —
  the Tiggo 9 **Elite** has no WLTP not because Chery lacks a UK arm but because the UK took the
  34.5 kWh AWD and not the 18.7 kWh FWD. Ask which variant Europe imported, not which brand.

  **Batch 4 produced the wave's first counter-example, and it matters.** The Audi Q5 e-hybrid's
  Australian 82 km is genuine WLTP *and is conservative* — it sits below Europe's headline 100 km,
  because the local car is the 270kW quattro on 20-inch wheels while the European figure is the
  best-case 220kW. So the rule is not "Australian range figures are always inflated". It is
  **check which market and which spec published the number** — the same lesson Volvo's
  three-quantities-under-one-label taught in batch 3. Nine of ten families still favour suspicion.

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
- **Derived consumption — improved in batch 3, regressed in batch 5, and the split is by brand.**
  Before batch 3 every PHEV row had `consumptionKwhPer100km` exactly equal to
  `batteryKwh / rangeKm * 100`, making the schema's 25% cross-check tautological. Batch 3 produced
  the first rows where it genuinely bites: XC60 (2.2% gap), XC90 (4.6%), NX (6.8-12.9%), and X3
  corroborated against BMW's published 22.3-24.0 band. **Batch 5 went back to fully derived on all
  six families** — not through laziness but because no volume brand publishes EV-mode consumption,
  and the only published alternative is the ADR utility-factor-weighted label the brief forbids.
  So the realistic expectation is: premium European brands sometimes publish a usable figure,
  volume and Chinese brands do not. Keep asking, expect no from the latter, and keep saying which
  it was — where a figure was derived, that is stated in the agent's report rather than silent.
  **Batch 6 held to that split exactly**: derived on five of six, with the **Skoda Kodiaq** the lone
  exception — Škoda publishes a charge-depleting band of 17.2–20.5 kWh/100km and the derived 17.9
  falls inside it. Note that VW itself, on the same powertrain, publishes nothing usable, so this is
  not even consistent within one corporate group. Ask per model, not per brand.
- **Cross-family consistency is not automatic and the validator cannot see it.** The XC60 and XC90
  agents ran in parallel on the *same T8 battery pack* and returned incompatible conventions —
  18.8 kWh gross / AU range against 14.7 kWh usable / UK range. Both rows passed the validator
  independently; only reading the two reports side by side caught it. **When a batch contains two
  families sharing a platform or powertrain, diff their rows before committing.**

  **Batch 6 is where this check finally paid, and it refines what to diff.** Three agents on the
  same VW Group 1.5 TSI eHybrid agreed perfectly on every *sourced* field — all recorded 19.7 kWh
  usable, all recorded WLTP — and diverged on the one field none of them could source, giving the
  heavier Tayron more combined range than the smaller Tiguan on an identical tank. So the sourced
  fields are not where the risk is. **Diff the judged fields**: charge-sustaining fuel consumption,
  insurance, depreciation. And sanity-check them against a physical ordering — mass, size, output —
  because a set of individually defensible estimates can still be collectively impossible.
- **Body-type spread — the earlier reading of this was wrong.** Batch 1 closed `Ute`. Every PHEV
  in the dataset is an SUV or a ute, and this document previously said that if `Hatch` and `Sedan`
  stayed BEV-only that would be "a real fact about the market rather than a gap". **The survey
  disproved that.** Plug-in sedans are on sale here now and the dataset lacks them only because
  nobody researched them — go get them. Wagons are also on sale but are a deliberate scope
  exclusion, which is a different thing from a gap. Do not infer market
  facts from the shape of a dataset that was assembled from one session's recollection.
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
- **Published sources go stale in both directions, and brand sites are not exempt.** Batch 4 found
  `jeep.com.au` advertising a plug-in Grand Cherokee it no longer sells, and Peugeot Australia's
  3008 page carrying global-template "Plug-In Hybrid" strings for a car available only as a mild
  hybrid — while Land Rover appears to have deleted models it *does* still sell, its range being
  split across `landrover.com.au` and `rangerover.com/en-au`. Also live and wrong on the day:
  Cayenne Turbo S E-Hybrid on CarExpert, Compass 4xe on CarsGuide, and the Eclipse Cross PHEV
  (discontinued March 2025) in an April 2026 roundup. Corroborate across a brand page *and* an
  independent Australian source before concluding either "on sale" or "withdrawn".
- **The dev-server cache is a real trap and it bit again in batch 5.** A `node server/index.js`
  from an earlier session was still holding port 3000, and `ps aux | grep` did not surface it —
  only `lsof -nP -iTCP:3000 -sTCP:LISTEN` did. Worse, `npm start` printed "Listening on 3000" and
  exited 0 without ever taking the port, so the log looked like a successful restart while the old
  process kept serving the pre-batch dataset. **Verify the restart by the page header's
  "N brands · N models · N variants" line matching the build output**, not by the server's own log.
  Batch 5's header read `31 brands · 69 models · 183 variants`, which is what proved it.
- **The shortlist is ranked, so a new family not appearing is usually not a bug.** The page shows
  roughly five cards nearest the budget ceiling. At the default $900/mo only the RAV4 of batch 5's
  six appeared; the others needed the budget moved to where they sit ($560 for the Seal 6, $600 for
  the Sealion 5 and Starray) or a filter that selects them (7 seats for the Sealion 8). Use
  `?monthlyBudget=`, `?bodyTypes=`, `?seats=` and `?minElectricRangeKm=` to drive each new family
  onto the page individually — confirming the aggregate count alone does not prove a row renders.
- **Budget: the survey exhausted the 200-call WebSearch ceiling on its own.** It finished via
  WebFetch against known URLs. Treat a survey as a whole session's work, not a spare slot in a
  research batch — and note that the four family agents in batch 4 each cost 24-62 tool calls,
  so a six-family batch remains the right size.
- **Usable battery capacity is usually unpublished, and derivation direction matters.** Of the
  families checked so far only Audi and Land Rover publish a net figure (`25.9 (20.7)` and
  `19.2 (15.4)`). Lexus, Mitsubishi, Volvo, BMW and Mercedes publish gross only. Where it must be
  derived, derive `batteryKwh` from the two independently sourced numbers — it is read by nothing
  but the cross-check — rather than deriving the consumption, which is what makes the check
  tautological. Say which was which in the report.
