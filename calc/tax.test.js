import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { incomeTax, medicareLevy, lito, netIncome } from './tax.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('income tax is nil at the tax-free threshold', () => {
  close(incomeTax(18200, tables), 0);
});

test('income tax at bracket boundaries', () => {
  close(incomeTax(45000, tables), 4020);
  close(incomeTax(135000, tables), 31020);
  close(incomeTax(190000, tables), 51370);
});

test('income tax part-way through the 37% bracket', () => {
  close(incomeTax(145000, tables), 34720);
});

test('medicare levy is nil below the low-income threshold', () => {
  close(medicareLevy(20000, tables), 0);
});

test('medicare levy phases in between the threshold and shade-out point', () => {
  close(medicareLevy(30000, tables), 277.80);
  close(medicareLevy(34027, tables), 680.54);
});

test('medicare levy is 2% above the shade-out point', () => {
  close(medicareLevy(145000, tables), 2900);
});

test('LITO tapers in two stages and reaches nil at 66,667', () => {
  close(lito(37500, tables), 700);
  close(lito(40000, tables), 575);
  close(lito(50000, tables), 250);
  close(lito(70000, tables), 0);
});

test('netIncome subtracts pre-tax deductions before tax', () => {
  const plain = netIncome({ grossSalary: 145000 }, tables);
  close(plain.totalTax, 37620);
  close(plain.netAnnual, 107380);
  close(plain.netMonthly, 8948.33);

  const packaged = netIncome({ grossSalary: 145000, preTaxDeductions: 12000 }, tables);
  close(packaged.taxableIncome, 133000);
  assert.ok(packaged.netAnnual < plain.netAnnual, 'packaging reduces cash in hand');
  assert.ok(plain.netAnnual - packaged.netAnnual < 12000, 'but by less than the deduction');
});
