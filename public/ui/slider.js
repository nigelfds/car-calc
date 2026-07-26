import { optionCosts, reachableVehicle } from '../../calc/compare.js';

const OPTIONS = ['novated', 'loan', 'upfront'];

// Feasibility differs per option (upfront is bounded by savings, not
// budget — see calc/compare.js), so a missing/infeasible option must render
// as "out of reach" rather than $NaN. Every downstream consumer keys off
// `tco === null` for that, never a truthy/falsy check on the option object
// itself (it's always present, just empty).
const emptyOption = option => ({ option, tco: null, monthlyCost: null, vehicle: null, detail: null });

export function verdictAt({ vehicles, budgetMonthly, inputs }, tables) {
  const options = {};
  let best = null;
  let bestVehicle = null;

  for (const option of OPTIONS) {
    const vehicle = reachableVehicle({ vehicles, budgetMonthly, option, inputs }, tables);
    if (!vehicle) {
      options[option] = emptyOption(option);
      continue;
    }
    const costs = optionCosts({ vehicle, inputs }, tables)[option];
    options[option] = { option, tco: costs.tco, monthlyCost: costs.monthlyCost, vehicle, detail: costs.detail };

    if (best === null || costs.tco < options[best].tco) {
      best = option;
      bestVehicle = vehicle;
    }
  }

  return { winner: best, options, vehicle: bestVehicle };
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

const money = value => `$${Math.round(value).toLocaleString('en-AU')}`;

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

export function renderVerdict(root, verdict) {
  const panel = root.querySelector('#verdict');
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

export function renderRatesPanel(root, state, onChange, rates = null) {
  const panel = root.querySelector('#rates-panel');
  const defaults = {
    leaseRatePct: rates?.leaseRatePct,
    loanRatePct: rates?.loanRatePct,
    adminFeeAnnual: rates?.adminFeeAnnual,
    opportunityRatePct: rates?.opportunityRatePct,
    residualPctOverride: FIELD_DEFAULTS.residualPctOverride,
    deposit: FIELD_DEFAULTS.deposit
  };

  panel.innerHTML = `
    <p class="rates-panel__intro">These are researched market defaults — edit any of them to match a real quote.</p>
    ${RATE_FIELDS.map(spec => fieldMarkup(spec, state, rates)).join('')}`;

  for (const input of panel.querySelectorAll('[data-field]')) {
    const field = input.dataset.field;
    input.addEventListener('input', () => {
      const raw = input.value;
      const value = raw === '' ? null : Number(raw);
      onChange({ ...state, [field]: value });
    });
  }

  for (const button of panel.querySelectorAll('[data-reset]')) {
    button.addEventListener('click', () => {
      const field = button.dataset.reset;
      // Guard against writing `undefined` into state: when renderRatesPanel
      // is called with no `rates` (rates === null), the researched-default
      // fields (leaseRatePct, loanRatePct, adminFeeAnnual,
      // opportunityRatePct) have nothing to reset to. ui/app.js always
      // fetches /api/dataset once and passes rates through, so this branch
      // is a defence-in-depth guard, not the primary fix.
      if (!(field in defaults) || defaults[field] === undefined) return;
      onChange({ ...state, [field]: defaults[field] });
    });
  }
}
