import { optionCosts, reachableVehicle, reachableVehicles, optionBlocker, valueRatio } from '../../calc/compare.js';
import { rankVehicles } from '../../calc/rank.js';
import { money } from './format.js';

const OPTIONS = ['novated', 'loan', 'upfront'];

// Feasibility differs per option (upfront is bounded by savings, not
// budget — see calc/compare.js), so a missing/infeasible option must render
// as "out of reach" rather than $NaN. Every downstream consumer keys off
// `tco === null` for that, never a truthy/falsy check on the option object
// itself (it's always present, just empty).
const emptyOption = option => ({ option, tco: null, monthlyCost: null, vehicle: null, detail: null, valueRatio: null, balloon: null, balloonCovered: null, blocker: null });

// Each option answers "what is the most expensive car this way of paying
// gets you into, at this budget?" — so the three tiles describe three
// different cars, and the winner is decided on return rather than on raw
// total cost.
//
// An earlier revision settled on ONE car and compared the three options
// against it, because comparing raw totals across different cars is
// indefensible: a cheaper car always costs less, so it crowned whichever
// option was stuck shopping lowest (cash, capped by savings, "won" at high
// budgets purely by being unable to reach anything dear). That objection is
// answered here by the metric, not by forcing one car — valueRatio is
// scale-free, so "how much of what you spent are you still holding" compares
// honestly across a $46k Zeekr and a $90k EQB.
//
// `vehicles` is expected to already be filtered to the caller's stated
// preferences (ui/app.js does this before calling in).
export function verdictAt({ vehicles, budgetMonthly, inputs }, tables) {
  const options = {};

  // Shared with the shortlist (calc/compare.js) so the two sections can
  // never disagree about what this budget reaches.
  const affordableVehicles = reachableVehicles({ vehicles, budgetMonthly, inputs }, tables);

  if (affordableVehicles.length === 0) {
    for (const option of OPTIONS) options[option] = emptyOption(option);
    return { winner: null, options, vehicle: null };
  }

  // Quoting a blocker needs *some* car to quote against. The cheapest one in
  // the pool is the honest choice: it is the smallest ask that would put this
  // option in play at all.
  const cheapest = affordableVehicles.reduce((low, v) => (v.listPrice < low.listPrice ? v : low));

  let best = null;
  for (const option of OPTIONS) {
    const vehicle = reachableVehicle({ vehicles, budgetMonthly, option, inputs }, tables);

    if (!vehicle) {
      // Carry *why*, so the totals row can name the lever instead of saying
      // "out of reach" three identical times.
      const costs = optionCosts({ vehicle: cheapest, inputs }, tables)[option];
      options[option] = { ...emptyOption(option), blocker: optionBlocker(costs, budgetMonthly) };
      continue;
    }

    const costs = optionCosts({ vehicle, inputs }, tables)[option];
    // `blocker: null` rather than absent, so every option object has the
    // same shape whether it is reachable or not.
    // A novated lease ends with a lump-sum residual. It is already inside the
    // total, but a total is not a cash-flow warning: affordability is tested
    // against the monthly figure alone, so a budget that covers the payments
    // comfortably can still leave a five-figure bill due on the last day.
    // Surfaced separately, with whether the car is projected to be worth
    // enough to clear it on sale.
    const balloon = option === 'novated' ? costs.detail.residual : null;

    options[option] = {
      option,
      tco: costs.tco,
      monthlyCost: costs.monthlyCost,
      vehicle,
      detail: costs.detail,
      valueRatio: valueRatio(costs),
      balloon,
      balloonCovered: balloon === null ? null : costs.detail.resale >= balloon,
      blocker: null
    };
    if (best === null || options[option].valueRatio > options[best].valueRatio) best = option;
  }

  // The headline car is the winning option's car — section 3 anchors on it.
  return { winner: best, options, vehicle: best ? options[best].vehicle : null };
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
  // Runner-up is now the next-best *return*, not the next-smallest total —
  // the totals belong to different cars and cannot be subtracted from one
  // another meaningfully.
  const runnerUp = Object.values(verdict.options)
    .filter(o => o.valueRatio !== null && o.option !== verdict.winner)
    .sort((a, b) => b.valueRatio - a.valueRatio)[0];

  panel.innerHTML = `
    <div class="winner">🏆 ${labels[verdict.winner]} — ${escapeHtml(verdict.vehicle.make)} ${escapeHtml(verdict.vehicle.model)}</div>
    <div class="detail">Best return over the term: ${money(winner.detail.grossOutlay)} out of pocket, and you still own about ${money(winner.detail.resale)} of car — a net cost of ${money(winner.tco)}${
      runnerUp ? `, better value than ${labels[runnerUp.option].toLowerCase()}` : ''
    }.</div>
    <div class="totals">${OPTIONS.map(o => {
      const entry = verdict.options[o];
      if (entry.tco === null) {
        return `<div class="total">
          <span>${labels[o]}</span>
          <strong>out of reach</strong>
          ${entry.blocker ? `<span class="total__blocker">${blockerText(entry.blocker)}</span>` : ''}
        </div>`;
      }
      // Each option reaches a different car, so the car has to be named on
      // the tile — otherwise three unlike totals sit side by side looking
      // like a like-for-like comparison.
      return `<div class="total${o === verdict.winner ? ' is-winner' : ''}">
        <span>${labels[o]}</span>
        <strong>${money(entry.tco)}</strong>
        <span class="total__reach">most expensive car you could buy:
          ${escapeHtml(entry.vehicle.make)} ${escapeHtml(entry.vehicle.model)}
          <span class="total__reach-price">${money(entry.vehicle.listPrice)}</span></span>
        <span class="total__ratio">keeps ${Math.round(entry.valueRatio * 100)}c of every $1 spent</span>
        ${entry.balloon ? `<span class="total__balloon${entry.balloonCovered ? '' : ' is-short'}">
          plus a ${money(entry.balloon)} balloon to own it at the end${
            entry.balloonCovered
              ? `, roughly covered by selling it (${money(entry.detail.resale)})`
              : ` — more than it is projected to be worth (${money(entry.detail.resale)}), so selling it would not clear the debt`
          }</span>` : ''}
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
    // Collapsed by default: eight editable rates is a lot of screen between
    // the verdict and the shortlist, and most people never touch them. The
    // `_ratesBuilt` guard below means this markup is written once, so a user
    // who opens the disclosure keeps it open across every recompute.
    panel.innerHTML = `
      <details class="rates-disclosure">
        <summary class="rates-disclosure__summary">Rates and settings</summary>
        <div class="rates-disclosure__body">
          <p class="rates-panel__intro">These are researched market defaults — edit any of them to match a real quote.</p>
          ${RATE_FIELDS.map(spec => fieldMarkup(spec, state, rates)).join('')}
        </div>
      </details>`;
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
