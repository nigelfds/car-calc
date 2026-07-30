# Compare tab — design

**Date:** 2026-07-30
**Branch:** `feature/compare-tab`
**Status:** approved, ready for implementation planning

## What this is

A second tab that explores the existing dataset a different way: pick up to three cars and
compare them side by side. The current three-step flow becomes the default tab and is
otherwise untouched.

The comparison is **specs only**. It does not cost a car under a novated lease, a loan or
cash, and it does not read salary, budget, term or any other step-1 input. That keeps the
tab self-contained, keeps a shared comparison link free of the reader's income, and keeps
`calc/compare.js` (the money path) out of the change entirely.

Any car in the dataset can be compared against any other. There is no body-type
restriction and no preference filtering: all 216 variants are selectable, and the only
limit is what the data holds.

## Why "not like for like" is the hard part

The dataset has **no missing values** — every one of the 216 variants has a figure for
every numeric field. So the difficulty is not gaps, it is *semantics*: two cars can both
have a number in `rangeKm` and have it mean different things.

- A BEV's `rangeKm` is total driving range (≈400–680 km). A PHEV's `rangeKm` is
  electric-only range (43–183 km); its total is `combinedRangeKm` (up to 1,340 km).
- A PHEV's `consumptionKwhPer100km` applies only in electric mode, and it also burns
  petrol (`fuelConsumptionL100km`). A BEV has no petrol figure at all.
- A ute's "boot" is an open tray. Every ute in the dataset has `bootLitresSeatsDown`
  equal to `bootLitresSeatsUp`, so a seats-down row reads as a tie that is not one.
- Boot litres for a 6-seater are measured behind a different row of seats than for a
  5-seater.
- Being under the $91,661 threshold buys a BEV the novated-lease FBT exemption. It buys a
  PHEV nothing — PHEVs lost that exemption on 1 April 2025.

Calling these out on the row where they bite is the feature's main job.

## 1. Shell and routing

The existing `#about`, `#afford` and `#cars` sections are wrapped in one tab panel — the
default, with no changes to their markup or behaviour. A second panel holds Compare.

Tabs follow the ARIA tab/tabpanel pattern: `role="tablist"`, `aria-selected`, arrow-key
navigation, and panels hidden with the `hidden` attribute.

### URL state

The slots live in the query string, so a comparison is shareable and a future "send these
cars to Compare" button on tab 1 is just a matter of building a link.

```
?tab=compare&compare=kia-ev5-air-long-range,tesla-model-y-premium-rwd
```

`public/ui/state.js` already has the machinery. Add `tab` to `STRING_FIELDS` and `compare`
to `ARRAY_FIELDS`, with defaults `tab: 'find'` and `compare: []`.

Three rules the serialiser needs, because `toQueryString` compares against defaults by
value and would otherwise emit junk:

1. An empty slot serialises as an empty segment, so slot position survives a share:
   `compare=id1,,id3`.
2. Trailing empty slots are trimmed before writing, and an all-empty array is normalised
   to `[]` so it is dropped from the URL entirely. Without this, three empty slots
   serialise as the literal string `,,`.
3. On read: unknown ids are ignored and leave the slot empty rather than throwing, and
   the array is truncated to three entries.

### The hidden-chart hazard

`ui/app.js` repaints the crossover chart on `window.resize` and `orientationchange`
regardless of which tab is showing. Measuring a hidden element gives zero widths, so a
resize while Compare is open would corrupt the chart's cached layout.

Two guards: `renderChart` returns early on a zero-width container, and switching back to
tab 1 triggers a repaint via the existing debounced `rerenderChartForViewport`.

## 2. Slots and autocomplete

Three slots. Each is an ARIA combobox over all 216 variants — no filtering by the step-1
preferences.

- Matching runs across make, model and variant, so `ev5`, `kia 5` and `sealion` all land.
- Results group under the model name; four Kia EV5 trims in a flat list is noise.
- Each result shows variant, list price, body type and a BEV/PHEV badge — enough to pick
  the right trim without leaving the list.
- Keyboard: up/down to move, Enter to pick, Escape to close.
- Picking commits immediately and the comparison repaints. There is no Apply button.
- Result count is capped at 8.

Slot 3 is optional: two cars is a valid comparison, and the tab is useful the moment the
second slot fills. Below two filled slots the tab shows an empty state rather than a
half-drawn table.

A filled slot can be cleared, and clearing shifts nothing — slot 2 emptied stays slot 2.

## 3. Rows

Eighteen rows in four groups, then the written material.

### Price

| Row | Unit | Better | Notes |
|---|---|---|---|
| List price | $ | lower | |
| Drive-away (Vic, est.) | $ | lower | `calc/onroad.js` `driveAwayPrice`, using each row's `isGreenForVicDuty` / `isFuelEfficientForLct` / `isNonPassengerForVicDuty` flags. Includes stamp duty and one year's registration; **excludes LCT**, which is already embedded in the list price. Needs only the vehicle and `tables` — no user input. |
| Under the $91,661 threshold | yes/no | — | A pure `listPrice <= tables.lct.fuelEfficientThreshold` test. It must **not** call `fbtTreatment`, which requires a lease start date this tab deliberately does not have. |
| Resale after 5 years | % of list retained | higher | `depreciationCurve[5]`. |

### Practicality

| Row | Unit | Better |
|---|---|---|
| Body type | text | — |
| Seats | count | — (more is not better) |
| Boot, seats up | L | higher |
| Boot, seats down | L | higher |
| Braked towing | kg | higher |

### Energy

| Row | Unit | Better | Notes |
|---|---|---|---|
| Powertrain | BEV / PHEV | — | The row that explains most of the caveats below it. |
| Electric range | km | higher | `rangeKm` for both powertrains — like for like by construction. |
| Total range | km | higher | `combinedRangeKm` for a PHEV, `rangeKm` for a BEV. |
| Battery | kWh | higher | |
| Energy use | kWh/100km | lower | Electric mode only for a PHEV. |
| Petrol use | L/100km | lower | Em-dash for a BEV. The row is **omitted entirely** when the set holds no PHEV, rather than printing a row of em-dashes. |

Splitting range into **electric** and **total** is deliberate. One combined "range" row
would need a caveat to be readable at all; two rows are each genuinely comparable, and the
caveat then only has to explain what "total" assumes.

### Ownership

| Row | Unit | Better |
|---|---|---|
| Warranty | years | higher |
| Insurance (est. annual) | $ | lower |
| Data sourced | date | — |

### Written material

Below the table, per car: the family `summary`, `pros`, `cons`, and `sources` as links.
Sourced from `data/families.json` via `familyId`. A variant whose family record is missing
renders the table row and omits the prose rather than failing.

## 4. Callouts and best-in-row

A pure function in `calc/spec-compare.js` takes the two or three vehicles plus `tables`
and returns the row model. All caveats are derived from the data — none are hand-written
per car.

### Rules

| Id | Fires when | Applies to |
|---|---|---|
| `mixed-powertrain` | the set holds both a BEV and a PHEV | Total range, Battery, Energy use, Petrol use |
| `phev-present` | the set holds **any** PHEV | Under the $91,661 threshold |
| `ute-vs-other` | the set holds a Ute and a non-Ute | Boot seats up, Boot seats down |
| `ute-present` | the set holds any Ute | Boot seats down |
| `mixed-seats` | the filled slots have more than one distinct seat count | Boot seats up, Boot seats down |

`phev-present` is deliberately not folded into `mixed-powertrain`: an all-PHEV comparison
would otherwise print "yes" against the threshold row with no caveat, implying an FBT
exemption that no PHEV has had since 1 April 2025. The threshold is a real fact about the
car's price either way — the row stays, and the caveat says what it does and does not buy.

Wording, in each case, names the car responsible and gives the number that makes the row
readable — for example, on Total range: *"Not like for like — the Sealion 6 is a plug-in
hybrid: 140 km on battery, then petrol to 1,340 km. These two are battery only."*

Several rules can hit one row. Boot seats-down can attract three at once, which is a wall
of amber. So each row carries an ordered caveat list and **renders at most two**, in
precedence order `ute-vs-other` > `ute-present` > `mixed-seats` > `mixed-powertrain` >
`phev-present` — the more specific wording subsumes the more general.

### Winner marking

- **A caveated row marks no winner at all.** If the numbers cannot be read straight
  across, neither can a "best".
- Rows with no meaningful direction — Body type, Seats, Powertrain, Under the threshold,
  Data sourced — never mark a winner.
- A tie across all filled slots marks no winner.
- **Best-in-row is computed across every filled slot, including the car benched off-screen
  on mobile.** This is the trap the mockups exposed: a two-up view that scores only what it
  shows puts the marker on a $61,170 car while the actual cheapest sits benched at
  $46,990. The marker would be lying.

## 5. Layout

### Desktop (≥700px)

A conventional table: a label column and three car columns. No bench. A caveat renders as
a full-width band directly beneath the row it qualifies.

### Mobile (<700px)

Two car columns; the third car waits on a bench chip above the table and swaps in on tap.
Tapping a benched chip swaps it with the **right-hand** visible column, which is
predictable and needs no extra affordance.

Bench position is view state only. It is not in the URL — it is an artefact of the
viewport, not of the comparison.

Two callout types, visually distinct:

- **Amber — "not like for like".** The rules above. Identical on desktop and mobile.
- **Grey — "off screen".** Mobile only, and only when all three slots are filled and the
  benched car holds best-in-row on that row. It names the car and gives the number:
  *"Off screen · Sealion 6 — cheapest of the three at $46,990."* Suppressed on caveated
  rows, where no winner exists to report.

A dot on the bench chip marks that the benched car appears in at least one callout, so the
reader is warned before scrolling.

Pros and cons stack full-width per car below the table, with the benched car's collapsed.

## 6. Modules

Following the existing conventions: no bundler, no framework, native ES modules, pure
calculation in `calc/`, rendering in `public/ui/`. Renderers build an HTML string and
assign it to a container found via `root.querySelector`, so they can be tested in Node
against a stub — matching `renderCards` in `ui/cars.js`. Listeners bind once against a
stable parent and use delegation, matching `bindPresets` in `ui/sections.js`.

### New

| File | Responsibility |
|---|---|
| `calc/spec-compare.js` | Pure. `comparisonRows(vehicles, tables)` → grouped rows with values, winner index and caveats. Exports its row specification so tests can assert coverage. Knows nothing about the DOM. |
| `calc/spec-compare.test.js` | Row values, winner selection, every caveat rule, precedence, winner suppression, ties, two-car sets. |
| `public/ui/autocomplete.js` | `searchVehicles(vehicles, query, limit)` as a pure export, plus a thin combobox layer bound once. |
| `public/ui/autocomplete.test.js` | Ranking and grouping of matches, cap, empty query, no-match. |
| `public/ui/compare-tab.js` | Renders slots, table, callouts and prose from the row model. |
| `public/ui/compare-tab.test.js` | Markup assertions against a stubbed root: caveat text, winner marker present/absent, off-screen note, empty state. |
| `public/ui/tabs.js` | Tab switching, ARIA state, URL sync. |
| `public/ui/tabs.test.js` | Switching, default tab, unknown tab value falls back to `find`. |

### Touched

- `public/index.html` — tablist, two panels, compare markup.
- `public/ui/state.js` — `tab` and `compare` fields, plus the three serialisation rules.
- `public/ui/app.js` — wire the tab, mount the compare tab, guard the chart repaint.
- `public/ui/crossover-chart.js` — early return on a zero-width container.
- `public/styles.css` — tabs, slots, comparison table, callouts, the <700px layout.

Not touched: `ui/cars.js`, `ui/sections.js`, `ui/slider.js`, and the whole money path in
`calc/` apart from importing `driveAwayPrice`.

## 7. Testing

`node --test`, no framework, matching the existing 330-test suite. Tests live beside the
module they cover and run identically in Node and the browser.

The bulk of the value is in `calc/spec-compare.test.js`, because the caveat rules are the
feature. Each rule gets a test that it fires when it should, a test that it does not fire
when it should not, and a test that the row it qualifies marks no winner.

The pre-push hook runs the suite and must be green before this branch merges.

## 8. Out of scope

- Costing a comparison under the three funding options.
- Any "send to Compare" button on the step-1 shortlist. The URL contract exists so this can
  be built later without touching the compare tab.
- Comparing more than three cars.
- Car photography, consistent with the rest of the app.
- Persisting comparisons anywhere but the URL.
