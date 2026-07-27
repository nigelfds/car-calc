import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPolylines, toSegments, toWinnerBands, renderChart, layoutCrossoverLabels, wrapText } from './crossover-chart.js';

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

// ---------------------------------------------------------------------------
// I4: renderChart used to pick its rendering with `root.clientWidth < 900`.
// app.js always calls it with `root = document`, and Document has no
// clientWidth — `undefined < 900` is always false, so the mobile winner
// band could never render at any real viewport. These fixtures put a
// deliberately wrong `clientWidth` directly on the fake `root` (the
// property the old, buggy code actually read) so that if renderChart were
// still reading it, the assertion below would fail — the only way these
// pass is if the viewport-width source is something else (matchMedia).

// Returns { root, getHtml } rather than a destructured `html` value —
// destructuring a getter reads it once, immediately, before renderChart has
// run, which would silently capture the empty starting string every time.
function fakeChartRoot(extra = {}) {
  let html = '';
  const target = {
    set innerHTML(value) { html = value; },
    get innerHTML() { return html; }
  };
  const root = {
    querySelector: sel => (sel === '#crossover' ? target : null),
    ...extra
  };
  return { root, getHtml: () => html };
}

function withMatchMedia(matches, fn) {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = query => ({ media: query, matches });
  try {
    fn();
  } finally {
    if (original === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = original;
  }
}

test('renderChart renders the mobile winner band when matchMedia reports a narrow viewport, ignoring a large clientWidth on root', () => {
  withMatchMedia(false, () => {
    // clientWidth: 5000 is a decoy — under the old bug this property was
    // never even read correctly (root was `document`), but if some fix
    // wrongly started reading root.clientWidth directly, this large value
    // would flip the outcome to the desktop chart and fail the assertion.
    const { root, getHtml } = fakeChartRoot({ clientWidth: 5000 });
    renderChart(root, series);
    assert.ok(getHtml().includes('winner-band'), 'expected the mobile winner band markup');
    assert.ok(!getHtml().includes('crossover-chart'), 'the desktop chart must not also render');
  });
});

test('renderChart renders the desktop line chart when matchMedia reports a wide viewport, ignoring a tiny clientWidth on root', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot({ clientWidth: 10 });
    renderChart(root, series);
    assert.ok(getHtml().includes('crossover-chart'), 'expected the desktop SVG line chart markup');
    assert.ok(!getHtml().includes('winner-band'), 'the mobile band must not also render');
  });
});

test('without matchMedia, renderChart falls back to document.documentElement.clientWidth, not root.clientWidth', () => {
  const original = globalThis.matchMedia;
  delete globalThis.matchMedia;
  try {
    // clientWidth directly on root (the old buggy read) is huge; the real
    // Document-shaped fallback (documentElement.clientWidth) is narrow.
    const { root, getHtml } = fakeChartRoot({ clientWidth: 5000, documentElement: { clientWidth: 400 } });
    renderChart(root, series);
    assert.ok(getHtml().includes('winner-band'), 'expected the fallback to read documentElement.clientWidth, not root.clientWidth');
  } finally {
    if (original !== undefined) globalThis.matchMedia = original;
  }
});

// ---------------------------------------------------------------------------
// I7: the user's current budget must be marked on whichever rendering is
// chosen — previously renderChart never received the budget at all.

test('the desktop line chart marks the current budget when one is passed', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    assert.ok(getHtml().includes('budget-marker'), 'expected a budget-marker element in the SVG');
  });
});

test('the mobile winner band marks the current budget when one is passed', () => {
  withMatchMedia(false, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    assert.ok(getHtml().includes('winner-band__budget-marker'), 'expected a budget-marker element on the band');
  });
});

test('no budget marker renders when renderChart is called without a budget', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series);
    assert.ok(!getHtml().includes('budget-marker'), 'no budget was passed, so no marker should render');
  });
});

// --- Crossover label collision -----------------------------------------
// A richer dataset means more variants, which means more budgets at which
// the cheapest option flips. Three crossovers inside ~100px used to render
// their labels on top of each other ("$110$1200/mo"), so labels now get
// stacked onto extra rows rather than overprinting.

const labelsOverlap = (a, b, charWidth = 5.4, gap = 4) => {
  const halfWidth = e => (`$${e.budget}/mo`.length * charWidth) / 2;
  return Math.abs(a.x - b.x) < halfWidth(a) + halfWidth(b) + gap;
};

test('two well-separated crossover labels both stay on the first row', () => {
  const laidOut = layoutCrossoverLabels([
    { budget: 500, x: 20 },
    { budget: 2500, x: 500 }
  ]);
  assert.deepEqual(laidOut.map(e => e.row), [0, 0]);
});

test('a crossover label that would overprint its neighbour moves to the next row', () => {
  const laidOut = layoutCrossoverLabels([
    { budget: 1100, x: 200 },
    { budget: 1200, x: 210 }
  ]);
  assert.equal(laidOut[0].row, 0);
  assert.equal(laidOut[1].row, 1, 'the colliding label must not share row 0');
});

test('no two crossover labels on the same row ever overlap', () => {
  const laidOut = layoutCrossoverLabels([
    { budget: 900, x: 100 },
    { budget: 1100, x: 118 },
    { budget: 1200, x: 131 },
    { budget: 1500, x: 149 },
    { budget: 1600, x: 160 }
  ]);
  for (const a of laidOut) {
    for (const b of laidOut) {
      if (a === b || a.row !== b.row) continue;
      assert.ok(!labelsOverlap(a, b), `$${a.budget} and $${b.budget} overlap on row ${a.row}`);
    }
  }
});

test('crossover labels keep the x of their own marker line, only the row changes', () => {
  const input = [{ budget: 1100, x: 200 }, { budget: 1200, x: 210 }];
  const laidOut = layoutCrossoverLabels(input);
  assert.deepEqual(laidOut.map(e => e.x), [200, 210]);
});

test('a label reuses an earlier row once it has cleared that row horizontally', () => {
  const laidOut = layoutCrossoverLabels([
    { budget: 900, x: 100 },
    { budget: 1000, x: 112 },
    { budget: 2500, x: 400 }
  ]);
  assert.deepEqual(laidOut.map(e => e.row), [0, 1, 0], 'the far-right label should drop back to row 0');
});

// Leader-change markers are suspended: crossoverSeries prices each option
// against a different car, so a "crossover" can mean nothing more than one
// option starting to shop dearer. Drawing a decision point there implied a
// confidence the numbers do not support. layoutCrossoverLabels above is kept
// against the markers returning once the series compares like with like.
test('no leader-change markers are drawn while the series compares different cars', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    const dense = Array.from({ length: 21 }, (_, i) => ({
      budget: 300 + i * 100,
      novated: 50000 + i * 1000,
      loan: 52000 + i * 900,
      upfront: null
    }));
    renderChart(root, {
      points: dense,
      crossovers: [
        { budget: 1000, from: 'novated', to: 'loan' },
        { budget: 1100, from: 'loan', to: 'novated' }
      ]
    }, 800);
    const html = getHtml();
    assert.ok(!html.includes('crossover-line'), 'the dashed leader-change rules must be gone');
    assert.ok(!html.includes('axis-label--crossover'), 'their budget labels must be gone too');
  });
});

// The accessible description has to describe the chart as drawn — leaving the
// spoken "the cheapest option changes at $X" summary in place would describe
// markers a sighted user can no longer see.
test('the accessible description no longer narrates leader changes either', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    assert.ok(!/cheapest option changes/i.test(getHtml()),
      'the aria description must match what is actually drawn');
  });
});

// --- Axis titles ---------------------------------------------------------
// The bare tick labels ("$300/mo", "$62,816") never said what either axis
// measured, so the Y axis in particular was easy to read as an affordability
// ceiling rather than as what each option costs you over the term.

test('the chart titles both axes', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    const html = getHtml();
    assert.ok(html.includes('axis-title--x'), 'expected an x-axis title element');
    assert.ok(html.includes('axis-title--y'), 'expected a y-axis title element');
    assert.ok(/Monthly budget/i.test(html), `expected the x axis to name the budget, got: ${html}`);
    assert.ok(/Total cost/i.test(html), 'expected the y axis to name total cost');
  });
});

test('the y-axis title is rotated so it reads along the axis', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    assert.ok(/axis-title--y[^>]*rotate\(-90\)|rotate\(-90\)[^>]*axis-title--y/.test(getHtml()),
      'the y title must carry a -90 degree rotation');
  });
});

test('the mobile winner band names its axis in visible text, not just aria', () => {
  withMatchMedia(false, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    // The aria-label already contained the words "by monthly budget", so
    // assert on a real element instead — otherwise this passes vacuously.
    assert.ok(getHtml().includes('winner-band__axis-title'),
      'the band scale is a budget axis and should say so on screen');
  });
});

// --- FBT cliff marker ----------------------------------------------------

const cliffFixture = {
  cliffPrice: 91661,
  budgetAt: 1217,
  budgetNeeded: 3039,
  carBelow: { make: 'Mercedes-Benz', model: 'EQB', listPrice: 90000 },
  carAbove: { make: 'Kia', model: 'EV6', listPrice: 99660 }
};

const wideSeries = {
  points: Array.from({ length: 25 }, (_, i) => ({
    budget: 300 + i * 100, novated: 30000 + i * 500, loan: 40000 + i * 900, upfront: 62835
  })),
  crossovers: []
};

test('the cliff marker renders with its explanation when one applies', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, cliffFixture);
    const html = getHtml();
    assert.ok(html.includes('fbt-cliff'), 'expected a cliff marker');
    assert.ok(/loses|lost outright|exemption/i.test(html), 'expected the exemption explained');
    assert.ok(html.includes('$91,661'), 'expected the threshold named');
    assert.ok(html.includes('<title>'), 'the explanation must be reachable as a tooltip');
  });
});

test('no cliff marker renders when there is no cliff', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, null);
    assert.ok(!getHtml().includes('fbt-cliff'), 'nothing to mark, so nothing drawn');
  });
});

// valueToX clamps out-of-range values to an edge, so a cliff beyond the
// charted budget range would be pinned to the axis end and read as though it
// sat there. Drawing nothing is the honest option.
test('a cliff outside the charted budget range is not drawn at the edge', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, { ...cliffFixture, budgetAt: 9999 });
    assert.ok(!getHtml().includes('fbt-cliff'), 'a cliff off the right of the chart must not be pinned to the edge');
  });
});

test('the cliff marker names both cars and both monthly figures', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, cliffFixture);
    const html = getHtml();
    assert.ok(html.includes('EQB'), 'the dearest exempt car');
    assert.ok(html.includes('EV6'), 'the first car past the cliff');
    assert.ok(html.includes('$1,217'), 'what the exempt car costs monthly');
    assert.ok(html.includes('$3,039'), 'what the next car up would cost');
  });
});

// The marker is an annotation, not a control: it stays out of the tab order
// so it cannot be tabbed to or clicked. Its text is still exposed to assistive
// technology through aria-label on the group.
test('the cliff marker is not focusable or clickable', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, cliffFixture);
    const html = getHtml();
    assert.ok(!/tabindex/.test(html), 'an annotation must not enter the tab order');
    assert.ok(!/onclick|<a /.test(html), 'and must not be a control');
    assert.ok(/aria-label="FBT cliff/.test(html), 'its text must still reach assistive tech');
  });
});

// A native <title> only appears after the browser's ~1s tooltip delay. The
// explanation is drawn into the chart instead so it shows instantly on hover.
test('the explanation is drawn into the chart, not left to a native title tooltip', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, cliffFixture);
    const html = getHtml();
    assert.ok(html.includes('fbt-cliff__tip'), 'expected a drawn tooltip element');
    assert.ok(html.includes('<tspan'), 'expected the copy wrapped into tspans');
    // Scoped to the cliff group: the data points legitimately keep their own
    // <title> hover labels, so a document-wide check would never pass.
    const group = html.slice(html.indexOf('class="fbt-cliff"'));
    assert.ok(!group.slice(0, group.indexOf('</g>')).includes('<title>'),
      'the cliff should not rely on the delayed native tooltip');
  });
});

// --- Tooltip text wrapping ------------------------------------------------
// SVG <text> does not wrap, so the cliff explanation has to be split into
// lines by hand before it becomes <tspan>s.

test('wrapText splits on whitespace without exceeding the width', () => {
  const lines = wrapText('the quick brown fox jumps over the lazy dog', 12);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(line.length <= 12, `"${line}" is too long`);
  assert.equal(lines.join(' '), 'the quick brown fox jumps over the lazy dog', 'no words lost or reordered');
});

test('wrapText keeps a word longer than the limit rather than truncating it', () => {
  const lines = wrapText('a supercalifragilistic word', 8);
  assert.ok(lines.includes('supercalifragilistic'), 'an over-long word must survive intact');
});

test('wrapText on empty input produces no lines', () => {
  assert.deepEqual(wrapText('', 20), []);
  assert.deepEqual(wrapText('   ', 20), []);
});
