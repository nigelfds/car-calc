# Wave 5 (final), 2026-11-27

Started at 2:02 PM Melbourne on the owner's go. Alfa Romeo, Cadillac, Denza, Ford, Forthing, GAC,
Jeep, KGM, Land Rover, Leapmotor, Lotus, Nissan, Polestar 3, Renault, Suzuki, Zeekr X.
22 agents: 2,459,920 subagent tokens; mean 112k, 40 tool calls, 5m18s.

## Coverage

- Updated (22): alfa-romeo-junior-elettrica, cadillac-lyriq, cadillac-optiq, cadillac-vistiq,
  denza-b5, denza-b8, ford-mustang-mach-e, forthing-taikon-5, gac-aion-ut, gac-aion-v,
  jeep-avenger, kgm-torres-evx, land-rover-defender-phev, leapmotor-b10, leapmotor-c10,
  lotus-eletre, lotus-emeya, nissan-ariya, polestar-3, renault-scenic-e-tech, suzuki-e-vitara,
  zeekr-x.
- Rows removed: cadillac-lyriq-luxury (dropped for MY27), leapmotor-c10 Style (dropped June 2026;
  evidence mixed, see watchlist).
- Rows added: cadillac-lyriq-v ($99,000, orders open), lotus-emeya-600-se ($209,990, the former
  Emeya S).
- All 134 families now have a provenance file. Variant count stays 312.

## Notable changes

- Prices up: land-rover-defender-phev MY27 $136,800 / $149,000 (was $131,100 / $143,200);
  lotus-emeya 600 $189,990 (held $177,990 came from one listicle); suzuki-e-vitara RRP $47,990 /
  $56,990 (was backed out at $47,131 / $55,768; Suzuki's 10%-off-RRP offer terms and Glass's MSRP
  agree).
- cadillac-lyriq MY27: new 91 kWh pack, 503 km (Sport) and 471 km (V) WLTP, was 102 kWh / 530 km.
- Runs-out and campaigns: jeep-avenger is MY24 stock ($40,000 drive-away offer); nissan-ariya is
  MY25 run-out with drive-away deals to 31 Mar 2027; kgm-torres-evx's $52,990 is a factory bonus,
  so the $55,188 list stands.
- Battery fixes to usable: leapmotor-b10 55 / 65 kWh (was gross 56.2 / 67.1), gac-aion-ut 60 (was
  58), ford-mustang-mach-e Select 72.6.
- Boot fixes to the cargo-cover rule: Cadillac rows carried US to-the-roof figures (Lyriq 793 to
  588, Optiq 744 to 443, Vistiq 430 to 297); mach-e folded 1,420 to 800; leapmotor-c10 581 to 435;
  alfa-romeo-junior folded 1,265 to 929 (judged); forthing seats-up 541 to 480.
- Towing: forthing-taikon-5 1,500 to 750 kg (current spec sheet); cadillac-vistiq 2,268 to 2,000 kg
  (US rating was for the larger pack).
- Range standards: Denza B5 and B8 stay on WLTC (no WLTP exists for the AU cars); NEDC figures
  rejected for defender-phev, leapmotor-b10, kgm-torres-evx.
- Manufacturer sites that blocked reads: Cadillac, Ford, Lotus (no prices), Renault (POA), Nissan
  (placeholder), Polestar (drive-away only), Leapmotor (no prices).

## Threshold crossings

None. Near misses: denza-b5 base $74,990 ($10 under $75,000); cadillac-lyriq Sport $90,000
($1,661 under $91,661).

## Integration fixes

- Depreciation, one curve per brand: every brand is now on a single curve. New this wave: Cadillac
  [1,.66,.54,.45,.38,.32], Denza [1,.65,.53,.44,.37,.31], GAC and Forthing [1,.7,.58,.49,.42,.36],
  Leapmotor [1,.72,.59,.5,.43,.37], Lotus [1,.55,.42,.33,.26,.21], Ford (matches ranger-phev),
  Zeekr (matches 7x), Jeep and Alfa Romeo [1,.68,.56,.47,.4,.34], Land Rover [1,.66,.55,.46,.39,.33],
  Renault (renault-megane-e-tech was removed in wave 1, so the Scenic's Techno curve is the brand
  curve).
- Watchlist: "Unsourced consumption figures" removed (forthing-taikon-5 and zeekr-x now sourced);
  Lotus Emeya and Eletre notes updated; 9 entries added (Eletre X, Optiq-V, Lyriq-V deliveries,
  Avenger run-out, Taikon name dispute, C10 Style, C10 AWD Sports+, Ariya facelift, Scenic packs).

## Flags

- Platform twins disagree on folded boot: jeep-avenger 1,252 L (method unstated) against
  alfa-romeo-junior-elettrica 929 L (judged from an ADAC window-line measurement).
- cadillac-lyriq: The Beep's VIC drive-away for the V is $4,500 above the app's figure (Sport
  $1,700). May point to a VIC luxury-car duty rate the on-road model lacks; check calc/onroad.js.
- suzuki-e-vitara: Suzuki's drive-away offers sit $3,300 to $3,900 below RRP plus VIC on-roads, so
  the app overstates what buyers are offered while the campaign runs.
- Towing unsure: mach-e 0 (no AU rating), leapmotor-b10 0 (EU 750), lyriq 0 (EU 1,587).
- lotus-eletre prose: servicing interval (2 years / 30,000 km) unverified; CarExpert says 12 months.
- nissan-ariya Advance+ has no grade card on Nissan AU's spec page; kept on outlet evidence.
- Denza battery figures are 75% of pack (25% charge floor), consistent across B5 and B8.
