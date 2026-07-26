const ARRAY_FIELDS = new Set(['bodyTypes']);
const STRING_FIELDS = new Set(['leaseStartDate', 'freeText']);

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
    residualPctOverride: null,
    bodyTypes: [],
    minBootLitres: null,
    minRangeKm: null,
    seats: null,
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
    } else {
      const parsed = Number(raw);
      state[key] = Number.isFinite(parsed) ? parsed : defaults[key];
    }
  }
  return state;
}
