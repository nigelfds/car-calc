import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resaleValue } from './resale.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);
const curve = [1, 0.78, 0.68, 0.60, 0.53, 0.47];

test('resale at a whole year reads straight off the curve', () => {
  close(resaleValue({ driveAwayTotal: 60000, termMonths: 48, depreciationCurve: curve }), 31800);
});

test('resale mid-year interpolates linearly', () => {
  // 3.5 years sits halfway between year 3 (0.60) and year 4 (0.53) => 0.565
  close(resaleValue({ driveAwayTotal: 60000, termMonths: 42, depreciationCurve: curve }), 33900);
});

test('a term beyond the curve extends the final decline', () => {
  const value = resaleValue({ driveAwayTotal: 60000, termMonths: 72, depreciationCurve: curve });
  assert.ok(value < 0.47 * 60000, 'keeps depreciating past the curve');
  assert.ok(value > 0, 'never goes negative');
});
