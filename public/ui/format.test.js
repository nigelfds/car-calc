import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money } from './format.js';

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
