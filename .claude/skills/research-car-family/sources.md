# Sources and traps

Where each kind of figure comes from, and the traps that earlier research waves fell into. Each
rule here caught a real error at least once.

## Which source for what

| Question | Best source | Lead only |
|---|---|---|
| Is it orderable, and how many grades | Manufacturer's Australian Build & Price | Nav menus, model grids, register-interest pages, aggregator listings, government certification filings |
| List price | Manufacturer configurator or price list saying "plus on-road costs"; Australian launch review saying "before on-road costs" in words | RedBook / Glass's "MSRP", aggregator price widgets, any figure that might be drive-away |
| Specs (battery, range, boot, tow) | Manufacturer's Australian spec sheet or technical data; Australian launch review | Aggregator spec grids (carsales, CarsGuide databases): they list database permutations and transpose digits |
| Range standard and usable battery | Manufacturer's UK or European technical data for the **same variant**; EV Database | A single unlabelled figure |
| Verdict prose | Australian reviews and long-term tests | International reviews, marketing copy |

**Cite only pages you opened.** A citation must be a URL you fetched in this run and that contains
the figure. A plausible-looking URL from memory is a fabricated citation, and one has been caught.

**One clear error discredits a source record.** When an aggregator page gets one figure plainly wrong
(CarsGuide priced a RAV4 grade with transposed digits beside a nickel-metal-hydride claim), discard
every figure from that record, not just the wrong one.

**Matching numbers are copies, not corroboration**, unless the standard and the variant also match.

**Budget.** Searches may be capped per session. Fetch known URLs directly: the existing provenance
file and the family's `sources` list are your starting points in `update` mode, and manufacturer
configurators answer more per fetch than any search.

## Price rules

1. **Assume any Australian price is drive-away until the page says otherwise.** For Chinese brands,
   KGM and Suzuki, drive-away is the default quoted figure. A source saying "before on-road costs" in
   words outranks an MSRP column.
2. **Price the model year orderable now**, from the price list the manufacturer's own configurator
   serves. Check the date on any campaign price: an introductory price that expires is still a
   campaign, and a note's claim that it expired can itself be wrong (Suzuki e Vitara's was extended).
3. **Check the direction of a discrepancy.** A "drive-away" figure below the computed drive-away is a
   mislabelled list price; above it, genuine.
4. **Check what a drive-away figure includes.** A flat national figure quoted identically for two
   states is not a per-state calculation, and one bundling dealer delivery or CTP makes a back-out
   overstate the list (affected all MG IM rows by an estimated $1,500–2,000).

### When only drive-away exists: back it out, then prove it

Back the list price out with the app's Victorian model, using the divisor for the body type:

| Body type | Formula |
|---|---|
| `Sedan`, `Hatch`, `SUV` | `list = (driveaway − 958.80) / 1.042` |
| `Ute` | `list = (driveaway − 958.80) / 1.027` |

Then round-trip it through the real function and tables, and confirm you land within a dollar or two
of the advertised drive-away:

```bash
node --input-type=module -e "
import {driveAwayPrice} from './calc/onroad.js';
import fs from 'fs';
const tables = JSON.parse(fs.readFileSync('data/tax-tables.json','utf8'));
console.log(driveAwayPrice({listPrice: 54990, isNonPassenger: false}, tables).total);
"
```

Arithmetic on a marketing number proves only the arithmetic. **Verify the result against something
the manufacturer did not choose**: a published on-road estimate that matches the computed on-roads
(Tank 500: $108 gap), or a premium that replicates across grades (Tank 300: $9,800 PHEV premium on
both grades, where the divisor gave ~$5,800 and was wrong by $1,200). Mark the price `backed-out`
and record the round-trip in its note.

## Grade-count rules

Grade *names* rarely fail; grade *counts* do, and a wrong count silently merges or invents cars.
Sixteen of thirty-three planned grade lists were wrong in the PHEV wave. Count on the configurator.
Shapes seen so far:

- A grade that exists overseas but not here, or a battery structure that does not cross the border.
- One badge on two powertrains, sometimes at the same price: match on the powertrain page or a
  drivetrain-dependent spec, never badge plus price.
- An aggregator carrying an unlaunched grade with a price; a certification filing without one.
- A grade sold only by a separate state distributor (Suzuki Queensland). Ask whether it is orderable
  **in Victoria**.
- An option pack promoted to a grade (BMW X5 "M Sport Pro" is an option box), including on the
  manufacturer's own site. Price a round-number "extra grade" as an option first.
- A configurator that under-counts. Confirm against a launch review.

## Range standard rule

Treat every Australian range figure as NEDC until shown otherwise; the Chinese brands are the worst
offenders.

1. Use the figure certified for the **Australian-market specification** where one exists; otherwise
   the manufacturer's WLTP figure for that variant. Record which in the provenance `standard`.
2. **Direction test**: ADR 81/02 accepts NEDC- or WLTP-derived data (WLTP is mandatory only under
   ADR 81/03, for new models from 1 July 2026). An Australian figure **higher** than the
   manufacturer's WLTP best case is an NEDC submission: reject it. **Lower** means WLTP-derived local
   spec: use it. Apply per brand, and per figure.
3. A manufacturer "up to" figure is the best-case wheel and pack; it overstates the local car by up
   to 17%. Match the wheel size the Australian grade ships on.
4. **Find WLTP through the market that imported the same variant.** BYD, Geely, Chery, Jaecoo and
   Omoda all have UK arms publishing WLTP. The predictor is whether the UK or Europe took this
   variant, not the brand. Some brands sell only in non-WLTP markets (GWM's Tank and Haval PHEVs):
   then NEDC is the only number that exists. Say where you looked, and list it as low confidence.
5. Implied-consumption arithmetic (battery ÷ range) separates WLTP from CLTC or NEDC: the wrong
   standard implies an absurdly efficient car. Range and consumption taken from the same end of a
   quoted band agree with each other whether or not they describe the local car.

## Battery rules

- **Usable, not gross.** Find a source stating both figures for the same vehicle. Implied-consumption
  arithmetic cannot settle gross versus usable: a 5% difference sits inside the plug-to-wheel loss.
- An unlabelled capacity from Toyota, Lexus or Subaru is **gross**: their own tables say "Capacity
  (gross, kWh)" where the Australian pages drop the qualifier.
- Kia and Hyundai publish **gross** on the E-GMP and EV9 packs; the Kona is an exception. Settle it
  per pack. Test: headline kWh ÷ cell count against ~218.7 Wh per SK On pouch cell, or nominal voltage
  × rated Ah.
- A label naming both quantities is not evidence of which is printed: Skoda's "Gross / Nett" heading
  sits over the gross figure. VW Group's 19.7 kWh PHEV pack, by contrast, is the net figure.
- The pack must be the one the Australian car gets. For a Chinese-brand BEV assume the line-up
  differs from the home market until shown otherwise.

## A published figure may be the wrong quantity

If a figure disagrees with battery ÷ range by more than a few percent, suspect the quantity before
the arithmetic. Volvo publishes three different quantities under near-identical labels across its UK,
EU and Australian sites; BMW's German and UK consumption bands differ (utility-factor-weighted versus
charge-depleting). The tell is the paired fuel figure.

## Siblings

Fields judged rather than sourced diverge across siblings even when each is defensible alone: four VW
Group PHEVs on one powertrain came back with charge-sustaining figures ordered backwards by mass,
giving the heavier car more range. Before writing a judged field, read the same field on the siblings
the dispatcher named and either match them or give the evidence for the difference.
