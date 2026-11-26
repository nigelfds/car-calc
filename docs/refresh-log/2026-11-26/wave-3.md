# Wave 3, 2026-11-26

Started as wave 2 slots freed. The owner asked to pause at 7:18 PM Melbourne because token use
was higher than expected. 14 families had finished; the 12 still running were stopped and their
partial file writes reverted.
Finished agents: 1,718,672 subagent tokens; mean 123k, 36 tool calls, 5m00s.

## Coverage

- Updated (14): gwm-cannon-alpha-phev, gwm-haval-h6-gt-phev, gwm-haval-h6-phev, gwm-ora-5,
  gwm-tank-300-phev, gwm-tank-500-phev, mazda-6e, mg-hs-phev, mg-im5, mg-im6, mg-s6, skoda-elroq,
  vw-id4, vw-tayron-phev.
- Stopped at the pause, then rerun from scratch at midnight Melbourne when the usage window reset
  (12): vw-tiguan-phev, skoda-enyaq, skoda-kodiaq-phev, mazda-cx-80-phev, cupra-formentor-phev,
  cupra-terramar-phev, audi-a5-phev, audi-q5-phev, smart-1, smart-3, geely-ex2, geely-ex5.
  Rerun agents: 1,238,095 subagent tokens; mean 103k, 34 tool calls, 4m12s.
- Added row: audi-a5-phev-rs5-sedan (RS 5 Sedan, $179,827 Audi list; on sale since late 2026).
- No families added or removed.

## Notable changes

- GWM: held list prices were mostly drive-away or expired launch figures. Lists now backed out of
  GWM's VIC drive-away (H6, H6 GT, Ora 5, Tank 300, Tank 500) or taken from the MSRP where it passes
  the direction test (Cannon Alpha, now $54,990 / $61,990). Tank 500 is $75,921 (was $78,490).
- mg-hs-phev: held prices were drive-away; list now $46,171 / $50,010. WLTP 120 km, 23.2 kWh usable.
- vw-id4: MY27 on sale (not run-out), Pro $60,990 / GTX $70,990.
- mazda-6e and skoda-elroq: prices unchanged; boot and MY27 specs refreshed.
- All six GWM families now share one depreciation curve [1, 0.7, 0.58, 0.49, 0.42, 0.36].

- Rerun results: smart-1 Pro+ $49,900 (smart AU price, owner decision); audi-q5-phev $96,818 /
  $100,318 and audi-a5-phev $89,900 (Audi list); every VW Group eHybrid now 19.7 kWh usable with
  ADAC WLTP battery-empty fuel (5.6 to 5.9 L/100km, was a judged 6.5 to 7.0); skoda-enyaq MY27
  specs (longer range, RS on the 77 kWh pack, towing 2,000 / 2,200 kg); mazda-cx-80-phev 60 km
  WLTP and 14.0 kWh usable (17.8 gross).

## Threshold crossings

None.

## Integration fixes

- Depreciation, one curve per brand: cupra-tavascan (VZ row), mazda-cx-60-phev and audi-q6-e-tron
  moved to their brand's curve. Audi, Cupra, Mazda, Skoda, VW, smart, Geely, GWM and MG are now on
  one curve each.
- Watchlist: RS 5 Avant added to the wagons entry.
- Watchlist: Elroq Sportline 85 rechecked (orders early 2027, recheck 2027-02-15); mg-s6 dropped
  from the unsourced-consumption backlog entry.

## Flags

- gwm-tank-500-phev uses China WLTC range (110 km); the other GWM PHEVs use NEDC because no
  other figure was found. GWM fuel figures: Cannon 8.1, Tank 300 8.3, Cannon Alpha 8.4 (judged),
  Tank 500 8.4.
- MG and GWM back-outs use flat national drive-away prices that include dealer delivery, so these
  list prices may sit $600 to $2,000 high.
- vw-tiguan-phev R-Line stays $74,550 ($450 under $75,000); Chasing Cars' $75,550 contradicts its
  own text and every other source.
- geely-ex5 boot 410 L includes a 108 L underfloor well (302 L to the window line); smart-3's 370 L
  method is unstated (smart NZ says 260 L). Both may overstate against the to-the-cover rule.
- 7-seat folded boot figures (cx-80, sorento, kodiaq) are to the roof; no belt-line figure is
  published.
- Lead for next refresh: Audi re-homologated the A5 e-hybrid in July 2026 (103 to 118 km).
