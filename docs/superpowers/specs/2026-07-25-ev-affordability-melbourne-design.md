# EV Affordability Calculator — Melbourne

**Date:** 2026-07-25
**Status:** Approved design, ready for implementation planning

## Purpose

Help a Melbourne buyer decide how to pay for an electric car. The app compares three
financing routes — **novated lease**, **direct car loan**, and **cash upfront** — against the
user's real after-tax position, and shows which one wins as their monthly budget changes.
Feature comparison (body type, boot space, range) is secondary but necessary: affordability
is meaningless without knowing which cars are in reach.

## Success criteria

1. A user enters a salary and a monthly budget and sees a ranked recommendation with dollar
   figures they could take to a novated lease provider and check.
2. Dragging the budget slider visibly moves the recommendation between the three options, and
   the crossover point is stated in dollars.
3. Free-text input ("SUV, big boot for a large dog") produces a sensible shortlist without the
   user touching a filter control.
4. Every rate and assumption is visible and editable, and every one has a stated source.
5. The calculator works with the Claude API unavailable.

## Non-goals

- Not financial advice; no user accounts, saved profiles, or lead generation.
- Not modelled: HELP/HECS debt, Medicare Levy Surcharge, Division 293, family benefits.
  These are affected by the Reportable Fringe Benefits Amount an exempt EV lease generates.
  The UI states this as a caveat rather than computing it.
- No live pricing feeds. The dataset is committed JSON, refreshed manually.
- Not covered: used EVs, PHEVs (FBT exemption ended 31 March 2025), business/ABN structures,
  states other than Victoria.

## Architecture

Three tiers, with a hard wall between calculation and AI.

```
Browser (static, served by Express)
  ui/sections.js, ui/slider.js, ui/crossover-chart.js, ui/state.js
        │ imports directly
        ▼
calc/  — pure core, shared by browser and server, no I/O          ← deterministic
  tax.js  fbt.js  novated.js  loan.js  upfront.js  onroad.js  compare.js
        ▲ reads
data/  — vehicles.json, rates.json, tax-tables.json
        ▲ reads at boot
server/ — Express on Heroku                                       ← Claude-backed
  static.js, routes/parse.js, routes/rank.js, routes/explain.js,
  claude.js, schema.js
```

**The organising principle:** everything in `calc/` is a pure function — plain object in, plain
object out. No `fetch`, no `Date.now()`, no randomness. Claude sits outside that wall on both
sides: it converts prose into inputs *before* the maths, and narrates results *after* it. It
never produces a dollar figure. A bad model response can therefore mislead the user's filters
but can never corrupt their costs.

**Consequence worth protecting:** dragging the slider recomputes locally, with no network call.
Claude is invoked on text submit only. If the API is down, out of credit, or slow, the keyword
fallback parser covers filtering and the explanation panel does not render. The calculator
never depends on the API.

### Stack

- Node 22 LTS, pinned in `.nvmrc`; `engines.node: ">=20"` in `package.json`.
- Express 5, `@anthropic-ai/sdk`, `zod`. Tests on `node:test` — no test framework dependency.
- No bundler, no framework, no build step. Native ES modules, so `calc/` is imported unchanged
  by both the browser and the Node test runner. The slider is one range input; the chart is
  hand-written SVG. A framework would cost more than it returns at this size.
- Homebrew installs the Heroku CLI (`brew install heroku/brew/heroku`).

## Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `calc/tax.js` | Gross salary → income tax, Medicare levy, LITO, take-home | `tax-tables.json` |
| `calc/fbt.js` | Lease start date + car value → FBT phase and treatment | `tax-tables.json` |
| `calc/onroad.js` | List price → VIC stamp duty, rego, LCT, drive-away | `tax-tables.json` |
| `calc/novated.js` | Lease payment, pre-tax cost, packaged running costs, residual | `tax.js`, `fbt.js` |
| `calc/loan.js` | Amortisation schedule, total interest | — |
| `calc/upfront.js` | Cash cost plus opportunity cost of capital | — |
| `calc/compare.js` | Runs all three, ranks them, solves the crossover budget | all of the above |
| `server/claude.js` | SDK client; key from env; retry, timeout, graceful failure | — |
| `server/schema.js` | zod schemas validating every Claude response | — |

Each `calc/` module is independently testable with no mocks, because none of them perform I/O.

## Calculation specification

### Income tax — 2026-27 resident rates

| Taxable income | Rate |
|---|---|
| $0 – $18,200 | Nil |
| $18,201 – $45,000 | 15% |
| $45,001 – $135,000 | 30% |
| $135,001 – $190,000 | 37% |
| $190,001+ | 45% |

Plus 2% Medicare levy. The 16% → 15% cut took effect 1 July 2026; many public calculators are
still on the old figure.

LITO: $700 maximum, reducing 5c per dollar above $37,500, then 1.5c per dollar above $45,000,
nil at $66,667.

Medicare levy low-income phase-in uses the singles threshold $27,222 shading out to $34,027.
These are 2025-26 figures, committed as the starting point and to be refreshed when the ATO
publishes 2026-27 values. They only affect users below ~$34k, who are outside the app's
realistic audience.

### FBT — phase-aware

The full EV FBT exemption is being phased out. Announced May 2026; **not yet legislated**, which
the UI must state.

| Phase | Dates | Treatment |
|---|---|---|
| 1 | to 31 Mar 2027 | Full exemption for BEVs under the LCT fuel-efficient threshold |
| 2 | 1 Apr 2027 – 31 Mar 2029 | Full exemption at $75,000 or less; 25% FBT discount above $75,000 up to the threshold |
| 3 | from 1 Apr 2029 | 25% discount for all eligible BEVs |

Leases entered before a phase begins are **grandfathered** for their whole term. Lease start
date is therefore a real input, and the app surfaces the 31 March 2027 deadline prominently.

Eligibility: battery electric only; PHEVs excluded since 1 April 2025. The car must be first
held or used on or after 1 July 2022. The binding price cap is the LCT fuel-efficient threshold
**in the year the car is first held** — $91,661 for 2026-27 ($91,387 for 2025-26).

Where FBT is payable (phases 2 and 3 above the relevant cap), use the statutory formula: 20% of
base value, grossed up at 2.0802 (type 1, GST credit claimable), taxed at 47%. The 25% discount
reduces the taxable value — legislated as a 15% statutory rate in place of 20%, which is
arithmetically identical to applying a 25% reduction to the 20% rate. Employee contribution method then reduces FBT to nil via post-tax
contributions — modelling those post-tax dollars is what stops the app overstating the benefit.

### Novated lease

- Financed amount = drive-away price − GST input credit, capped at 1/11 of the car limit.
  Car limit 2026-27 is **$69,883**, so the GST credit caps at **$6,353**.
- Residual = ATO minimum for the term, applied to the vehicle cost:

  | Term | 12mo | 24mo | 36mo | 48mo | 60mo |
  |---|---|---|---|---|---|
  | Minimum residual | 65.63% | 56.25% | 46.88% | 37.5% | 28.13% |

  The user may set a residual above the minimum to cut monthly cost; never below.
- Monthly lease payment amortises (financed amount − present value of residual) at the lease
  rate over the term. Residual is payable with GST at the end.
- Running costs — insurance, charging, rego, tyres, servicing — are packaged GST-exclusive from
  pre-tax salary. This is a material and frequently underrated part of the benefit.
- Admin and brokerage fee added per year.

### Direct loan

Straight amortisation on (drive-away price − deposit) at the full GST-inclusive price. All
running costs paid from post-tax income.

### Upfront

Full drive-away price in cash, plus opportunity cost of that capital at a configurable return
(default 4.5% p.a.).

### Comparison basis

All three options settle on the same footing:

```
TCO = total after-tax outflow over the term
      − estimated resale value of the car at end of term
      + balloon paid (novated only, if retaining the car)
```

Upfront and loan leave the user owning the car. Novated leaves them owning it only if they pay
the balloon. Without the final term, novated appears artificially cheap — a balloon is not a
cost avoided, it is a cost deferred. Resale estimation uses a per-model depreciation curve
stored in `vehicles.json`.

### Crossover semantics

For each budget value on the x-axis, the engine finds the best car each option can reach at that
budget, and plots that option's TCO. The flip is genuine: at low budgets the user is in cheap,
comfortably FBT-exempt territory where the novated lease dominates; as budget climbs past the
$75,000 and $91,661 thresholds the exemption weakens or disappears and a plain loan catches up.
The crossover budget is solved numerically and stated in dollars.

Precise definitions, since "best car each option can reach" is otherwise ambiguous:

- **Reachable** means the highest-priced variant among the user's filtered matches whose monthly
  cost under that option is at or below the budget. Highest-priced, not highest-ranked — the
  chart answers "how much car can this option buy me", while ranking within the shortlist is
  section 3's job.
- **Novated** — monthly cost is the reduction in take-home pay from packaging the lease and its
  running costs.
- **Loan** — monthly cost is the repayment plus post-tax running costs.
- **Upfront** — the reachable car is bounded by **available savings**, not by monthly budget, so
  the upfront line is horizontal across the x-axis. The budget constraint applies only to its
  post-tax running costs. The line is omitted entirely when savings are below the cheapest
  matching variant's drive-away price, which is the common case.
- Where an option can reach no matching variant at a given budget, its line is discontinuous
  there rather than drawn at zero.

## Dataset

`data/vehicles.json` — 60–80 rows at **variant** level, not model level. Variant granularity is
required because a Long Range trim can cross the FBT threshold when the base model does not,
which reverses the recommendation.

Per variant: make, model, variant, body type, VIC drive-away price, list price, battery kWh,
range km, kWh/100km, boot litres (seats up and down), seats, tow rating, warranty, depreciation
curve, insurance band, `sourcedAt`.

`data/families.json` — qualitative research at **family** level (roughly 30 families), keyed by
family id and referenced by each variant. Family level rather than variant level because a
review of "the Kia EV5" does not differ meaningfully between Air and Earth trims, and it keeps
~30 research passes tractable instead of 80.

Per family:

- `summary` — two or three sentences of reviewer consensus, in the app's own words.
- `pros` / `cons` — three to five short points each, drawn from multiple reviews rather than one.
- `sources` — URLs the summary was drawn from, preferring established Australian outlets
  (CarExpert, Drive, CarsGuide, WhichCar) since verdicts on ride quality and value are
  market-specific.
- `images` — two or three URLs, **official manufacturer press and media room links only**.
  Press rooms exist for republication; review-site photography does not. Nothing is committed to
  the repo.
- `sourcedAt` — dates the research.

Qualitative research feeds display and Claude's ranking rationale. It never feeds `calc/`, which
consumes only the numeric fields in `vehicles.json`.

`data/rates.json` — finance and running-cost defaults with sources and `sourcedAt`.
`data/tax-tables.json` — brackets, LITO, LCT thresholds, car limit, ATO residuals, FBT phase
dates, VIC duty rates.

`scripts/build-dataset.js` is a manually-run research helper, not part of the request path.

## Defaults, as researched July 2026

| Input | Default | Basis |
|---|---|---|
| Direct car loan rate | 6.50% p.a. | best advertised 5.66% (Harmoney) / 5.69% (People's Choice); typical approved EV 6.24% base, 6.89% comparison; green loans run 1.2–1.7% below standard |
| Novated lease finance rate | 7.50% p.a. | competitive comparison rate 6.5–7.5%; ~9.5% effective on a 5-year lease |
| Lease admin + brokerage | $1,020/yr | ~$85/month packaging fee |
| Residual | ATO minimum for term | 37.5% at 48 months |
| Comprehensive insurance | $1,850/yr | EV range $1,200–$2,800; brand averages Geely ~$1,622 to Tesla ~$2,985 (Jan 2026 sample) |
| Electricity | 28 c/kWh | home charging |
| Rego, tyres, servicing | $1,240/yr | VIC rego ~$880; the $100 ZLEV discount ended 1 Jan 2026 |
| VIC stamp duty | 4.2% | $8.40 per $200, green passenger car rate |
| Opportunity cost of cash | 4.5% p.a. | savings return for the upfront option |

Every default is editable in the UI, shows its source, and resets in one tap.

**Two corrections to widely-repeated errors**, both encoded in the dataset:

1. Several EV sites claim Victorian BEVs under $68,740 pay **zero** stamp duty. They do not. The
   green rate is $8.40 per $200 at every price point — identical to the base tier. The green
   benefit only appears above $80,809, where other passenger cars step up to $10.40 per $200.
2. Most current articles quote the LCT fuel-efficient threshold as $91,387. That is 2025-26. The
   2026-27 figure is **$91,661** (indexation factor 1.003).

No ZLEV road-user charge applies — struck down by the High Court in 2023.

## Claude integration

Three endpoints, each validated with zod, each degrading gracefully.

| Endpoint | Input | Output | On failure |
|---|---|---|---|
| `POST /api/parse` | free text | structured filter + income object, via tool-use | keyword fallback parser |
| `POST /api/rank` | filtered cars + soft priorities | ordered top 3–5 with one-line reasons | dataset sort order |
| `POST /api/explain` | computed figures | plain-English explanation of the winner | panel not rendered |

Vague input triggers a single clarifying question. Conversation state is **client-held and posted
back** with each request, so the Heroku dyno needs no session store and survives restarts.

Claude receives computed figures and narrates them; it is never asked to calculate. Prompts state
this explicitly. Parsed numeric values are clamped to sane ranges before reaching `calc/`.

## User interface

Mobile-first. Three sections, stacked vertically on a phone, laid out as columns from 900px.

1. **Tell us about you** — a large free-text area at the top carrying the placeholder "I earn
   $145k and can spend about $900 a month. I want an SUV with a big boot for my dog.", with the
   numeric fields beneath it: salary, monthly budget, term, savings, annual km, lease start date.
   When Claude parses the text, changed fields highlight briefly and carry a "from your
   description" marker, so the hand-off is visible. Manual edits always win over parsed text.
2. **What you can afford** — the budget slider, the winning option, the three totals side by
   side, the crossover chart, and the collapsible rates panel. On desktop the chart is three SVG
   lines; on mobile it is replaced by a single horizontal winner band showing which option leads
   across the budget range, with the user's position marked. Three thin lines in 96px of height
   is not legible on a phone.
3. **Cars that match** — the ranked shortlist with the attributes that drove the match. Each card
   carries a hero image, and expands to show the family summary, pros and cons, and links to the
   source reviews. Images are lazy-loaded from external press URLs; any that fails to load is
   replaced by a body-type SVG silhouette, so a rotted link degrades to a plain card rather than
   a broken one.

A sticky one-line summary bar on mobile ("🏆 Novated · Kia EV5 · $871/mo") scrolls to section 3
on tap, so the payoff is always one tap away despite being third in the stack.

State lives in a single object serialised to the URL query string, making any result shareable.

## Error handling

- Claude unreachable, slow, or rate-limited → fallbacks above; a quiet notice, never a blocking
  error. Requests time out at 10 seconds.
- Claude returns malformed or out-of-range data → zod rejects, fallback applies.
- User inputs an implausible salary or budget → clamped, with the clamp shown.
- Missing or malformed dataset row → that variant is skipped, logged, and excluded from results
  rather than crashing the comparison.
- API key absent → server boots and serves the working calculator with AI features disabled.

## Testing

`node:test`, no framework.

- **Unit** — every `calc/` function. Tax at bracket boundaries; FBT across all three phase
  transitions and both price thresholds, including a lease straddling 31 March 2027;
  amortisation against known-good schedules; residuals at every term.
- **Golden cases** — a handful of end-to-end scenarios with hand-verified expected dollar
  figures, protecting against silent drift when tables are refreshed.
- **Crossover** — assert the flip exists and lands where expected for a known salary and car set.
- **Schema** — zod schemas reject malformed Claude responses; fallbacks engage.
- **No network in `calc/` tests**, which is enforceable precisely because the core is pure.

## Deployment

- Local: `nvm use`, `npm install`, `.env` holding `ANTHROPIC_API_KEY`, `npm start`.
- Heroku: `Procfile` with `web: node server/index.js`, `engines.node` pinned, server reads
  `process.env.PORT`. Key set via `heroku config:set`. Eco dyno (~$5/month, sleeps after 30
  minutes idle) is sufficient.
- GitHub holds the source. **No `gh-pages` branch** — GitHub Pages cannot run Express or hold an
  API key secretly, which is why hosting moved to Heroku.
- `.gitignore` covers `node_modules/`, `.env`, and `.superpowers/`.

## Risks and caveats

- **The FBT phase-out is announced, not legislated.** It may change. The UI must say so, and the
  phase dates live in `tax-tables.json` so a change is a data edit, not a code change.
- **Novated lease rates are not published.** The 7.5% default is an informed estimate; a real
  quote should be entered. This single input moves the crossover more than any other.
- **Drive-away prices move often**, particularly for Chinese brands. Rows carry `sourcedAt`, and
  the UI shows dataset age.
- **External image URLs will rot**, and some hosts block hotlinking. Accepted deliberately in
  exchange for keeping copyrighted photography out of the repo; the silhouette fallback means the
  cost is cosmetic. Restricting to manufacturer press rooms keeps copyright exposure low, but
  does not eliminate it — these are still third-party images served from someone else's host.
- **Review summaries are editorial opinion**, condensed by a model from a handful of sources and
  fixed at `sourcedAt`. They inform browsing, never the numbers.
- **RFBA effects are out of scope** and can materially reduce a lease's benefit for users with
  HELP debt or without private hospital cover. Stated in the UI as a caveat.
- The app informs a decision; it does not replace a quote or professional advice.

## Deferred

- Division 293, family benefits, HELP and MLS modelling.
- Used EVs and non-Victorian states.
- Live pricing or insurance quote feeds.
