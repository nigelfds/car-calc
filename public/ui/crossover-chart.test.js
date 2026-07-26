import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPolylines, toWinnerBands } from './crossover-chart.js';

const series = {
  points: [
    { budget: 400, novated: 50000, loan: 55000, upfront: null },
    { budget: 800, novated: 60000, loan: 62000, upfront: null },
    { budget: 1200, novated: 75000, loan: 72000, upfront: null }
  ],
  crossovers: [{ budget: 1200, from: 'novated', to: 'loan' }]
};

test('each option becomes an SVG points string', () => {
  const lines = toPolylines(series, { width: 400, height: 200 });
  assert.equal(typeof lines.novated, 'string');
  assert.equal(lines.novated.split(' ').length, 3);
});

test('an option with no reachable car produces an empty line', () => {
  const lines = toPolylines(series, { width: 400, height: 200 });
  assert.equal(lines.upfront, '');
});

test('the cheapest point sits lower on screen than the dearest', () => {
  const lines = toPolylines(series, { width: 400, height: 200 });
  const ys = lines.novated.split(' ').map(pair => Number(pair.split(',')[1]));
  assert.ok(ys[0] > ys[2], 'a lower cost is a larger y in SVG coordinates');
});

test('winner bands cover the full width and change at the crossover', () => {
  const bands = toWinnerBands(series);
  assert.equal(bands[0].fromPct, 0);
  assert.equal(bands[bands.length - 1].toPct, 100);
  assert.ok(bands.length >= 2, 'the winner changes at least once');
  assert.equal(bands[0].option, 'novated');
  assert.equal(bands[bands.length - 1].option, 'loan');
});

test('a series with a single leader produces one band', () => {
  const flat = { points: [
    { budget: 400, novated: 50000, loan: 55000, upfront: null },
    { budget: 800, novated: 60000, loan: 65000, upfront: null }
  ], crossovers: [] };
  const bands = toWinnerBands(flat);
  assert.equal(bands.length, 1);
  assert.equal(bands[0].option, 'novated');
});
