# Wave 1, 2026-11-26

26 research agents in two groups of 13 (about 05:48 to 06:12 UTC), plus integration.
Totals: 3,078,994 subagent tokens; mean 118k (80k to 157k), 37 tool calls, 5m20s; slowest 9m14s.

## Coverage

- Updated (22): kia-ev3, bmw-ix3, mazda-cx-60-phev, xpeng-g6, zeekr-7x, polestar-4, volvo-ex90,
  jaecoo-j7-shs, geely-starray-em-i, cupra-tavascan, audi-q4-e-tron, audi-q6-e-tron, kgm-musso-ev,
  byd-shark-6, ford-ranger-phev, porsche-cayenne-phev, alfa-romeo-tonale-phev, mg-4, tesla-model-y,
  chery-e5 (renamed from chery-omoda-e5), deepal-s07 (run-out), volvo-xc60-phev (run-out),
  mercedes-eqa (run-out), vw-id5 (run-out).
- Removed families: bmw-i4, mercedes-eqb, bmw-x5-phev (sweep), renault-megane-e-tech (Techno
  run-out POA, facelift deposit-only), maserati-grecale-folgore (not in MY2026 line-up).
- Removed rows (grades gone or now option packs): xpeng-g6-performance-black-edition,
  zeekr-7x-performance-black-special-edition, volvo-ex90-plus-twin-motor, audi-q4-e-tron-45,
  audi-q4-e-tron-sportback-45, audi-q6-e-tron-performance, -quattro, -sportback-quattro,
  kgm-musso-ev-2wd-black-edge, byd-shark-6-dynamic-cab-chassis, mercedes-eqa-250-plus-city-edition,
  -night-edition.
- Added rows: kia-ev3-gt-line-awd, volvo-ex90-plus-single-motor, jaecoo-j7-shs-summit-awd,
  geely-starray-em-i-inspire-awd, cupra-tavascan-v, four porsche-cayenne-phev Black Editions.

## Threshold crossings

- Under $75,000 now: polestar-4 Rear ($73,900), mazda-cx-60-phev Azami ($74,840) and GT.
- Over $75,000 now: cupra-tavascan-vz ($75,490).
- Under $91,661 now: audi-q4-e-tron quattro pair ($81,650 / $83,250), audi-q6-e-tron RWD pair ($89,900).

## Integration fixes

- tesla-model-3 boot set to the owner convention (594 / 977 L, frunk not added).
- Watchlist: new entries for iX3 40, iX3 M60, Q4 RWD, Zeekr 7X Black pack, Deepal S07 update,
  Chery New E5, XC60 long-range, EQA and ID.5 run-out, Maserati Folgore; Megane entry moved to
  model scope; gross-battery entry narrowed to kia-ev4 / Hyundai.

## Flags for later waves or the owner

- byd-shark-6-performance consumption is capped at the schema ceiling (35); battery ÷ range is 37.
- jaecoo-j7-shs towKg 0: AU sheet lists only unbraked; UK rates 1,500 kg braked.
- Depreciation conventions still mixed within Zeekr, Volvo and Mercedes.
- Leads for later families: kia-ev4 batteries are gross (same packs as EV3); mazda-cx-80-phev
  battery 17.8 is gross; volvo-xc90-phev fuel 7.7 is below the lighter XC60's 8.4.
- Manufacturer sites blocked or script-rendered for most agents; the auto-mode permission check
  refused a curl or internal price API in about a third of runs, and every agent stopped there.
