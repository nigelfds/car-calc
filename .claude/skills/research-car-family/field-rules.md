# Field rules

What every field means and how to fill it. `data/schema.js` is the source of truth for types and
numeric bounds (`NUMERIC_BOUNDS`, `PHEV_BOUNDS`) and the build enforces them; this file covers the
meaning the schema cannot check. A row the build rejects is wrong: fix the row.

## Variant rows: `data/vehicles/<familyId>.json`

An **array**, one row per grade orderable in Victoria. Variant granularity is the point of the app:
a Long Range grade crossing a tax threshold when the base grade does not is exactly what it exists
to catch. Keep one row per configurator price line.

```json
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
  "sourcedAt": "<research date>"
}
```

Numbers above are shape only. In `update` mode keep existing `id`s for grades that still exist, so
links and the Compare tab's saved slots keep working; give a renamed grade a new id only when it is
a different car.

### Identity

- **`bodyType`** is exactly one of `SUV`, `Sedan`, `Hatch`, `Ute`. Binding decisions: `Sedan`
  includes four-door liftbacks and fastbacks; people movers file as `SUV` (passenger versions only);
  the Deepal E07 is an `SUV`. **Wagons are excluded**: write no row for a wagon, and for a model sold
  as both, write only the non-wagon grades and name the wagon in your report. A missing car is
  honest; a miscategorised one competes on boot space against the wrong shapes.
- Cab-chassis and panel-van variants are out of scope. Dual-cab pickups are in.
- **`powertrain`**: omit it for a battery-electric car (absent means `bev`). Set `"phev"` on every
  plug-in hybrid row. Range-extenders (the engine only charges the battery) and non-plug-in hybrids
  are out of scope in both; report any you excluded. A BEV grade inside a PHEV family, or the
  reverse, belongs in its own family.

### Price

- **`listPrice` is the manufacturer list price before on-road costs** (MSRP, RRP, "plus on-road
  costs"). `calc/onroad.js` adds Victorian stamp duty and registration itself, so a drive-away figure
  double-counts on-roads and corrupts every threshold. LCT is already inside the list price. This is
  the most common error in the dataset's history; the price rules in [sources.md](sources.md) say how
  to find and verify it.

### Battery, range, consumption

These three are cross-checked: the build rejects a row whose `consumptionKwhPer100km` is more than
25% from `batteryKwh / rangeKm × 100`. Take all three for the **same pack, same wheel, same
standard**, so they agree because they describe one car.

- **`batteryKwh` is the usable capacity.** Gross figures are common and unlabelled; see the battery
  rules in [sources.md](sources.md). It is read by nothing but the cross-check, so a gross figure eats
  the tolerance and blinds the check.
- **`rangeKm`**: for a BEV, the whole driving range. For a PHEV, the **electric-only** range. Use the
  range standard rule in [sources.md](sources.md) and name the standard in the provenance.
- **`consumptionKwhPer100km`**: energy per 100 km while driving on battery. Prefer a published
  EV-mode figure; otherwise derive it as usable battery ÷ range × 100 and mark it `derived`. A derived
  value makes the cross-check tautological, which is acceptable as long as provenance says so.
  **Never use the ADR / VESR electric-consumption label for a PHEV**: it is utility-factor-weighted
  grid energy over total driving, a different quantity (Kia Sorento's sat 30.7% off).

### Space, seats, towing

- `bootLitresSeatsDown` ≥ `bootLitresSeatsUp`. For a PHEV, take the figure with the battery fitted;
  the petrol twin's brochure figure is a trap. When the folded figure is genuinely unpublished, scale
  it from a comparable car's ratio, mark it `judged`, and say so.
- `seats` is a whole number: the maximum seating of that grade.
- `towKg` is the **braked** capacity from the manufacturer's technical spec sheet (marketing pages
  overstate: KGM's "up to 2.3 tonne" against a 1,800 kg sheet; aggregators gave the Q4 55 quattro
  2,200 kg against Audi's 1,200 kg). `0` when not rated to tow.

### Warranty, insurance, depreciation

- **`warrantyYears` is the unconditional vehicle term**, a whole number. Many brands advertise a
  longer term conditional on dealer servicing; record the fallback. Reference values: Kia 7, MG 7,
  GWM 7, BYD 6, Hyundai 5, Nissan 5, Toyota 5, Tesla 5, Mitsubishi 5, Ford 5, Mazda 5. `calc/rank.js`
  scores this field and headlines the winner, so a conditional term buys an unearned win. Put the
  conditional offer, with its condition, and any separate battery term in `pros`.
- **`insuranceAnnual`** is a judged Melbourne comprehensive premium. Anchor it against siblings and
  similarly priced rows in `data/vehicles.json`; mark it `judged` and name the anchor.
- **`depreciationCurve`** starts at `1`, declines monotonically, stays within 0–1. The mainstream
  default is `[1, 0.78, 0.68, 0.6, 0.53, 0.47]`. Deviate only on documented evidence (heavy price
  cuts, discounting, thin local volume, a warranty cut), keep one convention per brand, and give the
  evidence in the provenance note.

### Utes

- Set **`isNonPassengerForVicDuty: true`** on every ute row. Victoria charges utes as goods vehicles
  (2.7%) whatever their emissions; without the flag the ute is billed as a passenger car.
- Set `bootLitresSeatsUp` equal to `bootLitresSeatsDown`, both the tub volume. If no litre figure is
  published, multiply the tub dimensions out, mark it `judged`, and note it reads 10–20% high.
- A battery-electric ute omits `isGreenForVicDuty` (it is PHEV-only and the build rejects it). A PHEV
  ute sets `isGreenForVicDuty: false`.

### PHEV-only fields

Required on every `"phev"` row and rejected on any other.

- **`combinedRangeKm`** is computed, because almost no market publishes a WLTP-based total range:
  `WLTP electric range + tank litres ÷ fuelConsumptionL100km × 100`. Source the tank capacity and use
  the same `fuelConsumptionL100km` you wrote to the row. Prefer a manufacturer total only when it is
  itself built on WLTP (Lexus's is built on NEDC). It must exceed `rangeKm`.
- **`fuelConsumptionL100km`** is the **charge-sustaining** figure (battery depleted), not the
  combined-cycle label (1–2 L/100km, which assumes a full battery every trip). Use a published
  charge-sustaining figure, else the best-sourced real-world review figure, and say which. It drives
  the petrol half of the running cost.
- **`isFuelEfficientForLct`**: true when the combined-cycle label consumption is at or below
  3.5 L/100km, which earns the fuel-efficient LCT threshold. Cite that label figure.
- **`isGreenForVicDuty`**: whether Victoria's State Revenue Office treats it as a green passenger
  car. Establish from the current SRO definition. `false` on a ute.

Plug-in hybrids lost the FBT exemption on 1 April 2025, so these flags, not the exemption, decide a
PHEV's numbers.

## Family file: `data/families/<familyId>.json`

A single object:

```json
{
  "id": "<familyId>",
  "summary": "Two to three sentences of consensus verdict in the app's own words.",
  "pros": ["..."],
  "cons": ["..."],
  "sources": ["https://..."],
  "sourcedAt": "<research date>"
}
```

- **`summary`**: 2–3 sentences in the app's neutral consensus voice. Reflect where Australian
  reviewers disagree. When a range is thin because grades were withdrawn, say so here: a withdrawn
  grade otherwise looks identical to an unresearched one.
- **`pros`: 3–5 items. `cons`: 2–5, aim for 4.** The schema enforces only the minimums; stay within
  the maximums. Each item is a specific, discriminating claim a buyer could act on: a number, a named
  rival, a concrete failure mode. These strings justify the shortlist.
- For a PHEV, at least one `con` addresses the plug-in compromise where sources support it: weight,
  lost boot space, charge-sustaining consumption, or economics that collapse without home charging.
- **`sources`**: 4+ `https://` URLs you actually opened. Prefer Australian reviews (CarExpert, Drive,
  CarsGuide, WhichCar, Chasing Cars, RACV) plus the manufacturer's Australian pages.
- No `image` field. Images live in `data/car-images.json` and are curated separately.

## Thresholds to report

Read current values from `data/tax-tables.json`. As of November 2026: **$91,661** (fuel-efficient
LCT threshold, and the FBT exemption ceiling for a BEV), **$80,809** (ordinary LCT threshold, which
matters for a PHEV failing the 3.5 L/100km test), and **$75,000** (the FBT full-exemption cap from
1 April 2027).
