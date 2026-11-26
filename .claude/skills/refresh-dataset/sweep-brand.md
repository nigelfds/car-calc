# Sweep one brand

You check **one brand's** Australian line-up against what car-calc holds, and return JSON. You write
no files and run no git. Your result decides which families get researched, added or removed, so
every claim carries an evidence URL you opened in this run.

## Scope

In scope: new battery-electric (BEV) and plug-in hybrid (PHEV) passenger cars orderable in Victoria,
priced between $15,000 and $250,000 before on-road costs, with body type SUV, Sedan, Hatch or dual-cab
Ute. People movers count as SUV (passenger versions only).

Out of scope, but report so the next sweep skips them: wagons, range-extenders (the engine only
charges the battery), non-plug-in hybrids, vans and cab-chassis, anything over $250,000, and
roadsters or coupés with no honest body type.

## What counts as evidence

- **On sale** = a live entry in the brand's Australian Build & Price or configurator with a price.
  A model on the nav menu, a register-interest form, a news story or an aggregator listing is a
  lead, never evidence of availability.
- **Not on sale** = the model is gone from the configurator, or the brand or a credible Australian
  outlet says it was withdrawn or cancelled. Run-out stock with no configurator entry counts as
  not on sale.
- **Pre-launch** = announced for Australia, not orderable. Record the expected month and any
  indicative price as a lead.

## Steps

1. Read the inputs: your brand's held family ids with their variant counts, and its watchlist
   entries. Watchlist notes record what earlier checks found; re-check an entry only when its
   `recheckAfter` is on or before the research date.
2. Open the brand's Australian site and its configurator. List every in-scope model on it.
3. For each **held family**: on sale, run-out, not on sale, or renamed. Note if the configurator's
   grade count differs from the held variant count, or a new model year is on sale. Prices you see
   are leads for the research agent; record them with whether they were list or drive-away.
4. For each in-scope model **not held**: is it on sale or pre-launch? Propose a familyId in the
   held style (`<make>-<model>`, PHEVs ending `-phev`, e.g. `byd-sealion-6`, `mazda-cx-60-phev`).
5. Check one Australian outlet (CarExpert, Drive, CarsGuide) for recent launches or withdrawals
   for this brand that the site might lag on.

**Done when** every held family and every due watchlist entry has a status with evidence, and every
in-scope model on the brand's site is accounted for.

## Return

Return only this JSON:

```json
{
  "make": "Kia",
  "checkedAt": "<research date>",
  "held": [
    {
      "familyId": "kia-ev5",
      "status": "on-sale | run-out | not-on-sale | renamed",
      "heldVariants": 4,
      "configuratorGrades": 5,
      "newModelYear": false,
      "renamedTo": null,
      "evidenceUrl": "https://...",
      "leads": "GT-Line now $69,990 list; new Air Long Range AWD grade"
    }
  ],
  "new": [
    {
      "name": "Kia EV2",
      "proposedFamilyId": "kia-ev2",
      "powertrain": "bev",
      "bodyType": "SUV",
      "status": "on-sale | pre-launch | out-of-scope | unrepresentable",
      "expected": null,
      "evidenceUrl": "https://...",
      "leads": "from $39,990 drive-away"
    }
  ],
  "watchlist": [
    { "name": "<watchlist entry name>", "status": "<new status>", "evidenceUrl": "https://...", "note": "..." }
  ],
  "unsettled": ["anything you could not determine, and why"]
}
```
