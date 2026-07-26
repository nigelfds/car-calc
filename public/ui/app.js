// public/ui/app.js — boots the whole app: fetches the dataset once, wires
// state to the DOM, and keeps the verdict, chart, shortlist and URL in
// sync. Ranking and filtering are local and deterministic (calc/rank.js,
// ui/cars.js) so they can run on every keystroke or drag with no network
// call. The only network calls this file makes after boot are /api/parse
// (inside ui/sections.js's bindFreeText) and /api/explain — and
// /api/explain only ever follows a completed parse, never a slider drag.

import { defaultState, toQueryString, fromQueryString } from './state.js';
import { renderInputs, bindFreeText } from './sections.js';
import { verdictAt, renderVerdict, renderRatesPanel, debounce } from './slider.js';
import { renderChart } from './crossover-chart.js';
import { filterVehicles, cardModel, renderCards } from './cars.js';
import { rankVehicles } from '../../calc/rank.js';
import { crossoverSeries } from '../../calc/compare.js';
import { money } from './format.js';

// crossoverSeries was measured at ~17ms for 80 vehicles across 25 budget
// steps (Task 18/20 design intent) — over a 16ms frame budget, so this can
// never be recomputed straight off a raw 'input' event. 25 points across a
// realistic monthly-budget range mirrors that measurement while still
// covering enough of the range to show a genuine crossover.
const BUDGET_RANGE = { min: 300, max: 2700, step: 100 };
const RECOMPUTE_DEBOUNCE_MS = 80;

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

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
    deposit: state.deposit
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
  const defaults = defaultState(rates);
  let state = fromQueryString(location.search, defaults);
  let lastVerdict = null;

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
      `${OPTION_PHRASE[verdict.winner]} for the ${verdict.vehicle.make} ${verdict.vehicle.model}: ${money(winner.tco)} total`;
  }

  function renderShortlist() {
    const shortlist = rankVehicles(filterVehicles(vehicles, state), state, 5);
    const cards = shortlist.map(({ vehicle, reasons }) => ({
      ...cardModel(vehicle, families),
      reason: reasons[0]
    }));
    renderCards(root, cards);
  }

  // The full recompute-and-repaint pass. Deliberately routed through
  // `debounce` (see below) for every DOM-driven change — a budget-slider
  // drag above all, since that's the control most likely to fire a burst of
  // raw 'input' events — so it never runs straight off one.
  function render() {
    history.replaceState(null, '', location.pathname + toQueryString(state, defaults));
    syncFieldInputs(root, state);
    if (budgetOutput) budgetOutput.textContent = money(state.monthlyBudget);

    const inputs = buildInputs(state);
    const salaryReady = hasValidSalary(state);

    // Neither the engine nor the chart is called at all when the salary
    // isn't a real number yet — not called-then-discarded, so there is no
    // window where a bogus $-11,463 "novated lease is free" figure ever
    // reaches the DOM (see hasValidSalary's comment for why).
    const verdict = salaryReady
      ? verdictAt({ vehicles: filterVehicles(vehicles, state), budgetMonthly: state.monthlyBudget, inputs }, tables)
      : { winner: null, options: {}, vehicle: null, insufficientInput: true };
    lastVerdict = verdict;
    renderVerdict(root, verdict);
    renderSummaryBar(verdict);

    // crossoverSeries/renderChart are untouched (see C2's note on chart
    // scope) and both assume a non-empty `points` array — an empty series
    // would crash renderWinnerBand's `series.points[0].budget` on mobile,
    // not degrade gracefully. So this simply skips the recompute+repaint
    // while the salary is invalid, leaving whatever the chart last showed
    // (always a legitimate render — defaultState()'s salary is valid, so
    // the very first render() at boot always succeeds) rather than ever
    // asking the chart to paint zero/negative-cost points.
    if (salaryReady) {
      const series = crossoverSeries({ vehicles, inputs, budgetRange: BUDGET_RANGE }, tables);
      renderChart(root, series);
    }

    renderRatesPanel(root, state, onRatesChange, rates);

    renderShortlist();
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

  async function maybeExplain() {
    const panel = root.querySelector('#explanation');
    if (!panel) return;
    if (!lastVerdict?.winner) {
      panel.innerHTML = '';
      return;
    }

    const winner = lastVerdict.options[lastVerdict.winner];
    const result = {
      winner: lastVerdict.winner,
      vehicle: `${lastVerdict.vehicle.make} ${lastVerdict.vehicle.model}`,
      termMonths: state.termMonths,
      monthlyBudget: state.monthlyBudget,
      winnerTotalCost: winner.tco,
      winnerMonthlyCost: winner.monthlyCost,
      // Buyers routinely overlook the balloon payment on a novated lease —
      // supply it explicitly whenever novated wins so the explanation can
      // mention it, per server/routes/explain.js's system prompt.
      balloonPayment: lastVerdict.winner === 'novated' ? (winner.detail?.residual ?? null) : null,
      options: Object.fromEntries(
        Object.entries(lastVerdict.options).map(([key, o]) => [key, { tco: o.tco, monthlyCost: o.monthlyCost }])
      )
    };

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ result })
      });
      const body = await response.json();
      panel.innerHTML = body?.explanation
        ? `<p class="explanation-panel__text">${escapeHtml(body.explanation)}</p>`
        : '';
    } catch {
      // No key, no network, a timeout, a 5xx — any failure here must leave
      // the numbers already rendered above untouched, and simply render no
      // explanation. Never let this reach the caller.
      panel.innerHTML = '';
    }
  }

  // A parse is a single discrete action (a button click), never a rapid
  // burst — render immediately rather than through the drag-oriented
  // debounce, then explain what the numbers mean. Explain runs only here,
  // never from onFieldChange/onRatesChange.
  async function onParsed(next) {
    state = next;
    render();
    await maybeExplain();
  }

  // A getter, not `state` itself — see renderInputs's own doc comment
  // (ui/sections.js). onFieldChange below reassigns this closure's local
  // `state`; renderInputs must read it live, at event time, or a second
  // field edited after the first discards the first (C1).
  renderInputs(root, () => state, onFieldChange);

  const slider = root.querySelector('#budgetSlider');
  if (slider) {
    // A separate, cheap listener purely for the live $ readout — never the
    // expensive recompute. renderInputs's own 'input' listener on this same
    // element (bound above) is what carries the debounced recompute.
    slider.addEventListener('input', () => {
      if (budgetOutput) budgetOutput.textContent = money(Number(slider.value));
    });
  }

  bindFreeText(root, () => state, { onParsed });

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
