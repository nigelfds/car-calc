# BEV market survey — brief

**Prepared 2026-07-29. Not yet run.** The preparing session had spent its 200/200 WebSearch budget,
and a survey is nothing but searching, so this is a job for a fresh session.

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
