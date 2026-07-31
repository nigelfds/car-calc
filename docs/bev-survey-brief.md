# BEV market survey — brief

**Prepared 2026-07-29. RUN 2026-07-29 — see [Findings](#findings) at the foot of this document.**
The preparing session had spent its 200/200 WebSearch budget, and a survey is nothing but searching,
so this was a job for a fresh session. That session ran it with five parallel surveyors split by
brand group. Everything above this line is the brief as written before the survey; it is kept
unchanged so the leads can be scored against what was actually found.

**Headline: the dataset holds about 37% of the battery-electric market. Roughly 68 families are
missing, which is twelve batches — a wave larger than the PHEV one.**

**Wave progress: batches 1, 2, 3, 4 and 5 done (1 and 2 on 2026-07-30, batches 3, 4 and 5 on
2026-07-31). 70 of ~111 families held, ~63%. Seven batches left.**

## Why this exists

The battery-electric dataset — 114 variants across 40 families, 24 brands, all sourced 26–27 July
2026 — was assembled from one session's recollection of what was on sale. It has never been checked
against the market.

That is the same method that built the PHEV wave plan, and the PHEV wave plan **missed the Toyota
RAV4 PHEV**: Toyota Australia's first-ever plug-in, on the best-selling nameplate in the country,
with Toyota expecting one in three RAV4s sold to be it. It was found only when batch 4 ran an actual
market survey, which also established that the plan covered about 40% of the plug-in market rather
than nearly all of it.

So the question this survey answers is not "are the 40 families right" — they were researched
properly and validate cleanly. It is **"what isn't in the list at all, and how much is missing."**
Nobody knows, and the recalled-list method has already been shown to miss something enormous.

This matters more than the PHEV gap did. The site is called "What's the best EV I could get?" —
battery-electric coverage is the product, not an extension of it.

## The task

Establish which **battery-electric passenger vehicles are on sale new in Australia today**, and
return a list with a source for each. **Write no data files.** This is a survey, not research; the
families it turns up get researched later against `docs/ev-family-research-brief.md`.

Work brand by brand rather than model by model. The failure mode being corrected is an absent
*brand*, not a missing variant — and a brand-by-brand sweep is what catches "Porsche sells electric
cars here and we have none of them", which no amount of checking the existing 40 families would
ever reveal.

## Scope — what counts

**In:** battery-electric only. A passenger vehicle a private buyer can order new from an Australian
dealer today.

**Out, and do not spend time on:**

- Plug-in hybrids and range-extenders (REEV/EREV). Those are the other dataset; `docs/phev-research-wave.md` tracks them.
- Conventional and mild hybrids.
- **Wagons.** A deliberate scope boundary — `Wagon` was removed from the app's body-type filter and
  will not return. Note any BEV wagon you find in the excluded list, but it will not be researched.
- **Commercial vans and cab-chassis-only models.** There is no honest body type for a panel van.
  A dual-cab ute is in scope and is a `Ute`; a Ford E-Transit is not.
- **Anything whose cheapest variant lists above $250,000 or below $15,000.** The schema rejects
  both. Record them in a separate "unrepresentable" list — that list is itself useful, since the
  PHEV survey found two brands (Lamborghini, Bentley) selling nothing the app can represent.
- Vehicles announced but not yet orderable. Record them as pre-launch with an expected date, so a
  later re-check pass knows where to look.

## What the dataset already has — diff against this

40 families, 24 brands. **Anything not on this list is a finding.**

| Brand | Families held |
|---|---|
| Audi | q4-e-tron |
| BMW | i4, ix1 |
| BYD | atto3, dolphin, seal, sealion-7 |
| Chery | omoda-e5 |
| Deepal | s07 |
| Ford | mustang-mach-e |
| Geely | ex5 |
| Hyundai | inster, ioniq-5, ioniq-6, kona-electric |
| Jeep | avenger |
| Kia | ev3, ev5, ev6, ev9 |
| Leapmotor | c10 |
| MG | 4, s5 |
| Mercedes-Benz | eqa, eqb |
| Mini | cooper-electric |
| Nissan | ariya |
| Polestar | 4 |
| Renault | megane-e-tech |
| Skoda | elroq, enyaq |
| Subaru | solterra |
| Tesla | model-3, model-y |
| Toyota | bz4x |
| Volvo | ex30, ex40 |
| XPeng | g6 |
| Zeekr | 7x, x |

## Leads worth checking first — these are guesses, not facts

The preparing session's recollection says the following sell battery-electric passenger cars in
Australia and appear **nowhere** in the table above. Treat every one as a lead to confirm or
disprove, exactly as the PHEV wave's family list should have been treated and was not:

**Brands possibly absent entirely:** Porsche · Genesis · Lexus · Cupra · Peugeot · Fiat · Abarth ·
Smart · Cadillac · Alfa Romeo · Mahindra · Jaecoo · Lotus · Maserati · Jaguar.

**Brands present but possibly holding only part of their range:** Polestar (2 and 3 as well as 4) ·
Volvo (EX90, EC40) · BMW (i5, i7, iX, iX2, iX3) · Mercedes-Benz (EQE, EQS and their SUVs, G580) ·
Audi (Q6 e-tron, Q8 e-tron, e-tron GT, A6 e-tron) · Hyundai (Ioniq 9) · Kia (EV4) · Nissan (the new
Leaf) · XPeng (G9, X9) · Zeekr (009) · Leapmotor (B10, T03) · Deepal (S05, E07) · BYD (Atto 2,
Dolphin Surf, Sealion 5 BEV).

**Two structural gaps to check specifically**, because both are cells the app offers and cannot
fill:

1. **`Ute` has zero battery-electric rows.** Every ute in the dataset is a plug-in hybrid. LDV,
   Foton, JAC and Riddara/Radar are the names to check.
2. **`Sedan` has only 7 variants across the whole dataset.** The PHEV survey found the equivalent
   empty cell was an artefact of nobody looking rather than a fact about the market. Assume nothing.

## What to return

1. **On sale and missing** — brand, model, approximate price span, body type, and a source. This is
   the list that becomes the batch plan.
2. **On sale and already held** — just enough to confirm the existing 40 are current. Flag any that
   look discontinued, renamed, or reduced to fewer variants; the first EV research wave found
   several families in exactly that state.
3. **Confirmed absent** — brands checked that sell no BEV here. As valuable as the positives,
   because it stops the next survey re-checking them.
4. **Pre-launch** — announced, not orderable, with expected timing.
5. **Unrepresentable** — over $250,000 or under $15,000, or commercial-only.
6. **A headline number:** roughly how many battery-electric families are on sale in Australia, and
   therefore what share of the market the current 40 represent. That single figure decides whether
   this is a two-batch top-up or a wave the size of the PHEV one.

## Paste this into a new session

```
Run the battery-electric market survey for car-calc.

Read docs/bev-survey-brief.md first — it is the task, the scope boundaries, and
the 40 families to diff against.

Dispatch several general-purpose subagents in parallel, split by brand group so
they do not duplicate searches — for example: German premium; Chinese brands;
Korean and Japanese; American, British and European mainstream; and one on the
two structural gaps (battery-electric utes, and sedans). Give each its slice of
the brand list, the brief path, and the instruction to write NO data files.

Require each to return: makes and models on sale with a source and rough price,
brands confirmed to sell no BEV here, anything pre-launch with expected timing,
and anything unrepresentable under the app's $15,000-$250,000 bound.

When they return, consolidate into docs/bev-survey-brief.md under a "Findings"
heading: what is missing, what share of the market the current 40 families
represent, and a proposed batch plan sized at six families per batch — one batch
per session, which is what the 200-call search budget covers.

Do not research any family in this session. The survey is the deliverable.
```

## One caution about the answer

If the survey comes back saying the 40 families are most of the market, be suspicious rather than
relieved, and check how the surveying agents established coverage. The PHEV survey's value was that
it counted the market independently and then diffed — not that it checked whether the existing list
looked reasonable. A list always looks reasonable to the person holding it. That is precisely how
the RAV4 went missing.

---

# Findings

**Surveyed 2026-07-29.** Five parallel general-purpose agents, split by brand group: German and
European premium; Chinese; Korean and Japanese; American, British, French, Italian and Indian; and
one body-type cross-cut on the two structural gaps. Each was told to establish every brand's range
independently from a brand-level source and *then* diff against the 40, rather than checking whether
the 40 looked reasonable. No data files were written. Roughly 240 tool calls across the five.

The caution at the top of this document does not apply. The survey did not come back saying the 40
families were most of the market.

## The headline number

| | Families | After batch 1 | After batch 2 | After batch 3 | After batch 4 | After batch 5 |
|---|---|---|---|---|---|---|
| Battery-electric families on sale new in Australia today | **~112** | **~111** — the eT60 came off, see below | **~111** | **~111** | **~111** | **~111** |
| Of those, representable under the app's schema and body types | **~108** | **~107** | **~107** | **~107** | **~107** | **~107** |
| Held by the dataset | **40** | **46** | **52** | **58** | **64** | **70** |
| **Coverage** | **~37%** | **~41%** | **~47%** | **~52%** | **~58%** | **~63%** |
| Missing and researchable | **~68** | **~61** | **~55** | **~49** | **~43** | **~37** |
| At six families per batch | **~12 batches** | **11 batches left** | **10 batches left** | **9 batches left** | **8 batches left** | **7 batches left** |

Batch 2 found nothing withdrawn and needed no back-out, so the on-sale and representable figures are
unchanged. All six families were `SUV`, so `Sedan` and `Ute` are exactly where batch 1 left them.

Batch 3 also found nothing withdrawn — all six were orderable, including the Geely EX2 whose on-sale
status was the batch's stop condition. Three `Hatch` and three `SUV`, so `Sedan` and `Ute` are again
untouched. **The wave has now passed the halfway mark.**

Batch 4 likewise found nothing withdrawn — all six orderable, including the Forthing Taikon 5, which
the survey had flagged as a low-confidence pre-launch call and which is in fact on sale. Five `SUV`
and one `Sedan` (the MG IM5), so `Ute` is untouched and `Sedan` gains its first family since batch 1.
**Measured after batch 4: 163 battery-electric variants across 64 families — SUV 122/46, Sedan 20/9,
Hatch 16/7, Ute 5/2.** That measurement also settles the discrepancy batch 2 flagged and could not
resolve: the `Sedan` count now reconciles exactly, at 20 variants across 9 families.

Batch 5 also found nothing withdrawn — all six orderable, including the three the batch settled
before dispatch (Hyundai Elexio, Subaru Uncharted, Subaru Trailseeker). All six are `SUV`, so
`Sedan` and `Ute` are untouched for the second batch running. **Measured after batch 5: 174
battery-electric variants across 70 families — SUV 133/52, Sedan 20/9, Hatch 16/7, Ute 5/2.**

The representable figure counts people movers, per the body-type decisions below. Only four
vehicles on sale are unrepresentable: three above the $250,000 ceiling and one two-seat roadster.

Per slice, showing the diff was not evenly distributed:

| Slice | On sale | Held | Missing | Coverage |
|---|---|---|---|---|
| German + European premium | ~47 | 12 | 32 | 26% |
| Chinese | 30 | 13 | 17 (13 representable) | 43% |
| Korean + Japanese | 23 | 11 | 12 | 48% |
| American / British / French / Italian / Indian | ~12 | 5 | 6 | 42% |

The PHEV survey found 23 of ~50, or 46%. This is worse, and it matters more — battery-electric
coverage is the product, not an extension of it.

## The RAV4-shaped finding

**Toyota HiLux BEV.** Battery-electric double-cab pickup, $76,490 (SR) to $82,990 (SR5), on sale
since May 2026. Toyota's first battery-electric ute, on the nameplate that has led or near-led the
Australian sales charts for a decade. The dataset has **zero** battery-electric utes.

It is the same failure pattern as the RAV4 PHEV, on the same brand, found the same way: not by
checking the existing list, but by counting the market. Source:
[CarExpert](https://www.carexpert.com.au/car-news/2026-toyota-hilux-bev-new-electric-ute-priced-for-australia).

## Whole brands absent from the dataset that sell BEVs here today

This is the finding the brand-by-brand method was designed to produce. Eleven brands, 24 families,
none of them represented at all:

| Brand | Families on sale | Cheapest |
|---|---|---|
| **Porsche** | Taycan, Macan Electric, Cayenne Electric | $124,100 |
| **Volkswagen** | ID.4, ID.5 | $59,990 |
| **Cadillac** | Optiq, Lyriq, Vistiq — **sells only BEVs in Australia** | ~$80,000 |
| **Genesis** | GV60, GV70 Electrified, G80 Electrified | $88,300 |
| **GAC / Aion** | Aion UT, Aion V | $31,990 |
| **Smart** | #1, #3 | $49,990 |
| **KGM** (ex-SsangYong) | Torres EVX, Musso EV (ute) | ~$58,000 d/a |
| **Lotus** | Eletre, Emeya | $189,900 |
| **GWM** | Ora 5 | $33,990 |
| **Lexus** | RZ | $84,500 |
| **Mazda** | 6e | $49,990 |
| **Suzuki** | e Vitara | ~$46,990 |
| **Cupra** | Tavascan | $55,490 |
| **Alfa Romeo** | Junior Elettrica | $57,900 |
| **Maserati** | Grecale Folgore | ~$207,500 |
| **Forthing** | Taikon 5 BEV | $38,990 |
| **Jaecoo** | J5 EV | $35,990 |

Cadillac deserves its own line: it is a BEV-only brand in Australia, all three families sit inside
the price bounds, and it appears nowhere in the dataset.

**Settled by batch 2 (2026-07-30):** three of these brands are now held. **Cadillac is complete** —
Optiq, Lyriq and Vistiq all researched and written, so the BEV-only brand is fully represented.
**Volkswagen** now holds both BEV families (ID.4, ID.5), leaving only the ID. Buzz in batch 12.
**KGM** is complete across both waves — Musso EV in batch 1, Torres EVX in batch 2.

**Settled by batch 3 (2026-07-31):** two more brands are now held, both complete. **GAC/Aion is
complete** — Aion UT and Aion V are its whole BEV range here, and the brand went from wholly absent
to fully represented in one batch. **GWM is complete on BEVs** — the Ora 5 is its only battery-
electric family, the old Ora hatch it replaced being discontinued. **Twelve of the seventeen brands
in this table are still absent.**

**Settled by batch 4 (2026-07-31):** two more, both complete. **Forthing is complete** — the Taikon 5
is its only Australian family, and only its two battery-electric grades are in scope. **Jaecoo is
complete on BEVs** — the J5 EV is its sole battery-electric model, the rest of the range being petrol
and super-hybrid. The dataset now holds 37 brands. **Nine of the seventeen brands in this table
remain absent:** Porsche, Genesis, Smart, Lotus, Lexus, Suzuki, Cupra, Alfa Romeo and Maserati.

That is nine, not the ten a reader would get by subtracting batch 4's two from the "twelve" recorded
above. The batch 3 figure was off by one: it did not count **Mazda**, whose 6e was researched in
batch 1, so eleven were absent after batch 3, not twelve. Corrected here rather than left to
propagate.

**Settled by batch 5 (2026-07-31):** two more, both complete on BEVs. **Suzuki** goes from no row of
any kind to its whole battery-electric range — the e Vitara is its only BEV family here. **Lexus is
complete on BEVs** — the RZ is its only battery-electric family, the rest of the range being petrol
and hybrid. The dataset now holds 38 brands. **Seven of the seventeen brands in this table remain
absent:** Porsche, Genesis, Smart, Lotus, Cupra, Alfa Romeo and Maserati.

**One correction to this table itself, in the same shape as the Mazda one above.** It is headed
"whole brands absent from the dataset", and **Lexus was never absent from the dataset** — it has
held `lexus-nx-phev` and `lexus-rx-phev` since the PHEV wave. What was absent was Lexus's
*battery-electric* range. The table conflates "sells a BEV we do not hold" with "brand we do not
hold", and it has now mis-stated that twice. The brand count moves by one this batch, not two:
37 → 38, because only Suzuki is genuinely new.

Batch 4 also closed the wave's largest single-brand hole. **MG went from 2 BEV families to 5** —
`mg-4` and `mg-s5` joined by `mg-s6`, `mg-im5` and `mg-im6` — and the **IM sub-brand, previously
unrecorded in any form, is now held in full**.

## The two structural gaps — both verdicts are "nobody looked"

### `Ute` — the cell is empty because nobody looked. Confidence: high.

Three battery-electric dual-cab utes are orderable by a private buyer today, with a fourth in
runout. CarExpert's own July 2026 round-up lists all three; this was one article away from being
found.

| Model | Price | Note |
|---|---|---|
| KGM Musso EV | $60,000–$64,000 d/a | Dual-cab only. On sale since 1 Dec 2025, explicitly priced for private buyers |
| Toyota HiLux BEV | $76,490–$82,990 | Double-cab pickup. Cab-chassis variant out of scope, pickup variants in |
| LDV eT60 | $92,990 | ~~Runout, verify.~~ **VERIFIED NOT ON SALE, 2026-07-30 — batch 1. Do not re-check.** See the batch 1 record |

The Deepal E07 was surveyed as a fourth candidate — a transformable body that CarExpert files under
electric utes and Chasing Cars files under mid-size SUVs. **It has been decided as an `SUV`**, so it
does not fill this cell.

The gap is therefore narrower than it first looked: **two confirmed families, and a third only if a
dealer confirms the eT60.** But "Toyota sells a battery-electric HiLux and the app cannot show a
single electric ute" is exactly the miss this survey existed to catch, and two families are enough
to make the `Ute` filter honest where zero is not.

**Settled by batch 1: it is two families, not three.** Both were researched and written; the eT60
was verified off the list. `Ute` now holds 5 battery-electric rows.

### `Sedan` — the cell is thin because nobody looked, and it is the larger gap. Confidence: high.

The dataset holds 4 BEV sedan families (Model 3, Seal, Ioniq 6, i4) out of roughly 15 on sale —
about **26%**. Eleven missing, spanning $49,990 to $219,900, and including the two cheapest cars in
the segment:

**Batch 1 took four of the eleven** (Kia EV4, Mazda 6e, Polestar 2, Mercedes CLA EV), and **batch 4
added a family the survey never listed — the MG IM5**, so `Sedan` now holds **9 families, 20
variants** (measured, not asserted). The IM5 is a genuine addition to the segment count rather than a
reallocation, so the denominator moves too: about 9 of ~16, roughly 56%. Seven of the survey's
original eleven are still missing, all of them premium:
Volvo ES90 · Genesis G80 Electrified · BMW i5 · Porsche Taycan · Audi e-tron GT · Mercedes-Benz EQS
Sedan · Mercedes-Benz EQE Sedan. The two cheapest cars in the segment are now both in.

Mazda 6e · Kia EV4 · Polestar 2 · Mercedes-Benz CLA EV · Volvo ES90 · Genesis G80 Electrified ·
BMW i5 · Porsche Taycan · Audi e-tron GT · Mercedes-Benz EQS Sedan · Mercedes-Benz EQE Sedan

Kia EV4 and Mazda 6e both undercut the Model 3. Polestar 2, Genesis G80, Taycan and e-tron GT have
been on sale here for *years* and were simply never in the recalled list — the body-type cross-cut
earned its slot by finding those four, which a brand sweep alone might have rationalised away.

**Settled: `Sedan` includes four-door liftbacks and fastbacks.** So Mazda 6e, Polestar 2, Volvo
ES90, Audi e-tron GT and Porsche Taycan are all `Sedan`, consistent with the BMW i4 Gran Coupé the
dataset already holds. All eleven missing families stand.

**Still open, and it costs one batch slot:** is the Mercedes EQE Sedan still orderable in Australia?
Mercedes is dropping it globally during 2026. Verify before spending the slot.

## Body-type decisions

Three calls the survey surfaced, now made. They are recorded here because they are the kind of
decision that silently reverses itself two waves later if nobody wrote it down.

| Question | Decision |
|---|---|
| Does `Sedan` cover four-door liftbacks and fastbacks? | **Yes.** Matches the held BMW i4 Gran Coupé |
| Is the Deepal E07 a `Ute` or an `SUV`? | **`SUV`** |
| Where do people movers go, given there is no such body type? | **`SUV`, for now** |
| Is the Subaru Trailseeker an `SUV` or a wagon (and so out of scope)? | **`SUV`** — settled 2026-07-31, batch 5 |

The Trailseeker call, since it was the one decision that could have removed a family from the wave
entirely. Subaru's page `<title>` calls it a "Large All-Terrain Electric **Wagon** with SUV
Capability" and its EV showroom card says "Large All-Electric Wagon" — but its main showroom copy
says "**This is an SUV**", it stands 1,675 mm tall on 211 mm of ground clearance, its twin is the
Toyota bZ4X Touring, and the three Australian outlets that maintain formal body-type taxonomies
(CarExpert, CarsGuide, Chasing Cars) all file it as an SUV. The wagon label appears in prose and
headlines; the SUV label appears in the fields. **Fields beat prose for a taxonomy question** — note
this is the opposite of the pricing rule, where prose beats database fields, because there the prose
carries the basis and the field is a bare number.

The people-mover decision is the one with numbers attached: it moves the XPeng X9, Zeekr 009, LDV
MIFA 9, Volkswagen ID. Buzz and Mercedes-Benz EQV out of "unrepresentable" and into the research
backlog, taking it from ~63 families to ~68 and adding a twelfth batch.

"For now" is doing real work in that decision. Five people movers filed as SUVs will compare badly
against actual SUVs on anything shape-dependent — boot litres especially, where a MIFA 9 in
seats-up configuration is not measuring the same thing as an Atto 3. If the wave finds that jars,
the honest fix is a `People Mover` body type, not a re-shuffle. Batch 12 is deliberately the last
research batch so that decision can be made with the data in hand rather than before it.

The panel-van exclusion is unchanged: the ID. Buzz Cargo and any cab-chassis or delivery variant
stay out. Only the passenger versions are in scope.

## Unrepresentable

`server/schema.js:9` defines exactly four body types: `SUV | Sedan | Hatch | Ute`. There is no
`Coupe`, no `People Mover`, no `Wagon`.

With people movers filed as `SUV`, only four vehicles on sale in Australia cannot be represented.

**Over $250,000 (schema rejects):**

| Vehicle | Price |
|---|---|
| BMW i7 | $306,900–$364,390 |
| Maserati GranTurismo Folgore | ~$450,000 |
| Maserati GranCabrio Folgore | ≥ GranTurismo; also a convertible |

**No honest body type:**

| Vehicle | Price | Why |
|---|---|---|
| MG Cyberster | $99,900–$115,000 | Two-seat roadster. No `Coupe` or `Convertible` body type, and it is not an SUV by any reading |

**Reclassified into scope by the body-type decisions above** — these were surveyed as
unrepresentable and are now batch 12:

| Vehicle | Price | Now |
|---|---|---|
| XPeng X9 | $89,900–$109,900 | `SUV` |
| Zeekr 009 | $115,900–$139,900 | `SUV` |
| LDV MIFA 9 | $106,000–$131,000 | `SUV` |
| Volkswagen ID. Buzz | $75,990–$104,990 (passenger only; Cargo excluded) | `SUV` |
| Mercedes-Benz EQV | — | `SUV` — **verify it is still on sale**, sourcing was thin |
| Deepal E07 | $64,900–$73,900 | `SUV`, not `Ute` |

**Wagons (excluded by scope, recorded so they are not re-found):** BMW i5 Touring · BYD Seal 6 EV
Touring · Toyota bZ4X Touring · Zeekr 7GT (pre-launch) · Denza Z9 GT (shooting brake, verify body).

**Commercial / conversion / fleet, all excluded:** Peugeot E-Expert and E-Partner · Ford E-Transit
and E-Transit Custom · Renault Kangoo E-Tech · LDV eDeliver 9 · Skywell EC11 · Farizon vans ·
Ford F-150 Lightning Pro (AUSEV converted; **AUSEV entered receivership March 2026**, residual stock
only) · Chevrolet Silverado EV (Autogroup International RHD conversion, no list price) · Tembo
Tusker-D (mining/fleet, private availability disputed).

**Nothing found under $15,000.** The market floor is the BYD Atto 1 at $23,990.

## Confirmed absent — checked, sell no BEV in Australia

Recording these is the point; it stops the next survey re-checking them.

**Sell cars here, but no battery-electric passenger car:** Mitsubishi · Honda · Isuzu · Peugeot
(BEV range is now vans only) · Chevrolet/GMSV · GMC · Ram · Mahindra · Ineos · Land Rover / Range
Rover · Jetour · JAC · Foton · Denza (PHEV only here) · SEAT (never sold here since 1999).

**Not in the Australian market at all:** Citroen (ceased new orders 1 Nov 2024) · Fiat and Abarth
(500e/595e sold through, not reordered) · Chrysler · Dodge · Daihatsu · Infiniti · Rivian · Lucid ·
NIO · Xiaomi · Hongqi · Changan (own badge) · Dongfeng (own badge) · Seres · Riddara/Radar · Tata ·
DS · Opel · Vauxhall.

**Jaguar sells no new cars of any kind in Australia.** Petrol sales ended 31 Dec 2025; showrooms
carry Approved Used only. I-Pace is out of production.

**Explicitly ruled out by the manufacturer for Australia — do not re-check:**
Ford Ranger BEV (Ford AU says the battery tech is not up to it; PHEV instead) · Riddara RD6 BEV
(Australian version will be PHEV-only) · Audi A6 / S6 e-tron (**Audi Australia cancelled the local
launch**) · Volkswagen ID.7 ("not for the Australian market") · standard Renault 5 E-Tech (fails
ADR 34 centre-rear top tether; Renault declined the ~$4.9m fix) · Tesla Model S and Model X
(withdrawn 2020–23, now globally discontinued) · Tesla Cybertruck (orders closed outside North
America) · Ford Puma Gen-E (cancelled for Australia) · Cupra Born (discontinued locally, not
returning) · Volvo EC40 (axed locally).

## Pre-launch — announced, not orderable

For a later re-check pass. Nearest first.

| Model | Expected | Indicative price |
|---|---|---|
| Leapmotor B05 | End Aug 2026 — **weeks away** | $35,990–$38,990 d/a |
| Mazda CX-6e | Sept 2026 showrooms; pre-orderable now | $53,990–$56,990 |
| Deepal S05 | "Final stages" as of late July 2026 | ~$40k–$45k |
| Honda Super-One | 2H 2026 — would be Honda's first BEV here | ~$33,000–$38,900 (leaked) |
| Smart #5 | Oct–Dec 2026 | from low $60,000s |
| XPeng G9L | Q4 2026 deliveries | $76,800–$84,800 |
| Mercedes-Benz GLC with EQ Technology | Late 2026 | TBA |
| Denza Z9 GT | Q3 2026 | $100k+ |
| Volvo EX60 | Late 2026 – early 2027 | TBA |
| Alpine A390 | Late 2026 – early 2027 — brand's Australian return | TBA |
| NIO Firefly | H2 2026 | >$40k |
| Hongqi range | H2 2026 | TBA |
| Skywell BE11 | Paused for an 800V facelift; unconfirmed | $48,990–$52,990 (2025) |
| MG U9 EV (ute) | Late 2026, unconfirmed | TBA |
| Hyundai Ioniq 3 | Q1 2027 | ~$40,000 |
| Toyota C-HR BEV | Mid-2027 | ~$57,390–$66,000 |
| Isuzu D-Max EV (ute) | Unconfirmed by Isuzu Ute Australia | ~$95k–$115k |
| Mahindra BE 6 / XEV 9e | ~2027 | TBA |
| Xiaomi SU7 | 2027 | TBA |
| Skoda Epiq | End 2027 | ~$34,000 |
| **Nissan Leaf (3rd gen)** | **Delayed indefinitely (March 2026)** | — |
| LDV eTerron 9 (ute) | **Possibly shelved** — wiped from LDV's Australian site | — |
| Kia Tasman EV | Sources conflict badly (2026 vs 2030); Kia "still mulling" | — |

## The 40 held families are current — but the price data is not

No held family is discontinued. Two problems surfaced instead, and both are maintenance work rather
than research:

**1. One family is misnamed.** `chery/omoda-e5` is now sold as the **Chery E5** — Omoda has been
split off as a separate sub-brand. The `familyId`, make and model are all stale.

**2. Prices across the dataset are stale by up to $14,500,** because 2026 has been a price-war year:

| Family | Change |
|---|---|
| Hyundai Kona Electric, Ioniq 5, Ioniq 6, Inster | Cut hard in 2026 — Kona now $46,000–$63,000, Ioniq 5 $68,200–$83,700, Inster $38,990 d/a |
| Volvo EX30, EX40 | Cut $7,000–$11,300 |
| BMW iX1 | Cut ~$8,000, now from $77,900 |
| Renault Megane E-Tech | Cut ~$10,000 |
| XPeng G6 | Cut $3,000, now $54,800–$59,800 |
| Cadillac Lyriq | Cut $32,000 permanently (not held, but shows the market) |

**3. Four held families have grown variants** the dataset will not have:

| Family | Added |
|---|---|
| Hyundai Ioniq 6 | **Ioniq 6 N**, $115,000, 478kW |
| BMW i4 | **M60 xDrive**, $139,900 |
| MG 4 | **Urban** entry grade, $31,990 d/a; whole range restructured Apr 2026 |
| Kia EV9 | **GT** grade added (range now Air/Earth/GT-Line/GT) |

> **Checked against the dataset 2026-07-30: three of these four are already held.**
> Only the i4 M60 is outstanding, and it contradicts the i4's own family record. Verified by reading
> `data/vehicles/*.json`, not by re-searching the market.
>
> | Claim | Actually held | Verdict |
> |---|---|---|
> | Ioniq 6 N | `N` $115,000, 487km — the family's **only** row | Already held. See the note below — this one is wrong in both directions |
> | MG 4 Urban | `Urban 43` and `Urban 54`, alongside `Essence 64` and `XPower` | Already held |
> | Kia EV9 GT | `GT AWD`, alongside Air RWD / Earth AWD / GT-Line AWD | Already held |
> | BMW i4 M60 xDrive | Not held — `eDrive35` $88,900 is the only row | **Unresolved, needs a real check** |
>
> **The Ioniq 6 note is stale in both directions.** It reads as though the dataset holds the
> mainstream grades and is missing the N. The reverse is true: the N is the only row, because
> `data/families/hyundai-ioniq-6.json` records that Hyundai **withdrew the Dynamiq and Epiq grades
> in the first half of 2026** after 1,214 local sales, and has not confirmed timing for the
> facelifted non-N cars. Sourced, among others, to a CarsGuide piece titled "standard Hyundai Ioniq 6
> electric car pulled from sale". So there is nothing to add here, and adding the base grades would
> invent cars nobody can order — the failure mode the research brief warns about hardest.
>
> **The i4 M60 needs settling before a slot is spent on it,** because two records disagree.
> `data/families/bmw-i4.json` (sourced 2026-07-26) says BMW "pared the local range back to this
> single grade for 2026, dropping the eDrive40 and M50", citing EV Central's "BMW i4 range trimmed in
> Australia… more expensive models follow ICE 4 Series out the door". A $139,900 M60 arriving *after*
> that trim is possible, but it is the opposite of what the held record says. Confirm against BMW's
> own configurator before writing anything; if the M60 is not orderable, correct this table instead
> of adding a row.

**4. One held family needs its powertrain confirmed:** `leapmotor/c10` is sold here as both a BEV
and a REEV. Confirm the dataset holds the battery-electric one.

> **Settled 2026-07-30: the dataset holds the BEV.** All three rows carry BEV-sized batteries and
> ranges — Style 69.9kWh/420km, Design LR 81.9kWh/510km, AWD Sports+ 81.9kWh/437km — where the C10
> REEV pairs a ~28kWh pack with a petrol generator and a far shorter electric range. The family
> summary describes it as an electric SUV set against the Model Y and EV5, and cites a "2026 BEV
> Design" review. No `powertrain` field is present on the rows, which `data/schema.js` reads as
> `bev`, and that is correct here. No action.

**5. Two held families are on borrowed time:** Mercedes EQA and EQB are being replaced by the
CLA/GLC EQ generation, and the Mini Cooper Electric is in run-out with stock quoted only "until the
end of the year".

**6. A held family with one expensive variant is not evidence of a gap.** Added 2026-07-30, after a
review of the dataset flagged `hyundai-ioniq-6` (N only, $115,000) and `bmw-i4` (eDrive35 only,
$88,900) as families whose affordable grades had been missed. Both are correct: the Ioniq 6's
mainstream grades were withdrawn from sale and the i4's were dropped for 2026, and both findings are
recorded in the family summaries with sources. Scanning for "one row, dear" finds precisely the two
families where a culled range is the right answer, so the heuristic is worse than useless — it points
at the families most likely to be invented back into existence. Read the family summary before
concluding anything is missing; a withdrawn grade looks identical to an unresearched one from the
variant table alone. Four held families have a single variant priced over $80,000, and all four are
right: `hyundai-ioniq-6` and `bmw-i4` by culling as above, `cadillac-vistiq` (Platinum only) and
`cadillac-optiq` (Sport only) by the brand's local lineup, exactly as the batch 2 brief specified.

## Proposed batch plan — 12 batches, six families each

Same constraint as the PHEV wave: **one batch per session**, because six families at 20–35 searches
each is 120–210 searches against a 200-call budget. Every family below is a **lead, not a fact** —
the same rule as `docs/phev-research-wave.md`. If a family is not on sale at the research date,
write no files and report the finding with evidence.

Sequencing principle: structural gaps first, then absent brands with volume, then depth at brands
already held, then the top end. The app is more wrong when it can show a buyer *no* electric ute
than when it is missing a third Porsche.

### Batch 1 — the structural gaps — **DONE 2026-07-30**
Fills the empty `Ute` cell and the cheap end of `Sedan`. Highest value in the wave.

**All six landed: 15 variants. `Ute` went from zero battery-electric rows to five; `Sedan` from 4
BEV families to 8. The eT60 verification came back negative — see the batch 1 record below.**

| Family | Note |
|---|---|
| Toyota HiLux BEV | `Ute`. Pickup variants only — the cab-chassis is out of scope. HiLux also sells as diesel; price the BEV only |
| KGM Musso EV | `Ute`. Prices are quoted drive-away — convert |
| Kia EV4 | `Sedan`. Australia gets the sedan; the hatch is not confirmed here |
| Mazda 6e | `Sedan` — liftback, and liftbacks are sedans. Mazda AU's own site calls it a "hatchback"; ignore that |
| Polestar 2 | `Sedan`. Base Standard Range was axed for MY27, so the price floor moved to $66,400 |
| Mercedes-Benz CLA EV | `Sedan`. The CLA also sells as a hybrid — price the EQ Technology BEV only |

**Also verify in this batch, without spending a slot:** the LDV eT60. It is the only remaining ute
lead and a dealer call settles it. If it is orderable, it is a third `Ute`; if not, write no files
and record the finding.

> **Settled 2026-07-30: NOT on sale, no files written.** LDV Australia's own model page returns HTTP
> 404 and the eT60 is absent from their current lineup (T60 MAX, Terron 9, D90, MIFA 9, eDeliver
> vans). Third-party aggregators still carry price pages, but drive-away only at $99,343 with no
> list price anywhere. Fewer than 100 sales in two years, and the eTerron 9 that was to replace it
> has itself been wiped from LDV's Australian site. Per the research brief, a family the
> manufacturer no longer lists is not on sale.

### Batch 2 — absent volume brands — **DONE 2026-07-30**

**All six landed: 9 variants. Volkswagen goes from zero BEV rows to four, and Cadillac — a BEV-only
brand here — is now held in full. See the batch 2 record below.**

| Family | Note |
|---|---|
| Volkswagen ID.4 | VW has zero BEV rows despite selling two families here |
| Volkswagen ID.5 | Coupe-liftback body of the ID.4 — `SUV` |
| Cadillac Optiq | Cadillac is BEV-only in Australia and wholly absent |
| Cadillac Lyriq | Took a permanent $32,000 cut — use current pricing |
| Cadillac Vistiq | Platinum grade only |
| KGM Torres EVX | Prices quoted drive-away. Pairs with the Musso EV researched in batch 1 |

### Batch 3 — the cheap Chinese end — **DONE 2026-07-31**

**All six landed: 12 variants. GAC and GWM both go from zero BEV rows to complete. The Geely EX2
stop condition passed — it is orderable. See the batch 3 record below.**

| Family | Note |
|---|---|
| BYD Atto 2 | |
| BYD Atto 1 | $23,990 — the market floor, and the app's cheapest possible BEV |
| Geely EX2 | Orders opened days before the survey; re-confirm on-sale status |
| GAC Aion UT | Whole brand absent |
| GAC Aion V | |
| GWM Ora 5 | Replaced the axed Ora hatch. Do not research the old hatch |

### Batch 4 — MG's missing range, plus Chinese remainder — **DONE 2026-07-31**

**All six landed: 13 variants. MG goes from 2 BEV families to 5 and the IM sub-brand is now held in
full; Forthing and Jaecoo both go from zero BEV rows to complete. The Forthing Taikon 5's on-sale
status — the survey's own low-confidence call — was settled before dispatch and it is on sale. See
the batch 4 record below.**

| Family | Note |
|---|---|
| MG S6 EV | MG is the biggest single-brand hole: 4 of 6 families absent |
| MG IM5 | `Sedan`. The whole IM sub-brand is unrecorded |
| MG IM6 | |
| Leapmotor B10 | Confirm BEV, not REEV |
| Forthing Taikon 5 | BEV variants only — the range mixes BEV and EREV |
| Jaecoo J5 EV | |

### Batch 5 — Korean and Japanese mainstream — **DONE 2026-07-31**

**All six landed: 11 variants. Suzuki goes from no row of any kind to complete, and Lexus from zero
BEV rows to complete. The Trailseeker's wagon-boundary call was settled as `SUV` before dispatch.
See the batch 5 record below.**

| Family | Note |
|---|---|
| Hyundai Ioniq 9 | |
| Hyundai Elexio | |
| Lexus RZ | Lexus wholly absent. Prices cut by up to $42,000 in 2026 |
| Subaru Uncharted | Single variant |
| Subaru Trailseeker | **Wagon-boundary call** — Subaru and CarExpert say SUV, WhichCar says off-road wagon |
| Suzuki e Vitara | Intro pricing expired 1 Jul 2026; current prices are $2–3k higher |

### Batch 6 — BMW's missing range, plus European mainstream
| Family | Note |
|---|---|
| BMW iX3 | Neue Klasse. Entry iX3 40 arrives Q4 2026 — price the grades on sale now |
| BMW iX2 | |
| BMW iX | |
| BMW i5 | Sedan only. The Touring is a wagon and is out |
| Renault Scenic E-Tech | New family at a brand already held |
| Alfa Romeo Junior Elettrica | Single variant, $57,900 |

### Batch 7 — Mercedes-Benz
| Family | Note |
|---|---|
| Mercedes-Benz EQS Sedan | Refreshed EQS starts Q4 2026; the family is in transition |
| Mercedes-Benz EQS SUV | |
| Mercedes-Benz EQE SUV | Being dropped globally during 2026 — confirm on-sale first |
| Mercedes-Benz EQE Sedan | **Verify orderable before spending the slot.** Same global drop |
| Mercedes-Benz G 580 with EQ Technology | $249,000 — **$1,000 under the schema ceiling.** Verify the price before writing; a small rise makes it unrepresentable |
| Skoda Enyaq Coupe | Body extension of a held family, not a new family. Cheap slot to fill out the batch |

### Batch 8 — Audi, Cupra, Mini, Smart
| Family | Note |
|---|---|
| Audi Q6 e-tron | Includes Sportback body |
| Audi Q8 e-tron | **Verify orderable.** Production ended Feb 2025; local listings may be run-out stock |
| Cupra Tavascan | Cupra's only BEV — the Born is discontinued here |
| Mini Aceman | |
| Mini Countryman Electric | E and SE All4 |
| Smart #1 | Whole brand absent |

### Batch 9 — premium SUVs and Genesis
| Family | Note |
|---|---|
| Smart #3 | |
| Volvo EX90 | |
| Volvo ES90 | Sedan |
| Polestar 3 | |
| Genesis GV60 | Includes the GV60 Magma performance grade |
| Genesis GV70 Electrified | Reported reduced to a single grade — verify |

### Batch 10 — the top end
Every family here needs variant-level pricing, because several span the $250,000 ceiling: the
cheapest variant qualifies, the flagship does not.

| Family | Note |
|---|---|
| Porsche Taycan | Sedan, 8 variants. Base $175,100; Turbo GT ~$442k is unrepresentable — split at the ceiling |
| Porsche Macan Electric | |
| Porsche Cayenne Electric | **Verify orderable today** — first deliveries were Q3 2026 |
| Audi e-tron GT | Sedan. S / RS / RS Performance |
| Genesis G80 Electrified | Sedan. **Weakest single source in the survey** — confirmed only via a Genesis AU model listing, and dead in North America. Verify before committing the slot |
| Polestar 5 | Sedan GT |

### Batch 11 — the tail, plus the maintenance backlog
Not six new families — this batch is deliberately mixed, because the tail is thin and the
maintenance debt is real.

| Item | Note |
|---|---|
| Lotus Eletre | Top R variant is quoted at both $279,990 and $315,000; base $189,900 qualifies |
| Lotus Emeya | `Sedan` |
| Maserati Grecale Folgore | **Verify orderable, not run-out.** Maserati has retrenched hard on EVs and told dealers to discount Folgore stock ~43% |
| Maintenance sweep | **Shrunk 2026-07-30 — see the checks under "the price data is not current".** Still to do: rename `omoda-e5` → Chery E5; settle whether the BMW i4 M60 is orderable at all (two records disagree) and add it only if it is; re-price XPeng G6. **Already done, do not redo:** Ioniq 6 N, MG4 Urban and Kia EV9 GT are all held; Leapmotor C10 is confirmed BEV; Kona ($46,000–$63,000) and Ioniq 5 ($68,200–$83,700) already match this survey's own "now" figures exactly. **Still worth checking:** the Inster, where this survey quotes $38,990 *drive-away* against a held list of $39,000 — a drive-away figure is not a list price, and that one backs out to about $36,574, so either the held row is $2,400 high or the survey is quoting a grade the dataset does not hold. Volvo, BMW iX1 and Renault re-pricing is unverified either way |
| **e-TNGA `batteryKwh` correction — ADDED BY BATCH 5, evidenced, do not re-derive** | **Five held rows record a GROSS pack figure in a field the schema defines as USABLE.** `toyota-bz4x` (2WD, AWD, Touring AWD) and `subaru-solterra` (AWD, AWD Touring) all carry `batteryKwh: 74.7`. Toyota's European newsroom states, for the bZ4X Touring, *"a maximum gross capacity of 74.7 kWh (**71 kWh net**)"*, and Toyota USA's 2026 bZ release calls 74.7 a *"total capacity"* in those words. The correct usable figure for that pack is **71.0** — a 5.2% overstatement. Batch 5 corrected its own three families to 71.0 and did not touch these. **Do not blind-swap all five.** The `toyota-bz4x` **2WD** row needs a model-year check first: the superseded MY25 pack is a different unit at **73.1 nominal / 69.0 usable**, and 73.1 is a *nominal* figure that has already been mistaken for a usable one once during this adjudication. Sources: `https://newsroom.toyota.eu/the-new-toyota-bz4x-touring-an-suv-for-electrified-adventures/`, `https://pressroom.toyota.com/toyota-bz-all-electric-suv-adds-range-charging-and-exterior-updates-for-2026/` |

### Batch 12 — people movers, filed as `SUV`
Last of the research batches, deliberately. Every family here is only in scope because of the
body-type decision above, so running it last means the decision can be revisited with real data —
if these compare badly against actual SUVs on boot space and shape, the fix is a `People Mover`
body type, and it is cheaper to find that out at the end than to have salted it through the wave.

| Family | Note |
|---|---|
| Deepal E07 | `SUV`, not `Ute`. Also verify the March 2026 ADR 34/03 stop-sale was lifted |
| XPeng X9 | |
| Zeekr 009 | |
| LDV MIFA 9 | |
| Volkswagen ID. Buzz | Passenger versions only — Cargo is a panel van and stays out |
| Mercedes-Benz EQV | **Verify it is still on sale.** Thinnest sourcing of the six |

### Batch 13 — the re-check pass (see below)
Run after the wave. Leapmotor B05, Mazda CX-6e, Deepal S05, Honda Super-One and Smart #5 all land
inside the wave's own timeframe, so several will be on sale before the wave finishes. Re-run the
brand sweep for the pre-launch table above.

## Batch records

### Batch 1 — done 2026-07-30

Six agents, one per family, all six written. 15 variants; dataset went to 34 brands, 81 families,
207 variants. Build 0 failures, 482 tests pass. Commit `fd53d87`.

| Family | Variants and list prices |
|---|---|
| `toyota-hilux-bev` | SR Pick-Up $76,490 · SR5 Pick-Up $82,990 |
| `kgm-musso-ev` | 2WD $57,566 · 2WD Black Edge $59,513 · AWD $61,461 (all **backed out** of drive-away) |
| `kia-ev4` | Air SR $49,990 · Earth LR $59,190 · GT-Line LR $64,690 |
| `mazda-6e` | GT $49,990 · Atenza $52,990 |
| `polestar-2` | LR Single $66,400 · LR Dual $71,400 · LR Dual Performance $85,080 |
| `mercedes-cla-ev` | 200 EQ $72,200 · 350 4MATIC EQ $91,300 |

**Six things later batches need to know.**

**1. The brief's drive-away back-out formula is wrong for utes. Verified in code, not argued.**
`docs/ev-family-research-brief.md` gives `list = (driveaway - 880) / 1.042`. That is the *green
passenger* rate. `calc/onroad.js:23-28` tests `isNonPassenger` **first**, at $5.40 per $200 (2.7%),
not $8.40 (4.2%) — a ute is a goods vehicle whatever its emissions. On the Musso EV, 1.042
undershoots by $851–$909 per row and does not round-trip. **Utes: divide by 1.027. Passenger cars:
1.042, unchanged.** Always round-trip through `driveAwayPrice()` against the real tax tables rather
than trusting either constant. Batch 2's **KGM Torres EVX is a passenger SUV, so it uses 1.042** —
do not carry the ute divisor across just because it is the same brand.

**2. The grade-count failure mode has not gone away, and it now has a third shape.** Batch 1 caught
three, none of which was a wrong badge:
- *A grade that does not exist here.* The EV4's Air/Earth/GT-Line ladder looks like the EV3's
  four-row SR/LR matrix. There is no **Air Long Range** on the Australian list. Assuming platform
  siblings share a grade matrix is now a proven way to invent a car.
- *A range structure that does not cross the border.* The Mazda 6e's European two-battery mapping
  (Takumi 68.8 kWh LFP / Takumi Plus 80 kWh NMC) does not exist here — Australia gets one 78 kWh LFP
  pack across both grades. Two cars, not four.
- *A badge that exists twice on different powertrains.* There is a **petrol** CLA 200 at $68,100 and
  an **electric** CLA 200 at $72,200. Matching on the badge alone picks the wrong car. Expect this
  wherever a family sells combustion and BEV side by side — batch 7's Mercedes rows and batch 2's
  VW rows are the obvious exposures.

**3. NEDC is still the dominant defect, and it can collide numerically with the WLTP figure.**
Toyota Australia publishes **NEDC only** for the HiLux BEV: 315 km pick-up, 245 km cab-chassis. The
pick-up's true WLTP figure is **245 km** — the same number as the cab-chassis NEDC figure. Taking
Toyota's headline would have overstated range by 29%, and a checker comparing "245" against "245"
would have felt confirmed. **Matching numbers are not corroboration unless the standard and the
variant both match.** Every other batch 1 family was WLTP throughout.

**4. Sedan boot figures are mostly unpublished, and the convention now has a shape.** No Australian
outlet publishes a seats-down volume for the EV4 fastback, the CLA sedan or several held cars. The
dataset's seats-up-to-down ratios cluster by body: **notchbacks 2.2–2.4** (CLA 2.22, EV4 2.24, Seal
2.38), **liftbacks 2.7–3.2** (Polestar 2 2.70, i4 2.74, Seal 6 2.79, Mazda 6e 3.19), with the Model
3 an outlier at 1.39 on an unusually large 682 L seats-up figure. Use the ratio band for the body
shape and cap against any published sibling. This killed a sourced-but-wrong 1435 L on the EV4 —
single-sourced, and it would have given a notchback a higher ratio than every liftback held.

**5. Utes have their own field conventions. Follow them.** `isNonPassengerForVicDuty: true`
(schema-optional, consumed by `calc/compare.js:21`), `bootLitresSeatsUp == bootLitresSeatsDown` set
to tub volume, and `towKg` braked from the manufacturer's technical sheet rather than the marketing
page — KGM's marketing claims 2.3 t against its own spec sheet's 1,800 kg. Leave
`isGreenForVicDuty` unset on a BEV ute: the default is true, and `isNonPassenger` short-circuits
before it is read, so it has no numeric effect either way.

**6. Cross-row diffing earned its place, and the validator cannot do it.** Every one of the 15 rows
passed independently. The EV4 boot error was only visible against the other sedans. The tightest
consumption deviation in the batch is Polestar 2 Single Motor at **19.0%** against a 25% ceiling —
note the validator divides by the **stated** figure, not the implied one (`data/schema.js:154`), so
compute it that way when judging headroom.

**Two things to watch that batch 1 could not settle.** The CLA 350 4MATIC lists at $91,300, clearing
the $91,661 LCT/FBT threshold by **$361** — the tightest margin in the dataset, and any factory
option ordered with the car destroys the exemption. And the Polestar 2's $85,080 Performance row is
kept as a variant on the strength of separate WLTP homologation, against one source calling it an
$8,980 option; it is the row that creates that family's $75,000 straddle, so if it is wrong the
straddle is wrong with it.

**One gate not run.** The browser render check was skipped at the user's instruction — the Playwright
profile was held by a live Chrome process and the headless fallback was declined. Build, tests and a
fresh server boot all passed, but **no page-level confirmation was obtained for these six families.**
Worth a look at the start of batch 2, since a green API with a broken page has happened here before.

### Batch 2 — done 2026-07-30

Six agents, one per family, all six written. 9 variants; dataset went to **35 brands, 87 families,
216 variants** (138 of them battery-electric). Build 0 failures, 491 tests pass. No family was found
withdrawn, and — unusually — **no price in this batch had to be backed out of a drive-away figure**.
Every one of the six had a genuine list price, including the two the plan predicted would not.

| Family | Variants and list prices |
|---|---|
| `vw-id4` | Pro $59,990 · GTX 4MOTION $69,990 |
| `vw-id5` | Pro $62,990 · GTX 4Motion $72,990 |
| `cadillac-optiq` | Sport AWD $80,000 |
| `cadillac-lyriq` | Luxury AWD $90,000 · Sport AWD $90,000 |
| `cadillac-vistiq` | Platinum AWD $116,000 |
| `kgm-torres-evx` | 2WD $55,188 |

**Nine things later batches need to know.**

**1. Volkswagen Australia publishes a real primary spec document, and it can be read.** The
ID.4/ID.5 MY25 spec brochure (publication `VWPIDMY25`) carries a technical-specification table with
declared Wh/km, WLTP range, gross *and* useable battery, tare mass and luggage volumes. It is 10.4 MB
and **WebFetch refuses it on size** — the way in is `curl` followed by inflating the PDF content
streams directly, and the text renders letter-by-letter so searches need whitespace-tolerant
matching. Two agents found it independently and it settled four disputed fields. Assume a similar
brochure exists for other VW Group brands before trusting an aggregator.

**2. A figure can be manufacturer-primary and still be the wrong model year.** This batch's only
real cross-row conflict was towing, and it consumed two adjudication rounds. `1,200 kg` and
`1,400 kg` are the **pre-facelift MY24–25** European ratings **at 8% gradient**; MY26 is **1,800 kg
at 12% gradient** for both GTX bodies, which VW itself markets under a module headed *"erhöhte
Anhängelast"* (increased trailer load). ADAC's catalogue pins the changeover: ID.4 GTX 4MOTION,
production 10/2023–07/2025, 1,200 kg. The 1,800 kg attaches to the **4MOTION dual-motor drivetrain**,
not to a grade badge, which is why it appears on the European Pro 4MOTION as well as the GTX — and
why "Australia doesn't sell that grade" was not the disqualifier it looked like. Final state:
ID.4 Pro 1,000 · ID.5 Pro 1,200 · both GTX 1,800.

**3. Plug-to-wheels overhead consistency is NOT a valid cross-row test. Do not use it.** It looked
like a good way to spot a bad consumption figure, and it is not: **VW Australia's own brochure
implies 17.9% overhead on the ID.4 Pro and 12.5% on the ID.5 GTX, from the same table in the same
publication** — a 5.4-point disagreement inside the primary source. The held MEB rows already span
6.7% (Enyaq 60) to 18.5% (Q4 e-tron Sportback 45). A row sitting at either end is not evidence of
anything.

**4. "US spec presented as Australian data" is a distinct failure mode, and it hit three of three
American-brand families in one batch.** Each shape was different, so the pattern is the lesson rather
than any one instance:
- *EPA range in place of WLTP* — the Optiq's US EPA figure is ~486 km against the Australian WLTP
  425 km. Note the direction: **EPA can be HIGHER than WLTP**, so the too-good-to-be-true instinct
  that catches NEDC does not catch this. Only the label catches it.
- *A US tow rating on an Australian aggregator* — thebeep gave the Lyriq 1,588 kg (3,500 lb) where
  CarsGuide's Australian review states it has **no tow rating here**. The row is `towKg: 0`.
- *A US grade ladder inside an Australian database feed* — carsales' research pages list the Vistiq
  as two Australian grades, "Premium Luxury" and "Platinum", **with an identical price span on both
  rows**. That identical span is the tell that it is a feed artefact, not a second local grade.

For any American brand: treat every unlabelled figure as US until proven local.

**5. Australian Cadillacs are not the American cars.** GM re-specs them for ECE R100.03: the Vistiq
takes **91 kWh useable** against the US car's ~102 kWh, and the Optiq is 75 useable / 85 gross. So a
US pack figure here is not a gross-versus-useable trap, it is **a different vehicle**. Cadillac also
confirmed WLTP figures are not published for the US-market Vistiq at all.

**6. Grade counts held up everywhere, and one note was wrong in the safe direction.** Five of six
families are single- or two-grade ranges and every count was confirmed on a manufacturer or
manufacturer-adjacent listing. The Vistiq's "Platinum grade only" survived. The **Vistiq is a
six-seater, not the seven-seater the dispatching prompt asserted** — the US seven-seat bench is not
offered here, and one WebFetch summary claiming "7" was a summariser error against four sources. The
error came from the prompt, not from a source; check the prompt's own claims too.

**7. KGM's advertised price falling does not mean the list price fell.** The Torres EVX shows
$53,690 drive-away against a $55,188 RRP: that is RRP **plus** metallic paint **minus** a $5,010
time-limited factory bonus, and the RRP is unchanged since launch. Read the fine print before
recording a cut. Also: the advertised $58,000 "drive-away" is a flat **national** figure quoted
identically for Victoria and Sydney, which no per-state calculation produces — so it is not a valid
figure to back a list price out of. The Torres correctly used the **passenger** divisor 1.042, not
the Musso's ute 1.027.

**8. Distrust CarExpert's spec database on platform pairs sharing a battery.** It lists
**23.0 kWh/100km for both the Musso EV and the Torres EVX**, which share the 80.6 kWh pack, where KGM
Australia's own figure for the Torres is 18.65. One car's number propagating onto its platform-mate is
the mechanism. Same caution as the ID.4/ID.5 towing case: shared hardware invites shared figures.

**9. Two housekeeping observations, neither acted on.** The Lyriq's two grades are **identical on
every numeric field and both list at $90,000** — the restructure equalised them and they differ only
in trim, so they will read as same-price twins in any ranking. And the `Sedan` count in this document
says 18 variants where the built dataset measures **17** BEV sedan rows across 8 families; batch 2
added no sedans, so the discrepancy predates it and wants reconciling by whoever next touches those
rows.

**The cross-row diff earned its place again, and differently from batch 1.** Batch 1's catch was a
sourced-but-wrong boot figure visible only against its siblings. This batch's was a **sourced field
where both agents had manufacturer evidence and one was reading a superseded model year** — the kind
of conflict that cannot be seen from inside either row, since both passed the validator and both had
a citation. It took two rounds of putting each agent's evidence to the other. Worth budgeting for:
neither agent conceded on the first exchange, and the one that was wrong was the one arguing more
specifically.

**Judged fields, for anchoring later batches.** The three Cadillacs form a deliberate ladder rather
than a house style — insurance 2500 / 2850 / 3000 by price, curves `[1, 0.66…]` / `[1, 0.64…]` /
`[1, 0.66…]`, with the **Lyriq steepest because it alone carries the $32,000 cut's overhang**. The VW
rows sit between the Skoda Enyaq's `0.75` and the Audi Q4's `0.70` at the Tiguan PHEV's `[1, 0.72…]`,
with the ID.5 GTX one step steeper on reviewer consensus that it is the worse buy of the two grades.
The Torres EVX copies the Musso EV's steep `[1, 0.66…]` on brand-level evidence.

**The render check is now CLEARED for both batches — 2026-07-30.** All twelve families from batches
1 and 2 were confirmed rendering in a real browser against a freshly booted server, with **zero
console errors or warnings** across the whole session. Four things worth carrying forward:

**1. The stale-server warning is real and it caught us.** The server already listening on port 3000
was serving **207 variants and had `toyota-hilux-bev` but not `vw-id4`** — batch 1's data but not
batch 2's. Every check before the restart would have been a false pass. `lsof -nP -iTCP:3000
-sTCP:LISTEN` then kill and `npm start`, and re-confirm the count before believing anything.

**2. The shortlist caps at ~5 cards and ~2 per band, so "load the page and look" does not exercise a
new family.** The page must be *driven* to each one. The app reads its whole state from the query
string (`public/ui/state.js`), which makes this cheap: `?bodyTypes=SUV&minBootLitres=543&minRangeKm=522&monthlyBudget=1000`.
Only *minimum* filters exist, so a family can be isolated only from below — pick the boot and range
floors that just exclude its rivals, then tune `monthlyBudget` until it lands in a band. The
per-family URLs that worked are worth reusing next batch.

**3. One family could not be surfaced in the shortlist at all, and it is not a defect.** The **KGM
Torres EVX is Pareto-dominated** — the Leapmotor C10 is cheaper ($49,888 v $55,188) with more boot
(581 L v 465 L) and more range (510 km v 462 km), and the XPeng G6 beats it too. No filter or budget
selects it, because the ranking is right not to. Its card was instead confirmed by driving the app's
own `cardModel`/`renderCards` through the live page with the real row: it renders as *"KGM Torres EVX
2WD · 465L boot · 462km range · $55,188"* with no NaN or undefined. **Recorded honestly as a
component-level render, not a shortlist appearance.** Expect this again for any family that is
mid-pack on every axis.

**4. A pre-existing app defect surfaced during the check — raising `savings` REMOVES cars.** Nothing
to do with this batch's data (`git diff df0da91..HEAD` touches no `public/`, `calc/`, `server/` or
`scripts/` file). At the default $900/mo the shortlist shrinks monotonically as savings rise:
$0–120,000 → 5 cards, $135,000 → 3, $145,000 → 2, $200,000 → **0**, and the empty state then reads
*"Raise the budget, or add savings to make buying outright an option"* while savings are already set.
The threshold sits near the drive-away price of the dearest car in the dataset (~$140,000 on the
$129,250 Kia EV9 GT), which points at the band logic being anchored on a cash ceiling that can climb
out of the dataset. Distinct from review item 14, which is about *filter*-driven empties and is done.
Not filed in `docs/ux-review.md` — that register belongs to the UX branch's workflow.

### Batch 3 — done 2026-07-31

Six agents, one per family, all six written. 12 variants; dataset went to **36 brands, 93 families,
228 variants**. Build 0 failures, 596 tests pass. Commit `50cfa71`. Nothing was found withdrawn, and
**every one of the six families rendered in the shortlist** — no Pareto-dominated fallback was needed
this time.

| Family | Variants and list prices |
|---|---|
| `byd-atto1` | Essential $23,990 · Premium $27,990 |
| `byd-atto2` | Dynamic $31,990 · Premium $35,990 |
| `geely-ex2` | Complete $26,490 · Inspire $30,990 |
| `gac-aion-ut` | Premium $31,990 · Luxury $35,990 |
| `gac-aion-v` | Premium $42,590 · Luxury $44,590 |
| `gwm-ora-5` | Lux $31,775 · Ultra $34,655 (both **backed out** of drive-away) |

**The whole batch straddles neither FBT threshold.** Nothing here comes within $30,000 of $75,000, so
for six families the recommendation never flips on tax. The `byd-atto1` Essential at $23,990 is now
the dataset's cheapest row, displacing the MG 4 Urban 43 by $5,850.

**Seven things later batches need to know.**

**1. The drive-away trap has three distinct shapes and all three appeared in one batch.** Batch 1 and
2 each caught one; this batch caught three, and only one resembled the earlier cases:
- *A promotional drive-away numerically IDENTICAL to the list price.* GAC's own site headlines
  "Drive Away Price: from $31,990" for the Aion UT, which is exactly its list price, because the
  promotion is free on-roads. Taking the headline would have been **coincidentally right on one grade
  and wrong in kind** — and would have silently broken the moment the promo ended.
- *A correct list price under a wrong label.* A BYD dealer configurator shows the Atto 1's
  $23,990/$27,990 beneath a column headed "Drive Away Price Incl. on road costs and registration".
  The label is a generic template artefact. The tell is direction: real drive-away figures in
  circulation were *higher* ($25,760–$27,023), and a round-trip confirmed it.
- *A bonus dressed as pricing.* Geely's 12 Jul – 31 Aug 2026 launch offer is a charger and paint,
  not a discount, and correctly did not move `listPrice`.

The general rule that falls out: **check the DIRECTION of the discrepancy, not just its size.** A
figure labelled drive-away that sits below the computed drive-away is a list price mislabelled; one
that sits above is genuine.

**2. Aggregator "MSRP" is not a manufacturer RRP, and this cost a correction.** The GWM Ora 5 agent
recorded $32,490/$35,490 as sourced MSRPs from CarsGuide. That page states its figures derive from
**Glass's Information Services third-party pricing data**, and it is *unstable* — it now shows the
Lux at **$30,490**, not $32,490. CarExpert and CarsGuide both publish drive-away only; GWM Australia
publishes a Victorian drive-away and no list price anywhere. So this was the brief's back-out case
after all: $33,990/$36,990 give **$31,775/$34,655**, both round-tripping to within a dollar.
**Treat a RedBook/Glass's-derived figure as an estimate, not a source** — and note it can be a
plausible, well-shaped number ($X,490 matched GWM's own price ladder exactly), which is what made it
convincing.

**3. A reviewing session must check the agent's REASONING, not only its evidence.** The Ora 5 agent
argued the advertised drive-away sat *below* list-plus-on-roads and inferred a promotional campaign,
citing batch 2's Torres EVX as precedent. That reasoning was **circular**: the gap existed only
because of the RedBook figure the agent had itself adopted, and unlike the Torres there was no
independent evidence of a factory bonus. Both batch 1 and batch 2 caught bad *data* by cross-row
diffing; this one was caught by reading an argument. Budget for that separately — the row passed the
validator, had citations, and diffed cleanly against every sibling.

**4. Numerically colliding range figures struck twice more, in opposite directions.** Batch 1 logged
the HiLux's 245-versus-245 collision. This batch:
- *A true WLTP figure that collides with an unrelated CLTC one.* The Aion V's Australian **510 km
  WLTP** happens to equal a Chinese **510 km CLTC** figure quoted on a *smaller* pack. It was
  separated by arithmetic, not by sourcing: 510 km on 75.26 kWh implies ~14.8 kWh/100 km at the
  wheels, which is right; a CLTC 510 km on that pack would imply ~22, which is absurd for a 4.6 m FWD
  SUV.
- *The reassuring direction, which is also a check.* The EX2's Australian WLTP figures (252/345 km)
  are **lower** than the Chinese CLTC ones (310/410 km) despite the Australian car having **bigger**
  packs. Lower range on a bigger pack is the signature of a stricter standard, and is positive
  evidence the figure is genuinely WLTP.

**Use the implied-consumption arithmetic to separate standards.** It is the only test that works when
the numbers themselves match.

**5. Aggregators carry unlaunched grades WITH prices, which look exactly like real rows.** carsales
and CarsGuide both list Ora 5 **Hatch** variants with specific prices ($31,990/$34,990 d/a and
$30,490/$33,490), and GWM has announced neither pricing nor an on-sale date for the hatch. Taking
them would have produced a plausible four-row family instead of the correct two. This is a *fourth*
shape of the grade-count failure and it is nastier than the others, because a price is normally the
strongest evidence that a grade is real. **A price on an aggregator is not evidence of availability.**
Batch 2's Vistiq case (identical price spans on two rows) was the same family of defect; the tell
here was the absence of any manufacturer announcement rather than anything in the data itself.

**6. Foreign-market packs appeared in four of six families and were correctly rejected each time.**
The Atto 2's European 64.8 kWh Comfort grade; a 45.1 kWh European pack figure being served as the
Australian Atto 2's; the Atto 1's European "Boost" middle grade (Australia gets only the two
endpoints); the Aion UT's 34.8/44/50.27 kWh Chinese variants; and the EX2's Chinese 30.12/40.16 kWh
packs, which are *smaller* than the Australian car's. The pattern is now well enough established to
state plainly: **for a Chinese-brand BEV, assume the pack lineup differs from the home market until
shown otherwise.** Rule 4's framing — a foreign pack is a different car, not a gross/usable problem —
earned its place four times in one batch.

**7. `batteryKwh` usable-versus-gross is this batch's systemic soft spot.** Three of six agents named
a battery figure as their least-confident number (`gac-aion-ut` 58, `gac-aion-v` 75.26, and the Atto
2's 51.13). The cause is structural rather than sloppy: **BYD publishes a single unqualified number
for Blade packs, and GAC publishes one unqualified "Battery Capacity (kWh)"**, so the usable/gross
split can only be inferred from third-party databases that sometimes disagree. Every affected row
reconciles against its WLTP range either way, so nothing is wrong — but if a future batch finds a
manufacturer spec sheet stating usable capacity for either brand, these are the rows to revisit.

**One judged-field note, for anchoring later batches.** The two GAC families were researched by
independent agents that never communicated, and both arrived at `make: "GAC"` / `model: "Aion <X>"`,
the same curve `[1, 0.7, 0.58, 0.49, 0.42, 0.36]`, and the same documented rationale — zero Australian
resale history, ~19 dealers, no capped-price servicing. That convergence is worth more than either
agent's argument alone. The GWM Ora 5 sits one notch shallower at `[1, 0.7, 0.59, 0.51, 0.44, 0.38]`
on the strength of an established local network, and both BYDs and the EX2 take their existing brand
cluster curves unchanged (`[1, 0.74, …]` for BYD, matching the held `geely-ex5`'s 0.75 band for the
EX2). Insurance runs monotonically with price across the whole batch and joins cleanly onto the held
BYD ladder: Atto 1 1100/1200 → Dolphin 1250 → Atto 2 1300/1400 → Dolphin Premium 1400 → Atto 3 1500.

**The cross-row diff found nothing this time, and that is a result rather than a gap.** Batch 1 caught
a sourced-but-wrong boot figure; batch 2 caught a superseded model year. Here the six families share
no platform and only two share a brand, and the two BYDs independently agreed on method — both took
the **homologated WLTP combined** consumption rather than the battery÷range arithmetic several
outlets print, landing at 13–15% plug-to-wheels overhead. Per batch 2's finding that overhead
consistency is not a valid cross-row test, that agreement was read as method agreement, not as
corroboration of the numbers.

**Render check: CLEARED, and every family reached the shortlist.** Confirmed against a freshly booted
server whose header read *36 brands · 93 models · 228 variants*, matching the build exactly. **The
stale-server warning caught us again** — a server from a previous session was already listening on
port 3000 and was killed before any check was believed. Zero console errors or warnings from the app
across the whole session. The per-family URLs that worked, worth reusing:

| Family | URL query |
|---|---|
| `gac-aion-ut` | `?bodyTypes=Hatch&minRangeKm=430&monthlyBudget=650` |
| `geely-ex2` | `?bodyTypes=Hatch&minBootLitres=370&monthlyBudget=600` |
| `byd-atto1` | `?bodyTypes=Hatch&monthlyBudget=520` |
| `gwm-ora-5` | `?bodyTypes=SUV&minRangeKm=435&minBootLitres=360&monthlyBudget=620` |
| `byd-atto2` | `?bodyTypes=SUV&minBootLitres=375&minRangeKm=340&monthlyBudget=620` |
| `gac-aion-v` | `?bodyTypes=SUV&minRangeKm=505&minBootLitres=420&monthlyBudget=730` |

The technique that made this cheap: **cheap cars isolate by lowering `monthlyBudget`, not by
filtering.** Every family in this batch is near the bottom of the price range, so dropping the budget
to $520–$730 evicted the pricier rivals that were out-ranking them while leaving the target
affordable. Batch 2 had to fall back to a component-level render for the Pareto-dominated Torres EVX;
no such fallback was needed here.


### Batch 4 — done 2026-07-31

Six agents, one per family, all six written. 13 variants; dataset went to **37 brands, 99 families,
241 variants** (163 of them battery-electric). Build 0 failures, 596 tests pass. Commit `2b2a177`.
Nothing was found withdrawn. **The browser render check was NOT RUN** — see the gate note at the end
of this record.

| Family | Variants and list prices |
|---|---|
| `mg-s6` | Essence RWD $47,130 · Essence AWD $53,848 (both **backed out** of drive-away) |
| `mg-im5` | Premium $57,687 · Platinum $64,405 · Performance $74,002 (all **backed out**) |
| `mg-im6` | Premium $57,687 · Platinum $64,405 · Performance AWD $74,002 (all **backed out**) |
| `leapmotor-b10` | Style $37,888 · Design LR $40,888 |
| `forthing-taikon-5` | BEV Luxury $36,574 · BEV Exclusive $39,933 (both **backed out**) |
| `jaecoo-j5-ev` | EV Summit $35,990 |

**Eleven of thirteen rows carry a backed-out price** — by far the worst ratio of the wave, against
batch 2's zero. Four of the six families are brands that publish no Australian list price at all.

**Nine things later batches need to know.**

**1. The stop condition in the pasted prompt was STALE, and a reader following it literally would
have wasted a slot.** The prompt block below still named the Geely EX2 — batch 3's condition, already
settled. Batch 4's actual open verification was the **Forthing Taikon 5**, flagged not in the batch
table but in the "Confidence, stated plainly" section as one of two families "placed on opposite
sides of the pre-launch line with low confidence in both calls". It settled in one search: on sale
since June 2026. **The batch tables are not the only place a stop condition lives — read the
confidence section too.** The prompt block has been corrected below.

**2. A same-price badge collision across powertrains is the new worst case, and it hit twice.**
Batch 1 logged the petrol-versus-electric CLA 200 at *different* prices, which a price check
separates. This batch found two families where it does not:
- **Leapmotor prices the B10 REEV identically to the BEV, badge for badge** — Style $37,888 and
  Design $40,888 exist in both powertrains at the same figure. Matching on badge *and* price is a
  coin flip. The separators are drivetrain-dependent specs: CarsGuide lists towing 0 kg (BEV) versus
  750 kg (REEV) and boot 490/1475 versus 420/1415.
- **Forthing sells Luxury and Exclusive in both BEV and range-extender form.** The separator is
  structural rather than numeric: Forthing Australia serves them from two distinct model pages
  (`/taikon-5-electric/` and `/taikon-5-range-extender-hybrid/`), each with its own spec sheet.
**Match on the powertrain page or a drivetrain-dependent spec, never on the badge, and never on the
badge plus price.**

**3. Certification filings and configurators disagree, and the filing is not availability.** The MG
S6 appears in Australian government certification documents with a third RWD grade on a ~55 kWh pack
that is on no configurator and has no price or on-sale date. This is a **fifth shape of the
grade-count failure**, and it is the mirror of batch 3's: there, an aggregator carried an unlaunched
grade *with* a price; here, a primary-looking government source carries one *without*. Both invent a
car. Australia gets the 77 kWh pack only, in two grades.

**4. A reconstruction that fits to the cent is a formula, not a corroboration.** This batch's central
conflict was IM5-versus-IM6 on whether $60,990/$67,990/$77,990 are list or drive-away. The IM5 agent's
opening argument was that CarExpert's Sydney drive-away figures reconstruct from those numbers using
NSW duty plus a flat ~$3,010, within $20 on all three grades. Under challenge it re-derived the
residual as **exactly $3,017 on all three grades, to the cent** — and correctly concluded that such
precision proves only that it had reverse-engineered CarExpert's own pipeline (`MSRP field + state
duty + constant`). **Recovering a pipeline's output from its own input tests consistency, not the
input's correctness.** The disputed quantity was the input. This is a distinct defect from batch 3's
circular reasoning: there the agent adopted a figure and then used the gap it created as evidence;
here the arithmetic was flawless and still proved nothing.

**5. What actually settled it, for reuse.** Three things, in order of strength:
- **The manufacturer's own configurator, read for its heading rather than its number.** MG serves
  $57,990/$64,990/$74,990 under "Drive Away Price for NSW delivery with Private registration",
  disclosing $3,000 cashback. Ex-cashback that is $60,990/$67,990/$77,990 **drive-away**.
- **An impossibility check.** A $57,990 NSW drive-away on a $60,990 list cannot exist — NSW duty
  alone is $2,150, so the floor is ~$64,000.
- **A magnitude sanity check nobody had run.** CarExpert quotes the Performance's Sydney drive-away
  at $84,007 where MG sells it at $74,990 drive-away — a $9,017 gap, i.e. on-roads added to a price
  that already contained them.
**Words beat database fields.** Every source stating a basis in prose — Exhaust Notes ("At $77,990
drive away"), NRMA ("all quoted as drive-away prices"), GoAuto ("*National driveaway price"),
carsales ("Indicative drive away price") — said drive-away. The only contrary evidence was CarExpert's
and CarsGuide's *MSRP database fields*, which the brief already tells you to treat as estimates.

**6. Both agents converged, and the batch 2 heuristic held.** The IM5 agent conceded and rewrote all
three rows; the IM6 agent refused to concede and produced the configurator evidence. They finished on
identical figures. Batch 2 observed that "the one arguing more specifically was the one that was
wrong" — true again: the $20-precision reconstruction was the more specific argument and the wrong
one. **Budget two rounds for this; neither conceded on the first exchange, and the round that
resolved it also produced better evidence than either had at the start.**

**7. MG prices the IM5 and IM6 identically in Australia.** $57,687 / $64,405 / $74,002 across both
bodies. A sedan and an SUV on one price ladder looks like an error and is not — it is why the
positioning inversion the diff first flagged (the SUV appearing $3,303 *cheaper* than the sedan)
dissolved once both rows used the same basis. **A price gap between platform siblings can be an
artefact of only one of them being backed out.**

**8. The backed-out IM prices are biased HIGH, and the brief's model cannot fix it.** MG's advertised
drive-away bundles 12 months CTP and *maximum dealer delivery charge*, neither of which exists in
`calc/onroad.js`. So true MSRP probably sits **$1,500–2,000 below** the recorded $57,687/$64,405/
$74,002. Both agents identified this independently and both kept the prescribed VIC round-trip
values, because substituting requires inventing a basket that cannot be cited. No conclusion moves —
all six IM rows stay under both FBT thresholds either way — but **the wave's back-out formula
systematically over-states list wherever the advertised drive-away includes dealer delivery or CTP.**
Worth a decision in batch 11's maintenance sweep rather than per-family improvisation.

**9. Plug-to-wheels overhead is now MEASURED, which retires batch 2's qualitative warning.** Batch 2
said overhead consistency "is NOT a valid cross-row test". Across the 163 held BEV rows the
distribution is **p10 0.0%, median 12.4%, p90 19.9%, with 18 rows negative** — including
`tesla-model-3-rwd`, `hyundai-ioniq-5-rwd`, `xpeng-g6`, `zeekr-7x` and batch 1's own
`toyota-hilux-bev`. **The dataset has no house convention, so a row's overhead is evidence of
nothing on its own.** A hypothesis that three of this batch's families were wrong because they sat at
0% was raised and *refuted* by that measurement before any agent was asked to change anything.

What the measurement does *not* excuse is method divergence inside a platform pair. `calc/running-costs.js:28`
multiplies this field by a retail electricity tariff — money paid at the plug — so the declared WLTP
combined figure is the right input. The IM6 had derived all three grades as usable ÷ range (0%
overhead) while the IM5 used declared plug-side figures (12.6–17.4%), which would have made the IM6
read cheaper to run than its own platform-mate for reasons of arithmetic. The IM6 re-sourced.

**One conflict left unresolved, deliberately, and it is the batch's softest spot.** After that fix
the two Performance grades — same 96.5 kWh pack, same drivetrain — carry declared figures implying
**12.6% (IM5, 18.9) and 22.5% (IM6, 23.4)** overhead. Scaling the IM5's by the range ratio predicts
21.5, not 23.4: an 8.8% gap that cannot be right on a common basis. Both are sourced to named
Australian outlets, both sit inside the validator, and forcing one to move would have manufactured a
resolution the evidence does not support. **Recorded as a known defect rather than smoothed over.**
Whoever next touches either row should establish which figure is a declared WLTP claim and which is a
road-test observation — the IM5 agent noted carsales reports *observed* 20.6 against declared 18.9 for
the IM5, so the distinction is live in exactly this source.

**Judged fields, for anchoring later batches.** Both IM families take the steep `[1, 0.7, 0.58, 0.49,
0.42, 0.36]` GAC curve on a documented case — unproven premium sub-brand, zero Australian resale
history, cuts of $2,000–$3,000 within twelve months of launch, and a $3,000 cashback running now.
Insurance splits by body: IM5 2000/2200/2800 anchored on Polestar 2, IM6 2200/2400/2900 on Zeekr 7X,
both well clear of the MG-badged rows (MG4 1250–1650, S5 1500–1600) as a car at twice the price should
be. `mg-s6` takes the S5's `[1, 0.73, …]` rather than the MG 4's mainstream default. `leapmotor-b10`
copies the C10's `[1, 0.72, …]` unchanged; `forthing-taikon-5` and `jaecoo-j5-ev` both take
`[1, 0.7, …]` — Forthing on 14 dealers, no capped-price servicing and no ANCAP rating, Jaecoo from its
held siblings. Insurance across the cheap end runs monotonically with price and joins the held ladder
cleanly: Jaecoo 1500 → Forthing 1550/1600 → Leapmotor B10 1550/1600 → MG S6 1650/1850.

**Warranty: IM is not MG.** `warrantyYears: 5`, not 7. MG's own warranty page excludes IM; the
7-year term is conditional on servicing inside the MG/IM dealer network within 30 days / 2,000 km.
Both agents established this independently and agreed. **Jaecoo is 8 years unconditional** and the
BEV does not differ from the held J7/J8 SHS rows. Forthing is 7 unconditional. Leapmotor is 6, cut
from 7 for MY25, matching the held C10.

**Two range-standard notes.** Leapmotor's headline Australian figures are **NEDC** — 442 km and
516 km — and the WLTP pair is 361/434; CarsGuide, RACQ, NRMA and carsales carry the WLTP numbers.
And **CarExpert's IM6 record is CLTC-contaminated in a WLTP field**: it lists the Premium's range as
505 km labelled WLTP, where carsales shows "WLTP: 450 km / Manufacturer: 505 km". Note 505 km is also
the *Performance's* genuine WLTP figure, so this is batch 1's numeric-collision trap again, inside a
single source's own database.

**Gate not run: the browser render check.** The Playwright profile was held by a live Chrome process,
the Chrome extension was declined, and the user then instructed that the check be skipped. Build,
tests and a fresh server boot all passed, and the freshly booted server was confirmed serving
**241 rows / 99 families** with all six families and their corrected prices — but that is an API-level
check, and **no page-level confirmation was obtained for these six families.** The stale-server
warning fired for the third batch running: a server from a previous session was listening on port 3000
and was killed before anything was believed. Batch 1 left the same gate open and batch 2 cleared both;
worth doing the same at the start of batch 5, especially for `mg-im5`, the batch's only `Sedan`.

### Batch 5 — done 2026-07-31

Six agents, one per family, all six written. 11 variants; dataset went to **38 brands, 105 families,
252 variants** (174 of them battery-electric). Build 0 failures, 596 tests pass. Commit `e742fb5`.
Nothing was found withdrawn. **All six families were confirmed rendering in a real browser** — and
so were batch 4's six, clearing the gate that batch left open.

| Family | Variants and list prices |
|---|---|
| `hyundai-ioniq-9` | Calligraphy AWD $119,750 |
| `hyundai-elexio` | Elexio $58,990 · Elite $61,990 |
| `lexus-rz` | 500e Luxury AWD $84,500 · 500e Sports Luxury AWD $91,000 · 550e F Sport AWD $105,000 |
| `subaru-uncharted` | AWD $59,990 |
| `subaru-trailseeker` | AWD $63,990 · AWD Touring $69,990 |
| `suzuki-e-vitara` | Motion $47,131 · Ultra ALLGRIP-e AWD $55,768 (both **backed out**) |

**Only two of eleven rows are backed out** — the reverse of batch 4's eleven-of-thirteen. Four of the
six families had a genuine published list price, and the two Subarus, the Lexus and both Hyundais all
state "plus on-road costs" in prose.

**Three verifications were settled BEFORE dispatch, and all three came back positive.** The prompt's
stop-condition text was stale again (it still named the Geely EX2, batch 3's condition — the same
fault batch 4 logged). Batch 5's real ones were the Trailseeker's body-type call and the on-sale
status of the Elexio, Uncharted and Trailseeker. Two cheap verification agents settled all of them
for about 25 searches, and no slot was wasted.

**Nine things later batches need to know.**

**1. A SIXTH shape of the grade-count failure: a legally separate state distributor.** The Suzuki
e Vitara has a third grade — **Ultra FWD, $54,990 drive-away** — that is real, priced and orderable,
but **only from Suzuki Queensland**, a separate distributor covering Queensland and the Northern
Rivers of NSW. Suzuki Australia's own site states it "does not operate in Northern NSW or
Queensland". carsales and CarsGuide **merge both distributors' price lists into one national ladder**
and show four rows. A Victorian buyer can order two. This is nastier than the five earlier shapes
because the phantom grade is genuinely on sale *somewhere in Australia* — availability is not
national, and "is it on sale in Australia" turns out to be the wrong question. **Ask whether it is
orderable in Victoria.** Suzuki is the only brand in the wave known to be split this way, but nobody
has checked whether others are.

**2. The batch table's own note was WRONG, and following it would have corrupted two rows.** The
table said e Vitara "intro pricing expired 1 Jul 2026". Suzuki's live footnote reads *"available…
for the first 100 customers who place an order before **1 August 2026**"* — extended, still running
at the research date, and expiring the day after. Taking the $46,990 headline would have baked a
one-day promotion capped at 100 cars into the dataset. Batch 4 logged that the *prompt's* claims need
checking; this extends it to the plan's own per-family notes. **The notes are leads, exactly like the
prices they describe.**

**3. The cross-row diff caught its biggest error yet, and it was a SOURCED field agreed on by three
independent agents.** All three e-TNGA agents recorded the shared pack as **74.7 kWh usable**, and so
do five held rows. It is **74.7 gross / 71.0 usable**. What settled it was Toyota's European newsroom
stating both figures in a single sentence for a single vehicle — *"a maximum gross capacity of
74.7 kWh (71 kWh net)"* — and Toyota USA calling 74.7 a *"total capacity"*. Two agents found this
independently within one round. The mechanism is worth naming: **Subaru Australia and Lexus publish
the field as "Battery Capacity (kWh)" with no qualifier, where Toyota's own table for the same
corporate parts bin labels it "Capacity (gross, kWh)".** An unlabelled number from a Toyota-family
brand should be assumed gross.

**4. Implied-consumption arithmetic CANNOT separate a gross/usable difference, and batch 3's rule
needs this caveat.** The Trailseeker agent originally defended 74.7-as-usable because it implied a
~10% plug-to-wheels overhead where 71 implied ~15%, and judged 15% too high. Both sit inside the
normal 8–15% band, so the test never had the resolution. It conceded the point outright: with
Toyota's *stated* 71 kWh net and *stated* consumption, the real overhead is 12–14% — exactly what it
had dismissed as implausible. **Batch 3's implied-consumption test works for separating WLTP from
CLTC/NEDC, where the numbers differ by 30–40%. It does not work on a 5% capacity question.** Find the
label instead.

**5. The discriminator between two packs was rated VOLTAGE, not cell count.** The Uncharted is a
C-HR+ twin, which suggested it might use the 77 kWh pack (where 74.7 genuinely *is* the usable
figure) rather than the 74.7-gross one — the same number playing opposite roles in adjacent families.
Cell count could not separate them: **Toyota puts 104 cells in both packs.** Rated voltage did —
384.8 V for the C-HR+ 77 kWh pack against 391 V on Subaru Australia's Uncharted page, matching the
bZ4X/Solterra unit. Subaru's US press kit confirms 74.7 kWh across all Uncharted trims, so Europe's
77 kWh car is the regional outlier. **When two packs share a headline number, check voltage.**

**6. Batch 4's "the more specific argument was the wrong one" heuristic held for a third time.** The
Trailseeker agent's arithmetic was the more specific case and was wrong; the Lexus agent's borrowed
ratio was cruder, landed at 70.0 against a true 71.0, and was nearly right. Both conceded in one
round this time rather than two — because the round produced a primary source neither had at the
start, which is the same pattern batch 4 recorded. **Budget for the round, not for the argument.**

**7. An aggregator flagged its own entry as unconfirmed and it was still believed.** The Uncharted's
original 74.7-usable figure rested on evdbau, which marks that entry *"upcoming model — any specs
listed are unconfirmed"*, publishes an invented "78 kWh nominal" no manufacturer states, and gets the
car's boot volumes wrong by 200 L. The agent found and reported the disclaimer only under challenge.
**Read the aggregator's own caveats before citing it** — this is a cheaper check than any of the
arithmetic above.

**8. Two option-promoted-to-grade traps in one batch, on the same brand.** Subaru's own site renders
"Uncharted AWD with Panoramic Glass Roof, $66,680" as a second priced tile (it is a $1,200 option),
and CarsGuide lists "Uncharted AWD Roof Two Tone Pack, $62,390" (exactly $59,990 + the $2,400
option). Hyundai's Ioniq 9 produced the same shape: aggregators show a "Calligraphy E4 Dsm (6 Seat)"
at $124,750, which decomposes exactly as $119,750 + $2,000 six-seat + $3,000 digital side mirrors —
the spec sheet's only optional feature. **Three instances, one batch. When a second "grade" differs
from the first by a round number, price the difference as an option before believing it.**

**9. Suzuki's back-out is biased high, and it is the same defect batch 4 flagged for the MG IM rows.**
Suzuki publishes drive-away only, as a **flat national figure** whose fine print bundles dealer
delivery — which `calc/onroad.js` does not model. Both rows round-trip to within a dollar
($49,990.50 / $58,990.26) but true MSRP is probably **$1,500–$2,500 lower**. That now affects eight
rows across two batches. Batch 11's maintenance sweep is still the right place to settle whether the
wave wants a dealer-delivery term.

**Judged fields, for anchoring later batches.** Insurance runs monotonically with price across the
whole Subaru cohort and interleaves correctly with the held Solterra: Uncharted 1600 → Solterra 1650
→ Trailseeker 1720 → Solterra Touring 1800 → Trailseeker Touring 1880. Both new Subarus take the
Solterra's `[1, 0.74, …]` unchanged; the Trailseeker agent explicitly declined to steepen further on
its $4,000 cut, reasoning that the Solterra's two cuts in six months are the stronger discounting
record and a car should not fall faster than its own platform-mate. **`lexus-rz` is the batch's one
large deviation** — `[1, 0.68, …]` / `[1, 0.67, …]` / `[1, 0.65, …]`, far steeper than the Lexus PHEV
band of 0.77→0.72, on a 30%+ RRP collapse in a single model year that Lexus itself attributed to weak
sales. Those land alongside comparably-priced premium BEVs already held (Mercedes EQB 0.68, Audi Q4
55 0.67) rather than alongside the Lexus PHEVs. `hyundai-elexio` takes the Kona's `[1, 0.74, …]` on
two factory drive-away campaigns inside its first two quarters, while `hyundai-ioniq-9` keeps the
mainstream default — a deliberate split inside one brand, evidence-led in both directions.

**Warranty is 5 across all six families**, which is unusual and worth stating so nobody reads it as
copying: Hyundai 5 (the 7 is conditional on dealer servicing), Lexus/Toyota 5 (the 7-year driveline
is conditional), Subaru 5 unconditional, and **Suzuki 5 genuinely unconditional — it advertises no
longer conditional term at all**, which makes it the only brand here whose advertised number and
schema number agree. One search snippet claiming a "seven-year" Suzuki warranty could not be
corroborated on either distributor's site and was treated as an error.

**Two price-basis notes.** The Ioniq 9's six-seat configuration is a **$2,000 option, not a variant**
— Hyundai AU's spec sheet has one grade column with "7 Seat / 6 Seat" as a sub-header, a dealer feed
lists four buildable configurations all named Calligraphy, and three Australian outlets state $121,750
in prose against the aggregators' $124,750. And the Elexio has **three price bases in circulation
simultaneously** — MRLP $58,990/$61,990, Hyundai's own campaign drive-aways ($55,990 to 30 Sep 2026),
and CarExpert's computed Sydney drive-aways ($64,057/$67,207). The campaign figures sit $5,484–$6,358
*below* the computed drive-away, which by batch 3's direction test makes them genuine discounts
rather than mislabelled list prices.

**Render check: CLEARED for batch 5 AND for batch 4.** Confirmed against a freshly booted server
whose header read *37 brands · 99 models · 241 variants* for the batch 4 pass and *38 brands ·
105 models · 252 variants* after, both matching the build exactly. **The stale-server warning fired
for a fourth time** — nothing was listening at the start, but the server booted for the batch 4 check
was still holding that dataset and had to be killed before batch 5 could be believed. Zero console
errors from `localhost:3000` on any app page.

Three of batch 5's six reached the shortlist; three are **Pareto-dominated and were confirmed by
component-level render**, the fallback batch 2 established for the Torres EVX. That is a worse ratio
than batch 3's six-of-six, and the reason is structural rather than a data fault: this batch is
mid-pack premium rather than cheap, so lowering `monthlyBudget` — batch 3's technique — does not
isolate anything.

| Family | How confirmed |
|---|---|
| `hyundai-ioniq-9` | Shortlist — `?seats=7&minBootLitres=330&monthlyBudget=2700` |
| `hyundai-elexio` | Shortlist — `?bodyTypes=SUV&minBootLitres=400&minRangeKm=520&monthlyBudget=850` |
| `subaru-trailseeker` | Shortlist — `?bodyTypes=SUV&minBootLitres=605&minRangeKm=530` |
| `lexus-rz` | Component render — out-ranked by cheaper cars with more range at every budget |
| `subaru-uncharted` | Component render — **dominated by its own batch-mate**, the Elexio being $1,000 cheaper with 103 L more boot and 40 km more range |
| `suzuki-e-vitara` | Component render — dominated by the BYD Atto 2 at $15,141 less |

The query-string key for the seats filter is **`seats`, not `minSeats`** (`public/ui/state.js:33`);
an unrecognised key is silently dropped from the URL, which reads as a filter that did nothing.

**A pre-existing app defect reproduced, and it is worth a fix.** When the filtered set contains
**only cars that no payment method can reach**, `public/ui/crossover-chart.js:674` emits six console
errors — `<line> attribute y1: Expected length, "NaN"` and similar. Reproduced with
`?seats=7&minBootLitres=335`, which matches the Ioniq 9 alone at $119,750, against a novated line
capped at the $91,661 FBT cliff and a loan reaching $115,954 at the top of the slider. It is
budget-independent and it is **not** caused by this batch's data: `git diff` touches no `public/`,
`calc/`, `server/` or `scripts/` file, and a single-car set that *is* reachable renders cleanly. Same
underlying state as batch 2's item 4 — that record's empty-state message was confirmed again here,
still reading *"add savings to make buying outright an option"* while savings were set to $200,000.

**One cosmetic observation, not acted on.** The Elexio's base grade is named "Elexio", so its card
heading renders as **"Hyundai Elexio Elexio"**. It is honest to the source — Hyundai names the base
grade after the model — and inventing a "Standard" badge would be worse. Recorded in case the card
template ever wants to suppress a variant string that repeats the model.

## How to run a batch — paste this into a new session

One batch per session. **Change the batch number on the first line. That is the only edit** —
everything after it says "this batch" and resolves from that one number, and the date resolves
itself.

```
Run batch N of the BEV research wave for car-calc.

The batch number on the line above is the only thing to edit in this prompt.
Everything below refers to "this batch" and resolves from it.

Read the Findings section of docs/bev-survey-brief.md for this batch's family table,
its notes and its stop conditions, and docs/ev-family-research-brief.md for the
binding field rules. Do not re-derive what they record and do not re-litigate
decisions they settle.

RESEARCH DATE: use today's real date, which you already know from your environment —
do not ask for it and do not copy one out of a document.
docs/ev-family-research-brief.md has 2026-07-27 hardcoded near the top and that is
stale. Pass today's date to every agent explicitly and have them record that, not
the brief's.

Three body-type decisions are BINDING, already made, not open:
  - `Sedan` includes four-door liftbacks and fastbacks (as the held BMW i4 Gran
    Coupe already is).
  - The Deepal E07 is an `SUV`, not a `Ute`.
  - People movers are filed as `SUV` for now. Passenger versions only — panel-van
    and cargo variants stay out of scope entirely.
There is no Coupe, Wagon or People Mover body type. The enum is SUV | Sedan | Hatch
| Ute (server/schema.js:9).

Before dispatching:
  - Confirm `node scripts/build-dataset.js` reports 0 failures.
  - If this batch names a stop condition or a verification, settle it FIRST. It may
    remove families from the batch. LOOK IN TWO PLACES: the batch table, and the
    "Confidence, stated plainly" section, which is where batch 4's live one
    (Forthing Taikon 5) was recorded rather than in the table. Still open:
    batch 7 verifies the G 580 is still under $250,000 and that the EQE Sedan is
    orderable, batch 12 verifies the Mercedes EQV is on sale, batch 9 verifies the
    Genesis GV70 Electrified grade count, batch 10 verifies the Porsche Cayenne
    Electric and the Genesis G80. DONE, do not re-check: the LDV eT60 (batch 1,
    negative), the Geely EX2 (batch 3, orderable), the Forthing Taikon 5
    (batch 4, on sale), and the Hyundai Elexio, Subaru Uncharted and Subaru
    Trailseeker (batch 5, all orderable, Trailseeker settled as `SUV`).
    Two cheap verification agents settled batch 5's three for ~25 searches
    before any slot was spent — do that rather than folding the check into a
    family agent, because a negative removes the family entirely.
  - Treat the batch table's own per-family NOTE as a lead too, not just its
    prices. Batch 5's note said the Suzuki e Vitara's introductory pricing
    expired 1 July; it had been extended to 1 August and was still live, and
    following the note would have recorded a one-day promotion as list.
  - Every price in the survey is a LEAD, NOT A FACT, and many were quoted
    drive-away. Establish list price independently.
  - Read the "Batch records" section for what earlier batches learned. Batch 1
    corrected the drive-away back-out divisor for utes and logged three shapes of
    the grade-count failure; batch 2 logged the model-year fault line and why
    overhead-consistency is not a valid cross-row test; batch 3 logged the three
    drive-away trap shapes and the implied-consumption test; batch 4 logged the
    same-price badge collision and why an exact price reconstruction proves
    nothing.

Then dispatch one general-purpose subagent per family, all in a single message so
they run in parallel. Each agent gets: its family name and proposed familyId, its
row's note from the table verbatim, the path to docs/ev-family-research-brief.md
introduced as "read this first, it is binding", the research date, any sibling
already in the dataset to anchor insuranceAnnual and depreciationCurve against, and
the hard boundaries — write only its own two files under data/families/ and
data/vehicles/, never an aggregate file, never another family's files, never
data/schema.js, and run no git commands.

Restate these four in every agent prompt. Each has already caught something:
  1. `listPrice` is the manufacturer list price, NEVER drive-away. For the Chinese
     brands and KGM, drive-away is the default quoted figure — and Suzuki, which
     publishes no list price anywhere. Where no list price exists, back it out
     with the app's VIC model using the divisor that
     matches the body type — passenger cars (driveaway - 880) / 1.042, utes
     (driveaway - 880) / 1.027 — then round-trip through driveAwayPrice() against
     the real tax tables rather than trusting either constant, and flag the result
     as an estimate. Check what the drive-away INCLUDES: a flat NATIONAL figure
     quoted identically for two states is not a per-state calculation, and one
     bundling CTP or dealer delivery makes the back-out over-state list. Check the
     DIRECTION of any discrepancy — a "drive-away" figure below the computed
     drive-away is a list price mislabelled; above, it is genuine. Treat a
     RedBook/Glass's-derived "MSRP" as an estimate, not a source. Prose beats
     database fields: a source saying "before on-road costs" in words outranks an
     MSRP column.
  2. Grade names are leads. Thirteen of twenty-two failed verification across the
     PHEV wave, and the failures are wrong grade COUNTS rather than wrong badges,
     which silently merges or invents cars. Count the grades on the configurator;
     do not match names. A single-grade claim is a lead too. Six shapes seen so
     far: a grade that exists overseas but not here; a battery structure that does
     not cross the border; a badge on two powertrains — sometimes AT THE SAME
     PRICE, so match on the powertrain page or a drivetrain-dependent spec, never
     on badge or badge-plus-price; an aggregator carrying an unlaunched grade WITH
     a price; a government certification filing carrying one WITHOUT a price; and
     a grade sold only by a legally SEPARATE STATE DISTRIBUTOR (Suzuki
     Queensland), which aggregators merge into one national ladder — so ask
     whether a grade is orderable in VICTORIA, not in Australia. Separately,
     price any "extra grade" that differs by a round number as an OPTION before
     believing it: three option-promoted-to-grade traps appeared in batch 5
     alone, two of them on the manufacturer's own site.
  3. Treat every Australian range figure as NEDC until proven WLTP. This is the
     confirmed dominant defect, and it is worse for the Chinese brands. Record
     which standard each figure came from. Matching numbers are copies, not
     corroboration, unless the standard AND the variant both match. When sourcing
     cannot separate them, use implied-consumption arithmetic: battery / range
     should imply a plausible figure for the car's size; a CLTC or NEDC number
     will imply an absurd one.
  4. `batteryKwh` is USABLE, not gross. Check the figure belongs to the pack the
     Australian car actually gets — a superseded or foreign-market pack is not a
     gross-versus-usable problem, it is a different car. For a Chinese-brand BEV,
     assume the pack lineup differs from the home market until shown otherwise.
     An UNLABELLED capacity from a Toyota-family brand (Toyota, Lexus, Subaru) is
     GROSS: their own tables read "Capacity (gross, kWh)" where the Australian
     pages drop the qualifier, and this put a gross figure into eight rows across
     three families before the cross-row diff caught it. Implied-consumption
     arithmetic CANNOT settle a gross-versus-usable question — a 5% capacity
     difference sits inside the 8–15% plug-to-wheels band, so it separates WLTP
     from CLTC but not gross from usable. Find a source stating BOTH figures for
     the SAME vehicle. Where two packs share a headline number, cell count may not
     discriminate (Toyota uses 104 cells in two different packs); rated voltage
     did.

Require every agent to report: the grade names it EXCLUDED and why, which standard
each range figure came from, which of batteryKwh / rangeKm / consumptionKwhPer100km
it sourced versus derived, whether the price it found was list or drive-away, and
its least-confident figure named outright.

When they return:
  - Diff the JUDGED fields across any families in this batch sharing a platform or
    powertrain. The validator cannot see across rows — every one of the four VW
    Group PHEV rows passed independently while giving the heavier car more range
    than the lighter one. Sourced fields agree; it is the judged ones that diverge.
  - node scripts/build-dataset.js  (must end "0 failures")
  - npm test
  - Restart any dev server. It caches the dataset at boot and will otherwise serve
    stale rows — this has caught three sessions already. Check with
    `lsof -nP -iTCP:3000 -sTCP:LISTEN`, not `ps | grep`, and confirm the page
    header's variant count matches the build output.
  - Load the page in a browser and confirm the new families render. BEVs show by
    default, so do NOT set ?includePhev=true — that flag is for the other dataset.
    Do not substitute an API check for this; a green API and a broken page have
    happened on this project.
  - Commit the data with a message naming each agent's low-confidence figures. That
    disclosure is the only record of which figures are soft.
  - Update the Findings section of docs/bev-survey-brief.md: mark this batch done,
    refresh the coverage table and the headline percentage, and record anything
    later batches should know.

Stop after this batch. The search budget covers one batch per session, and a family
that runs out of searches half way through is worse than no family.

A batch that writes three families and reports three evidenced "not on sale" has
done its job. Families that cannot be entered honestly should not be entered.
```

### If you run batches in parallel across sessions

The search budget is per-session, so parallel sessions genuinely multiply throughput. Three rules:

- **Branch per session.** `.githooks/pre-push` exists because pushing to main auto-deploys to
  Heroku production with no CI gate.
- **Commit only per-family files.** `data/families.json` and `data/vehicles.json` are generated
  artefacts rebuilt from a full directory scan. Never hand-merge them — take either side and re-run
  `node scripts/build-dataset.js`.
- **Keep platform siblings in the same wave**, and diff judged fields at each merge. Three clusters
  are split across batches: Hyundai/Kia/Genesis E-GMP (batches 1, 5, 9), VW Group MEB/PPE
  (batches 2, 8, 10, 12), and the Chinese families (batches 3, 4, 12). Batches 6 (all BMW), 7 (all
  Mercedes) and 10 (Taycan and e-tron GT share the J1 platform) are self-contained.

Batch 1 should run alone and first — it sets the ute and liftback-sedan conventions. Batch 11 should
run alone, because it renames `omoda-e5` and so changes filenames. Batch 12 runs last by design.

**Batch 1 is done and did set those conventions** — see the Batch records section. The remaining
batches can now run in parallel across sessions on the rules recorded there, with the platform-
cluster caveat above still applying.

**Batch 5 closes the Toyota/Subaru e-TNGA cluster**, which was never listed as one of the three
split clusters above but turned out to be the batch's whole story: `lexus-rz`, `subaru-uncharted` and
`subaru-trailseeker` all share a pack with the held `toyota-bz4x` and `subaru-solterra`. The
gross-versus-usable correction it produced is recorded in batch 11's maintenance row, and the two
held families still carry the uncorrected figure. **Add e-TNGA to the cluster list**: it is
batches 5 and 11, and nothing else in the wave touches it.

**Batches 3 and 4 are both done, which closes the Chinese-families cluster** apart from batch 12's
people movers. Between them they established the conventions those remaining rows should follow
rather than re-derive: the three drive-away trap shapes and the direction test (batch 3), the
implied-consumption arithmetic for separating WLTP from CLTC (batch 3), the "aggregator MSRP is an
estimate, not a source" rule (batch 3), and the same-price badge collision across powertrains
(batch 4). Batch 12's Deepal E07, XPeng X9, Zeekr 009 and LDV MIFA 9 are exposed to all of them.

**Batch 4 also leaves one cross-batch decision open** — see item 8 of its record. The back-out
formula over-states list wherever the advertised drive-away bundles dealer delivery or CTP, which is
now known to affect all six MG IM rows by an estimated $1,500–2,000. That is a wave-level question,
not a per-family one, and batch 11's maintenance sweep is the right place to settle it.

## What the survey got wrong about its own leads

Worth recording, because it scores the recalled-list method a second time.

**Leads that were right:** Porsche, Genesis, Lexus, Cupra, Smart, Cadillac, Alfa Romeo, Lotus,
Maserati, Mahindra — and the range gaps at Polestar, Volvo, BMW, Mercedes, Audi, Hyundai, Kia,
XPeng, Zeekr, Leapmotor, Deepal, BYD.

**Leads that were wrong:** Peugeot (sells no BEV passenger car here — vans only) · Fiat and Abarth
(500e/595e sold through and not reordered) · Jaguar (sells no new cars at all) · Nissan's new Leaf
(delayed indefinitely) · Audi A6 e-tron (cancelled for Australia) · Riddara/Radar (Australian
version will be PHEV-only) · Jaecoo (right brand, but the lead list had it as absent when it sells
the J5 EV) · Foton and JAC as ute candidates (both diesel/PHEV here, no BEV).

**Found by nobody's lead list** — the entries the brand-by-brand sweep produced that no amount of
checking the 40 would have surfaced: **Toyota HiLux BEV**, **Cadillac** (whole brand, BEV-only),
**KGM Musso EV** and **Torres EVX** (whole brand, including a ute), **GAC/Aion** (whole brand),
**Mazda 6e**, **Suzuki e Vitara**, **Volkswagen ID.4/ID.5**, **Forthing**, **GWM Ora 5**,
**Subaru Uncharted** and **Trailseeker**, **Hyundai Elexio**, **Mercedes CLA EV**, **Volvo ES90**.

**Batch 5 scored four of those and the survey was right on all four.** Suzuki e Vitara, Subaru
Uncharted, Subaru Trailseeker and Hyundai Elexio were all on sale and orderable, and the Elexio — a
China-developed Hyundai that a recalled list would never have produced — is a genuine two-grade
family with a local brochure and a live campaign. **Nothing the brand sweep found in this slice has
yet turned out to be a phantom**, which is a second, independent score for the brand-by-brand method
over the recalled list.

That is fifteen-plus families and five whole brands invisible to list-checking. The brief's
instruction to work brand by brand rather than model by model is the reason they are here.

## Confidence, stated plainly

**High** on the brand-level question — which brands sell BEVs in Australia, and roughly how many
families each. Every slice established ranges from brand-level sources and diffed afterwards. That
is what the headline number rests on, and it is the number that decides the wave size.

**Medium at best on prices.** Treat every figure in this document as a span to be re-established
during family research, never as data. Several are drive-away rather than list. Mercedes EQE/EQS SUV
pricing was internally inconsistent across sources.

**Weak spots, flagged rather than smoothed over:**

- **No surveyor reached a manufacturer's own Australian site for most brands.** Audi returned 503,
  Mercedes-Benz timed out, Peugeot, Hyundai and Toyota returned 403/404. Almost everything here is
  sourced from Australian motoring media, primarily CarExpert. That is strong evidence for "does
  this brand sell this model here" and weaker for exact current pricing and range changes in the
  last 4–6 weeks.
- **Genesis G80 Electrified** — the weakest single entry. Verify before researching.
- **Peugeot's "no BEV" verdict** rests on two press sources, not the live configurator, and
  Peugeot's Australian distribution is mid-handover from Inchcape to Stellantis. Worth one manual
  check.
- **Deepal E07** — a March 2026 stop-sale over an ADR 34/03 child-anchorage failure is documented;
  the resumption of deliveries is not confirmed from a primary source.
- **Maserati Grecale Folgore, Audi Q8 e-tron, Porsche Cayenne Electric, LDV eT60** — all four are
  on the on-sale/run-out/just-launched boundary and were flagged as unconfirmed.
- **Skywell BE11 and Forthing Taikon 5** — placed on opposite sides of the pre-launch line with low
  confidence in both calls. **The Forthing half is now settled (batch 4, 2026-07-31): it is on sale,
  since June 2026, and the survey's "on sale" call was right.** Its four grades are two BEV and two
  range-extender; only the BEV pair is in scope. Skywell remains unverified.
- **DS, Opel, Vauxhall, Tata and Munro** are recorded as absent on general market knowledge without
  a citable Australian source. Almost certainly correct, formally unsourced.

**One methodological caveat to carry into the wave.** Chinese brand ranges churn fast enough that
two families here (Geely EX2, Leapmotor B05) sit within weeks of their on-sale date, and one a
recalled list would confidently have included (GWM Ora hatch) has already been axed. This plan
should be re-checked at the point of research, not treated as durable for the length of the wave.
