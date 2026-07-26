import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { luxuryCarTax, vicStampDuty, driveAwayPrice } from './onroad.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('no LCT below the fuel-efficient threshold', () => {
  close(luxuryCarTax({ listPrice: 91661, isFuelEfficient: true }, tables), 0);
});

test('LCT applies at 33% of the GST-exclusive excess', () => {
  close(luxuryCarTax({ listPrice: 100000, isFuelEfficient: true }, tables), 2501.70);
});

test('green cars pay the flat rate at every price point', () => {
  close(vicStampDuty({ dutiableValue: 56000, isGreen: true }, tables), 2352);
  close(vicStampDuty({ dutiableValue: 90000, isGreen: true }, tables), 3780);
});

test('non-green cars step up through tiers on the whole value', () => {
  close(vicStampDuty({ dutiableValue: 90000, isGreen: false }, tables), 4680);
});

test('drive-away price sums list price, duty and registration', () => {
  const result = driveAwayPrice({ listPrice: 56000 }, tables);
  close(result.lct, 0);
  close(result.stampDuty, 2352);
  close(result.registration, 880);
  close(result.total, 59232);
});

// I6: LCT is a wholesale tax already embedded in the advertised list price
// by the time a buyer sees it — unlike stamp duty and registration, which
// are on-road charges applied at retail settlement. The drive-away total
// must not add LCT again on top of listPrice, and stamp duty must be
// charged on listPrice, not on listPrice + lct.
test('LCT is not added on top of a list price that already includes it', () => {
  const listPrice = 99660; // kia-ev6-gt-awd — above the fuel-efficient LCT threshold
  const result = driveAwayPrice({ listPrice }, tables);
  const lct = luxuryCarTax({ listPrice }, tables);

  close(lct, 2399.70);
  close(result.lct, lct, 0.01); // still reported, informationally
  // Stamp duty is charged on listPrice alone — not listPrice + lct.
  close(result.stampDuty, vicStampDuty({ dutiableValue: listPrice }, tables));
  // The total must not contain the LCT amount at all.
  close(result.total, listPrice + result.stampDuty + result.registration);
  assert.notEqual(result.total, listPrice + lct + result.stampDuty + result.registration);
});
