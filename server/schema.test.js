import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchema, explainSchema, clampParsed } from './schema.js';

test('a well-formed parse result validates', () => {
  const result = parseSchema.safeParse({
    bodyTypes: ['SUV'],
    minBootLitres: 500,
    minRangeKm: 400,
    seats: 5,
    grossSalary: 145000,
    monthlyBudget: 900,
    termMonths: 60,
    clarifyingQuestion: null
  });
  assert.equal(result.success, true);
});

test('an unknown body type is rejected', () => {
  const result = parseSchema.safeParse({ bodyTypes: ['Spaceship'] });
  assert.equal(result.success, false);
});

test('a parse result may omit every optional field', () => {
  assert.equal(parseSchema.safeParse({}).success, true);
});

test('explain results require non-empty prose', () => {
  assert.equal(explainSchema.safeParse({ explanation: 'Because you are in the 37% bracket.' }).success, true);
  assert.equal(explainSchema.safeParse({ explanation: '' }).success, false);
});

test('an implausible salary is clamped, not rejected', () => {
  assert.equal(clampParsed({ grossSalary: 99000000 }).grossSalary, 1000000);
  assert.equal(clampParsed({ grossSalary: 200 }).grossSalary, 20000);
});

test('an implausible budget is clamped', () => {
  assert.equal(clampParsed({ monthlyBudget: 500000 }).monthlyBudget, 10000);
});

test('the term is snapped to a supported ATO lease term', () => {
  assert.equal(clampParsed({ termMonths: 50 }).termMonths, 48);
  assert.equal(clampParsed({ termMonths: 999 }).termMonths, 60);
});

test('clamping leaves absent fields absent', () => {
  assert.deepEqual(clampParsed({}), {});
});
