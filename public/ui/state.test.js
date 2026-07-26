import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, toQueryString, fromQueryString } from './state.js';

const rates = {
  loanRatePct: 6.5, leaseRatePct: 7.5, adminFeeAnnual: 1020,
  opportunityRatePct: 4.5, defaultAnnualKm: 15000
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
