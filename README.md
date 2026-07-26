# Can I afford an EV?

A straight answer for Melbourne buyers: type what you earn, what you can spend, and what you're
after in a car, and this tool works out which way of paying for an EV — a novated lease, a car
loan, or paying cash — gets you the most car for the least money, and which cars in the current
Australian EV market are actually reachable on that budget.

## General information only

**This tool does not take account of your objectives, financial situation or needs. It is not
personal financial, tax or credit advice.** Every figure it shows is an estimate, computed from
published rates and the numbers you enter — it will differ from a real quote. Consider seeking
advice from a licensed adviser before deciding. This disclaimer is shown non-dismissibly in the
app itself, next to the verdict.

One caveat worth stating up front: an FBT-exempt novated lease still creates a Reportable Fringe
Benefits Amount, which can affect HELP repayments and the Medicare Levy Surcharge. This tool does
not model that.

## What it does

1. **Tell us about you** — your salary, monthly budget, lease term, deposit/savings, annual
   kilometres and lease start date. You can type a sentence instead ("I earn $145k and can spend
   about $900 a month, I want an SUV with a big boot for my dog") and the tool fills the form in
   for you — see [How parsing works](#how-parsing-works) below.
2. **What you can afford** — drag the budget slider and watch the recommendation, the chart and
   the total costs for all three payment options recompute instantly, entirely in the browser,
   with no network call. The chart shows where the cheapest option changes as your budget moves.
   Every rate behind the numbers (lease finance rate, loan rate, admin fee, opportunity cost of
   your own savings) is shown, sourced, and editable — put in your own quote and the numbers
   update.
3. **Cars that match** — a shortlist of real EVs currently sold in Australia, ranked by how well
   they fit what you asked for (boot space, range, warranty, value), each with a plain-English
   summary, pros/cons and source links where the family has been researched. No photography — an
   EV's silhouette by body type stands in for a picture, since car imagery in this dataset is
   deliberately out of scope.

## How parsing works

Typing a sentence and clicking "Fill in the form for me" tries three tiers, in order, and always
degrades gracefully:

1. **On-device**, via Chrome's built-in Prompt API, if it's available — nothing leaves your
   machine.
2. **The server**, on Claude Haiku, if `ANTHROPIC_API_KEY` is configured.
3. **A local keyword parser**, with no model at all, if neither of the above is available.

A model is only ever asked to extract preferences (salary, budget, body type, boot size...) —
never to compute a dollar figure. All the money maths (tax, FBT, stamp duty, loan amortisation,
depreciation, comparisons) is a deterministic calculator that runs the same way regardless of
which parsing tier fired, or whether one fired at all. **The calculator, the slider, the chart
and the shortlist all work with `ANTHROPIC_API_KEY` unset** — the only things that go away are the
free-text parse (the manual fields below it still work) and the one-paragraph plain-English
explanation of the verdict.

## Local setup

Requires Node 22 (pinned in `.nvmrc`).

```bash
nvm use
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY if you want free-text parsing and the
# plain-English explanation — everything else works without it
npm start
```

Then open `http://localhost:3000`.

## Tests

```bash
npm test
```

Runs the full suite on Node's built-in test runner (`node --test`) — no test framework
dependency. 186 tests across the tax/FBT/loan/lease/resale calculators, the dataset validator, the
server routes, and the browser-side UI modules (parsed and rendered the same way whether run
under Node or loaded natively in the browser, since there's no bundler or build step — `calc/` is
imported unchanged by both).

## Refreshing the dataset

`data/vehicles.json` and `data/families.json` are **generated artefacts** — never hand-edit them.
The source of truth is the per-model research files under `data/vehicles/*.json` and
`data/families/*.json`. To add or update a model, edit (or add) its file there, then rebuild:

```bash
node scripts/build-dataset.js
```

This validates every row against `data/schema.js` (plausibility bounds on price, range,
consumption, boot space, warranty and so on) and only overwrites the aggregate files if every row
passes — a bad edit leaves the previously-published dataset untouched rather than shipping broken
data.

## Where the default rates came from

Shown in the app itself, next to each editable rate, and in `data/rates.json`:

| Rate | Default | Source |
|---|---|---|
| Novated lease finance rate | 7.5% | Competitive novated comparison rate, 6.5–7.5%; ~9.5% effective over 5 years. |
| Car loan interest rate | 6.5% | Mid-market green EV secured rate, July 2026. Best advertised rate seen was 5.66%. |
| Novated lease admin fee | $1,020/yr | Typical $85/month packaging fee. |
| Other running costs (rego, servicing, tyres) | $1,240/yr | VIC registration ≈ $880 plus servicing and tyres. The ZLEV registration discount ended 1 Jan 2026. |
| Electricity | 28c/kWh | Melbourne residential off-peak-weighted estimate. |
| Return your savings would otherwise earn | 4.5% | An assumption, not a published rate — it's what your own money would earn if you didn't spend it on a car. Edit it to match your actual savings/offset rate. |
| Lease residual | ATO statutory minimum for the term | Not a market rate — a legislated minimum. Overridable if your financier has quoted something different. |

All figures are dated in `data/rates.json`'s `sourcedAt` field and were current as of that date;
rates move, so check them against a real quote before relying on the numbers here.

## Architecture, briefly

No bundler, no framework, no build step — native ES modules throughout, so the pure calculation
core (`calc/`) is imported completely unchanged by both the Node test runner and the browser.
Express (`server/`) serves the static frontend (`public/`), the dataset, and three thin API
routes: `/api/parse` (tier 2/3 of the free-text parser), `/api/explain` (the plain-English verdict
explanation), and `/api/dataset` (vehicles, families, rates and tax tables, fetched once at boot).
Ranking the shortlist is a deterministic scoring function (`calc/rank.js`) that never calls a
model — the same inputs always produce the same order, for free, offline.

## Deployment

A `Procfile` is included for Heroku (`web: node server/index.js`). Deployment itself is a
separate, deliberate step — set `ANTHROPIC_API_KEY` in the target environment's config if you want
free-text parsing and explanations there too; the app runs without it either way.
