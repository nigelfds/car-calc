import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeParsed } from './parse.js';

test('Claude values win over keyword values', () => {
  const merged = mergeParsed(
    { grossSalary: 100000, monthlyBudget: 500 },
    { grossSalary: 145000, monthlyBudget: 900 }
  );
  assert.equal(merged.grossSalary, 145000);
  assert.equal(merged.monthlyBudget, 900);
});

test('keyword values fill gaps Claude left null', () => {
  const merged = mergeParsed(
    { grossSalary: 145000, minRangeKm: 400 },
    { grossSalary: null, monthlyBudget: 900 }
  );
  assert.equal(merged.grossSalary, 145000);
  assert.equal(merged.monthlyBudget, 900);
  assert.equal(merged.minRangeKm, 400);
});

test('merging with a null Claude result returns the keyword result', () => {
  const merged = mergeParsed({ grossSalary: 145000 }, null);
  assert.equal(merged.grossSalary, 145000);
});
