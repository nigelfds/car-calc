# Provenance file

`data/provenance/<familyId>.json` records where every figure on every row came from, so a reviewer can
audit one number without redoing the research, and the next refresh can re-open the exact pages
instead of searching. `scripts/check-provenance.js` validates it against the vehicle rows; the build
does not read it, and the app never ships it.

## Shape

```json
{
  "familyId": "kia-ev5",
  "researchedAt": "2026-11-27",
  "mode": "update",
  "variants": {
    "kia-ev5-air-standard-range": {
      "availability": { "basis": "sourced", "url": "https://www.kia.com/au/shopping-tools/build-and-price.html" },
      "listPrice": { "value": 49720, "basis": "sourced", "url": "https://...", "note": "Kia AU price list, 'plus on-road costs'" },
      "batteryKwh": { "value": 62.4, "basis": "sourced", "url": "https://...", "note": "usable; gross 64.2 on the same page" },
      "rangeKm": { "value": 400, "basis": "sourced", "standard": "WLTP", "url": "https://..." },
      "consumptionKwhPer100km": { "value": 15.6, "basis": "derived", "note": "batteryKwh / rangeKm × 100" },
      "insuranceAnnual": { "value": 1800, "basis": "judged", "note": "anchored to kia-ev3 and tesla-model-y rows" },
      "towKg": { "value": 300, "basis": "carried", "note": "model year unchanged since 2026-07-27" }
    }
  },
  "lowConfidence": [
    "kia-ev5-gt-line.listPrice: one source only, Kia site timed out"
  ]
}
```

## Rules

- **One entry under `variants` per row** in `data/vehicles/<familyId>.json`, keyed by the row's `id`,
  and no entries for rows that do not exist.
- Each entry carries **`availability`** (the page showing the grade orderable) and one entry for every
  required field: `listPrice`, `batteryKwh`, `rangeKm`, `consumptionKwhPer100km`, `bootLitresSeatsUp`,
  `bootLitresSeatsDown`, `seats`, `towKg`, `warrantyYears`, `insuranceAnnual`, `depreciationCurve`;
  on a PHEV row also `combinedRangeKm`, `fuelConsumptionL100km`, `isFuelEfficientForLct`,
  `isGreenForVicDuty`.
- **`value` equals the row's value exactly** (arrays compared element by element).
- **`basis`** is one of:

  | Basis | Meaning | Needs |
  |---|---|---|
  | `sourced` | Read off a page | `url` |
  | `backed-out` | List price computed from a drive-away figure | `url` of the drive-away source, `note` with the round-trip result |
  | `derived` | Computed from other fields or sourced inputs | `note` with the formula |
  | `judged` | Your estimate (insurance, depreciation, an unpublished boot figure) | `note` naming the anchor or evidence |
  | `carried` | Kept from earlier research without re-checking, `update` mode only | `note` saying why it was safe to keep |

- `listPrice` is never `carried`: prices are re-verified every refresh. `availability` is `sourced`.
- `rangeKm` with basis `sourced` names its **`standard`**: `AU-certified`, `WLTP`, `NEDC` or `other`
  (explain in `note`).
- Every `url` is `https://` and is a page you opened in this run.
- `lowConfidence` lists every figure you are less than confident in as `"<rowId>.<field>: reason"`,
  matching your report. An empty list is a claim that nothing is soft; make it only when true.
