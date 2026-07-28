# EV family research brief — car-calc dataset

You are researching **one** EV family for the Australian (specifically Victorian) market and
writing **exactly two files**. Project root: `/Users/nigel/projects/car-calc`.
Research date to record: **2026-07-27**.

## Hard boundaries

- Write **only** these two files:
  - `data/families/<familyId>.json`
  - `data/vehicles/<familyId>.json`
- **Never** touch `data/vehicles.json`, `data/families.json`, `data/schema.js`, any other family's
  files, or anything outside `data/families/` and `data/vehicles/`. Parallel agents are working on
  other families right now; writing a shared file will corrupt their work.
- Do **not** run any `git` command. Do not commit.
- Do **not** research, invent or include an `images` field. It is deferred and must be omitted
  entirely. Spend the effort on pricing accuracy and review quality instead.

## Lessons from the first research wave — read these

1. **Any expectation in your task prompt about price band or FBT-threshold straddling is a LEAD,
   NOT A FACT.** In wave one, most families expected to straddle $75,000 turned out not to, because
   the "over $75k" figures in circulation were drive-away prices. Establish the truth and
   contradict your prompt in your report if that's what the sources say.
2. **Price the model year that is orderable NOW**, not the launch car. Several families had a
   mid-life update that changed battery, charging speed and price by five figures. If two price
   lists are in circulation, use the one the manufacturer's own configurator serves, and say which.
3. **Check the range hasn't been culled or withdrawn.** Wave one found grades deleted (MG's Excite
   pair), limited editions dropped from the price list, and one family (Hyundai Ioniq 6) reduced to
   a single variant because the mainstream grades were pulled from sale. Write only what is
   orderable at the research date.
4. **Exclude anything that isn't a pure battery-electric car** — no range-extenders (REEV/EREV),
   no plug-in hybrids. The calculator's electricity and consumption model assumes a BEV. Say in
   your report if you excluded such a grade.
5. **Anchor `insuranceAnnual` and `depreciationCurve` against comparable rows already in
   `data/vehicles.json`** rather than inventing a scale, so the dataset stays internally
   consistent. Deviate from the default curve only on documented evidence (price cuts, discounting,
   tiny local volume, a warranty cut) and justify it in your report.
6. **If the brand publishes only drive-away pricing** and no list price exists anywhere (Zeekr does
   this), back the list price out of the drive-away figure using the app's own VIC model —
   `list = (driveaway - 880) / 1.042` — verify it round-trips, and flag it clearly in your report.

## If the car is not on sale

If your family is not actually on sale new in Australia as at the research date (discontinued,
register-interest-only, never launched here), **write no files at all** and report that finding
with the evidence. Do not invent a plausible row. Already established as not on sale — do not
re-litigate: GWM Ora (discontinued, replaced by Ora 5 SUV) and Xpeng G9 (register-interest only).

## `data/vehicles/<familyId>.json` — an ARRAY of variant rows

One row **per variant currently orderable in Victoria**. Variant granularity is the whole point:
a Long Range trim crossing an FBT threshold when the base trim does not is exactly the case this
app exists to catch. Do not collapse a range into one row, and do not invent variants that aren't
on the configurator.

```json
[
  {
    "id": "<familyId>-<variant-slug>",
    "familyId": "<familyId>",
    "make": "Kia",
    "model": "EV5",
    "variant": "Air Standard Range",
    "bodyType": "SUV",
    "listPrice": 49720,
    "batteryKwh": 64.2,
    "rangeKm": 400,
    "consumptionKwhPer100km": 16.1,
    "bootLitresSeatsUp": 513,
    "bootLitresSeatsDown": 1714,
    "seats": 5,
    "towKg": 300,
    "warrantyYears": 7,
    "insuranceAnnual": 1800,
    "depreciationCurve": [1, 0.78, 0.68, 0.6, 0.53, 0.47],
    "sourcedAt": "2026-07-27"
  }
]
```

Field rules — every one of these is enforced by `data/schema.js`, and a violation fails the build:

- **`listPrice` is the manufacturer list price BEFORE on-road costs** (MSRP / RRP / "plus on-road
  costs"). This is the single most common mistake: Australian sources very often quote a
  *drive-away* price instead. The calculator adds VIC stamp duty and registration itself
  (`calc/onroad.js`), so a drive-away figure here double-counts on-roads and corrupts the FBT
  threshold logic. If a source only gives drive-away, find the list price elsewhere or back it out
  and say so in your report. Note LCT is already embedded in the advertised list price — do not add it.
- **`bodyType`** must be exactly one of `SUV`, `Sedan`, `Hatch`, `Ute`. Any other string
  silently breaks the body-type filter and the card silhouette. Pick the closest of those four. Wagon was dropped — no wagon is on sale, and an unfilterable body type is worse than an approximate one; if you find a genuine wagon, classify it as the nearest of the four and say so in your report.
- **`consumptionKwhPer100km` is cross-checked against `batteryKwh` and `rangeKm`.** The validator
  computes `batteryKwh / rangeKm * 100` and rejects the row if the stated consumption is more than
  **25%** away from it. Use the **usable** battery capacity and the **WLTP** range and combined
  consumption from the same source family so the three numbers agree. If they don't reconcile,
  you have mixed gross/usable capacity or WLTP/NEDC ranges — fix it rather than fudging one number.
- `bootLitresSeatsDown` must be **>=** `bootLitresSeatsUp`.
- `seats` and `warrantyYears` must be whole numbers.
- **`warrantyYears` must be the UNCONDITIONAL term** — the cover a buyer gets with no strings
  attached. Many Australian brands advertise a longer term that is conditional on servicing
  exclusively within the dealer network (MG "10 years", Nissan "10 years", Hyundai "7 years",
  Toyota's 7-year driveline). Record the fallback: MG 7, Nissan 5, Hyundai 5, Toyota 5, Kia 7,
  BYD 6, Tesla 5. `calc/rank.js` scores this field as `warrantyYears / 10` and headlines the
  winner as a reason, so a conditional number here buys the car an advantage it hasn't earned.
  Put the conditional offer in the family `pros` as prose instead, stating the condition.
- `towKg` is the **braked** towing capacity; use `0` if not rated to tow.
- `insuranceAnnual` is your estimate of a Melbourne comprehensive premium (must be 500–6000).
- `depreciationCurve` must start at `1`, decline monotonically, and stay within 0–1. Default for
  mainstream EVs is `[1, 0.78, 0.68, 0.6, 0.53, 0.47]`. Adjust only for families with notably
  strong or weak Australian resale, and say why in your report.
- Numeric bounds: `listPrice` 15000–250000, `batteryKwh` 15–200, `rangeKm` 100–1000,
  `consumptionKwhPer100km` 8–35, `bootLitresSeatsUp` 100–1200, `bootLitresSeatsDown` 200–3000,
  `seats` 2–9, `towKg` 0–3500, `warrantyYears` 1–10.

## `data/families/<familyId>.json` — a single OBJECT

```json
{
  "id": "<familyId>",
  "summary": "Two to three sentences of consensus verdict in the app's own words.",
  "pros": ["...", "...", "..."],
  "cons": ["...", "..."],
  "sources": ["https://...", "https://..."],
  "sourcedAt": "2026-07-27"
}
```

- `summary`: 2–3 sentences, minimum 20 characters, written as the app's own neutral consensus
  voice — not a quote, not marketing copy. Reflect where reviewers actually disagree.
- `pros`: **3–5** items. `cons`: **2–5** items (aim for 4). Every one must be a specific,
  discriminating claim a buyer could act on — a number, a named rival, a concrete failure mode.
  Not "good value" or "nice interior". These strings are what the app shows to justify a
  recommendation, and generic filler makes the shortlist useless.
- `sources`: 4+ `https://` URLs you actually consulted. **Prefer CarExpert, Drive, CarsGuide,
  WhichCar, Chasing Cars, RACV** — verdicts on ride quality and value are market-specific, so
  Australian reviews are worth far more here than international ones.

## Verify before you report

From `/Users/nigel/projects/car-calc`, run:

```bash
node scripts/build-dataset.js
```

Confirm **no `FAIL` line mentions your own family id or any of your own vehicle ids**. A non-zero
exit code caused by *another* family still being written by another agent is expected and is not
your concern — only your own rows are. If your family does appear in a FAIL line, fix it and
re-run until it doesn't.

## Report back

Return a short report: the variants and list prices you established, which FBT threshold(s) the
family straddles ($75,000 and $91,661 are the boundaries that flip the recommendation), anything
you had to judge rather than source, any figure you are less than confident in, and confirmation
that the build showed no FAIL lines for your family.
