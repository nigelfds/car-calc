# Market sweep, 2026-11-26

Twelve sweep agents checked 52 brands' Australian sites against the 136 held families and
`data/watchlist.json`, following `.claude/skills/refresh-dataset/sweep-brand.md`. This file is the
work list for the refresh; per-brand detail and evidence links follow the summary.

## Summary

**Held families no longer on sale (remove):**
- `bmw-i4`: gone from BMW AU's line-up; replaced by the new i3 sedan.
- `bmw-x5-phev`: old X5 50e is run-out stock only; the new X5 50e PHEV arrives Q2 2027 (keep the id for it).
- `mercedes-eqb`: replaced by the new electric GLB.

**Possibly ending (research in `check` mode first):** `maserati-grecale-folgore` (missing from the
MY26 list), `volvo-xc60-phev` (MY26 run-out ahead of a Q2 2027 long-range PHEV), `mercedes-eqa`
(GLA electric due 1H 2027), `deepal-s07` ("while stocks last"), `vw-id5` (no MY27).

**Renamed:** `chery-omoda-e5` is sold as the Chery E5 (proposed id `chery-e5`).

**Held families whose grade line-up changed** (all held families get an `update` anyway):
`byd-atto3` (now Atto 3 EVO, 3 grades), `mg-4` (MG4 Urban now a separate model; consider splitting),
`hyundai-inster` (cut to 2 grades), `tesla-model-3` (new base RWD, 4 grades), `kia-ev3` (+GT-Line
AWD), `bmw-ix3` (+RWD 40), `mazda-cx-60-phev` (6 grades, Touring gone), `xpeng-g6` (3 grades),
`zeekr-7x` (3 grades), `polestar-4` (3 grades, price cut), `volvo-ex90` (new Single Motor base),
`jaecoo-j7-shs` (+Summit AWD, Black Edition), `geely-starray-em-i` (+Inspire AWD), `cupra-tavascan`
(+V), `renault-megane-e-tech` (facelift), `audi-q4-e-tron` and `audi-q6-e-tron` (MY27 line-ups),
`kgm-musso-ev` (2 grades), `byd-shark-6` (drop the cab-chassis row), `ford-ranger-phev` (updated),
`porsche-cayenne-phev` (Black Editions), `alfa-romeo-tonale-phev` (Veloce only?).

**New families on sale, in scope (36):**

| Powertrain | Families |
|---|---|
| BEV (24) | `honda-super-one`, `mg-u9-ev` (ute), `mitsubishi-asx-vr-e`, `denza-d9`, `lexus-es`, `mazda-cx-6e`, `genesis-g80-electrified`, `bmw-ix4`, `bmw-i3`, `mercedes-glb-ev`, `mercedes-glc-ev`, `mercedes-eqs`, `leapmotor-b05`, `leapmotor-b03x`, `xpeng-x9`, `polestar-4-suv` (or fold into `polestar-4`), `polestar-5`, `smart-5`, `vw-id-buzz`, `porsche-taycan`, `porsche-macan-electric`, `porsche-cayenne-electric`, `audi-e-tron-gt` (S only under $250k), `land-rover-range-rover-sport-electric` (Mar 2027) |
| PHEV (12) | `jac-hunter-phev`, `gwm-cannon-phev`, `gwm-haval-h7-phev`, `byd-atto2-phev`, `byd-m9-phev`, `gac-m8-phev`, `mercedes-gle-phev`, `land-rover-range-rover-velar-phev`, `land-rover-range-rover-sport-phev`, `vw-touareg-phev`, `cupra-leon-phev`, `audi-rs5-phev` (or a grade of `audi-a5-phev`) |

**Still unsettled:** Deepal E07 (stop-sale lift unconfirmed), Mercedes EQV, Zeekr 009 (listed,
unpriced), Cadillac Optiq (one report says ruled out), Honda Super-ONE (allocation may be sold out).

**Pre-launch, for the watchlist:** Kia PV5 (Dec 2026), XPeng L03 (pre-orders), XPeng G9L, Hongqi/HQ
E-HS9 (Jan 2027), EHS5, EHS4, Mercedes C 400 electric and GLA electric, BMW iX5 and new X5 50e,
Geely Monjaro EM-i, Emgrand L EM-i and Battleship 700, Nissan Navara Pro PHEV and Leaf, Chery
Stockman PHEV, Omoda 7 PHEV, GWM Jolion Max PHEV and EV, VW ID. Tiguan, Skoda Elroq Sportline 85,
Volvo EX60, Genesis GV90, Alpine A390, NIO Firefly, Deepal S05, Cupra Raval, LDV eTerron 9.

**Newly not on sale:** LDV MIFA 9, Isuzu D-Max EV (cancelled), Range Rover Evoque PHEV (dropped).

**Sites that blocked automated reads** (prices came from Australian outlets instead): Toyota, Lexus,
Mercedes-Benz, Audi, Volvo, Ford, Mitsubishi, Tesla, Cadillac, Maserati, Mini, Porsche (partly),
JAC. Many others render prices only after a postcode. Research agents will hit the same walls.

## Per-brand detail

## Tesla
- tesla-model-3: on sale, MY2027, 4 grades vs 3 held. New base RWD $45,900 list (60 kWh, 572 km WLTP), Premium RWD $54,900, Premium LR RWD, Performance $80,900. Held RWD/LR RWD likely map to Premium RWD / Premium LR RWD. Evidence: https://www.carexpert.com.au/tesla/model-3 ; https://thedriven.io/2026/10/01/tesla-slashes-entry-price-of-model-3-to-below-46000-boosts-range-and-adds-vehicle-to-load-on-all-new-evs/ (tesla.com 403)
- tesla-model-y: on sale, 4 grades = held. Performance now MY2027 cut to $84,900 list (from $89,400). Evidence: https://www.carexpert.com.au/tesla/model-y/2026
## Ford
- ford-mustang-mach-e: on sale, 3 grades Select $65,990 / Premium $80,490 / GT $98,490 list. https://www.carexpert.com.au/car-news/2026-ford-mustang-mach-e-price-and-specs (ford.com.au 403)
- ford-ranger-phev: on sale, updated: XL $59,000 / Sport $66,000 / Wildtrak $70,000 drive-away; XLT and Stormtrak dropped; possible new MY. https://www.carexpert.com.au/car-news/updated-ford-ranger-hybrid-cheaper-than-byd-shark-6
## Nissan
- nissan-ariya: on sale, 4 grades = held; prices not rendered on nissan.com.au. https://www.nissan.com.au/vehicles/browse-range/ariya.html
- NEW pre-launch: Nissan Navara Pro PHEV (ute, 2027). https://www.carexpert.com.au/car-news/2027-nissan-navara-pro-phev-ute-confirmed-for-australia-with-300kw-and-800nm
- Leaf gen 3: AU timing "before end of March 2027" (snippet only).
## Mitsubishi
- mitsubishi-outlander-phev: on sale, 4 grades = held (ES $58,990, Aspire $66,790, Exceed $71,640, Exceed Tourer $74,490 list). https://www.carexpert.com.au/car-news/2026-mitsubishi-outlander-phev-prices-more-ev-range-for-more-money
- NEW likely add: Mitsubishi ASX VR-e BEV SUV, priced (LS $46,740 list, Aspire $53,990, Exceed $57,990, GSR AWD $64,990), showrooms Q4 2026; configurator not verified (403). https://www.carexpert.com.au/car-news/2027-mitsubishi-asx-vr-e-price-and-specs
## Renault
- renault-megane-e-tech: Techno still listed (POA); facelift MY27 Esprit Alpine $55,990 list open for orders, deliveries H1 2027, replaces Techno. https://www.carexpert.com.au/car-news/2027-renault-megane-e-tech-price-and-specs-facelifted-small-ev-gets-more-tech-more-range
- renault-scenic-e-tech: on sale, 3 grades = held, POA. https://www.renault.com.au/vehicles/scenic-e-tech
- Renault 5 Turbo 3E: out of scope (limited halo, likely >$250k).
## Alpine
- A390 still pre-launch, no AU price/timing; launch reportedly "under study". https://www.alpinecars.com.au/
## GWM (https://www.gwmanz.com/au/) — configurator renders client-side; PHEV prices mostly not shown
- All 6 held on sale, grade counts match: cannon-alpha-phev (Lux/Ultra PHEV), haval-h6-gt-phev (Ultra), haval-h6-phev (Lux/Ultra/Ultra AWD; from $44,990 d/a), ora-5 (Lux $33,990 / Ultra $36,990 d/a VIC), tank-300-phev (Lux/Ultra), tank-500-phev (Ultra, $79,990 basis unstated).
- NEW on sale: GWM Cannon Hi4-T PHEV (gwm-cannon-phev, ute, Lux $50,990 / Ultra $54,990 d/a VIC, in dealers since mid-Oct 2026). https://www.gwmanz.com/au/models/ute/cannon/
- NEW on sale: GWM Haval H7 PHEV (gwm-haval-h7-phev, SUV, Lux AWD $50,990 / Vanta AWD $53,990 d/a). https://www.carexpert.com.au/car-news/2027-gwm-haval-h7-price-and-specs-boxy-new-generation-phev-hybrid-suv-reaches-showrooms
- Watchlist: Haval Jolion Max PHEV slipped to Q1 2027; add Jolion Max EV (Q1 2027, 58 kWh).
## Chery (https://cherymotor.com.au; prices postcode-gated, no configurator)
- chery-omoda-e5 RENAMED to Chery E5 (Ultimate, 1 grade). Proposed familyId chery-e5. "All-new E5" coming soon (Q4 2026). https://cherymotor.com.au/models/chery-e5-electric-suv
- tiggo-7/8/9-phev on sale, 2 grades each = held. Tiggo 7 Urban $34,990 / Ultimate $38,990 d/a (~$4k below launch).
- Watchlist: Stockman PHEV reservations only, deliveries ~Feb 2027.
## Omoda
- omoda-9-shs on sale, MY27, 1 grade, $58,990* (likely d/a). https://www.omodajaecoo.com.au/o9-build-your-own
- Watchlist: Omoda 7 PHEV still pre-launch, H1 2027.
## Jaecoo
- jaecoo-j5-ev on sale, Summit $36,990 d/a.
- jaecoo-j7-shs MY27: 3 grades vs 2 held (Track 2WD $39,990, Summit 2WD $44,990, new Summit AWD $47,990 d/a) + AWD Black Edition $49,990 d/a. https://www.omodajaecoo.com.au/j7-shs-build-your-own
- jaecoo-j8-shs on sale, 1 grade, $59,990*.
## Alfa Romeo (configurator client-side)
- alfa-romeo-junior-elettrica on sale (1 grade). https://www.alfaromeo.com.au/models/junior
- alfa-romeo-tonale-phev on sale; Veloce only at $78,990 list per CarExpert Jul 2026 (brand page lists 3 trims, maybe stale). https://www.carexpert.com.au/car-news/2026-alfa-romeo-tonale-price-and-specs
## Jeep
- jeep-avenger on sale, MY27, 3 grades (Longitude $49,990 / Limited $54,990 / Summit $60,990 list). https://www.jeep.com.au/avenger.html
- Grand Cherokee 4xe still on jeep.com.au nav, no price, MY23 brochure: likely stale, not on sale.
## Maserati
- maserati-grecale-folgore: possibly RUN-OUT — absent from CarExpert MY2026 Grecale list; refreshed Folgore expected H1 2027. Unconfirmed (maserati.com 403). https://www.carexpert.com.au/maserati/grecale/2026
## Cadillac (cadillacanz.com 403)
- cadillac-lyriq on sale (Luxury/Sport $90,000 list). New Lyriq-V $99,000 list, deliveries Q1-Q2 2027 (orderable unclear). https://www.carexpert.com.au/car-news/2027-cadillac-lyriq-v-price-and-specs-delivery-timing-confirmed-for-hot-electric-suv
- cadillac-optiq on sale per outlets (Sport $80,000) — one summary says "ruled out for Australia", probably Optiq-V; verify.
- cadillac-vistiq on sale, Platinum $116,000 list.
## Land Rover / Range Rover
- land-rover-defender-phev on sale MY27: 110 P300e X-Dynamic SE $136,800, HSE $149,000 list. https://www.carexpert.com.au/car-news/2027-land-rover-defender-lineup-revealed-with-new-trims-and-price-hikes
- NEW on sale: Range Rover Velar P400e PHEV (~$128k list). https://www.rangerover.com/en-au/range-rover-velar/index.html
- NEW on sale: Range Rover Sport P460e/P550e PHEV (some grades may exceed $250k). https://www.rangerover.com/en-au/range-rover-sport/index.html
- NEW pre-launch/maybe orderable: Range Rover Sport Electric (Dynamic HSE $226,518, Autobiography $249,518 list, arrives Mar 2027). https://www.carexpert.com.au/car-news/first-range-rover-sport-electric-priced-for-australia
- Unrepresentable: Range Rover Electric ($317k+). Evoque P300e PHEV dropped for MY27.
## Suzuki
- suzuki-e-vitara on sale, 2 grades; current d/a prices maybe $49,990 / $58,990 (intro offer ended 30 Sep). https://www.suzuki.com.au/vehicles/electric/e-vitara/
## BYD (https://bydautomotive.com.au/configurator — prices before on-roads)
- On sale, counts match: atto1 ($23,990/$27,990), atto2 ($31,990/$35,990), dolphin ($29,990/$36,990), seal-6 sedan ($34,990), seal ($52,990/$61,990), sealion-5 ($33,990/$37,990), sealion-6 ($42,990/$46,990/$52,990; "Premium AWD" now "Premium Extended"), sealion-7 ($54,990/$63,990), sealion-8 ($56,990/$63,990/$70,990).
- byd-atto3 RESTRUCTURED: now Atto 3 EVO configurator, 3 grades: Essential $39,990 (old), EVO Dynamic $41,990 FWD, EVO Premium $46,990 RWD; held Premium Extended Range gone. https://bydautomotive.com.au/configurator/byd-atto-3-evo
- byd-shark-6: 3 grades incl Dynamic Cab Chassis $55,900 (out of scope - held row should be dropped), Premium $57,900, Performance $62,900.
- NEW on sale: BYD Atto 2 DM-i PHEV (byd-atto2-phev, Essential $24,990 / Premium $29,990). https://bydautomotive.com.au/configurator/byd-atto-2-dmi
- NEW on sale: BYD M9 PHEV people mover (byd-m9-phev, Dynamic 8-seat $61,990 / Premium 7-seat $72,990 list). https://bydautomotive.com.au/configurator/byd-m9
- Out of scope: Seal 6 Touring (wagon).
## Denza (dealer-hosted configurator, no prices seen)
- denza-b5, denza-b8 on sale (Build & Order live).
- NEW on sale: Denza D9 BEV people mover (denza-d9, FWD $85,990 / AWD $95,990 list). https://www.carexpert.com.au/car-news/2026-denza-d9-price-and-specs
- Z9 GT delayed to H1 2027, shooting brake (likely out of scope).
## Toyota (toyota.com.au 403; outlets only)
- toyota-bz4x on sale (2WD $55,990, AWD $67,990 list; Touring $69,990 — outlets call it a wagon: check scope).
- toyota-hilux-bev on sale (SR5 $82,990 list).
- toyota-rav4-phev on sale, 3 grades (prices from Nov 2025).
## Lexus (lexus.com.au 403)
- nx-phev, rx-phev (MY27 rows, unchanged prices?), rz on sale. RZ600e F Sport Performance possible 4th grade, no AU price.
- NEW on sale: Lexus ES BEV sedan (lexus-es, ES350e $77,000 / ES500e $84,000 list). https://www.carexpert.com.au/car-news/2026-lexus-es-price-and-specs-new-generation-luxury-sedan-brings-ev-power-for-a-small-premium
## Subaru
- solterra (MY27 page), trailseeker, uncharted (MY27 page) on sale; prices after May 2026 cut.
## Mazda
- mazda-6e on sale (E35 GT from $52,990 d/a).
- mazda-cx-60-phev: 6 grades vs 7 held; P50e Touring appears gone; Evolve/GT now "Vision". https://www.carexpert.com.au/car-news/2026-mazda-cx-60-updates-tech-and-safety-upgrades-for-up-to-dollar7000-less
- mazda-cx-80-phev on sale, 4 PHEV grades.
- NEW on sale: Mazda CX-6e BEV (mazda-cx-6e, GT $53,990 / Azami $56,990 list). https://www.mazda.com.au/cars/cx-6e/
- CX-70/CX-90 PHEV: not on sale.
## Kia (configurator https://www.kia.com/au/shopping-tools/build-and-price.html; prices postcode-gated)
- kia-ev3: MY27, 5 grades vs 4 held; new GT-Line AWD (~$66,490 list). https://www.kia.com/au/shopping-tools/build-and-price.trim.ev3.html
- kia-ev4: MY27, 3 grades = held.
- kia-ev5: 5 configurator entries vs 4; "GT-Line Two-Tone" may be paint only.
- kia-ev6: MY27, 4 grades = held.
- kia-ev9, kia-sorento-phev: 4 grades = held.
- NEW pre-launch: Kia PV5 Passenger (kia-pv5, people mover, Dec 2026, ~$60-70k). PV5 Cargo out of scope.
- Watchlist fix: "Kia: no plug-in hybrid" entry is wrong (Sorento PHEV is held).
## Hyundai (configurator JS; outlets)
- hyundai-inster: MY27 cut to 2 grades (Standard $37,500, Cross $43,500 list); Extended Range dropped; held 4 rows -> remove ER and check Cross Roof Basket. https://www.carexpert.com.au/car-news/2027-hyundai-inster-price-cut-lineup-trimmed-in-australia
- hyundai-ioniq-5: MY27, 4 grades = held (RWD $68,200 / Elite $73,200 / Premium N Line $83,700 / N $115,000).
- hyundai-kona-electric: MY27, 5 grades = held (new Elite $53,000; base lost heat pump).
- hyundai-ioniq-6: N only, still. hyundai-ioniq-9: MY27, Calligraphy only. hyundai-elexio: 2 grades.
## Genesis
- genesis-gv60 (incl Magma; Advanced RWD $88,300 list), genesis-gv70-electrified on sale.
- NEW on sale: Genesis Electrified G80 (genesis-g80-electrified, Signature AWD $156,418 list). https://www.genesis.com/au/en/models/luxury-sedan-genesis/g80-ev/highlights.html
- GV90 pre-launch H1 2027, may exceed $250k.
## BMW (status from Build & Price links on https://www.bmw.com.au/en/all-models.html)
- REMOVE bmw-i4: no card on BMW AU all-models page; production ends, replaced by i3 sedan. https://www.carexpert.com.au/car-news/2027-bmw-i3-touring-confirmed-but-no-i4-liftback-replacement
- REMOVE (for now) bmw-x5-phev: old X5 Hybrid is run-out stock only (no Build & Price); new G65 X5 50e PHEV register-interest, Q2 2027. Keep familyId for successor.
- On sale: i5 (check M60 still offered), ix (to be replaced by iX5 mid-2027), ix1 (grade names now Sport Collection / M Sport?), ix2 (check eDrive20), x1-phev, x3-phev.
- bmw-ix3: 50 xDrive now $112,500 list (+$2,600) and new RWD iX3 40 $89,900 list not held. https://www.carexpert.com.au/car-news/bmw-ix3-ev-price-rises-just-months-after-australian-launch
- NEW on sale (deliveries ~Feb 2027): BMW iX4 (bmw-ix4, 40 xDrive $103,900 / 50 xDrive $119,900 list); BMW i3 Neue Klasse sedan (bmw-i3, 40 xDrive $96,900 / 50 xDrive $112,900 list).
- Pre-launch: iX5 (mid-2027). Unrepresentable: M5 PHEV ($280k+), XM.
## Mini (mini.com.au unreachable; outlets)
- aceman (2), cooper-electric (3 incl Paul Smith Edition — confirm still orderable), countryman-electric (5) all on sale, prices match held.
## Mercedes-Benz (mercedes-benz.com.au 403; outlets)
- REMOVE mercedes-eqb: replaced by new GLB electric (in showrooms Sep 2026).
- On sale: cla-ev, eqa (run-out soon; GLA electric 1H 2027), gla-phev, glc-phev, c-350e-phev (verify; updated C-Class 1H 2027).
- NEW on sale: Mercedes GLB electric (mercedes-glb-ev, GLB250+ $74,990 / GLB350 4MATIC $86,200 list). https://www.carexpert.com.au/car-news/2027-mercedes-benz-glb-price-and-specs-new-generation-seven-seat-suv-gains-eqb-replacing-ev-option
- NEW on sale: Mercedes GLC 400 4MATIC electric (mercedes-glc-ev, $112,200 list). https://www.carexpert.com.au/car-news/2027-mercedes-benz-glc400-electric-new-ev-priced-to-take-on-bmw-ix3
- NEW on sale: Mercedes EQS refreshed (mercedes-eqs, EQS400 sedan $184,900 list). https://www.carexpert.com.au/car-news/mercedes-benz-eqs-prices-updated-electric-limo-now-australias-longest-range-ev
- NEW on sale: Mercedes GLE 450e PHEV (mercedes-gle-phev, SUV $156,900 / Coupe $160,900 list). https://www.carexpert.com.au/car-news/2027-mercedes-benz-gle450e-phev-priced-for-australia
- Pre-launch: C 400 electric ($105,700, early 2027), GLA electric (1H 2027). Out of scope: CLA Shooting Brake.
- EQV still unverified.
## Leapmotor (no public configurator/prices)
- leapmotor-b10 (2), leapmotor-c10 (3) on sale.
- NEW on sale: Leapmotor B05 (leapmotor-b05, Hatch, Style / Design LR, from $35,990 d/a offer). https://www.leapmotor.net/en-au/models/b05
- NEW pre-order: Leapmotor B03X (leapmotor-b03x, SUV, from $29,990 d/a offer, "available to pre-order"). https://www.leapmotor.net/en-au/models/b03x
- Out of scope: B10/C10 Hybrid EV (range extenders).
## Deepal
- deepal-s07 on sale, 1 grade, $47,990 d/a "while stocks last" (possible run-out).
- Deepal E07 still listed (RWD / AWD Performance), stop-sale lift unconfirmed; Changan taking over distribution. S05 still register-interest.
## XPeng
- xpeng-g6 on sale ("New G6" facelift): 3 grades vs 4 held; Black Edition now a colour pack. RWD SR $51,800 / RWD LR $56,800 / AWD Perf $63,800 list. https://store.xpeng.com/au/configurator/New_G6R
- NEW on sale: XPeng X9 people mover (xpeng-x9, FWD SR $89,900 / AWD Perf $109,900 list). https://store.xpeng.com/au/configurator/New_X9
- NEW pre-launch (pre-orders open): XPeng L03 BEV ($41,900 / $46,900 / $53,900 list). G9L still coming soon.
## GAC (site moved to gacgroup.com/en-au)
- gac-aion-ut (Premium $31,990 / Luxury $35,990), gac-aion-v (Premium $42,590 / Luxury $44,590) on sale.
- NEW on sale: GAC M8 PHEV people mover (gac-m8-phev, Premium $76,590 / Luxury $83,590 list; confirm engine drives wheels). https://www.gacgroup.com/en-au/mpv/gac-m8-phev
## Forthing
- forthing-taikon-5 on sale, 2 grades, from $38,990 d/a. Name under trademark dispute.
## KGM
- kgm-musso-ev: 2 grades (2WD $60,000 / AWD $64,000 d/a) vs 3 held; Black Edge is a pack.
- kgm-torres-evx: on sale, $52,990 d/a (down from $58,000).
## Geely (https://www.geely.com.au/build/...)
- geely-ex2, geely-ex5 on sale, prices same as held.
- geely-starray-em-i: new 3rd grade Inspire AWD $44,990.
- Pre-launch (pre-orders, H1 2027): Monjaro EM-i PHEV, Emgrand L EM-i PHEV sedan; Battleship 700 PHEV H2 2027.
## Zeekr (zeekrlife.com/en-au)
- zeekr-7x MY27 orders open 1 Nov, prices unchanged (RWD $57,900 / LR RWD $63,900 / Perf AWD $72,900), more power; 3 grades vs 4 held (Black Special Edition now an option pack?). https://www.carexpert.com.au/car-news/2027-zeekr-7x-update-more-power-same-price
- zeekr-x on sale (d/a $48,900 / $57,900).
- Zeekr 009 still listed with Build & Price (3 grades; price unknown) — backlog.
- 7GT (wagon), 9X, 8X still pre-launch.
## Polestar
- polestar-2, polestar-3 on sale, MY27.
- polestar-4 MY27 cut $4,600: Rear $73,900 / Dual $81,750 / Dual Perf $95,450 list (3 vs 2 held). https://www.carexpert.com.au/car-news/2027-polestar-4-coupe-suv-prices-cut-to-match-new-more-practical-sibling
- NEW on sale: Polestar 4 SUV (own configurator, same prices; could fold into polestar-4). https://www.polestar.com/au/configure/polestar-4-suv/
- NEW on sale: Polestar 5 sedan (polestar-5, $171,100 / $193,100 list, deliveries Apr-May 2027). https://www.polestar.com/au/configure/polestar-5/
## Volvo (volvocars.com/au 403; outlets)
- es90 MY27 on sale. ex30 MY27 (Cross Country continuing?). ex40 MY27 maybe 1-2 grades vs 2.
- volvo-ex90 MY27: new Plus Single Motor $106,990 replaces held Plus Twin ($124,990); Ultra $134,990. https://www.carexpert.com.au/car-news/2027-volvo-ex90-ev-base-price-slashed-by-dollar18000
- xc60-phev: possibly run-out of MY26 T8; long-range PHEV Q2 2027. xc90-phev MY27 on sale.
- EX60 priced (P6 $86,990 / P10 $101,990 list) but delivery timing unclear.
## Smart (au.smart.com configurator, list prices)
- smart-1 (Pro+ now $49,900, -$90), smart-3 (matches) on sale.
- NEW on sale: smart #5 (smart-5, Pro+ $58,900 / Premium $63,900 / BRABUS $73,900 + ORC). https://au.smart.com/en/configurator/?model_id=31
## Lotus
- lotus-eletre, lotus-emeya on sale; site now uses 600/900-series names; no AU prices. Emeya held $177,990 conflicts with CarExpert $189,990.
## Volkswagen (prices client-side)
- vw-id4 MY27 on sale: Pro $60,990 / GTX $70,990 list (+$1,000). ID. Tiguan replaces ID.4/ID.5 (timing TBA).
- vw-id5 on sale (MY25/26 stock, may become run-out). vw-tayron-phev, vw-tiguan-phev on sale (2 grades each).
- NEW on sale (verify price/run-out): VW Touareg R eHybrid PHEV (vw-touareg-phev, ~$129,990 at 2024 launch). https://www.volkswagen.com.au/en/models/touareg-r.html
- Backlog confirmed on sale: VW ID. Buzz passenger (Pro SWB, Pro LWB, GTX). https://www.volkswagen.com.au/en/models/id-buzz.html
## Skoda
- skoda-elroq MY27 (Select 60 / Select 85); Sportline 85 orders slip to early 2027.
- skoda-enyaq MY27, 5 grades = held. skoda-kodiaq-phev on sale. Superb PHEV is wagon only (out of scope).
## Cupra
- cupra-formentor-phev, cupra-terramar-phev on sale.
- cupra-tavascan: new entry grade V $55,490; Endurance $66,490 (+$5,500), VZ $75,490 (+$1,000). https://www.carexpert.com.au/car-news/cupra-launching-its-cheapest-ev-yet-in-australia-undercutting-tesla-model-y
- NEW on sale: Cupra Leon Ve PHEV hatch (cupra-leon-phev, $62,990 list). https://www.carexpert.com.au/car-news/2026-cupra-leon-ve-prices-updated-spanish-phev-hatch-gets-much-more-range
- Raval pre-launch.
## Audi (audi.com.au 403)
- audi-a5-phev on sale, $89,900 sedan unchanged.
- audi-q4-e-tron: MY27 replaces 45/55 grades (RWD $71,650, Sportback RWD $71,650, quattro $81,650, Sportback quattro $83,250); rename/reprice all 4 rows. https://goauto.com.au/new-models/audi/q4/e-tron/audi-sharpens-q4-e-tron-pricing-for-2027/2026-08-21/100181.html
- audi-q5-phev on sale. audi-q6-e-tron MY27 prices cut >$20k (Q6 $89,900 ...); grade count likely falls from 7. https://www.carexpert.com.au/car-news/2027-audi-q6-e-tron-prices-slashed-by-more-than-dollar20000
- NEW on sale: Audi RS 5 PHEV sedan ($179,900; could be a grade of audi-a5-phev).
- Backlog confirmed: Audi e-tron GT (only S ~$209,900 under ceiling).
## Porsche
- porsche-cayenne-phev MY27: new Black Edition grades (E-Hybrid, S E-Hybrid; SUV and Coupé) — up to 8 in scope vs 4 held.
- Backlog confirmed on sale: Taycan (11 variants, cheaper ones under $250k), Macan Electric (5 variants, $129,800-$187,600), Cayenne Electric (base $167,800, S $193,100; Turbo over ceiling).
## Honda
- NEW on-sale: Honda Super-ONE (honda-super-one). Live Honda AU configurator, 2 grades (Mono Tone, Two Tone). Model page: from $36,900 / $37,400, basis unstated (press says drive-away). CarExpert drive-away (Sydney) $40,763 / $41,278. 202 km WLTP, 70 kW, 50 kW DC. https://www.honda.com.au/cars/configurator/build-superone.html
- Watchlist: Honda Super-One -> on-sale. Configurator live; some grades show Out Of Stock; 2026 allocation reportedly sold out (unverified).
- Unsettled: Price basis of $36,900/$37,400 unconfirmed.
- Unsettled: Whether still orderable (allocation sold out) unconfirmed.
- Unsettled: Honda AU has no PHEV.
## NIO
- NEW pre-launch: NIO Firefly (nio-firefly). No AU date, distributor or orders as of 21 Oct 2026. https://www.carsguide.com.au/news/nio/firefly
- Watchlist: NIO Firefly -> pre-launch. Slipped; recheck Feb 2027.
- Unsettled: No NIO AU site found (404s).
## Hongqi
- NEW pre-launch: HQ (Hongqi) E-HS9 (hongqi-e-hs9). Below $150,000 before on-roads, deliveries from 18 Jan 2027, single AWD grade, 120 kWh, 548 km WLTP. https://www.carexpert.com.au/car-news/2027-hongqi-e-hs9-luxury-electric-suv-to-start-below-dollar150k-arriving-in-january
- NEW pre-launch: HQ (Hongqi) EHS4 (hongqi-ehs4). Small SUV, no AU price. https://www.carexpert.com.au/car-news/chinas-oldest-auto-brand-locks-in-range-of-electric-luxury-suvs-for-australia-sedan-set-to-follow
- NEW pre-launch: HQ (Hongqi) EHS5 (hongqi-ehs5). Mid-size SUV, no AU price. https://www.carexpert.com.au/car-news/chinas-oldest-auto-brand-locks-in-range-of-electric-luxury-suvs-for-australia-sedan-set-to-follow
- Watchlist: Hongqi range -> pre-launch. Launching as 'HQ'; split into per-model entries; recheck Feb 2027.
- Unsettled: hongqi.com.au 503.
## Skywell
- NEW pre-launch: Skywell/Skyworth BE11 (skywell-be11). Unverified: carsales reports indefinitely deferred (403). 
- Watchlist: Skywell BE11 -> pre-launch. Unverified postponement; recheck 2027.
- Unsettled: skywell.com.au did not resolve; carsales 403.
## Isuzu
- NEW out-of-scope: Isuzu D-Max EV (isuzu-d-max-ev). Cancelled for Australia 30 Sep 2026. https://www.carexpert.com.au/car-news/isuzu-d-max-ev-australian-launch-cancelled-still-no-sign-of-hybrid-phev-options
- Watchlist: Isuzu D-Max EV -> not-on-sale. AU launch cancelled 30 Sep 2026; recheck 2027-07 for a PHEV.
## JAC
- NEW on-sale: JAC Hunter PHEV (jac-hunter-phev). Hunter Pro 4x4 $49,988 and Hunter X 4x4 $54,844 before on-roads (CarExpert Jul 2026). Not verified on JAC configurator (503). https://www.carexpert.com.au/jac/hunter
- NEW out-of-scope: JAC Hunter PHEV cab-chassis (None). Cab-chassis, out of scope. https://www.carexpert.com.au/car-news/australias-cheapest-plug-in-hybrid-ute-set-to-get-even-cheaper
- Watchlist: JAC Hunter PHEV -> on-sale. Launched ~Aug-Sep 2026 per CarExpert; confirm on JAC configurator.
- Unsettled: jacmotors.com.au 503; on-sale rests on CarExpert.
## MG
- mg-4: on-sale, 5 grades vs 4 held. MG4 EV facelift MY26: Essence 64 $39,990, XPOWER $47,990 (drive-away NSW). MG4 EV Urban now a separate model/configurator (https://www.mgmotor.com.au/configurator/mg4-ev-urban): Essence 43 $29,990*, Essence 54 $32,990*, Essence 54 Special Edition $33,990* (offer d/a), struck-through $31,990/$34,990/$35,990. Consider splitting Urban into mg-4-urban. https://www.mgmotor.com.au/configurator/mg4-ev?ref=website
- mg-hs-phev: on-sale, 2 grades vs 2 held. HS Super Hybrid Excite $48,990 / $42,990* offer; Essence $52,990 / $45,990*. Cashback to 31 Dec 2026. MY25 and MY26 both sold. https://www.mgmotor.com.au/configurator/mg-hs?ref=website
- mg-im5: on-sale, 3 grades vs 3 held. $57,990/$64,990/$74,990 d/a NSW; higher $60,990/$67,990/$77,990 probably list. https://www.mgmotor.com.au/configurator/im5?ref=website
- mg-im6: on-sale, 3 grades vs 3 held. $57,990/$64,990/$74,990 d/a incl $3k cashback; struck-through $60,990/$67,990/$77,990. https://www.mgmotor.com.au/configurator/im6?ref=website
- mg-s5: on-sale, 2 grades vs 2 held. $39,990 / $44,990 d/a; struck-through $41,990/$46,990. https://www.mgmotor.com.au/configurator/mgs5-ev?ref=website
- mg-s6: on-sale, 2 grades vs 2 held. $48,990* / $55,990* d/a; crossed-out $49,990/$56,990. https://www.mgmotor.com.au/configurator/mgs6-ev?ref=website
- NEW on-sale: MG U9 EV (mg-u9-ev). One dual-cab AWD variant, 102.2 kWh, $78,990 + ORC list. https://www.mgmotor.com.au/configurator/mgu9-ev
- NEW on-sale: MG4 EV Urban (mg-4-urban). Possibly covered by held mg-4 Urban rows; now a separate model. https://www.mgmotor.com.au/configurator/mg4-ev-urban?ref=website
- NEW out-of-scope: IM LS9 (None). Range-extender, previewed only. https://www.carsguide.com.au/car-news/every-new-mg-model-confirmed-for-australia-as-zeekr-rivalling-ls9-large-suv-teased
- Watchlist: MG U9 EV -> on-sale. Live configurator; research as new family.
- Unsettled: MG prices unlabelled: starred offer drive-away (NSW) vs struck-through probably list.
- Unsettled: mg-4 Urban split.
- Unsettled: HS MY25 vs MY26 spec change.
## LDV
- NEW out-of-scope: LDV eDeliver vans (None). Only plug-ins are vans. https://www.ldvautomotive.com.au/price/
- Watchlist: LDV MIFA 9 -> not-on-sale. Gone from LDV AU price guide; model page 404.
- Watchlist: LDV eTerron 9 -> pre-launch. Still a no-show (16 Sep 2026); recheck ~3 months.
- Unsettled: No LDV configurator; MIFA 9 removal inferred from site.
