import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPreferences } from './sections.js';

const base = {
  grossSalary: 100000, monthlyBudget: 900, termMonths: 60,
  bodyTypes: [], minBootLitres: null, touched: []
};

test('parsed preferences are applied to untouched fields', () => {
  const { state, changedFields } = applyPreferences(base, { grossSalary: 145000, bodyTypes: ['SUV'] });
  assert.equal(state.grossSalary, 145000);
  assert.deepEqual(state.bodyTypes, ['SUV']);
  assert.ok(changedFields.includes('grossSalary'));
  assert.ok(changedFields.includes('bodyTypes'));
});

test('a field the user has edited is never overwritten', () => {
  const touched = { ...base, touched: ['grossSalary'] };
  const { state, changedFields } = applyPreferences(touched, { grossSalary: 145000 });
  assert.equal(state.grossSalary, 100000, 'the manual value survives');
  assert.ok(!changedFields.includes('grossSalary'));
});

test('null preferences leave the state alone', () => {
  const { state, changedFields } = applyPreferences(base, { grossSalary: null, seats: null });
  assert.equal(state.grossSalary, 100000);
  assert.equal(changedFields.length, 0);
});

test('a value identical to the current one is not reported as changed', () => {
  const { changedFields } = applyPreferences(base, { grossSalary: 100000 });
  assert.equal(changedFields.length, 0);
});
