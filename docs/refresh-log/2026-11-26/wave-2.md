# Wave 2, 2026-11-26

26 research agents started at 7 PM Melbourne (08:01 UTC), up to 20 at a time, plus integration.
Totals: 3,259,510 subagent tokens; mean 125k (87k to 169k), 39 tool calls, 5m07s; slowest 11m11s
(hyundai-ioniq-9).

## Coverage

- Updated (26): byd-atto1, byd-atto2, byd-dolphin, byd-seal, byd-seal-6, byd-sealion-5,
  byd-sealion-6, byd-sealion-7, byd-sealion-8, kia-ev4, kia-ev6, kia-ev9, kia-sorento-phev,
  hyundai-elexio, hyundai-ioniq-5, hyundai-ioniq-6, hyundai-ioniq-9, hyundai-kona-electric,
  genesis-gv60, genesis-gv70-electrified, chery-tiggo-7-phev, chery-tiggo-8-phev,
  chery-tiggo-9-phev, jaecoo-j5-ev, jaecoo-j8-shs, omoda-9-shs.
- Removed row: byd-sealion-6-premium-awd (18.3 kWh car, no longer in the configurator).
- Added row: byd-sealion-6-premium-extended-range (26.6 kWh AWD, $52,990).
- No families added or removed.

## Notable changes

- Price moves: kia-ev6 MY27 +$205 every grade; kia-ev9 GT $129,600; kia-sorento-phev MY27
  ($71,175 to $86,115); chery-tiggo-7-phev cut $5,000; omoda-9-shs $58,990 (configurator; outlets
  still say $61,990, low confidence); genesis-gv70 $132,718 and hyundai-ioniq-6 N $114,918 and
  ioniq-9 $119,668 (LCT indexation).
- NEDC ranges replaced with WLTP: sealion-5, sealion-6, tiggo-7/8/9, j8-shs, omoda-9-shs.
  byd-sealion-8 stays NEDC (no WLTP in any market).
- Gross battery figures settled to usable: kia-ev4, kia-ev6, kia-ev9, hyundai-elexio, ioniq-5,
  ioniq-6, ioniq-9 (106 of 110.3), genesis-gv60/gv70 (80 of 84).
- Towing corrected from 0: genesis-gv60 (1,600 / 2,400 kg), kona-electric 64.8 kWh rows (750 kg);
  kia-ev6 now 1,800 kg on every grade.

## Threshold crossings

None. Every row stayed on the same side of $75,000, $80,809 and $91,661.

## Integration fixes

- Depreciation, one curve per brand: byd-atto3, hyundai-ioniq-6 and hyundai-ioniq-9 moved to the
  [1, 0.74, 0.63, 0.55, 0.48, 0.42] curve the other BYD and Hyundai rows carry. Genesis, Kia,
  Chery, Jaecoo and Omoda were already on one curve each after this wave.
- Watchlist: removed the gross-battery backlog entry (all families settled); Ioniq 6 standard
  grades rechecked, next check 2027-02-26.

## Flags for later or the owner

- byd-seal-6 combinedRangeKm capped at the schema ceiling 1,500 (formula gives 1,532; BYD UK says
  1,505). The ceiling may need raising.
- Fuel ordering inside Chery: tiggo-8-phev 5.6 now sits below tiggo-7-phev 6.0 (different sources).
- BYD PHEV fuel basis is mixed: sealion-5 keeps BYD AU's NEDC-basis 4.5; seal-6 and sealion-6 use
  UK/EU WLTP charge-sustaining figures. Worth settling across all BYD PHEVs.
- hyundai-kona-electric Premium N Line kept as a row although Hyundai calls it an option pack.
- Many prices rest on outlets because Kia, Hyundai and Genesis configurators are postcode-gated or
  JavaScript-rendered; the permission check refused direct price-API calls, as intended.
