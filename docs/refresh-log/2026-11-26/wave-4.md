# Wave 4, 2026-11-26

Started at midnight Melbourne (27 Nov) after the wave 3 rerun finished, when the usage window
reset. BMW, Mercedes, MINI, Volvo, Lexus, Toyota, Subaru and Polestar 2.
26 agents: 2,869,927 subagent tokens; mean 110k, 37 tool calls, 4m23s.

## Coverage

- Updated (26): bmw-i5, bmw-ix, bmw-ix1, bmw-ix2, bmw-x1-phev, bmw-x3-phev, mercedes-c-350e-phev,
  mercedes-cla-ev, mercedes-gla-phev, mercedes-glc-phev, mini-aceman, mini-cooper-electric,
  mini-countryman-electric, volvo-es90, volvo-ex30, volvo-ex40, volvo-xc90-phev, lexus-nx-phev,
  lexus-rx-phev, lexus-rz, toyota-hilux-bev, toyota-rav4-phev, subaru-solterra,
  subaru-trailseeker, subaru-uncharted, polestar-2.
- bmw-ix1: generic xDrive30 row removed (MY26 sells only the M Sport); new row xDrive30 Sport
  Collection, $75,835 backed out of a $79,900 national drive-away (limited edition).
- No families added or removed. Variant count stays 312.

## Notable changes

- Prices up: bmw-x3-phev $107,700 (was $104,800), bmw-x1-phev $79,900 (was $79,500),
  mercedes-c-350e-phev $99,418 (was $98,200), mercedes-gla-phev $78,800 (MY27, was $78,000),
  lexus-nx-phev $84,630 / $96,090 (was $84,500 / $96,000).
- Prices down: bmw-ix1 M Sport $77,900 (was a stale $86,800), lexus-rz F Sport $104,920 (was
  $105,000).
- Run-outs, still orderable: polestar-2 (production ended Oct 2026), mercedes-c-350e-phev,
  mercedes-gla-phev (no plug-in successor), bmw-ix (iX5 due mid-2027).
- Range fixes: NEDC figures rejected for hilux-bev (245 km WLTP, was 315), rav4-phev, nx-phev,
  rx-phev, c-350e-phev; bmw-ix2 now the MY26 476 km WLTP (was 395 pre-update ADR).
- Boot fixes to the cargo-cover rule: subaru-solterra folded 2,005 L was a tare weight, now about
  1,050 L; volvo-ex40 851 L, subaru-trailseeker 1,230 / 1,216 L, rav4-phev 1,189 L, nx-phev 1,141 L,
  rx-phev seats-up 461 L, glc-phev 470 L (all were to-the-roof figures).
- BMW AU (503) and Mercedes AU, Lexus AU, Toyota AU, Volvo AU (403) were unreadable all run, so
  those prices rest on outlets that say "before on-road costs" in words.

## Threshold crossings

None. Near misses: volvo-ex40 Twin Motor $74,990 ($10 under $75,000), bmw-ix1 Sport Collection
$75,835 (backed out, true list may be under $75,000), bmw-x1-phev $909 under $80,809.

## Integration fixes

- Depreciation, one curve per brand. BMW [1,.72,.61,.53,.46,.4]; Mercedes [1,.7,.58,.49,.42,.36];
  MINI [1,.71,.59,.5,.43,.38]; Volvo [1,.66,.54,.45,.38,.32] (volvo-xc60-phev moved onto it);
  Polestar [1,.66,.55,.46,.39,.33]; Toyota [1,.75,.65,.57,.5,.44]; Subaru [1,.74,.63,.55,.48,.42].
- Lexus: nx and rx agents chose the mainstream curve, rz chose a steeper one. Settled on mainstream
  [1,.78,.68,.6,.53,.47] (two of three, and the RX private-sale guide supports it); lexus-rz moved.
- Watchlist: 14 entries added (XC90 T8 long-range, AMG CLA 45, AMG GLC63 S E, updated C 300 e,
  GLA 250 e run-out, iX run-out, iX1 Sport Collection, EX40 MY27.5, RZ600e F Sport Performance,
  NX facelift, RAV4 GXL 2WD PHEV, Polestar 2 run-out, next-gen Polestar 2, Cooper E).

## Flags

- toyota-bz4x folded boot 1,410 L disagrees with its twin subaru-solterra (about 1,050 L). Lead for
  the next bZ4X refresh.
- Towing conflicts: subaru-uncharted kept 0 (CarExpert says 1,500 kg); subaru.com.au says the
  Solterra tows unbraked only, against the held 1,500 kg; mini-aceman now 750 kg but
  mini-cooper-electric is 0.
- mercedes-eqa folded boot 1,320 L looks like a to-the-roof figure.
- polestar-2 keeps Performance as a row while polestar-4 treats its Performance pack as an option.
- lexus-rx-phev: RX production was suspended in July 2026 after the Japan earthquake; no restart
  found. Outlets show $100 more on both grades than Lexus' last release.
- bmw-i5 and bmw-ix resale guides point to a steeper curve than the BMW brand curve.
- mercedes-gla-phev may have the larger 12.9 kWh pack in MY27; kept 11.5 kWh / 65 km.
