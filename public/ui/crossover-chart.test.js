import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPolylines, toSegments, toWinnerBands } from './crossover-chart.js';

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

// Issue 1 regression: a crossover placed at the boundary between the
// second-to-last and last sampled points used to collapse the new leader's
// band to `{ fromPct: pct, toPct: pct }` — zero width, invisible, and with
// no later point to grow it. The fixture above already has its crossover on
// the last point; every band in it (and in any series) must render as an
// actual strip.
test('every winner band has non-zero width', () => {
  const bands = toWinnerBands(series);
  assert.ok(bands.length > 0);
  for (const band of bands) {
    assert.ok(band.toPct - band.fromPct > 0, `${band.option} band is zero-width (${band.fromPct}-${band.toPct})`);
  }
});

test('a crossover on the very last sampled point still produces a visible second band', () => {
  const lateCrossover = { points: [
    { budget: 400, novated: 50000, loan: 60000, upfront: null },
    { budget: 800, novated: 60000, loan: 68000, upfront: null },
    { budget: 1200, novated: 75000, loan: 90000, upfront: null },
    { budget: 1600, novated: 90000, loan: 88000, upfront: null }
  ], crossovers: [{ budget: 1600, from: 'novated', to: 'loan' }] };

  const bands = toWinnerBands(lateCrossover);
  assert.equal(bands.length, 2);
  assert.equal(bands[0].option, 'novated');
  assert.equal(bands[1].option, 'loan');
  assert.ok(bands[1].toPct - bands[1].fromPct > 0, 'the late-crossover band must have non-zero width');
  // The boundary is the midpoint between the two samples that disagree
  // (index 2 at 66.6% and index 3 at 100%), not the later sample's own pct.
  assert.ok(bands[0].toPct > 66.6 && bands[0].toPct < 100, `boundary ${bands[0].toPct} should sit strictly between the two samples`);
  assert.equal(bands[0].toPct, bands[1].fromPct, 'bands stay contiguous — no gap, no overlap');
});

test('bands stay contiguous, first starts at 0, last ends at 100', () => {
  const bands = toWinnerBands(series);
  assert.equal(bands[0].fromPct, 0);
  assert.equal(bands[bands.length - 1].toPct, 100);
  for (let i = 1; i < bands.length; i++) {
    assert.equal(bands[i - 1].toPct, bands[i].fromPct, `gap or overlap between band ${i - 1} and ${i}`);
  }
});

// Issue 3: nothing reachable at any sampled budget must not produce [],
// which would violate "first band starts at 0, last ends at 100" and leave
// the caller rendering a blank strip with a stub aria-label.
test('a series with no reachable option anywhere produces an explicit unaffordable band, not []', () => {
  const nothingAffordable = { points: [
    { budget: 400, novated: null, loan: null, upfront: null },
    { budget: 800, novated: null, loan: null, upfront: null }
  ], crossovers: [] };
  const bands = toWinnerBands(nothingAffordable);
  assert.equal(bands.length, 1);
  assert.equal(bands[0].fromPct, 0);
  assert.equal(bands[0].toPct, 100);
  assert.notEqual(bands[0].option, undefined);
  assert.notEqual(bands[0].option, 'novated');
  assert.notEqual(bands[0].option, 'loan');
  assert.notEqual(bands[0].option, 'upfront');
});

// Issue 2: toPolylines() is documented as unsafe for direct painting
// because it bridges gaps; toSegments() is the public painting interface
// that breaks a real gap into separate runs instead.
test('toSegments breaks a run at a null point instead of bridging it', () => {
  const withGap = { points: [
    { budget: 400, novated: 50000, loan: 55000, upfront: 40000 },
    { budget: 800, novated: 60000, loan: 62000, upfront: null },
    { budget: 1200, novated: 75000, loan: 72000, upfront: 40000 }
  ], crossovers: [] };
  const segments = toSegments(withGap, { width: 400, height: 200 });
  assert.equal(segments.upfront.length, 2, 'the gap at index 1 splits upfront into two runs');
  assert.equal(segments.upfront[0].length, 1);
  assert.equal(segments.upfront[1].length, 1);
  // No gap in the source data: novated stays one contiguous run.
  assert.equal(segments.novated.length, 1);
  assert.equal(segments.novated[0].length, 3);
});
