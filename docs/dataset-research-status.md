# EV dataset research status — handoff note

**Last updated: 2026-07-27.** Written so a new session can pick this up cold.

The per-family research spec is `docs/ev-family-research-brief.md`. It is the accumulated
product of 20 research agents and encodes every data trap they hit — read it before
re-researching anything. The dispatch pattern is Task 12, Step 3 of
`docs/superpowers/plans/2026-07-25-ev-affordability-melbourne.md`: one subagent per family,
each writing only its own `data/families/<id>.json` + `data/vehicles/<id>.json` pair, then
`node scripts/build-dataset.js` to merge and validate.

## Why this note exists

A research pass on 2026-07-27 **exhausted the session's web-search budget: 200 of 200
`WebSearch` calls**. Twenty parallel research agents consumed it. Families dispatched late in
the run lost their ability to discover sources partway through.

To raise the ceiling in a new session, set `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`.
Budget roughly **20–45 searches per family** based on this run, so plan about 10 families per
200-call session, or raise the limit before starting.

Note `WebFetch` was **not** capped and kept working after `WebSearch` stopped. An agent that
already knows the URL it needs (a manufacturer configurator, a known review page) can still
verify by direct fetch. Manufacturer configurators proved to be the single best price source —
better than any review aggregator — so a re-run that fetches those directly needs far fewer
searches.

## Families affected by the search limit — outcome: none need re-research

Three families were still running when the budget ran out (Skoda Enyaq, Mercedes EQB, Audi Q4
e-tron). The risk being guarded against was that an agent unable to search falls back on recalled
pricing, which looks plausible and passes schema validation. **That did not happen.** All three
completed with real sourcing, because `WebFetch` stayed available and each fell back on
manufacturer documents rather than memory:

- **`audi-q4-e-tron`** — priced from Audi Australia's own Starting Price Calculator, which served
  figures stamped "Prices effective from 1st July 2026" and "Statutory charges current as at
  27-7-2026", plus Audi's MY26 Specification Guide PDF. The best-sourced family in the pass. It also
  corrected a towing figure that CarExpert, CarsGuide and carsales all get wrong (they say 2,200kg
  braked for the 55 quattro; Audi's own spec guide says 1,200kg) — which `calc/rank.js` would
  otherwise have rewarded.
- **`skoda-enyaq`** — worked from Skoda Australia's MY27 spec sheets, round-tripping each list price
  through the app's VIC model against Skoda's campaign drive-away figures.
- **`mercedes-eqb`** — completed with sourcing; its files were additionally verified by hand against
  its report.

Two cheap spot-checks remain, neither a re-research:

**`audi-q4-e-tron` 55 quattro list price.** Recorded as **$97,936** from Audi's live calculator
(actual MLP $97,935.62). The arithmetic closes exactly against Audi's own VIC drive-away of
$109,813.11, and the LCT back-solves to a threshold of precisely $91,661 — so the figure is
internally coherent. **But CarExpert and CarsGuide both still show $99,900**, and no formula derives
one from the other. Both land above $91,661 so the FBT logic is unaffected either way; if a round
advertised figure is ever preferred, $99,900 is the alternative.

**`mercedes-eqb` 250+ City Edition list price.** Two items to close out:

- **The 250+ City Edition's $86,300** is its weakest figure — derived from CarsGuide pricing plus a
  documented $900 MY2026 increase, because `mercedes-benz.com.au` timed out on every attempt, so
  the agent never read the manufacturer's own number. Its drive-away cross-check is consistent
  (CarExpert's identical $96,503 drive-away for Base and Night Edition, $3,770 lower for City, only
  reconciles with a $3,700 list gap). Confirm against Mercedes-Benz Australia directly.
- **Whether the City Edition is still on the order books at all.** The EQB is a run-out — global
  production ended January 2026, European configurators dropped it September 2025, and the GLB
  Electric successor lands in Australia Q4 2026. Two aggregators still list the City Edition,
  which is why it was kept.

Note the EQB is FBT-exempt across the range but with only **$1,661** of headroom on the $90,000
pair, so a single option pack flips a novated-lease buyer out of the exemption.

**`skoda-enyaq` 60 Select range**, if convenient. Recorded as 410km. MY27 swapped to a 61kWh LFP
pack (58kWh usable) and Skoda lists the Australian WLTP figure as "to be confirmed"; the agent chose
a conservative Australian-published pair over an implausible European homologation number that would
have implied a range *gain* on a smaller pack, and flagged it in the family `cons`.

**How to verify any of the above:** confirm the `listPrice` against the manufacturer's own Australian
configurator (the authoritative "before on-road costs" figure) or against two independent Australian
review sources that explicitly say "before on-road costs". If a family's rows cannot be corroborated,
delete the pair and re-research it rather than leaving unsourced rows in place.

Also worth a cheap re-check: **`zeekr-7x`** is otherwise complete, but its agent could not verify
a crash-safety rating before the budget ran out. It correctly claimed Euro NCAP rather than
inventing an ANCAP result. Confirm whether an ANCAP rating exists.

## Established NOT on sale in Australia — do not spend a research slot

- **GWM Ora** — production ended; replaced by the Ora 5 SUV, a different vehicle.
- **Xpeng G9** — xpeng.com.au is register-interest only, no configurator or prices.
- **Mahindra XEV 9e** — *(added 2026-07-27)* Mahindra Australia sells three ICE SUVs only; the
  "EV" link in its own footer redirects to the India-market site with rupee pricing. CarExpert
  and CarsGuide both 404 on model/price pages. Latest coverage (CarsGuide, 2 June 2026) is a
  Melbourne test mule with Mahindra declining to comment, headlined as a **2027** model. Every
  price figure in circulation is a conversion of Indian pricing or a journalist estimate. Do not
  re-research until Mahindra Australia publishes local pricing.

**Excluded by the plan, do not research:** Nissan Leaf, Cupra Born, Polestar 2.

## Open data-consistency questions

None of these is a schema failure — the build and test suite are green. Each needs a judgement call,
and each affects a field that feeds `calc/rank.js`, so they change recommendations rather than just
tidiness.

1. **Solterra vs bZ4X range disagreement.** `subaru-solterra` AWD claims 566 km WLTP;
   `toyota-bz4x` AWD claims 517 km. These are mechanically identical twins. Plausibly a real
   18-inch vs 20-inch wheel difference (the bZ4X researcher noted AWD/Touring run 20s), but if
   the two rows are quoting different wheel specs they are not comparable, and `rangeKm` is a
   ranking input. **This was the search that hit the cap and is still unresolved.**
2. **`mercedes-eqa` range is probably an NEDC figure in a WLTP field.** The EQA and EQB share the
   same 70.5 kWh pack, but `mercedes-eqa` records **578 km** where the freshly-researched
   `mercedes-eqb` records **536 km**. 578 km on 70.5 kWh implies 12.2 kWh/100km, which is
   implausibly efficient for this platform and is the classic signature of an NEDC number. Every
   Australian source quotes 564 km for the EQB and labels it NEDC; the EQB researcher rejected that
   in favour of EV Database's 536 km WLTP, and flagged that the EQA row it did not touch is likely
   still on the NEDC figure. `rangeKm` is a ranking input, so if this is right the EQA has been
   over-scoring on range. Check the EQA's WLTP figure and correct it. While there, the EQA's list
   prices may also predate the same $900 MY2026 increase that applied across both EQ lines.
3. **MG depreciation curves disagree within one brand.** `mg-s5` uses a weakened curve
   `[1, 0.73, 0.63, 0.55, 0.48, 0.42]`, justified on evidence about *MG4* resale (~50% at three
   years against a ~60% Australian EV average). But `mg-4` itself still carries the mainstream
   default `[1, 0.78, 0.68, 0.6, 0.53, 0.47]`. The evidence arguably applies more directly to the
   family not using it. Pick one convention for the brand.

## Conventions established during this pass

These were applied by hand at integration and are now written into the research brief. A new
session should keep them.

- **`warrantyYears` is the UNCONDITIONAL term.** Three agents independently recorded a
  service-conditional headline figure. Normalised: Nissan 10→5, MG 10→7, Hyundai 7→5. Reference:
  MG 7, Nissan 5, Hyundai 5, Toyota 5, Kia 7, BYD 6, Tesla 5. `calc/rank.js` scores this as
  `warrantyYears / 10` and headlines the group winner, so a conditional number buys an unearned
  advantage. Conditional offers belong in the family `pros` as prose, with the condition stated.
- **`listPrice` excludes on-road costs.** `calc/onroad.js` adds VIC stamp duty and registration
  itself. This was the most common source error by a wide margin — six of ten first-wave agents
  hit sources that mislabel one as the other.
- Where a brand publishes drive-away only (Zeekr X, MY26), back the list price out with
  `list = (driveaway - 880) / 1.042` and verify it round-trips. Do **not** assume this applies
  brand-wide: the Zeekr 7X still uses conventional MSRP.
- `data/schema.test.js` holds a guard on the Kia EV5 family asserting all four variants stay
  under $75,000 on list price. The EV5 is the canary — its GT-Line is widely reported as "over
  $75k", which is its drive-away price. If a refresh reintroduces drive-away figures, that test
  fails first.

## Coverage against the plan's target

The plan targeted ~43 families. Once the three families above are verified, the target list is
fully accounted for: researched, or established not on sale. Anything further is new-model
expansion, not backfill. Known near-term triggers for a refresh:

- **BYD Atto 3 Evo** — 800V rework, approved for Australia, registrations of interest only, no
  pricing, arrival "second half of 2026". Will likely restructure the `byd-atto3` family.
- **Skoda Elroq Sportline 85** — orders open October 2026, no price published yet.
- **Renault Megane E-Tech facelift** — H1 2027, more range and faster DC charging.
- **Hyundai Ioniq 6** — Hyundai AU pulled every mainstream grade and has not confirmed local
  timing for the facelift. The family currently holds only the $115,000 N. Recheck when the
  standard grades return.
