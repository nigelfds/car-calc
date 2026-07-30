# What's the best EV I could get?

A straight answer for Melbourne buyers: say what you earn and what you want in a car, set a
monthly budget, and this tool works out how much car each way of paying — a novated lease, a car
loan, or cash — actually reaches, then shows you the real EVs sitting at that ceiling and what
each of them would cost you three ways.

## General information only

**This tool does not take account of your objectives, financial situation or needs. It is not
personal financial, tax or credit advice.** Every figure it shows is an estimate, computed from
published rates and the numbers you enter — it will differ from a real quote. Consider seeking
advice from a licensed adviser before deciding. This disclaimer is shown non-dismissibly in the
app itself, below the chart and ahead of the shortlist.

One caveat worth stating up front, and repeated in that box: an FBT-exempt novated lease still
creates a Reportable Fringe Benefits Amount, which can affect HELP repayments and the Medicare
Levy Surcharge. This tool does not model that.

## What it does

The three steps do three different jobs, and the split is deliberate: **step 2 knows nothing about
specific cars**, and step 3 does all the car work. All three live under the first tab, **Find a
car**. The second tab, **Compare**, is a different tool, covered next.

1. **What you want** — salary, lease term, savings, annual kilometres and lease start date, plus
   what you want in a car: body type, minimum boot, seats and range.
2. **How much to spend?** — drag the budget slider and watch how much car each way of paying
   reaches. The y axis is a car price, not a cost, and that is the point: three capacities are
   directly comparable, where three totals for three different cars never were. The shape carries
   the two facts that matter most. The novated line climbs and then flattens dead at the
   $91,661 FBT threshold, because one dollar over it the exemption is lost outright and the
   monthly cost roughly doubles. Cash is a horizontal line at your savings ceiling, visibly
   independent of the monthly budget. Where the loan line crosses above the capped lease is a
   genuine crossover: the budget past which borrowing buys you more car than packaging does.
   Every rate behind it (lease finance rate, loan rate, admin fee, the return your savings would
   otherwise earn) is shown, sourced and editable under **Rates and settings**.
   Running costs here assume a typical EV from the dataset — step 3 uses each car's real figures.
3. **Cars for you** — five real EVs bracketed around that ceiling, at-budget first, then two
   just under it and one stretch above. Each is filtered by your stated preferences and costed under all
   three funding options, which is a fair comparison because all three price the *same* car.
   Each card also shows how much of every dollar survives as resale — the figure that separates
   two similarly-priced cars — and, for a novated lease, the balloon due at the end of the term
   and whether selling the car would clear it. No photography; car imagery is out of scope.

## Comparing cars side by side

The second tab, **Compare**, answers a different question from the first: not what you can afford,
but how two or three particular cars actually differ. It compares specifications only — it does not
cost a car under a novated lease, a loan or cash, because that is the first tab's job, and it reads
none of your salary, budget, term, savings or interest rate. While this tab is showing, the URL
itself carries only `tab` and `compare` — every step-1 field is left out of what gets written, not
merely reset to a default, so a link to a comparison genuinely carries none of your income.
Switching back to **Find a car** restores your entries from memory and they reappear in the URL;
reloading or bookmarking a Compare link, though, loses whatever step-1 entries you hadn't shared
another way — that's intended, since specs-only is the whole point of the tab, not a bug to route
around. A link that already carries both (one saved before this existed, say) still opens correctly;
only a fresh Compare link is built clean.

Any of the dataset's 216 variants goes in any of the three slots, chosen from an autocomplete on
each — there's no preference filtering and no restriction by body type, so a ute sits next to a
hatchback as readily as two SUVs. The slots live in the URL as `?tab=compare&compare=id1,id2,id3`; a
cleared *interior* slot serialises as an empty segment (`id1,,id3`) rather than being dropped,
because slot position matters — that's what will let a future "send these to Compare" button on the
first tab be nothing more than a link. A cleared *trailing* slot is trimmed instead: `id1,id2,` would
carry no information a shorter `id1,id2` doesn't already carry, so it's dropped rather than kept.

The dataset has no missing values, so the hard part here is never a gap — it's that the same field
can mean different things car to car. A plug-in hybrid's `rangeKm` is electric-only, with the whole
trip in `combinedRangeKm`; a BEV's `rangeKm` already is the whole trip. A ute's boot is an open tray,
so its seats-down figure equals its seats-up one and folding seats buys it nothing. And being under
the $91,661 threshold gets a BEV a novated-lease FBT exemption while buying a PHEV nothing at all,
since plug-in hybrids lost that exemption on 1 April 2025. Each of these is called out on the row it
affects rather than smoothed over — and a row carrying one of these notes marks no winner at all. If
the numbers can't be read straight across, neither can a "best".

At 700px and narrower, only two cars show at a time and the third sits benched, as a chip *above*
the table. Chips render in slot order, not screen order, so tapping one does one of two things
depending on which car it names: tapping the benched chip brings that car on screen and benches
whichever of the two visible cars is second by index; tapping a visible chip benches that car
directly and brings back whichever was off screen. Either way, every pair of the three cars stays
reachable. The winner on every row is still
worked out across all three cars, including the one off screen, so a row the benched car actually
wins gets a note naming it and its number — the alternative would be a tool that quietly reports the
best *visible* car.

## No model in the loop

Nothing in the app calls a model. The free-text "describe your situation" box and the
plain-English verdict explanation are currently unwired, so after the single `/api/dataset` fetch
at boot there are no network calls at all — every number, the ranking and the shortlist are
computed locally and deterministically, and `ANTHROPIC_API_KEY` is not needed for anything.

The parsing machinery is still present and still tested (`public/ui/sections.js`,
`public/ui/prompt-api.js`, `/api/parse`, `/api/explain`) so it can be reconnected. Note that if
the explanation is rewired it needs a caller written against the current verdict shape: it used
to read a vehicle from the verdict, and step 2 no longer names one.

## Local setup

Requires Node 22 (pinned in `.nvmrc`).

```bash
nvm use
npm install
cp .env.example .env
# ANTHROPIC_API_KEY is not needed: nothing in the UI calls a model right now.
# The routes that would use it are still there and still tested.
npm start
```

Then open `http://localhost:3000`.

## Tests

```bash
npm test
```

Runs the full suite on Node's built-in test runner (`node --test`) — no test framework
dependency. 587 tests across the tax/FBT/loan/lease/capacity/resale/spec-comparison calculators,
the dataset validator, the server routes, and the browser-side UI modules (parsed and rendered the
same way whether run under Node or loaded natively in the browser, since there's no bundler or
build step — `calc/` is imported unchanged by both).

### The pre-push hook

`main` auto-deploys to Heroku on every push, with no CI gate and no review step in between, so a
red commit reaching `main` reaches production. `.githooks/pre-push` runs the suite and refuses the
push unless it is green.

Hooks live in the tracked `.githooks/` directory rather than `.git/hooks/`, so they are
version-controlled — but `core.hooksPath` is local config, so **a fresh clone must opt in once**:

```bash
git config core.hooksPath .githooks
```

Check it took with `git config core.hooksPath` (should print `.githooks`). The hook skips
deletion-only pushes, explains itself if `npm` isn't on `PATH` (common when pushing from a GUI
client), and writes full output to `/tmp/car-calc-pre-push.log` on failure. `git push --no-verify`
bypasses it — reasonable for a WIP branch, rarely so for `main`.

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
routes: `/api/parse` (tier 2/3 of the free-text parser, currently unwired), `/api/explain` (the plain-English verdict
explanation), and `/api/dataset` (vehicles, families, rates and tax tables, fetched once at boot).
Purchasing power (`calc/capacity.js`) and shortlist ranking (`calc/rank.js`) are deterministic
functions that never call a model — the same inputs always produce the same order, for free, offline.

## Deployment

A `Procfile` is included for Heroku (`web: node server/index.js`). Deployment itself is a
separate, deliberate step. `ANTHROPIC_API_KEY` is not required while the parse and explanation are
unwired; set it in the target environment's config if you reconnect them later. The app runs
without it either way.
