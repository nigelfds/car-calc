import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, defaultLeaseStart, toQueryString, fromQueryString } from './state.js';

const rates = {
  loanRatePct: 6.5, leaseRatePct: 7.5, adminFeeAnnual: 1020,
  opportunityRatePct: 4.5, defaultAnnualKm: 15000,
  electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240
};

test('default state draws its rates from rates.json', () => {
  const s = defaultState(rates);
  assert.equal(s.loanRatePct, 6.5);
  assert.equal(s.leaseRatePct, 7.5);
  assert.equal(s.annualKm, 15000);
});

// The lease start date used to be the literal '2026-07-25' in both the markup
// and defaultState, so it was stale the day after it was written and drifted
// further every day after that. These pin the two properties that matter: it
// is in the future, and it is derived from the day it is asked for.
test('the default lease start date is a month ahead of today', () => {
  const start = defaultLeaseStart(new Date(2026, 6, 29));
  assert.equal(start, '2026-08-28');
});

test('the default lease start date rolls over the end of a year', () => {
  assert.equal(defaultLeaseStart(new Date(2026, 11, 20)), '2027-01-19');
});

// Local date parts, not toISOString(): a Melbourne reader is 10-11 hours ahead
// of UTC, so for most of the morning the UTC date is still yesterday's.
test('the default lease start date uses the local date, not the UTC one', () => {
  // 08:00 on 1 July in Melbourne is 22:00 on 30 June UTC.
  const morningInMelbourne = new Date(2026, 6, 1, 8, 0, 0);
  assert.equal(defaultLeaseStart(morningInMelbourne), '2026-07-31');
});

test('the default lease start date is never in the past', () => {
  const today = new Date();
  assert.ok(defaultLeaseStart() > today.toISOString().slice(0, 10));
});

// Eligibility is a boolean that defaults to TRUE, which is the case the generic
// numeric path gets wrong: Number('false') is NaN, so without the field being
// declared in BOOLEAN_FIELDS a shared link would silently re-enable a lease for
// someone who had told the tool they cannot get one.
test('an unticked employer flag survives a shared link', () => {
  const defaults = defaultState(rates);
  const noScheme = { ...defaults, employerOffersNovated: false };
  const query = toQueryString(noScheme, defaults);
  assert.ok(query.includes('employerOffersNovated=false'), query);
  assert.equal(fromQueryString(query, defaults).employerOffersNovated, false);
});

test('the employer flag defaults to available, so links made before it existed are unchanged', () => {
  const defaults = defaultState(rates);
  assert.equal(defaults.employerOffersNovated, true);
  assert.equal(fromQueryString('?grossSalary=145000', defaults).employerOffersNovated, true);
});

test('a state at defaults serialises to an empty query string', () => {
  const defaults = defaultState(rates);
  assert.equal(toQueryString(defaults, defaults), '');
});

test('only changed fields are serialised', () => {
  const defaults = defaultState(rates);
  const changed = { ...defaults, grossSalary: 145000, monthlyBudget: 1200 };
  const query = toQueryString(changed, defaults);
  assert.ok(query.includes('grossSalary=145000'));
  assert.ok(query.includes('monthlyBudget=1200'));
  assert.ok(!query.includes('loanRatePct'));
});

test('a round trip preserves changed values', () => {
  const defaults = defaultState(rates);
  const changed = { ...defaults, grossSalary: 145000, bodyTypes: ['SUV'], leaseRatePct: 8.2 };
  const restored = fromQueryString(toQueryString(changed, defaults), defaults);
  assert.equal(restored.grossSalary, 145000);
  assert.equal(restored.leaseRatePct, 8.2);
  assert.deepEqual(restored.bodyTypes, ['SUV']);
});

test('an unknown query parameter is ignored', () => {
  const defaults = defaultState(rates);
  const restored = fromQueryString('?grossSalary=145000&evil=1', defaults);
  assert.equal(restored.grossSalary, 145000);
  assert.equal(restored.evil, undefined);
});

test('a non-numeric value for a numeric field falls back to the default', () => {
  const defaults = defaultState(rates);
  const restored = fromQueryString('?grossSalary=abc', defaults);
  assert.equal(restored.grossSalary, defaults.grossSalary);
});

test('plug-in hybrids are excluded until asked for', () => {
  const state = defaultState(rates);
  assert.equal(state.includePhev, false);
  assert.equal(state.phevBatterySharePct, 50);
  assert.equal(state.minElectricRangeKm, null, 'no electric-range filter until one is set');
});

// Number('false') is NaN. Without a boolean branch the toggle would silently
// reset every time someone opened a shared link.
test('the toggle survives a round trip through the URL', () => {
  const defaults = defaultState(rates);
  const state = { ...defaults, includePhev: true, phevBatterySharePct: 70 };
  const restored = fromQueryString(toQueryString(state, defaults), defaults);
  assert.equal(restored.includePhev, true);
  assert.equal(restored.phevBatterySharePct, 70);
});

test('an explicit false in the URL does not become NaN', () => {
  const defaults = defaultState(rates);
  const restored = fromQueryString('?includePhev=false', defaults);
  assert.equal(restored.includePhev, false);
});

test('the default toggle stays out of the query string', () => {
  const defaults = defaultState(rates);
  assert.equal(toQueryString({ ...defaults }, defaults).includes('includePhev'), false);
});

import { normaliseCompare, TABS, MAX_COMPARE_SLOTS } from './state.js';

test('an all-empty comparison normalises away entirely', () => {
  assert.deepEqual(normaliseCompare(['', '', '']), []);
  assert.deepEqual(normaliseCompare([]), []);
  assert.deepEqual(normaliseCompare(undefined), []);
});

test('trailing empty slots are trimmed but interior ones are kept', () => {
  assert.deepEqual(normaliseCompare(['a', '', '']), ['a']);
  assert.deepEqual(normaliseCompare(['a', '', 'c']), ['a', '', 'c']);
});

test('no more than three slots survive', () => {
  assert.deepEqual(normaliseCompare(['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
  assert.equal(MAX_COMPARE_SLOTS, 3);
});

test('an empty comparison is absent from the query string', () => {
  const defaults = defaultState(rates);
  assert.equal(toQueryString({ ...defaults, compare: ['', '', ''] }, defaults), '');
});

test('a gapped comparison keeps its slot positions through a round trip', () => {
  const defaults = defaultState(rates);
  const query = toQueryString({ ...defaults, tab: 'compare', compare: ['a', '', 'c'] }, defaults);
  assert.match(query, /compare=a%2C%2Cc/);
  const back = fromQueryString(query, defaults);
  assert.deepEqual(back.compare, ['a', '', 'c']);
  assert.equal(back.tab, 'compare');
});

test('an unknown tab falls back to the default rather than routing nowhere', () => {
  const defaults = defaultState(rates);
  assert.equal(fromQueryString('?tab=nonsense', defaults).tab, 'find');
  assert.deepEqual(TABS, ['find', 'compare']);
});

// Fix 2: a compare link must carry none of the reader's income. Before this,
// toQueryString serialised the whole state object regardless of which tab
// was showing, so ?grossSalary=187500&tab=compare&compare=... was a
// perfectly reachable URL — the design spec's and README's claim otherwise
// was false.
test('a compare-tab link omits a non-default salary, budget and every other Find-tab field', () => {
  const defaults = defaultState(rates);
  const state = {
    ...defaults, tab: 'compare', compare: ['kia-ev5-air', 'tesla-model-y'],
    grossSalary: 187500, monthlyBudget: 1500, savings: 40000, deposit: 5000,
    bodyTypes: ['SUV'], includePhev: true
  };
  const query = toQueryString(state, defaults);
  assert.equal(query, '?tab=compare&compare=kia-ev5-air%2Ctesla-model-y');
  assert.ok(!query.includes('grossSalary'));
  assert.ok(!query.includes('monthlyBudget'));
  assert.ok(!query.includes('savings'));
  assert.ok(!query.includes('bodyTypes'));
});

test('a find-tab link still carries a non-default salary', () => {
  const defaults = defaultState(rates);
  const state = { ...defaults, tab: 'find', grossSalary: 187500 };
  const query = toQueryString(state, defaults);
  assert.ok(query.includes('grossSalary=187500'), query);
});

test('a legacy link carrying both income and a compare tab still parses the income on read', () => {
  // Inbound links must not break just because outbound serialisation now
  // filters — fromQueryString reads every field present, whatever `tab` says.
  const defaults = defaultState(rates);
  const restored = fromQueryString(
    '?grossSalary=187500&savings=40000&tab=compare&compare=kia-ev5-air,tesla-model-y', defaults
  );
  assert.equal(restored.grossSalary, 187500);
  assert.equal(restored.savings, 40000);
  assert.equal(restored.tab, 'compare');
  assert.deepEqual(restored.compare, ['kia-ev5-air', 'tesla-model-y']);
});

test('switching back to the Find tab re-adds the fields a compare link had omitted', () => {
  const defaults = defaultState(rates);
  // The in-memory state never loses these fields — only the compare-tab
  // serialisation omitted them from the URL. Switching `tab` back to 'find'
  // and re-serialising the same state object restores them.
  const compareState = { ...defaults, tab: 'compare', grossSalary: 187500 };
  const compareQuery = toQueryString(compareState, defaults);
  assert.ok(!compareQuery.includes('grossSalary'));
  const findState = { ...compareState, tab: 'find' };
  const findQuery = toQueryString(findState, defaults);
  assert.ok(findQuery.includes('grossSalary=187500'), findQuery);
});
