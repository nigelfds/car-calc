# PHEV research wave — batch plan

Prepared 2026-07-28. **Batches 1-4 complete.** Batches 5-8 outstanding.

**The wave is not finished. It is roughly 40% of the market.** Batch 4's fifth agent surveyed
what is actually on sale rather than researching a family, and the answer changed the plan: the
22 families this document was built from came from one session's recollection and were never
checked against the market. See [The survey](#the-survey--why-there-is-a-batch-5) below.

The calculation side of PHEV support is finished and merged. This is data work only: no code
change should be needed for any family below. `node scripts/build-dataset.js` validates every row,
and a row it rejects is wrong — fix the row, not the schema.

## Where the dataset stands

After batch 4: 31 brands, 63 families, 171 variants.

| Body type | BEV | PHEV |
|---|---|---|
| SUV | 97 | 49 |
| Hatch | 10 | 0 |
| Sedan | 7 | 0 |
| Ute | 0 | 8 |

Twenty-three PHEV families. **Ute is no longer an empty filter** — it was offered in step 1 and matched
nothing at all until batch 1 landed, and Australia's plug-in ute segment being entirely PHEV is why
no amount of EV research could have filled it.

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

**The empty PHEV `Sedan` cell is likewise no longer a fact about the market.** The BYD Seal 6 sedan
(batch 5) and Mercedes C 350e (batch 8) are both plug-in sedans. Do not conclude from the table
above that plug-in hybrids are only SUVs and utes — conclude that the dataset has only researched
SUVs and utes.

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

## Batch 5 — volume sellers

Highest volume, highest confidence, and cheap enough that the numbers actually change a
recommendation. **Verify every grade name against the live Australian configurator before
dispatching** — five of ten failed that test in batches 3 and 4.

| Family | `familyId` | Expected plug-in grade — confirm, don't assume |
|---|---|---|
| Toyota RAV4 PHEV | `toyota-rav4-phev` | XSE 2WD / XSE AWD / GR Sport AWD, ~$58,840-$66,340. The most important family in the wave. RAV4 also sells as a conventional hybrid across most of the range — plug-in only. |
| BYD Sealion 5 | `byd-sealion-5` | Essential / Premium, from ~$33,990. Anchor against `byd-sealion-6` already in the dataset. |
| BYD Seal 6 | `byd-seal-6` | Essential / Premium, ~$34,990-$39,990. **Sedan variants only** — the Touring is a wagon and wagons are out of scope (see the scope boundary above). The sedan is the first PHEV `Sedan` in the dataset. |
| Geely Starray EM-i | `geely-starray-em-i` | Complete / Inspire, ~$37,490-$39,990. New brand to the dataset. |
| GWM Haval H6 GT PHEV | `gwm-haval-h6-gt-phev` | Hi4 PHEV, ~$52,990 **drive-away** — back out the list price. Distinct from `gwm-haval-h6-phev` already in the dataset; anchor against it and note where they genuinely differ. |
| BYD Sealion 8 | `byd-sealion-8` | Dynamic / Premium, 7 seats, ~$61,957-$76,657 **drive-away**. |

**Two warnings specific to batch 5, both worse than anything batches 1-4 faced.**

1. **Prices in the survey are a mix of MSRP and drive-away** and are leads, not values. CarExpert
   quotes drive-away Sydney (7-10% above list), CarsGuide quotes MRLP. The brief already warns that
   drive-away is the most common `listPrice` mistake; in batch 5 it is the *default* for several
   families.
2. **Range provenance will be worse than batch 3, and the batch-3 rescue will not work.** Chinese
   brands quote NEDC almost universally — Tank 300 "115km", Tank 500 "120km", Omoda 9 and Jaecoo J8
   both "169km", Tiggo 9 "~170km". What saved five families in batch 3 was the European or UK press
   pack for the same model year, and **for these brands there is no European press pack**. Expect
   "no WLTP exists" to be the honest answer more often, and require the agent to say so explicitly
   rather than passing NEDC off as WLTP.

## Batches 6-8 — outline

Not yet planned in detail; grade names below are unverified leads from the survey.

- **Batch 6 — mainstream.** Chery Tiggo 9 Super Hybrid · Jaecoo J8 SHS · Omoda 9 SHS ·
  VW Tiguan eHybrid · VW Tayron eHybrid · Skoda Kodiaq PHEV. Note **Skoda Australia dropped the
  "iV" suffix** — local badging is just "PHEV", so a row keyed to "Kodiaq iV" will never match.
- **Batch 7 — off-roaders and the rest of the European mainstream.** GWM Tank 300 Hi4-T ·
  GWM Tank 500 Ultra Hi4-T · Denza B5 · Denza B8 · Cupra Terramar VZe · Skoda Superb PHEV
  (**wagon-only — permanently out of scope, do not research**). **Verify the Denzas are true PHEVs**: they use
  BYD's DMO off-road platform and the survey could not confirm first-hand that the engine
  mechanically drives the wheels. If it does not, they are REEVs and out of scope.
- **Batch 8 — premium.** Mercedes C 350e (a **sedan**) · Mercedes GLA 250e · BMW X5 xDrive50e ·
  Porsche Cayenne E-Hybrid · Alfa Romeo Tonale · Audi A5 e-hybrid.

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

**Restart any running dev server before checking a browser.** `server/index.js` reads the dataset
once at boot and will otherwise serve the pre-batch rows, which looks exactly like an agent having
failed to write its files. Then check the new families appear with the plug-in-hybrid toggle on.
Commit the data with a message naming what each agent flagged as low-confidence — that disclosure
is the only record of which figures are soft.

**Diff rows that share a platform before committing.** Batch 3 caught the XC60 and XC90 returning
incompatible battery conventions this way. Batch 4 needed it twice: the RX inherited its
`batteryKwh` from the NX correction rather than sourcing it, and the Defender's boot figures used a
different measurement convention from every other row. Neither is visible to the validator.

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
