# Trial batch of 10, 2026-11-26

Ten research agents (skill: research-car-family), all dispatched at once, research date 2026-11-26.

## Per agent

| Family | Mode | Site blocked | Tokens | Tool calls | Time |
|---|---|---|---:|---:|---:|
| smart-5 | new | | 91,345 | 20 | 2m34s |
| hyundai-inster | update | | 112,964 | 21 | 2m54s |
| mazda-cx-6e | new | | 101,895 | 27 | 3m40s |
| tesla-model-3 | update | yes | 105,896 | 32 | 4m27s |
| byd-atto3 | update | | 106,633 | 32 | 4m37s |
| mitsubishi-outlander-phev | update | yes | 112,916 | 35 | 5m09s |
| kia-ev5 | update | | 125,033 | 46 | 5m39s |
| toyota-bz4x | update | yes | 124,639 | 45 | 5m58s |
| gwm-cannon-phev | new | | 129,380 | 39 | 6m08s |
| mg-s5 | update | | 131,174 | 41 | 7m29s |
| **Total / mean** | | | **1,141,875 / 114,188** | **338 / 34** | **mean 4m52s, slowest 7m29s** |

New families averaged 108k tokens, updates 117k. The three agents facing blocked manufacturer
sites averaged 114k: blocks cost no extra, because agents fell back to Australian launch reviews.

## Outcome

- 10 of 10 finished; every provenance check passed; build 321 variants / 139 families, 0 failures.
- One test failed after integration (stale watchlist entries for families now held); fixed in
  data/watchlist.json, 666/666 passing.
- Two agents had a fetch refused by the auto-mode classifier (a curl retry on tesla.com, Kia's
  internal price endpoint). Both stopped and used other sources, as intended.

## Errors in held data that the trial caught

- mg-s5: held list prices were drive-away figures ($42,990 / $47,990). Now backed out to
  $39,453 / $44,251, checked against the configurator's own per-state duty offsets.
- kia-ev5: batteries were gross (88.1 → 84 usable; 64.2 → 61.2 judged). Air Standard Range tow
  was 1,250 kg; Kia's sheet says 300 kg.
- toyota-bz4x: 2WD battery was gross (74.7 → 71.0); boot 452 L was a UK figure (now 421 / 410).
- mitsubishi-outlander-phev: charge-sustaining fuel 6.7 was the pre-update car's (now 7.1);
  20-inch grades 83 km, not 86; combined range 877 → 829–832.
- tesla-model-3: new $45,900 base RWD; Long Range was $90 high; Performance range 571 → 600 and
  its price is over $75,000, which the old prose denied.
- hyundai-inster: two of four grades gone, prices down $1,500.
- byd-atto3: now Essential plus two Evo grades; Premium Extended Range gone; BYD's spec-table
  ranges were NEDC and were rejected.

## Open questions for the owner

- toyota-bz4x Touring is held as an SUV, but data/watchlist.json lists it as an excluded wagon,
  and its twin subaru-trailseeker is held as an SUV. Either fix the watchlist or drop both.
- mazda-cx-6e boot uses Mazda's to-the-roof figures (468 / 1,434 L); to the cover it is
  363 / 956 L. mazda-6e rows look like the to-cover convention.
- MG has two depreciation conventions (mg-4 mainstream default; mg-s5, mg-s6 steeper).
- smart-1-pro-plus held at $49,990; Chasing Cars says $49,900.

## Low-confidence figures (from the agents' reports)

Listed in full in each data/provenance/<id>.json `lowConfidence`. Most common: insurance and
depreciation (judged, every family), list prices read from outlets because the configurator was
unreadable (tesla, kia, toyota, mitsubishi, mazda, hyundai), usable battery inferred from EV
Database (several), gwm-cannon-phev range NEDC only and fuel 8.1 derived from an NEDC claim.
