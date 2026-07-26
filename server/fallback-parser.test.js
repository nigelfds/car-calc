import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKeywords } from './fallback-parser.js';

test('extracts salary written with a k suffix', () => {
  assert.equal(parseKeywords('I earn $145k a year').grossSalary, 145000);
});

test('extracts salary written in full', () => {
  assert.equal(parseKeywords('my salary is $145,000').grossSalary, 145000);
});

test('extracts a monthly budget', () => {
  assert.equal(parseKeywords('I can spend about $900 a month').monthlyBudget, 900);
});

test('distinguishes annual salary from monthly budget in one sentence', () => {
  const r = parseKeywords('I earn $145k and can spend about $900 a month on a car');
  assert.equal(r.grossSalary, 145000);
  assert.equal(r.monthlyBudget, 900);
});

test('recognises body types', () => {
  assert.deepEqual(parseKeywords('looking for an SUV').bodyTypes, ['SUV']);
  assert.deepEqual(parseKeywords('a small hatchback please').bodyTypes, ['Hatch']);
});

test('infers a boot requirement from a dog', () => {
  const r = parseKeywords('I need a big boot for my large dog');
  assert.ok(r.minBootLitres >= 500);
});

test('extracts a range requirement', () => {
  assert.equal(parseKeywords('I want at least 400km of range').minRangeKm, 400);
});

test('extracts a loan term in years', () => {
  assert.equal(parseKeywords('over 5 years').termMonths, 60);
});

test('returns nulls for text with nothing extractable', () => {
  const r = parseKeywords('something nice please');
  assert.equal(r.grossSalary, null);
  assert.equal(r.monthlyBudget, null);
  assert.deepEqual(r.bodyTypes, []);
});
