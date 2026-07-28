const ARRAY_FIELDS = new Set(['bodyTypes']);
const STRING_FIELDS = new Set(['leaseStartDate', 'freeText']);
// Declared for the same reason as NUMERIC_FIELDS below: fromQueryString sends
// anything unlisted through Number(), and Number('false') is NaN — the toggle
// would silently reset every time a shared link was opened.
const BOOLEAN_FIELDS = new Set(['includePhev']);

// Declared explicitly rather than inferred from defaultState()'s runtime
// values: minBootLitres, minRangeKm and seats default to null (no filter
// applied), so `typeof value === 'number'` would silently misclassify them
// as non-numeric the moment a null default is legitimate. Keeping this list
// next to defaultState() keeps the state shape and its types in one place.
export const NUMERIC_FIELDS = new Set([
  'grossSalary', 'monthlyBudget', 'termMonths', 'savings', 'annualKm',
  'deposit', 'leaseRatePct', 'loanRatePct', 'adminFeeAnnual',
  'opportunityRatePct', 'residualPctOverride',
  'electricityCentsPerKwh', 'otherRunningCostsAnnual',
  'minBootLitres', 'minRangeKm', 'seats',
  'phevBatterySharePct', 'minElectricRangeKm'
]);

export function defaultState(rates) {
  return {
    grossSalary: 100000,
    monthlyBudget: 900,
    termMonths: 60,
    savings: 0,
    annualKm: rates.defaultAnnualKm,
    leaseStartDate: '2026-07-25',
    deposit: 0,
    leaseRatePct: rates.leaseRatePct,
    loanRatePct: rates.loanRatePct,
    adminFeeAnnual: rates.adminFeeAnnual,
    opportunityRatePct: rates.opportunityRatePct,
    // I5: these used to be hardcoded inside calc/compare.js (RATE_DEFAULTS)
    // instead of flowing from data/rates.json, so neither an edit to the
    // data file nor an edit in the rates panel ever reached the engine.
    electricityCentsPerKwh: rates.electricityCentsPerKwh,
    otherRunningCostsAnnual: rates.otherRunningCostsAnnual,
    residualPctOverride: null,
    bodyTypes: [],
    minBootLitres: null,
    minRangeKm: null,
    seats: null,
    // Plug-in hybrids are opt-in: they are not EVs, they do not get the FBT
    // exemption, and including them silently would change every answer on
    // the page for a user who never asked for them.
    includePhev: false,
    // Only consulted for a PHEV. 50% is a starting point, not a claim — the
    // control exists precisely because the honest answer is personal.
    phevBatterySharePct: 50,
    // Filters on electric-only range. Meaningless for a BEV, where it would
    // duplicate minRangeKm, so the control is hidden with the rest.
    minElectricRangeKm: null,
    freeText: ''
  };
}

const same = (a, b) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b;

export function toQueryString(state, defaults) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === '' || same(value, defaults[key])) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function fromQueryString(search, defaults) {
  const params = new URLSearchParams(search);
  const state = { ...defaults };

  for (const key of Object.keys(defaults)) {
    if (!params.has(key)) continue;
    const raw = params.get(key);

    if (ARRAY_FIELDS.has(key)) {
      state[key] = raw ? raw.split(',') : [];
    } else if (STRING_FIELDS.has(key)) {
      state[key] = raw;
    } else if (BOOLEAN_FIELDS.has(key)) {
      state[key] = raw === 'true';
    } else {
      const parsed = Number(raw);
      state[key] = Number.isFinite(parsed) ? parsed : defaults[key];
    }
  }
  return state;
}
