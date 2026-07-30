# UX and design review — July 2026

Findings from a design, usability and financial-clarity review of the live site
(carcalc.nig.fm) plus the source in this repo. Thirty items, grouped by kind,
each written so it can be picked up as a standalone task without re-deriving the
diagnosis.

Tick a box when it lands.

**Done: 1, 2, 3, 5-14, 16-21, 23.** **Won't fix: 4** (see its entry).
**Still open: 15, 22, 24-30.**

## How this was reviewed

- Source read in full: `public/index.html`, `public/styles.css`,
  `public/ui/{app,sections,cars,slider,crossover-chart,state,format}.js`, and the
  `calc/` modules those call into.
- Live site driven in Chrome via Playwright at two viewports — 1280×900 (the
  three-column desktop grid) and 390×844 (iPhone-class). Computed styles and
  DOM state read directly off the page where the diagnosis needed it.
- Scenarios exercised beyond the default state:
  `?savings=120000&monthlyBudget=2500` (makes cash the winner, which is how the
  winner-colour bug in item 2 was confirmed).

## Working on these

- No bundler and no build step — edit `public/` and reload. `npm start` serves
  on `server/index.js`; the dataset arrives from `/api/dataset` at boot.
- `npm test` runs `node --test`. The UI modules have real coverage
  (`public/ui/*.test.js`), so a change to render logic usually means updating a
  test alongside it. Purely visual CSS changes generally have no test to update
  — verify those in the browser at both breakpoints.
- `.githooks/pre-push` blocks a red push to `main`, and `main` auto-deploys.
  A fresh clone needs `git config core.hooksPath .githooks` once.
- Three items (2, 16, 24) were each found twice — once in the source and once in
  the browser — and are recorded here once.

---

## Defects

Things that are wrong, as distinct from improvable.

### 1. Checkbox input and its label render on separate lines

- [x] **Done** — commit `1e77e52`, by scoping the generic rules as suggested
  below (and the `:focus` rule they'd also caught). Verified at 1280px and
  390px: both `.checkbox` labels compute `inline-flex`, and the inputs are back
  to their intrinsic 13px rather than filling the column.
- **Effort** S · **Files** `public/styles.css`

**Symptom** All six checkboxes, at both breakpoints. The input renders
full-width and its text wraps to the line below, so "Include plug-in hybrids"
looks like a heading with an orphaned box floating above it, and the body-type
row reads as five boxes over five words. Measured live: `#includePhev` input is
308px wide, `[data-value="SUV"]` is 42px, and every `.checkbox` label computes
`display: block`.

**Cause** Specificity, twice over. `.checkbox { display: inline-flex }` (:341)
loses to `.field label { display: block }` (:362) — one class against one class
plus one type. `.checkbox input { width: auto }` (:351) ties with
`.field input { width: 100% }` (:377) and loses on source order.

**Fix** Scope the generic rules rather than raising the specific ones — e.g.
`.field > label` and `.field input:not([type='checkbox'])` — or move the
`.checkbox` block below line 377. Scoping is preferable; adding weight to
`.checkbox` invites the same collision with the next generic rule.

**Verify** At 390px and 1280px: box and text on one line, box at its intrinsic
size, in the body-type row and on "Include plug-in hybrids".

### 2. Winner tile and slider are lease-orange whoever wins

- [x] **Done** — `renderVerdict` now writes a `total--{option}` modifier on
  every tile and `.is-winner` reads a `--option-line` / `--option-tint` pair
  off it. `renderSummaryBar` does the same for the sticky bar, clearing the
  other two modifiers each render so the class swaps rather than accumulates.
  Verified all three winners tint to their own legend colour: lease `#b96a1e`,
  loan `#10558f`, cash `#8f59d1`. Covered by a new test in `slider.test.js`.
- **Deliberately not changed**: the slider's `accent-color`. Orange is doing
  double duty as the brand accent (it is also the wordmark's "?"), so on the
  budget control — which is an input, not one of the three options — it reads
  as brand rather than as a claim. Worth revisiting only as part of a decision
  about whether the brand accent should be one of the three option hues at all.
- **Note**: the summary bar uses the pale `*-bg` tints as its foreground, not
  the line colours — its ground is `--ink`, and `--line-loan` on `#161b1f` is
  two dark colours stacked.
- **Effort** S · **Files** `public/styles.css`, `public/ui/slider.js`, `public/ui/app.js`

**Symptom** `.verdict-panel .total.is-winner` hardcodes `--line-lease` for both
border and background (:511-514); `.summary-bar__arrow` (:1105) and the slider's
`accent-color` (:600) are the same orange. Load
`?savings=120000&monthlyBudget=2500` and the winning "Buy upfront" tile is
orange, roughly 40px above a legend that assigns purple to cash.

**Fix** Have `renderVerdict` emit the winning option's own modifier class (the
markup already knows the winner — `slider.js:149`), and key border/background
off `--line-loan` / `--line-cash` / `--line-lease` accordingly. The slider's
accent is arguably fine as a neutral brand colour, but it reads as a claim while
the legend is on screen; decide deliberately either way.

**Verify** Each of the three winners in turn (vary `savings` and
`monthlyBudget`) tints its tile to match its legend dot.

### 3. Lease start date is hardcoded and already stale

- [x] **Done** — new exported `defaultLeaseStart(today = new Date())` in
  `ui/state.js`, defaulting 30 days out; the `value` attribute is gone from the
  markup, so the field is filled by `renderInputs` at boot. Built from local
  date parts, not `toISOString()`, which would hand a Melbourne reader
  yesterday's date all morning. Four tests cover the offset, year rollover, the
  timezone trap and "never in the past". Verified live: the field shows
  2026-08-28.
- **Effort** S · **Files** `public/index.html`, `public/ui/state.js`

**Symptom** Both the `value` attribute and `defaultState()` carry the literal
`2026-07-25`. It was three days in the past on the day of review and drifts one
day further every day.

**Fix** Compute at boot. A lease starting today is unrealistic anyway — consider
defaulting a few weeks forward, and keep `min="2025-04-01"` as the guard it
already is (a date before it hands a PHEV the FBT exemption; see `calc/fbt.js`
and the disclosure at `cars.js:202`).

**Verify** Load with no query string on two different days; the field shows a
sensible future date both times. Check `toQueryString` still omits it when it
equals the default, so shared links stay short.

### 4. A card can read "at your budget" and "over your budget" at once

- **Won't fix.** Item 7 puts the monthly figure the warning is computed from
  onto the card itself, which turns the apparent contradiction into an
  explanation: the reader can see $712/mo against their $900 budget and the
  price band beside it, and the two signals stop reading as a disagreement.
  Reopen if the pairing still confuses anyone once 7 has landed.
- **Effort** M · **Files** `public/ui/cars.js`, `public/ui/app.js`

**Symptom** Default state: Tesla Model 3 Long Range RWD, $61,990. It gets the
*AT YOUR BUDGET* band and, four lines below, a red *over your budget* warning on
its novated total.

**Cause** Two different quantities. The band comes from `bracketAroundPrice`
against the capacity ceiling — list price against list price (`app.js:159-172`).
The warning compares `costs.novated.monthlyCost` against `state.monthlyBudget`
(`cars.js:104`). Both are individually right.

**Fix** Options, roughly in order of preference: band on monthly cost under the
recommended option so the two agree; or keep price banding and reword the
warning to name why it differs ("this one's monthly cost is above your budget —
the band is by sticker price"); or suppress the band on a card that carries the
warning. Note this fires most often on PHEVs, which is the case
`novatedOverBudget` was originally written for.

**Verify** No card shows both signals in contradiction at the default state, and
the PHEV case (tick "Include plug-in hybrids") still explains itself.

### 5. Field hints sit closer to the next label than to their own field

- [x] **Done** — a `.field + .field` margin on `.field-group--prefs` and
  `.phev-options`, excluding the body-type fieldset, which carries a larger
  bottom margin of its own. The group now has the same 16px rhythm as
  `--numeric`'s grid gap. Verified: 16px between fields against 4px between a
  label and its own input, so proximity now points the right way.
- **Effort** S · **Files** `public/styles.css`

**Symptom** In the preferences group, "Seats up. A large dog crate needs roughly
500L." sits 19px above the *Minimum seats* label, against roughly 35px of
separation between fields elsewhere. Each hint reads as belonging to the field
beneath it.

**Cause** `.field__hint` has no bottom margin (:370-375), and
`.field-group--prefs` has no per-field gap — unlike `.field-group--numeric`,
which gets `gap: var(--space-4)` from its grid (:356-359).

**Fix** Give `.field-group--prefs` the same grid gap, or a `.field + .field`
margin within it.

**Verify** At 390px, the gap above each label exceeds the gap below its
preceding hint.

### 6. favicon.ico 404s on every load

- [x] **Done** — an inline SVG data URI in the head: the header's route rule as
  a mark, three bars in the lease, loan and cash colours on `--ink`. No second
  request, no binary to keep in step with the palette, and geometric rather
  than lettered because a favicon cannot load the page's font. Verified: zero
  console errors on load.
- **Effort** S · **Files** `public/index.html`

**Symptom** One console error per page load. `public/logo.png` was the obvious
source but is a 199×240 portrait — it would letterbox or crop badly at 16px.

---

## Comprehension

The reader's mental model — the largest cluster, and where the tool's real
usability lives.

### 7. Cards speak in term totals; everything above them speaks in $/month

- [x] **Done** — monthly leads each row, term total beneath it. Cash is
  deliberately not parallel: it leads with its up-front outlay and carries the
  running cost second, because its `monthlyCost` is running costs alone and a
  "$103/mo" headline beside a lease's "$712/mo" would read as cash being seven
  times cheaper. `termLabel` moved to `ui/format.js`, shared with item 11.
- **Effort** M · **Files** `public/ui/cars.js`

**Symptom** The slider, the verdict, the summary bar and the chart are all
monthly. Every shortlist card then switches to "TOTAL COST OVER THE TERM"
(`cars.js:129-163`). The reader carries two units at once and cannot check a
card against the budget they just set.

**Fix** `monthlyCost` is already computed for all three options
(`calc/compare.js:118-145`) and already in hand at `cars.js:104`, where it is
used once and discarded. Show `$X/mo` as the card's primary figure with the term
total secondary. Highest-value single change in this document.

**Verify** Each card's monthly figure for the winning option is comparable by eye
against the slider, and the term total is still reachable.

### 8. Four different label sets for the same three options

- [x] **Done** — `public/ui/labels.js` holds `OPTIONS` plus the long, short and
  sentence forms; the legend's wording won because it is the one a reader meets
  first. "Direct loan" and "Buy upfront" are gone. Its own test asserts the three
  maps cover the same keys and that the short and sentence forms only ever drop
  or add connectives, which is the drift that produced the original four.
- **Effort** S · **Files** `public/index.html`, `public/ui/{slider,cars,app}.js`

| Place | | | |
|---|---|---|---|
| Legend, `index.html:236` | Novated lease | Car loan | Cash |
| Verdict, `slider.js:132` | Novated lease | Direct loan | Buy upfront |
| Card table, `cars.js:124` | Novated | Loan | Cash |
| Summary bar, `app.js:39` | A novated lease | A car loan | Paying cash |

**Fix** One exported label map (a shared `ui/labels.js`, or extend
`ui/format.js`), with a long form and a short form and a sentence form if the
summary bar needs one. Every rename costs the reader a re-identification.

**Verify** Grep for the string literals; none remain outside the new module.

### 9. The page never defines "novated lease"

- [x] **Done** — a `.section-intro` at the head of step 2 defines all three
  options before any number that depends on knowing the difference, and names
  the FBT exemption as where the saving comes from. It also says a lease needs an
  employer who offers packaging, which sets up item 10's checkbox.
- **Effort** S · **Files** `public/index.html`

**Symptom** It is the term the entire tool turns on, the default winner at most
salaries, and it is assumed knowledge throughout.

**Fix** One plain sentence near the legend or under the verdict: the employer
pays the lease from pre-tax salary, and EVs under the luxury-car threshold are
exempt from fringe benefits tax, which is where the saving comes from. Pairs
naturally with item 19, which also wants explanatory text near the chart.

### 10. Never asks whether the reader's employer offers salary packaging

- [x] **Done** — `employerOffersNovated`, defaulted true, declared in
  `BOOLEAN_FIELDS` so a shared link round-trips it (the generic numeric path
  would have turned `'false'` into `NaN` and silently re-enabled the lease).
  Unticking bars a lease from winning but keeps its real ceiling: unavailable is
  not unaffordable, so no blocker and no zeroed figure. One
  `novated-unavailable` class on `#afford` and `#cars` dims the chart's lease
  line, its legend entry and the shortlist's novated rows, rather than teaching
  two renderers to draw a greyed variant of themselves.
- **Note**: the eligibility flag is a sibling of `inputs` in `verdictAt`, not a
  member of it — `inputs` is the calc engine's contract, and whose employer runs
  a scheme is not a fact about the money.
- **Effort** M · **Files** `public/index.html`, `public/ui/{state,app,slider}.js`

**Symptom** A novated lease requires an employer that offers it. Sole traders,
casuals, many small employers and some public-sector schemes are out.
`grep -rn "employer\|salary packag\|eligib" public/ calc/` returns nothing
outside PHEV eligibility. The tool recommends an option a meaningful share of
visitors cannot act on, with no prompt to check.

**Fix** A checkbox in step 1 — "My employer offers novated leasing" — defaulted
on. When off, grey the novated column and exclude it from the winner rather than
removing it, so the reader learns what they're missing and what it would be
worth. Needs a new state field, a query-string round-trip, and a branch in
`verdictAt`.

**Verify** Unticking moves the winner to loan or cash, the chart still plots the
novated line (visibly de-emphasised), and the shared URL round-trips the flag.

### 11. The winner headline is a ceiling that reads as affordability

- [x] **Done** — the commitment ("on $900 a month for 5 years") sits beside the
  ceiling at comparable weight; `verdictAt` now returns `budgetMonthly` and
  `termMonths` so the panel can say it. The trophy is replaced by a 3rem rule in
  the winning option's own colour, reusing item 2's `--option-line`. The winner's
  own obligation — the balloon, on a lease — is promoted out of 0.75rem grey.
- **Note**: the balloon is promoted in place rather than repeated in the
  headline. Two adjacent elements saying the same thing is the duplication this
  panel was criticised for before.
- **Effort** M · **Files** `public/ui/slider.js`, `public/styles.css`

**Symptom** `🏆 Novated lease — up to $61,802` (`slider.js:135`). It is a price
ceiling under a specific set of assumptions; reaching it means a balloon payment
and staying with that employer for the term. The clarifier below is grey, and
the balloon is a 0.75rem list item (`styles.css:497`).

**Fix** Three lines at comparable weight in the winner tile: ceiling, monthly
cost, balloon due at the end. Drop the trophy — it is the only emoji on an
otherwise restrained typographic page, and "🏆 = the right answer" is precisely
the framing the disclaimer four elements below spends a paragraph disowning.
Replace with a coloured rule in the winning option's hue (see item 2).

### 12. Novated total sits below the car's price with no explanation

- [x] **Done** — the caption carries both missing qualifiers once, rather than
  repeating them on three rows: "Totals are over 5 years, after resale". The
  period comes from the state's own term via `termLabel`.
- **Effort** S · **Files** `public/ui/cars.js`

**Symptom** Model 3 card: total cost $43,404 against a $61,990 car. Correct —
the balloon and projected resale net out — but it looks like an error until the
reader finds the balloon sentence below the table.

**Fix** A few words in the table caption (`cars.js:161`), e.g. "Total cost over
the term, after resale".

### 13. Nothing states that the monthly figures include running costs

- [x] **Done** — a hint under the budget slider, which is where the page's
  monthly unit is set, rather than beside each figure that uses it.
- **Effort** S · **Files** `public/index.html`

**Symptom** All three options fold charging, rego, servicing and tyres into
`monthlyCost` (`calc/compare.js:118-145`). This is right, and it is what makes
them comparable — a lease quote bundles them, so the loan and cash figures are
shown the same way. But a reader checking "$780/mo car loan" against a dealer's
repayment quote will conclude the site is $200 high.

**Fix** One sentence near the verdict or the card table saying so. Becomes more
important once item 7 puts monthly figures on the cards.

### 14. Empty shortlist doesn't name the binding filter

- [x] **Done** — `diagnoseEmptyFilters` (`ui/cars.js`) drops each active filter in
  turn and reports the one that alone brings the list back, with the value that
  would work computed from the remaining pool: *"Easing the range minimum to
  750km gives you 24 cars."* Where two filters are jointly binding it returns
  null and the caller says so rather than giving advice that would not help.
  Subsumes the PHEV-only special case, which keeps its better wording.
- **Note**: the suggested value respects the filters that are staying, not the
  whole fleet — otherwise it names a number that still returns nothing.
- **Effort** M · **Files** `public/ui/app.js`, `public/ui/cars.js`

**Symptom** "No car in the dataset matches these preferences. Try relaxing one."
(`app.js:190`) leaves the reader to bisect five filters by hand.

**Fix** Re-run `filterVehicles` with each active filter dropped in turn and name
the one that alone unblocks the list: "Nothing has a 600L boot and 500km range.
Dropping the boot minimum to 480L gives you 6 cars." Cheap — the filter is pure
and already runs on every keystroke. Report the nearest achievable value where
the filter is numeric.

**Verify** Set an impossible pair; the message names one filter and a value that
actually works.

### 15. Defaults render a complete answer indistinguishable from the reader's own

- [ ] **Effort** S · **Files** `public/ui/{app,slider}.js`

**Symptom** $100,000 and $900/mo produce a full, confident verdict and shortlist
before anything is typed. Showing a live example is the right call; nothing
marks it as not-yours.

**Fix** `state.touched` is already tracked (`sections.js:22`). Until
`grossSalary` is in it, badge the verdict "Example — enter your salary".

---

## Chart

### 16. Explanatory content is hover-only, so touch users cannot reach it

- [x] **Done** — `chartNotesMarkup` prints the same explanations in text below the
  chart, in a `<details>` closed by default. The hover tooltips stay for pointer
  users; they are simply no longer the only route. `cliffExplanation` and
  `entryExplanation` are shared by the badge and the note, so the two cannot
  drift apart the way two copies of the copy would.
- **Effort** M · **Files** `public/ui/crossover-chart.js`, `public/styles.css`

**Symptom** Two separate mechanisms, same flaw. The axis key's explanations
appear on hover and follow the pointer (`crossover-chart.js:414-448`); the two
in-chart markers carry theirs the same way (`:202-250`). On a phone — where the
chart is smallest and needs explaining most — neither is reachable. The markers'
`role="tooltip"` also has no `aria-describedby` pointing at it, so it does not
announce.

**Fix** Tap-to-expand `<details>`, or inline the text below the chart at small
widths. See item 19 for the marker copy specifically, which deserves promotion
rather than a better tooltip.

**Verify** At 390px with no pointer, both axis explanations and both marker
explanations are reachable.

### 17. Both chart markers use the same glyph

- [x] **Done** — the cliff is a warning and draws "!", the entry point is
  information and keeps "i". Each note in the block from item 16 is prefixed with
  the glyph its badge draws, in the badge's colour, which is the key the two
  markers never had.
- **Effort** S · **Files** `public/ui/crossover-chart.js`

**Symptom** The FBT cliff and the loan entry point both render a lowercase "i",
distinguished only by colour (red and blue), with no key anywhere.

**Fix** Different symbols, and a line in the legend for each.

### 18. Y-axis ticks are data-derived, not round

- [x] **Done** — `niceTicks` now picks a conventional 1/2/2.5/5 step and emits
  multiples of it, so the axis reads $50k / $75k / $100k rather than $33k / $74k
  / $116k. Ticks fall inside the true bounds rather than extending them: the lines
  are scaled to the data, and stretching the axis outward would pad the plot with
  space no data reaches. The step is the smallest that keeps the tick count within
  what was asked for, so a phone does not gain gridlines as the range widens.
- **Effort** S · **Files** `public/ui/crossover-chart.js`

**Symptom** The axis reads `$33k / $74k / $116k`. The reader is estimating line
positions against those.

**Fix** Snap to round steps — `$25k / $50k / $75k / $100k / $125k`. Watch the
interaction with `bounds()` and the end-label layout, which assume the current
extents.

### 19. The best explanation on the page is buried in a tooltip

- [x] **Done** — it appears in the notes block as "Why the novated line flattens",
  in full, alongside "Why the car loan line starts late". Placement, as
  predicted; the copy needed no rewriting.
- **Effort** S · **Files** `public/ui/crossover-chart.js`

**Symptom** The FBT cliff marker's own text already says it:

> "FBT cliff at $91,661. A novated lease is FBT-exempt up to this price; one
> dollar over and the exemption is lost outright, with no taper, and the monthly
> cost roughly doubles. That is why the novated line flattens here."

That sentence explains the most important shape in the chart and is reachable
only by hovering a 12px circle.

**Fix** Promote a condensed version to visible text under the chart, keeping the
full text in the marker. The copy is written; this is placement, not authoring.

---

## Form

### 20. The two money fields are in different places

- [x] **Done** — the deposit moved out of the collapsed rates panel and up beside
  savings in step 1, and out of `RATE_FIELDS` entirely so there is one control per
  field. It was also the wrong tenant for that panel: every other field there is
  a market rate with a citation, and a deposit is a decision.
- **Effort** S · **Files** `public/index.html`, `public/ui/slider.js`

**Symptom** "Savings you could spend outright" is in step 1 (`index.html:88`);
"Deposit on a car loan" is inside the collapsed *Rates and settings* disclosure
(`slider.js:230`). Someone with $20k intending to put it down on a loan will
type it into savings and get an answer that ignores it.

**Fix** Move the deposit up beside savings, or point at it from the savings hint.

### 21. Boot litres and range km demand numbers people don't have

- [x] **Done** — preset pills above each box (*Weekly shop 300L / Pram and gear
  450L / Camping, dogs 550L*; *City only 300km / Weekend trips 450km / Long
  highway runs 550km*), each showing the figure it stands for so the reader learns
  the unit rather than guessing it. An "Any" pill clears the filter. The number
  box stays for anyone who knows their figure.
- **Note**: `bindPresets` knows nothing about state — it writes the input and
  dispatches the same `input` event a keystroke would, so `renderInputs` remains
  the single path into state. `syncPresets` marks whichever pill matches on every
  render, since the value can also change from the box or a shared link.
- **Effort** M · **Files** `public/index.html`, `public/ui/sections.js`

**Symptom** Both ask for a figure the reader must invent. The dog-crate hint
(`index.html:143`) shows the problem is already understood.

**Fix** Presets that write the number — boot: *Weekly shop / Pram and gear /
Camping and dogs*; range: *City only / Weekend trips / Long highway runs* — with
the litres and km shown beside each, and the free number kept for people who do
know. Keep the underlying state fields unchanged so shared URLs still work.

### 22. "Term" is unqualified

- [ ] **Effort** S · **Files** `public/index.html:73`

It is both the lease/loan length and the window every total is computed over.
"How long you'd keep it" carries both.

### 23. Salary renders without thousands separators

- [x] **Done** — a formatted echo below the box (`renderEchoes`), so an extra zero
  is obvious at a glance. Kept as an echo rather than switching to a text input:
  that would mean stripping separators back out on every keystroke and would cost
  the numeric keypad on a phone.
- **Note**: applied to savings and the loan deposit as well, not just salary.
  They sit side by side and formatting only one of three would read as an
  oversight. Blank and zero echo nothing — "$0" beside an empty box is noise.
- **Effort** S · **Files** `public/index.html`, `public/ui/{sections,app}.js`

`100000` is hard to read and easy to mistype by an order of magnitude. Formatting
inside `type="number"` isn't possible directly — either format on blur with a
text input and a numeric `inputmode`, or echo the formatted value beside the
field. Watch the `blur` handler at `sections.js:118-122`, which currently
restores the raw model value.

---

## Layout

### 24. The three-column grid is cramped at 900px and wasteful at 1280px

- [ ] **Effort** M · **Files** `public/styles.css:255-266`

**Symptom** `250px 1fr 1fr` from 900px gives steps 2 and 3 about 310px each at
the breakpoint — the chart is in its compact rendering and the cards run a
two-column cost table in a phone-width column. At 1280px the page is 2103px
tall, with step 3 running the full height while steps 1 and 2 stop around 1300
and 1460 — roughly 600px of dead column.

**Fix** Two columns (form rail, then steps 2 and 3 stacked in one wide column)
from 900px, and three columns only past ~1200px where they are wide enough.
Interacts with `renderChart`'s container-width branch, so re-check both
renderings after changing it.

### 25. Mobile is 4,779px tall, with ~1,150px before the first answer

- [ ] **Effort** M · **Files** `public/index.html:121-213`

**Fix** Consider collapsing "What you want in a car" behind a disclosure — all
four filters are optional and default to "any". Keep the financial fields open;
they are what the answer depends on.

### 26. Cash reads "out of reach" in every card at the default $0 savings

- [ ] **Effort** S · **Files** `public/ui/cars.js:131-149`

Fifteen dead table rows across a five-card shortlist. Collapse the cash row to a
single line when savings cannot reach anything, with the lever to change it
(`blockerText` in `slider.js:109` already writes that sentence for the verdict).

---

## Accessibility

### 27. The chart legend is hidden from screen readers

- [ ] **Effort** S · **Files** `public/index.html:235`

`aria-hidden="true"` on `.line-legend` removes the only key to the chart. It is
text; let it be read. The colour dots can keep the attribute individually.

### 28. The summary bar is a clickable div with no keyboard path

- [ ] **Effort** S · **Files** `public/index.html:281`, `public/ui/app.js:342`

Confirmed live: `DIV`, `tabIndex -1`, with a click handler that scrolls to step
2. Make it a `<button>` and keep the live region as a child, so the announcement
behaviour survives.

---

## Polish

### 29. Disclaimer bullets are unranked

- [ ] **Effort** S · **Files** `public/index.html:252-262`

Four bullets at 0.82rem grey give the RFBA/HELP warning — genuinely material,
and it can cost someone thousands — the same weight as a note about NEDC range
figures. Keep all four (they are compliance copy, not decoration); lead with
RFBA and let the range caveat sit last.

### 30. No dark mode

- [ ] **Effort** M · **Files** `public/styles.css`

`prefers-color-scheme` appears nowhere; only `prefers-reduced-motion` is handled
(:122). The `:root` token block is already the hard part of the work — the chart
and the three option hues will need checking for contrast on a dark ground.
