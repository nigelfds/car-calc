import { optionCosts, reachableVehicles, optionBlocker } from '../../calc/compare.js';
import { rankVehicles } from '../../calc/rank.js';
import { money } from './format.js';

const OPTIONS = ['novated', 'loan', 'upfront'];

// Feasibility differs per option (upfront is bounded by savings, not
// budget — see calc/compare.js), so a missing/infeasible option must render
// as "out of reach" rather than $NaN. Every downstream consumer keys off
// `tco === null` for that, never a truthy/falsy check on the option object
// itself (it's always present, just empty).
const emptyOption = option => ({ option, tco: null, monthlyCost: null, vehicle: null, detail: null, blocker: null });

// C2 fix: settle on ONE car and compare all three options against it,
// rather than letting each option independently reach for the dearest car
// *it* can afford (the old behaviour, via reachableVehicle per option).
// That put the three totals-row figures in competition across different
// cars — a dearer car has a higher TCO, so it systematically rewarded
// whichever option could afford the least car (e.g. loan "winning" over
// novated only because loan could reach nothing better than a cheap
// hatchback while novated was pricing a $90k SUV). The three numbers in
// the totals row are presented as like-for-like; this makes them actually
// be like-for-like, and aligns the verdict with the shortlist rendered
// below it (calc/rank.js's rankVehicles), which is deterministic and
// already the mechanism used to choose *that* list's order.
//
// `vehicles` is expected to already be filtered to the caller's stated
// preferences (ui/app.js does this before calling in) — verdictAt itself
// does no filtering beyond "can at least one option afford it".
export function verdictAt({ vehicles, budgetMonthly, inputs }, tables) {
  const options = {};

  // Shared with the shortlist (calc/compare.js) so the two sections can
  // never disagree about what this budget reaches.
  const affordableVehicles = reachableVehicles({ vehicles, budgetMonthly, inputs }, tables);

  if (affordableVehicles.length === 0) {
    for (const option of OPTIONS) options[option] = emptyOption(option);
    return { winner: null, options, vehicle: null };
  }

  // Deterministic, single choice of car — same ranking the shortlist below
  // the verdict uses. No stated preferences are passed here (verdictAt
  // only ever receives financial `inputs`, not the filter/preference
  // fields rankVehicles can weight) so this ranks on the "unstated"
  // dimensions: boot, range, warranty, and value-for-money.
  const [{ vehicle }] = rankVehicles(affordableVehicles, {}, 1);
  const costsByOption = optionCosts({ vehicle, inputs }, tables);

  let best = null;
  for (const option of OPTIONS) {
    const costs = costsByOption[option];
    const feasible = costs.feasible && costs.monthlyCost <= budgetMonthly;
    if (!feasible) {
      // Carry *why*, so the totals row can name the lever instead of saying
      // "out of reach" three identical times.
      options[option] = { ...emptyOption(option), blocker: optionBlocker(costs, budgetMonthly) };
      continue;
    }
    // `blocker: null` rather than absent, so every option object has the
    // same shape whether it is reachable or not.
    options[option] = { option, tco: costs.tco, monthlyCost: costs.monthlyCost, vehicle, detail: costs.detail, blocker: null };
    if (best === null || costs.tco < options[best].tco) best = option;
  }

  return { winner: best, options, vehicle };
}

// ---------------------------------------------------------------------------
// Debounced/rAF-scheduled recompute — see Task 18 design intent:
// crossoverSeries measured ~17ms for 80 vehicles x 25 budget steps, over a
// 16ms frame budget. Wiring a slider's raw 'input' event straight to a
// verdictAt/crossoverSeries recompute would jank every drag. Whoever binds
// the budget control (ui/app.js, a later task) must run its recompute
// through this rather than calling straight into verdictAt/crossoverSeries
// on every 'input' event.
//
// Strategy: coalesce bursts of 'input' events behind a short debounce window
// (rapid drag ticks collapse into one), then align the actual recompute +
// DOM write to the next animation frame so it never lands mid-paint.
// requestAnimationFrame is unavailable under `node --test`, so this falls
// back to a plain debounce there — exercised by nothing but this guard,
// since node has no frame budget to blow.
export function debounce(fn, waitMs = 80) {
  let timer = null;
  let rafId = null;
  const hasRaf = typeof requestAnimationFrame === 'function';

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!hasRaf) {
        fn(...args);
        return;
      }
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => fn(...args));
    }, waitMs);
  };
}

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

// "out of reach" is the same three words whichever option is blocked, but
// the fix isn't the same: raise the monthly budget for a lease or a loan,
// or have the whole purchase price saved for cash. Name the lever.
function blockerText(blocker) {
  return blocker.kind === 'savings'
    ? `needs ${money(blocker.needed)} saved`
    : `needs ${money(blocker.needed)}/mo`;
}

export function renderVerdict(root, verdict) {
  const panel = root.querySelector('#verdict');
  // C3: a missing/blank/non-positive salary is "not enough information
  // yet", not a budget that happens to reach nothing — ui/app.js sets this
  // flag instead of calling verdictAt at all, so this must never be
  // confused with the "no car reachable" case below (that one still names
  // a real, if unaffordable, situation; this one has no result to show).
  if (verdict.insufficientInput) {
    panel.innerHTML = '<p class="skeleton-note">Enter your gross salary to see what you can afford.</p>';
    return;
  }
  if (!verdict.winner) {
    panel.innerHTML = '<p class="skeleton-note">No option reaches a matching car at this budget. Try raising it.</p>';
    return;
  }

  const winner = verdict.options[verdict.winner];
  const labels = { novated: 'Novated lease', loan: 'Direct loan', upfront: 'Buy upfront' };
  const runnerUp = Object.values(verdict.options)
    .filter(o => o.tco !== null && o.option !== verdict.winner)
    .sort((a, b) => a.tco - b.tco)[0];

  panel.innerHTML = `
    <div class="winner">🏆 ${labels[verdict.winner]} — ${escapeHtml(verdict.vehicle.make)} ${escapeHtml(verdict.vehicle.model)}</div>
    <div class="detail">${money(winner.tco)} total over the term${
      runnerUp ? `, saving ${money(runnerUp.tco - winner.tco)} versus ${labels[runnerUp.option].toLowerCase()}` : ''
    }</div>
    <div class="totals">${OPTIONS.map(o => {
      const entry = verdict.options[o];
      return `<div class="total${o === verdict.winner ? ' is-winner' : ''}">
        <span>${labels[o]}</span>
        <strong>${entry.tco === null ? 'out of reach' : money(entry.tco)}</strong>
        ${entry.tco === null && entry.blocker ? `<span class="total__blocker">${blockerText(entry.blocker)}</span>` : ''}
      </div>`;
    }).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Rates panel: every figure here is a researched market default (see
// data/rates.json's `sources`), not an invented one, and every figure is
// editable — a user with a real lease quote should be able to type their own
// rate straight in. `rates` (data/rates.json's shape, `sources` included) is
// injected rather than imported so this module stays usable under `node
// --test` with no filesystem/browser JSON-loading split; ui/app.js fetches
// it once from /api/dataset and passes it through. Fields with no research
// source (opportunityRatePct is an assumption about what your own savings
// would otherwise earn, not a published rate; residualPctOverride and
// deposit are personal choices, not market figures) get an honest note
// instead of an invented citation.
const RATE_FIELDS = [
  {
    field: 'leaseRatePct',
    label: 'Novated lease finance rate',
    suffix: '%',
    step: 0.1,
    fallbackNote: 'Moves the novated-lease crossover point more than any other figure on this page — use your own quote if you have one.'
  },
  {
    field: 'loanRatePct',
    label: 'Car loan interest rate',
    suffix: '%',
    step: 0.1
  },
  {
    field: 'adminFeeAnnual',
    label: 'Novated lease admin fee (annual)',
    prefix: '$',
    step: 10
  },
  {
    field: 'electricityCentsPerKwh',
    label: 'Electricity price',
    suffix: 'c/kWh',
    step: 1,
    fallbackNote: 'Melbourne residential off-peak-weighted estimate — edit it to match your own plan or home charging rate.'
  },
  {
    field: 'otherRunningCostsAnnual',
    label: 'Other running costs (rego, servicing, tyres)',
    prefix: '$',
    step: 10
  },
  {
    field: 'opportunityRatePct',
    label: "Return your savings would otherwise earn",
    suffix: '%',
    step: 0.1,
    fallbackNote: 'An assumption, not a published rate — edit it to match what your savings actually earn elsewhere.'
  },
  {
    field: 'residualPctOverride',
    label: 'Lease residual override',
    suffix: '%',
    step: 1,
    allowEmpty: true,
    fallbackNote: "Defaults to the ATO's statutory minimum residual for your term. Leave blank unless your financier has quoted a different figure."
  },
  {
    field: 'deposit',
    label: 'Deposit on a car loan',
    prefix: '$',
    step: 500,
    fallbackNote: 'Reduces how much you need to borrow for the direct-loan option. Not used by novated lease or cash.'
  }
];

const FIELD_DEFAULTS = {
  residualPctOverride: null,
  deposit: 0
};

function fieldMarkup({ field, label, prefix, suffix, step, allowEmpty, fallbackNote }, state, rates) {
  const raw = state[field];
  const value = raw === null || raw === undefined ? '' : raw;
  const sourceText = rates?.sources?.[field];
  const provenance = sourceText ?? fallbackNote ?? 'Editable default.';

  return `
    <div class="field rate-field">
      <label for="rate-${field}">${escapeHtml(label)}</label>
      <div class="field__input">
        ${prefix ? `<span class="field__prefix" aria-hidden="true">${prefix}</span>` : ''}
        <input type="number" id="rate-${field}" data-field="${field}" step="${step}"
          ${allowEmpty ? '' : 'required'} value="${escapeHtml(value)}" />
        ${suffix ? `<span class="field__suffix" aria-hidden="true">${suffix}</span>` : ''}
      </div>
      <p class="rate-field__provenance">${escapeHtml(provenance)}</p>
      <button type="button" class="rate-field__reset" data-reset="${field}">Reset to default</button>
    </div>`;
}

// Task 20: rebuilding this panel's markup on every render (the previous
// approach) tears down and recreates every <input> in it each time — which
// in a real browser blurs and discards whatever element the user currently
// has focus in. render() (ui/app.js) calls this on every debounced
// recompute, so that made the panel un-typeable: type a custom rate, wait
// 80ms, lose focus and cursor position.
//
// Fix: build the markup exactly once per panel element (guarded by
// `panel._ratesBuilt`, and bind the field/reset listeners then), and on
// every subsequent call only patch each input's `.value` in place — mirroring
// syncFieldInputs (ui/app.js), which does the same "update value, skip
// whatever has focus" for the plain fields. The listeners close over `panel`
// rather than `state`/`onChange`/`defaults` directly, reading
// `panel._ratesState`/`panel._ratesOnChange`/`panel._ratesDefaults`, which
// this function refreshes on every call — otherwise a listener bound on the
// first render would forever act on that first render's stale state.
export function renderRatesPanel(root, state, onChange, rates = null) {
  const panel = root.querySelector('#rates-panel');
  const defaults = {
    leaseRatePct: rates?.leaseRatePct,
    loanRatePct: rates?.loanRatePct,
    adminFeeAnnual: rates?.adminFeeAnnual,
    electricityCentsPerKwh: rates?.electricityCentsPerKwh,
    otherRunningCostsAnnual: rates?.otherRunningCostsAnnual,
    opportunityRatePct: rates?.opportunityRatePct,
    residualPctOverride: FIELD_DEFAULTS.residualPctOverride,
    deposit: FIELD_DEFAULTS.deposit
  };

  panel._ratesState = state;
  panel._ratesOnChange = onChange;
  panel._ratesDefaults = defaults;

  if (!panel._ratesBuilt) {
    panel.innerHTML = `
      <p class="rates-panel__intro">These are researched market defaults — edit any of them to match a real quote.</p>
      ${RATE_FIELDS.map(spec => fieldMarkup(spec, state, rates)).join('')}`;
    panel._ratesBuilt = true;

    for (const input of panel.querySelectorAll('[data-field]')) {
      const field = input.dataset.field;
      input.addEventListener('input', () => {
        const raw = input.value;
        const value = raw === '' ? null : Number(raw);
        panel._ratesOnChange({ ...panel._ratesState, [field]: value });
      });
    }

    for (const button of panel.querySelectorAll('[data-reset]')) {
      button.addEventListener('click', () => {
        const field = button.dataset.reset;
        const currentDefaults = panel._ratesDefaults;
        // Guard against writing `undefined` into state: when renderRatesPanel
        // is called with no `rates` (rates === null), the researched-default
        // fields (leaseRatePct, loanRatePct, adminFeeAnnual,
        // opportunityRatePct) have nothing to reset to. ui/app.js always
        // fetches /api/dataset once and passes rates through, so this branch
        // is a defence-in-depth guard, not the primary fix.
        if (!(field in currentDefaults) || currentDefaults[field] === undefined) return;
        panel._ratesOnChange({ ...panel._ratesState, [field]: currentDefaults[field] });
      });
    }
    return;
  }

  for (const input of panel.querySelectorAll('[data-field]')) {
    if (root.activeElement === input) continue; // never clobber what the user is mid-typing
    const field = input.dataset.field;
    const raw = state[field];
    const value = raw === null || raw === undefined ? '' : String(raw);
    if (String(input.value) !== value) input.value = value;
  }
}
