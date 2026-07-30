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
