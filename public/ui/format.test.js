import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, shortMoney, termLabel } from './format.js';

test('a positive amount renders with a leading dollar sign', () => {
  assert.equal(money(1234), '$1,234');
});

test('a negative amount puts the minus sign before the dollar sign (C3)', () => {
  // Was "$-500" — a real currency never spells it that way, and it read as
  // a nonsensical price rather than a negative total.
  assert.equal(money(-500), '-$500');
});

test('rounds to the nearest whole dollar before formatting', () => {
  assert.equal(money(1234.6), '$1,235');
  assert.equal(money(-0.6), '-$1');
});

test('zero has no sign', () => {
  assert.equal(money(0), '$0');
});

// --- Terms, said the way a reader would ------------------------------------
// Shared by the verdict (the commitment behind the ceiling) and the shortlist's
// cost table (the period its totals cover), which is why it lives here rather
// than in either one.

test('a whole-year term reads as years', () => {
  assert.equal(termLabel(60), '5 years');
  assert.equal(termLabel(48), '4 years');
});

test('a one-year term is singular', () => {
  assert.equal(termLabel(12), '1 year');
});

// A guard, not a path: the ATO defines statutory residuals only for whole-year
// terms and calc/novated.js throws on anything else, so this cannot be reached
// through the app today. It is here so a future term option degrades to
// something readable rather than "5.5 years".
test('a term that is not whole years falls back to months', () => {
  assert.equal(termLabel(30), '30 months');
});

test('no term at all reads as the term', () => {
  assert.equal(termLabel(null), 'the term');
  assert.equal(termLabel(0), 'the term');
});

// --- Compact money, for a narrow axis --------------------------------------
// A phone gives the chart about 310 units of plot width. "$115,989" eats a
// fifth of that in the left margin alone, so the y axis abbreviates.

test('thousands are abbreviated with a k', () => {
  assert.equal(shortMoney(115989), '$116k');
  assert.equal(shortMoney(32606), '$33k');
});

test('values under a thousand keep their digits', () => {
  assert.equal(shortMoney(940), '$940');
  assert.equal(shortMoney(0), '$0');
});

test('negatives keep the sign outside the dollar', () => {
  assert.equal(shortMoney(-42500), '-$43k');
});

test('a round million reads as m, not four digits of k', () => {
  assert.equal(shortMoney(1250000), '$1.3m');
});
