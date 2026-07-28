import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, toQueryString, fromQueryString } from './state.js';

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
