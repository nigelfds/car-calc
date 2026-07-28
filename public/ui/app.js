// public/ui/app.js — boots the whole app: fetches the dataset once, wires
// state to the DOM, and keeps the verdict, chart, shortlist and URL in
// sync. Ranking and filtering are local and deterministic (calc/rank.js,
// ui/cars.js) so they can run on every keystroke or drag with no network
// call. After the one /api/dataset fetch at boot this file makes no network
// calls at all: the free-text parse and the verdict explanation that used
// them are currently unwired (see the note where maybeExplain used to be).

import { defaultState, toQueryString, fromQueryString } from './state.js';
import { renderInputs } from './sections.js';
import { verdictAt, renderVerdict, renderRatesPanel, debounce } from './slider.js';
import { renderChart } from './crossover-chart.js';
import { filterVehicles, cardModel, renderCards, datasetStats } from './cars.js';
import { rankVehicles, bracketAroundPrice } from '../../calc/rank.js';
import { fbtCliff } from '../../calc/compare.js';
import {
  optionEntryPoint, representativeProfile, purchasingPowerSeries, cheapestPrice
} from '../../calc/capacity.js';
import { money } from './format.js';

// purchasingPowerSeries measures ~2.4ms for these 25 points — it bisects 40
// probe prices per option rather than costing all 114 real cars at every
// budget, which is why it beats the ~17ms cost series it replaced. Still
// routed through the debounce below: 25 points is a deliberate ceiling, and a
// raw 'input' event stream should never drive a recompute directly.
const BUDGET_RANGE = { min: 300, max: 2700, step: 100 };
const RECOMPUTE_DEBOUNCE_MS = 80;

// I4: renderChart's viewport pick (>=900px desktop line chart, <900px
// mobile winner band) has to re-run on a real window resize or a phone
// rotation — render() only runs on a state change, so without this the
// chart would be stuck in whichever representation happened to be current
// at the last recompute. resize/orientationchange can fire in bursts
// (dragging a window edge), so this goes through the same debounce
// primitive as the slider, just with its own, slightly longer window —
// there's no drag-smoothness reason to keep this one at 80ms.
const RESIZE_DEBOUNCE_MS = 150;

const OPTION_PHRASE = { novated: 'A novated lease', loan: 'A car loan', upfront: 'Paying cash' };

// C3: a missing/blank (sections.js deliberately writes '' rather than 0 —
// see NUMERIC_FIELDS.has(field) && raw !== '' there) or non-positive salary
// must never reach the calc engine. netIncome (calc/tax.js) floors taxable
// income at zero, so a salary of '' or 0 makes the fall in take-home pay
// from packaging a car read as zero — every car looks free and the total
// can go negative (a lease "costing" -$11,463). That's a domain rule
// (calc/tax.js) this branch is deliberately not touching — the fix is to
// never call the engine with a salary that can't produce a real answer.
function hasValidSalary(state) {
  return typeof state.grossSalary === 'number' &&
    Number.isFinite(state.grossSalary) &&
    state.grossSalary > 0;
}

function buildInputs(state) {
  return {
    grossSalary: state.grossSalary,
    savings: state.savings,
    termMonths: state.termMonths,
    annualKm: state.annualKm,
    leaseStartDate: state.leaseStartDate,
    leaseRatePct: state.leaseRatePct,
    loanRatePct: state.loanRatePct,
    adminFeeAnnual: state.adminFeeAnnual,
    opportunityRatePct: state.opportunityRatePct,
    residualPctOverride: state.residualPctOverride,
    deposit: state.deposit,
    // I5: these flow from data/rates.json via defaultState (or the rates
    // panel's edits) rather than being hardcoded in calc/compare.js.
    electricityCentsPerKwh: state.electricityCentsPerKwh,
    otherRunningCostsAnnual: state.otherRunningCostsAnnual,
    petrolCentsPerLitre: state.petrolCentsPerLitre,
    // Ignored for every BEV; the dominant term for a PHEV.
    phevBatterySharePct: state.phevBatterySharePct
  };
}

// Reflects state into every [data-field] element without touching
// listeners. renderInputs (ui/sections.js) binds its listeners once, at
// boot; two elements share data-field="monthlyBudget" (the Section 1
// number input and the Section 2 budget slider), so whenever a value
// changes from anywhere else — a parse, a rates-panel reset, the *other*
// element — this is what keeps both showing the same number. Skips
// whichever element currently has focus so it doesn't fight the user
// mid-type or mid-drag.
function syncFieldInputs(root, state) {
  for (const input of root.querySelectorAll('[data-field]')) {
    const field = input.dataset.field;
    if (!(field in state)) continue;
    const value = state[field];
    if (value === null || value === undefined) continue;
    if (root.activeElement === input) continue;
    if (input.type === 'checkbox' && !Array.isArray(value)) {
      if (input.checked !== Boolean(value)) input.checked = Boolean(value);
      continue;
    }
    if (String(input.value) !== String(value)) input.value = value;
  }
}

export function start(root = document) {
  return fetch('/api/dataset')
    .then(res => res.json())
    .then(dataset => boot(root, dataset))
    .catch(err => console.error('Could not load /api/dataset', err));
}

function boot(root, dataset) {
  const { vehicles, families, rates, tables } = dataset;
  // Step 2's ceiling is an EV ceiling and stays one whatever the PHEV toggle
  // says: the whole point of the median profile is that it is stable while
  // the user drags the slider, and it is the FBT-exempt case the headline
  // number describes. A PHEV's real cost is worked out per car in step 3.
  const bevOnly = vehicles.filter(v => (v.powertrain ?? 'bev') === 'bev');
  const profile = representativeProfile(bevOnly);
  const defaults = defaultState(rates);
  let state = fromQueryString(location.search, defaults);
  // I4: the last series painted, so a resize/orientation change can ask the
  // chart to re-pick its representation (mobile band vs desktop lines)
  // without waiting for the next state-driven recompute — see the resize
  // listener bound near the bottom of boot().
  let lastSeries = null;
  // I4 companion: the cliff belongs to the same snapshot as lastSeries, so a
  // resize repaint redraws the marker instead of dropping it.
  let lastCliff = null;
  let lastEntry = null;

  const budgetOutput = root.querySelector('#budgetSliderValue');

  function renderSummaryBar(verdict) {
    const text = root.querySelector('#summary-bar .summary-bar__text');
    if (!text) return;
    if (verdict.insufficientInput) {
      text.textContent = 'Enter your gross salary to see what you can afford';
      return;
    }
    if (!verdict.winner) {
      text.textContent = 'Fill in your details to see what you can afford';
      return;
    }
    const winner = verdict.options[verdict.winner];
    text.textContent =
      `${OPTION_PHRASE[verdict.winner]} reaches up to ${money(winner.maxSpend)} of car`;
  }

  const BAND_LABEL = {
    at: 'At your budget',
    below: 'Just under your budget',
    above: 'If you stretched'
  };

  function renderShortlist(verdict) {
    const matches = filterVehicles(vehicles, state);

    // The ceiling: the dearest car the recommended way of paying reaches.
    // Section 3 is framed entirely around it, so section 2's recommendation
    // and section 3's cars tell one story rather than two. It is now a single
    // number from the capacity model rather than a car's price.
    const anchorPrice = verdict?.maxSpend > 0 ? verdict.maxSpend : null;

    // Ranked over every preference-match, not just the affordable ones — the
    // "if you stretched" card is deliberately above the ceiling, and could
    // not be found in an affordability-filtered pool.
    //
    // Every variant goes in, not one per family: collapsing first threw away
    // the trims the price bands are made of. A family whose cheap trim scores
    // best would be represented only by that trim, so its expensive trim could
    // never be the stretch card, and bands went unfilled. bracketAroundPrice
    // does its own de-duplication, per band, where it can see the prices.
    const ranked = rankVehicles(matches, state, matches.length);

    const bands = anchorPrice !== null ? bracketAroundPrice(ranked, anchorPrice) : [];
    // Real figures here, unlike step 2's typical-EV profile: each card is
    // costed from its own consumption, insurance and depreciation curve.
    const context = { inputs: buildInputs(state), tables, monthlyBudget: state.monthlyBudget };

    const cards = bands.map(({ band, entry }) => ({
      ...cardModel(entry.vehicle, families, context),
      band,
      bandLabel: BAND_LABEL[band],
      winningOption: verdict.winner,
      reason: entry.reasons[0],
      otherTrimsText: entry.otherTrims
        ? `${entry.otherTrims.count} other ${entry.otherTrims.count === 1 ? 'trim' : 'trims'} from ${money(entry.otherTrims.fromPrice)}`
        : null
    }));

    // An empty list has distinct causes and distinct fixes.
    const emptyMessage = matches.length === 0
      ? 'No car in the dataset matches these preferences. Try relaxing one.'
      : `Nothing in the dataset is reachable on ${money(state.monthlyBudget)}/mo. Raise the budget, or add savings to make buying outright an option.`;
    renderCards(root, cards, emptyMessage);
  }

  // The full recompute-and-repaint pass. Deliberately routed through
  // `debounce` (see below) for every DOM-driven change — a budget-slider
  // drag above all, since that's the control most likely to fire a burst of
  // raw 'input' events — so it never runs straight off one.
  function render() {
    history.replaceState(null, '', location.pathname + toQueryString(state, defaults));
    syncFieldInputs(root, state);
    if (budgetOutput) budgetOutput.textContent = money(state.monthlyBudget);

    // The battery-share control is meaningless without a plug-in hybrid to
    // apply it to, so it only exists once the toggle is on.
    const phevOptions = root.querySelector('#phev-options');
    if (phevOptions) phevOptions.hidden = !state.includePhev;

    const inputs = buildInputs(state);
    const salaryReady = hasValidSalary(state);

    // Neither the engine nor the chart is called at all when the salary
    // isn't a real number yet — not called-then-discarded, so there is no
    // window where a bogus $-11,463 "novated lease is free" figure ever
    // reaches the DOM (see hasValidSalary's comment for why).
    const verdict = salaryReady
      ? verdictAt({ budgetMonthly: state.monthlyBudget, inputs, profile }, tables)
      : { winner: null, maxSpend: 0, options: {}, insufficientInput: true };
    renderVerdict(root, verdict);
    renderSummaryBar(verdict);

    // purchasingPowerSeries/renderChart both assume a non-empty `points` array
    // — an empty series
    // would crash renderWinnerBand's `series.points[0].budget` on mobile,
    // not degrade gracefully. So this simply skips the recompute+repaint
    // while the salary is invalid, leaving whatever the chart last showed
    // (always a legitimate render — defaultState()'s salary is valid, so
    // the very first render() at boot always succeeds) rather than ever
    // asking the chart to paint zero/negative-cost points.
    if (salaryReady) {
      // Computed over the same preference-filtered pool the chart is drawn
      // from, so the cars it names are cars the user could actually be shown.
      const pool = filterVehicles(vehicles, state);
      // Unlike the profile, this one does follow the toggle. It is the price
      // of the cheapest car that can actually be bought, and it is what
      // places the "a loan reaches nothing below $X" marker on the chart —
      // if a cheaper PHEV is on the shortlist, that marker would otherwise
      // contradict the card sitting right beneath it.
      //
      // Falls back to the whole fleet when the preferences match nothing:
      // cheapestPrice([]) is 0, and a zero floor switches the floor off
      // entirely (see maxAffordablePrice, calc/capacity.js), so the chart went
      // straight back to plotting $3,379 of capacity at $300/mo above a
      // shortlist reading "no car matches these preferences". An impossible
      // filter narrows what you can be shown; it does not make cars cheaper.
      const floorPrice = cheapestPrice(pool.length > 0 ? pool : vehicles);
      const series = purchasingPowerSeries(
        { inputs, profile, floorPrice, budgetRange: BUDGET_RANGE }, tables
      );
      lastSeries = series;
      lastCliff = fbtCliff({ vehicles: pool, inputs }, tables);
      // Where the car-loan line can first appear. Loan only: the other two
      // lines start at or near the left edge on realistic inputs, so a badge
      // on each would be clutter rather than explanation.
      lastEntry = optionEntryPoint({ vehicles: pool, inputs, option: 'loan' }, tables);
      // I7: pass the current budget through so both the desktop line chart
      // and the mobile winner band can mark the user's own position, not
      // just where the cheapest option changes.
      renderChart(root, series, state.monthlyBudget, lastCliff, lastEntry);
    }

    renderRatesPanel(root, state, onRatesChange, rates);

    renderShortlist(verdict);
  }

  const debouncedRender = debounce(render, RECOMPUTE_DEBOUNCE_MS);

  function onFieldChange(next) {
    state = next;
    debouncedRender();
  }

  function onRatesChange(next) {
    state = next;
    debouncedRender();
  }

  // The plain-English verdict explanation is gone with the free-text box that
  // triggered it — /api/explain only ever ran after a successful parse. It had
  // also broken silently in the capacity rework: it read lastVerdict.vehicle,
  // and the verdict no longer names a car. The server route and its tests are
  // untouched, so rewiring it means writing a caller against the new shape
  // rather than resurrecting this one.

  // A getter, not `state` itself — see renderInputs's own doc comment
  // (ui/sections.js). onFieldChange below reassigns this closure's local
  // `state`; renderInputs must read it live, at event time, or a second
  // field edited after the first discards the first (C1).
  renderInputs(root, () => state, onFieldChange, defaults);

  // Written once at boot: the dataset is fetched once and never changes
  // during a session, so this does not belong in render().
  const statsEl = root.querySelector('#dataset-stats');
  if (statsEl) {
    const stats = datasetStats({ vehicles, families });
    statsEl.textContent = [
      // "cars" for the model count was ambiguous — it read as either the
      // number of brands or the number of buyable variants, and was neither.
      `${stats.brands} brands`,
      `${stats.models} models`,
      `${stats.variants} variants`,
      stats.updated ? `last updated ${stats.updated}` : null
    ].filter(Boolean).join(' · ');
  }

  const slider = root.querySelector('#budgetSlider');
  if (slider) {
    // I7: public/index.html previously hardcoded the slider's max (3000)
    // independently of BUDGET_RANGE.max (2700, the highest budget the chart
    // actually samples) — the two could drift, and had: dragging past
    // $2,700 put the user off the plotted range with no indication. Deriving
    // the slider's bounds from BUDGET_RANGE here, rather than hardcoding
    // both, keeps them unable to disagree.
    slider.min = String(BUDGET_RANGE.min);
    slider.max = String(BUDGET_RANGE.max);

    // A separate, cheap listener purely for the live $ readout — never the
    // expensive recompute. renderInputs's own 'input' listener on this same
    // element (bound above) is what carries the debounced recompute.
    slider.addEventListener('input', () => {
      if (budgetOutput) budgetOutput.textContent = money(Number(slider.value));
    });
  }

  // I4: render() only runs on a state change, so without this the chart
  // stays stuck in whichever representation (mobile band / desktop lines)
  // was current at the last recompute — a window resize or a phone
  // rotation never triggers a state change. Re-picking the representation
  // doesn't need a full recompute, just another call to renderChart with
  // the series already on hand.
  const rerenderChartForViewport = debounce(() => {
    if (lastSeries) renderChart(root, lastSeries, state.monthlyBudget, lastCliff, lastEntry);
  }, RESIZE_DEBOUNCE_MS);

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', rerenderChartForViewport);
    window.addEventListener('orientationchange', rerenderChartForViewport);
  }


  root.querySelector('#summary-bar')?.addEventListener('click', () => {
    root.querySelector('#afford')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  render();
}

// This file is the page's entry point (loaded via <script type="module"
// src="ui/app.js">), not a module under test — no test file imports it, so
// running boot() on load here is safe and matches how index.html wires it.
if (typeof document !== 'undefined') {
  start();
}
