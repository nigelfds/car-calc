import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyRepayment, loanSummary } from './loan.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('amortises a 50k loan at 6.5% over 60 months', () => {
  close(monthlyRepayment({ principal: 50000, annualRatePct: 6.5, termMonths: 60 }), 978.31);
});

test('a zero-interest loan is principal divided by term', () => {
  close(monthlyRepayment({ principal: 60000, annualRatePct: 0, termMonths: 60 }), 1000);
});

test('a zero principal costs nothing', () => {
  close(monthlyRepayment({ principal: 0, annualRatePct: 6.5, termMonths: 60 }), 0);
});

test('summary reports total repaid and total interest', () => {
  const s = loanSummary({ principal: 50000, annualRatePct: 6.5, termMonths: 60 });
  close(s.totalRepaid, s.monthlyRepayment * 60);
  close(s.totalInterest, s.totalRepaid - 50000);
  assert.ok(s.totalInterest > 8000 && s.totalInterest < 9000);
});
