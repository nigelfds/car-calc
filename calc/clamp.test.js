import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampParsed } from './clamp.js';

test('an implausible salary is clamped, not rejected', () => {
  assert.equal(clampParsed({ grossSalary: 99000000 }).grossSalary, 1000000);
  assert.equal(clampParsed({ grossSalary: 200 }).grossSalary, 20000);
});

test('an implausible budget is clamped', () => {
  assert.equal(clampParsed({ monthlyBudget: 500000 }).monthlyBudget, 10000);
  assert.equal(clampParsed({ monthlyBudget: 1 }).monthlyBudget, 100);
});

test('boot, range and seats are bounded', () => {
  assert.equal(clampParsed({ minBootLitres: -10 }).minBootLitres, 0);
  assert.equal(clampParsed({ minBootLitres: 9000 }).minBootLitres, 3000);
  assert.equal(clampParsed({ minRangeKm: 5000 }).minRangeKm, 1000);
  assert.equal(clampParsed({ seats: 1 }).seats, 2);
  assert.equal(clampParsed({ seats: 20 }).seats, 9);
});

test('the term is snapped to a supported ATO lease term', () => {
  assert.equal(clampParsed({ termMonths: 50 }).termMonths, 48);
  assert.equal(clampParsed({ termMonths: 999 }).termMonths, 60);
  assert.equal(clampParsed({ termMonths: 0 }).termMonths, 12);
});

test('clamping leaves absent fields absent', () => {
  assert.deepEqual(clampParsed({}), {});
});

test('non-numeric or null fields are left untouched', () => {
  const result = clampParsed({ grossSalary: null, bodyTypes: ['SUV'], clarifyingQuestion: 'Budget?' });
  assert.equal(result.grossSalary, null);
  assert.deepEqual(result.bodyTypes, ['SUV']);
  assert.equal(result.clarifyingQuestion, 'Budget?');
});
