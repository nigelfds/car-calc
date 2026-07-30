import { optionCosts, optionBlocker } from '../../calc/compare.js';
import { maxAffordablePrice } from '../../calc/capacity.js';
import { money } from './format.js';

const OPTIONS = ['novated', 'loan', 'upfront'];

// Step 2 answers one question: how much car will each way of paying get me at
// this budget? No car is named here — that is step 3's job.
//
// Keeping cars out is what makes the three numbers comparable. The previous
// design had each option price the dearest car IT could reach and then
// compared those totals, which is not a comparison at all: a cheaper car
// always costs less, so it rewarded whichever option was stuck shopping
// lowest. Three capacities are all denominated in dollars of car, so they can
// simply be read against each other.
//
// A probe car priced against the representative profile is enough to say why
// a blocked option is blocked; nothing here touches the real fleet.
const PROBE_PRICE = 30000;

// What separates the three options isn't the ceiling — that's the number
// already on the card — it's what you are signed up for to get there. Each
// option gets the one figure that is peculiar to it and that the ceiling
// hides: the lump sum still owed at the end of a lease, what the interest and
// deposit on a loan add up to, and what the cash gives up by not being
// invested. `parts` is a list so the loan can carry two.
function optionDetail(option, detail, inputs) {
  if (option === 'novated') {
    return [`${money(detail.residual)} balloon payment due at the end`];
  }
  if (option === 'loan') {
    return [
      `${money(detail.totalInterest)} interest over ${inputs.termMonths} months`,
      inputs.deposit > 0
        ? `${money(inputs.deposit)} deposit up front`
        : 'no deposit'
    ];
  }
  return [`${money(detail.opportunityCost)} of savings returns given up over the term`];
}

export function verdictAt({ budgetMonthly, inputs, profile }, tables) {
  const options = {};
  let best = null;

  for (const option of OPTIONS) {
    const maxSpend = maxAffordablePrice({ budgetMonthly, option, inputs, profile }, tables);
    // Price the detail at this option's OWN ceiling rather than the shared
    // probe: the balloon on an $86,643 lease is not the balloon on the
    // $42,236 the loan reaches, and quoting one for the other would be worse
    // than saying nothing. The probe is still what a blocked option is
    // measured against — there is no ceiling to price at when nothing is
    // reachable.
    const priced = maxSpend > 0 ? maxSpend : PROBE_PRICE;
    const costs = optionCosts({ vehicle: { id: 'probe', ...profile, listPrice: priced }, inputs }, tables)[option];

    options[option] = {
      option,
      maxSpend,
      parts: maxSpend > 0 ? optionDetail(option, costs.detail, inputs) : [],
      blocker: maxSpend > 0 ? null : optionBlocker(costs, budgetMonthly)
    };
    if (maxSpend > 0 && (best === null || maxSpend > options[best].maxSpend)) best = option;
  }

  return { winner: best, maxSpend: best ? options[best].maxSpend : 0, options };
}

// ---------------------------------------------------------------------------
// Debounced/rAF-scheduled recompute — see Task 18 design intent:
// The step-2 recompute (verdictAt plus purchasingPowerSeries) is cheap now,
// but a slider emits a burst of 'input' events per drag and a DOM write per
// event would still jank. Whoever binds
// the budget control (ui/app.js, a later task) must run its recompute
// through this rather than recomputing on every 'input' event.
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
    panel.innerHTML = '<p class="skeleton-note">No way of paying reaches a car at this budget. Try raising it, or adding savings.</p>';
    return;
  }

  const winner = verdict.options[verdict.winner];
  const labels = { novated: 'Novated lease', loan: 'Direct loan', upfront: 'Buy upfront' };

  panel.innerHTML = `
    <div class="winner">🏆 ${labels[verdict.winner]} — up to ${money(winner.maxSpend)}</div>
    <!-- Said once, here, rather than repeated under all three figures: they
         are all the same kind of number, and the space under each is better
         spent on what makes that option different. -->
    <div class="detail">Each figure is the dearest car that way of paying reaches. The cars themselves are below.</div>
    <div class="totals">${OPTIONS.map(o => {
      const entry = verdict.options[o];
      // The option's own modifier goes on every tile, not just the winner's:
      // it names which way of paying the tile is, and the stylesheet decides
      // what to do with that. Today only `.is-winner` reads it — to tint the
      // tile in the winning option's colour rather than always the lease's —
      // but a class that appears only on the winner is one the next rule that
      // wants "which option is this" would have to re-derive.
      if (entry.maxSpend <= 0) {
        return `<div class="total total--${o}">
          <span>${labels[o]}</span>
          <strong>out of reach</strong>
          ${entry.blocker ? `<span class="total__blocker">${blockerText(entry.blocker)}</span>` : ''}
        </div>`;
      }
      return `<div class="total total--${o}${o === verdict.winner ? ' is-winner' : ''}">
        <span>${labels[o]}</span>
        <strong>${money(entry.maxSpend)}</strong>
        <ul class="total__parts">${
          (entry.parts ?? []).map(part => `<li>${escapeHtml(part)}</li>`).join('')
        }</ul>
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
    // Inert for a BEV, and the dominant term in a plug-in hybrid's fuel bill.
    // Listed here on the same footing as the rest because it is a researched
    // rate with a citation of its own (data/rates.json), and the panel's
    // promise that every figure is editable was false while it was missing.
    field: 'petrolCentsPerLitre',
    label: 'Petrol price',
    suffix: 'c/L',
    step: 1
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
    petrolCentsPerLitre: rates?.petrolCentsPerLitre,
    otherRunningCostsAnnual: rates?.otherRunningCostsAnnual,
    opportunityRatePct: rates?.opportunityRatePct,
    residualPctOverride: FIELD_DEFAULTS.residualPctOverride,
    deposit: FIELD_DEFAULTS.deposit
  };

  panel._ratesState = state;
  panel._ratesOnChange = onChange;
  panel._ratesDefaults = defaults;

  if (!panel._ratesBuilt) {
    // Collapsed by default: nine editable rates is a lot of screen between
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
