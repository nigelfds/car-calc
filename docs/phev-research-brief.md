# PHEV family research brief — car-calc dataset

You are researching **one plug-in hybrid family** for the Australian (specifically Victorian)
market and writing **exactly two files**. Project root: `/Users/nigel/projects/car-calc`.
Research date to record: **2026-07-28**.

This is the sibling of `docs/ev-family-research-brief.md`, which covers pure battery-electric
cars. Read this one instead — several rules are inverted, and the vehicle rows carry five fields
the EV brief never mentions.

## Hard boundaries

- Write **only** these two files:
  - `data/families/<familyId>.json`
  - `data/vehicles/<familyId>.json`
- **Never** touch `data/vehicles.json`, `data/families.json`, `data/schema.js`, any other family's
  files, or anything outside `data/families/` and `data/vehicles/`. Another agent is researching a
  different family right now; writing a shared file will corrupt their work.
- Do **not** run any `git` command. Do not commit.
- Do **not** research, invent or include an `images` field. It is deferred and must be omitted
  entirely. Spend the effort on pricing accuracy and review quality instead.

## This brief is for plug-in hybrids ONLY

The EV brief tells researchers to exclude anything that isn't a pure battery-electric car. Here
that is reversed, and precisely:

- **Include** plug-in hybrids (PHEVs): a battery you charge from a plug, plus a combustion engine
  that can drive the wheels, with a meaningful electric-only range.
- **Exclude** pure battery-electric grades. If the family's range includes a BEV variant, leave it
  out and say so in your report — BEVs belong in the other brief's dataset, and mixing them in
  here would give them the wrong tax treatment.
- **Exclude** range-extenders (REEV / EREV), where the engine only ever charges the battery and
  never drives the wheels. The cost model assumes the engine can propel the car. Report any you
  found.
- **Exclude** conventional (non-plug-in) hybrids and mild hybrids. No plug, not in scope.

If a grade's classification is genuinely ambiguous, say so in your report rather than guessing.

## Why the tax treatment differs, and why your flags matter

Australia's FBT exemption for electric cars covered PHEVs until **1 April 2025**. It does not any
more. That exemption is the whole basis of the novated-lease advantage this site is built on, so a
PHEV's numbers depend on two eligibility flags you must establish from sources, not assume:

- **`isFuelEfficientForLct`** — whether the car qualifies for the Luxury Car Tax's *fuel-efficient*
  threshold ($91,661) rather than the ordinary one ($80,809). The test is combined-cycle fuel
  consumption at or below **3.5 L/100km**. Most PHEVs clear it comfortably on the combined-cycle
  label figure; some larger ones do not. Cite the figure you based this on.
- **`isGreenForVicDuty`** — whether the car attracts Victoria's *green passenger car* stamp-duty
  rate rather than the ordinary tiered rate. Establish this from the current VIC State Revenue
  Office definition, not from a news article.

Both are booleans and both are required. Getting one wrong changes the drive-away price.

## `data/vehicles/<familyId>.json` — an ARRAY of variant rows

One row **per variant currently orderable in Victoria**. Variant granularity is the point: a trim
crossing a tax threshold when the base trim does not is exactly the case this app exists to catch.
Do not collapse a range into one row, and do not invent variants that aren't on the configurator.

```json
[
  {
    "id": "<familyId>-<variant-slug>",
    "familyId": "<familyId>",
    "make": "BYD",
    "model": "Sealion 6",
    "variant": "Dynamic AWD",
    "bodyType": "SUV",
    "powertrain": "phev",
    "listPrice": 48990,
    "batteryKwh": 18.3,
    "rangeKm": 81,
    "consumptionKwhPer100km": 22.6,
    "combinedRangeKm": 1092,
    "fuelConsumptionL100km": 7.3,
    "isFuelEfficientForLct": true,
    "isGreenForVicDuty": true,
    "bootLitresSeatsUp": 425,
    "bootLitresSeatsDown": 1440,
    "seats": 5,
    "towKg": 1500,
    "warrantyYears": 6,
    "insuranceAnnual": 1700,
    "depreciationCurve": [1, 0.76, 0.65, 0.57, 0.50, 0.44],
    "sourcedAt": "2026-07-28"
  }
]
```

The example above is **illustrative shape only** — every number in it is a placeholder. Establish
your own from sources.

### The five PHEV-specific fields

- **`powertrain` must be the exact string `"phev"`** on every row. A row that omits it is treated
  as battery-electric and silently gets the FBT exemption it is not entitled to. `data/schema.js`
  now rejects a row carrying any PHEV-only field without this, and rejects `"phev"` without all of
  them, so you cannot half-declare a car — but get it right rather than relying on the validator.
- **`rangeKm` is the ELECTRIC-ONLY range**, not the combined range. This is the biggest difference
  from the EV brief, where `rangeKm` is the whole story. Use the WLTP electric range (EAER where
  published) and **state which standard your figure is** in your report. NEDC electric ranges are
  substantially optimistic and are still quoted by some Chinese-market sources.
- **`combinedRangeKm`** is electric plus a full tank. Must be greater than `rangeKm`; the validator
  enforces it.
- **`fuelConsumptionL100km` is the COMBUSTION-MODE figure** — what it drinks with the battery
  depleted, sometimes published as "charge-sustaining" or quoted in reviews as the real-world
  figure once the battery is flat. **It is not the combined-cycle label number.** The label figure
  (often 1–2 L/100km) assumes you start every trip with a full battery and is meaningless as a
  running cost. If the charge-sustaining figure is not published anywhere, use the best-sourced
  real-world review figure and **say explicitly in your report which you used** — this field drives
  the petrol half of the running cost, so a label number here understates it by a factor of three
  or more. Note that `isFuelEfficientForLct` is judged on the *combined-cycle* figure, so the two
  numbers legitimately differ and serve different purposes.
- **`consumptionKwhPer100km`** is electric consumption while running on battery. The validator
  computes `batteryKwh / rangeKm * 100` and rejects the row if your stated consumption is more than
  **25%** away from it. Use the **usable** battery capacity and the **electric** range from the same
  source so the three numbers agree.

### The shared fields

- **`listPrice` is the manufacturer list price BEFORE on-road costs** (MSRP / RRP / "plus on-road
  costs"). This is the single most common mistake: Australian sources very often quote a
  *drive-away* price instead. The calculator adds VIC stamp duty and registration itself
  (`calc/onroad.js`), so a drive-away figure here double-counts on-roads and corrupts the tax
  threshold logic. If a source only gives drive-away, find the list price elsewhere or back it out
  and say so. LCT is already embedded in the advertised list price — do not add it.
- **`bodyType`** must be exactly one of `SUV`, `Sedan`, `Hatch`, `Wagon`, `Ute`. Any other string
  silently breaks the body-type filter. Pick the closest of the five.
- `bootLitresSeatsDown` must be **>=** `bootLitresSeatsUp`. For a PHEV, use the boot figure **with
  the battery pack installed** — several PHEVs lose boot space to the pack versus their petrol
  twin, and the petrol car's brochure figure is a common trap.
- `seats` and `warrantyYears` must be whole numbers.
- **`warrantyYears` must be the UNCONDITIONAL term** — the cover a buyer gets with no strings
  attached. Many Australian brands advertise a longer term conditional on servicing exclusively
  within the dealer network. Record the fallback (BYD 6, MG 7, Mitsubishi 5, GWM 7, Ford 5,
  Mazda 5). `calc/rank.js` scores this field and headlines the winner as a reason, so a conditional
  number buys the car an advantage it hasn't earned. Put the conditional offer in `pros` as prose
  instead, stating the condition. **If a PHEV's battery carries a different warranty term from the
  vehicle, `warrantyYears` is the vehicle term** — mention the battery term in `pros`.
- `towKg` is the **braked** towing capacity; `0` if not rated to tow.
- `insuranceAnnual` is your estimate of a Melbourne comprehensive premium (must be 500–6000).
- `depreciationCurve` must start at `1`, decline monotonically, and stay within 0–1. Anchor it
  against comparable rows already in `data/vehicles.json` rather than inventing a scale. Adjust
  only on documented evidence (price cuts, discounting, thin local volume) and justify it.

### Numeric bounds — note these differ from the EV brief for PHEVs

`data/schema.js` applies **PHEV-specific bounds** to a row declaring `"powertrain": "phev"`:

| Field | PHEV bound | (BEV bound, for contrast) |
|---|---|---|
| `batteryKwh` | 8–60 | 15–200 |
| `rangeKm` | 30–200 | 100–1000 |
| `combinedRangeKm` | 300–1500 | n/a |
| `fuelConsumptionL100km` | 1–15 | n/a |

Unchanged for both: `listPrice` 15000–250000, `consumptionKwhPer100km` 8–35, `bootLitresSeatsUp`
100–1200, `bootLitresSeatsDown` 200–3000, `seats` 2–9, `towKg` 0–3500, `warrantyYears` 1–10.

A row that fails `node scripts/build-dataset.js` is wrong. **Fix the row, never the schema** —
unless you have established that a bound is genuinely wrong for real cars on sale, in which case
report it and change nothing.

## `data/families/<familyId>.json` — a single OBJECT

```json
{
  "id": "<familyId>",
  "summary": "Two to three sentences of consensus verdict in the app's own words.",
  "pros": ["...", "...", "..."],
  "cons": ["...", "..."],
  "sources": ["https://...", "https://..."],
  "sourcedAt": "2026-07-28"
}
```

- `summary`: 2–3 sentences, minimum 20 characters, in the app's own neutral consensus voice — not
  a quote, not marketing copy. Reflect where reviewers actually disagree.
- `pros`: **3–5** items. `cons`: **2–5** items (aim for 4). Every one must be a specific,
  discriminating claim a buyer could act on — a number, a named rival, a concrete failure mode.
  Not "good value" or "nice interior". These strings are what the app shows to justify a
  recommendation, and generic filler makes the shortlist useless.
- **At least one `con` should address the plug-in compromise honestly** if the sources support it:
  the weight penalty, the lost boot space, the charge-sustaining fuel consumption, or the fact that
  the economics collapse for a buyer who cannot charge at home. Reviewers are usually direct about
  this and the app should be too.
- `sources`: 4+ `https://` URLs you actually consulted. **Prefer CarExpert, Drive, CarsGuide,
  WhichCar, Chasing Cars, RACV** — verdicts on ride quality and value are market-specific, so
  Australian reviews are worth far more here than international ones.

## If the car is not on sale

If your family is not actually on sale new in Australia as at the research date (discontinued,
register-interest-only, never launched here), **write no files at all** and report that finding
with the evidence. Do not invent a plausible row.

## Verify before you report

From `/Users/nigel/projects/car-calc`, run:

```bash
node scripts/build-dataset.js
```

Confirm **no `FAIL` line mentions your own family id or any of your own vehicle ids**. A non-zero
exit code caused by the *other* agent's family still being written is expected and is not your
concern — only your own rows are. If your family appears in a FAIL line, fix it and re-run until
it doesn't.

## Report back

Return a short report covering:

- The variants and list prices you established.
- **Which standard each range figure came from** (WLTP EAER, WLTP combined, NEDC) — this is the
  figure most likely to be wrong and the one hardest to spot later.
- **Which fuel-consumption figure you used** for `fuelConsumptionL100km`: published
  charge-sustaining, real-world review, or (as a last resort) something else — and why.
- The evidence behind `isFuelEfficientForLct` and `isGreenForVicDuty`, with the combined-cycle
  figure you judged the LCT one on.
- Which tax thresholds the family straddles. $80,809 (ordinary LCT), $91,661 (fuel-efficient LCT)
  and $75,000 (the 2027 FBT phase cap) are the boundaries that flip a recommendation.
- Any BEV, REEV or non-plug-in grade you excluded.
- Anything you had to judge rather than source, and any figure you are less than confident in.
- Confirmation that the build showed no FAIL lines for your family.
