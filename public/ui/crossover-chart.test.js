import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toPolylines, toSegments, renderChart, layoutCrossoverLabels, wrapText,
  niceTicks, chartNotesMarkup, cliffExplanation, entryExplanation
} from './crossover-chart.js';

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

// Values are capacities now — dollars of car reached — so the leader is the
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

test('a narrow viewport gets the compact chart, ignoring a large clientWidth on root', () => {
  withMatchMedia(false, () => {
    // clientWidth: 5000 is a decoy — under the old bug this property was
    // never even read correctly (root was `document`), but if some fix
    // wrongly started reading root.clientWidth directly, this large value
    // would flip the outcome to the wide geometry and fail the assertion.
    const { root, getHtml } = fakeChartRoot({ clientWidth: 5000 });
    renderChart(root, series);
    const html = getHtml();
    assert.ok(html.includes('crossover-chart'), 'the same line chart renders at every width');
    assert.ok(/viewBox="0 0 380 /.test(html), 'expected the compact viewBox');
    assert.ok(!html.includes('end-label'), 'end labels have no room and the legend covers them');
  });
});

test('a wide viewport gets the full chart, ignoring a tiny clientWidth on root', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot({ clientWidth: 10 });
    renderChart(root, series);
    const html = getHtml();
    assert.ok(html.includes('crossover-chart'), 'expected the SVG line chart markup');
    assert.ok(/viewBox="0 0 766 /.test(html), 'expected the wide viewBox');
    assert.ok(html.includes('end-label'), 'there is room to name the lines in place');
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
    // A narrow viewport now means compact geometry rather than a winner band.
    // The compact viewBox is 380 wide; the desktop one is 784.
    assert.ok(/viewBox="0 0 380 /.test(getHtml()),
      'expected the fallback to read documentElement.clientWidth, not root.clientWidth');
  } finally {
    if (original !== undefined) globalThis.matchMedia = original;
  }
});

test('a hidden container is not painted, so a resize behind another tab cannot corrupt it', () => {
  const target = { innerHTML: 'untouched', clientWidth: 0, getBoundingClientRect: () => ({ width: 0 }) };
  renderChart({ querySelector: () => target }, series, 900, null, null);
  assert.equal(target.innerHTML, 'untouched');
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

test('the compact chart marks the current budget too', () => {
  withMatchMedia(false, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    assert.ok(getHtml().includes('budget-marker'), 'expected a budget-marker element in the compact SVG');
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

// --- Axis key -------------------------------------------------------------
// The bare tick labels ("$300/mo", "$62,816") never said what either axis
// measured, so the Y axis in particular was easy to read as an affordability
// ceiling rather than as what each option costs you over the term. The titles
// used to sit inside the SVG; they now sit in an HTML key below it, labelled
// by axis so neither has to be inferred from its position.

test('the chart names both axes in a key below it, by axis', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    const html = getHtml();
    assert.ok(html.includes('axis-key'), 'expected the axis key');
    assert.match(html, /X-Axis:<\/dt>\s*<dd class="axis-key__label">Monthly budget/);
    assert.match(html, /Y-Axis:<\/dt>\s*<dd class="axis-key__label">Most expensive car/);
  });
});

test('the key sits after the chart, not inside it', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    const html = getHtml();
    assert.ok(html.indexOf('</svg>') < html.indexOf('axis-key'), 'the key must follow the SVG');
    assert.ok(!html.includes('axis-title'), 'the old in-SVG titles are gone');
    assert.ok(!html.includes('axis-note'), 'and so are their in-SVG hit areas');
  });
});

// One wording now serves both geometries: HTML wraps at whatever width the
// column is, where the SVG needed its own shorter copy for the narrow tip box.
test('the compact chart gets the same key as the wide one', () => {
  const wide = (() => {
    let html;
    withMatchMedia(true, () => {
      const f = fakeChartRoot();
      renderChart(f.root, series, 800);
      html = f.getHtml();
    });
    return html;
  })();
  const compact = (() => {
    let html;
    withMatchMedia(false, () => {
      const f = fakeChartRoot();
      renderChart(f.root, series, 800);
      html = f.getHtml();
    });
    return html;
  })();
  const keyOf = html => html.slice(html.indexOf('<dl class="axis-key">'));
  assert.equal(keyOf(compact), keyOf(wide));
});

test('each axis carries a hover explainer naming what it does not say outright', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    const html = getHtml();
    assert.equal((html.match(/class="axis-key__tip"/g) ?? []).length, 2, 'one explainer per axis');
    assert.match(html, /the same figure as the slider above/);
    assert.match(html, /treat it as a guide rather than a quote/);
  });
});

// Reclaimed when the titles left: the bottom margin held the x title beneath
// the tick labels, and the wide left margin held the rotated y one.
test('the margins the titles occupied are given back to the plot', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    assert.match(getHtml(), /viewBox="0 0 766 246"/, 'wide: left 96 -> 78, bottom 54 -> 30');
  });
  withMatchMedia(false, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, series, 800);
    assert.match(getHtml(), /viewBox="0 0 380 226"/, 'compact: top 34 -> 26, bottom 50 -> 30');
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
    assert.ok(html.includes('chart-marker--cliff'), 'expected a cliff marker');
    assert.ok(/loses|lost outright|exemption/i.test(html), 'expected the exemption explained');
    assert.ok(html.includes('$91,661'), 'expected the threshold named');
    assert.ok(html.includes('<title>'), 'the explanation must be reachable as a tooltip');
  });
});

test('no cliff marker renders when there is no cliff', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, null);
    assert.ok(!getHtml().includes('chart-marker--cliff'), 'nothing to mark, so nothing drawn');
  });
});

// valueToX clamps out-of-range values to an edge, so a cliff beyond the
// charted budget range would be pinned to the axis end and read as though it
// sat there. Drawing nothing is the honest option.
test('a cliff outside the charted budget range is not drawn at the edge', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, { ...cliffFixture, budgetAt: 9999 });
    assert.ok(!getHtml().includes('chart-marker--cliff'), 'a cliff off the right of the chart must not be pinned to the edge');
  });
});

// Under the capacity chart the cliff explains a plateau, not a pair of cars:
// the line flattens because the lease cannot reach anything dearer, and the
// actionable number is what crossing would cost per month.
test('the cliff marker explains the plateau and what crossing would cost', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, cliffFixture);
    const html = getHtml();
    assert.ok(html.includes('$91,661'), 'the threshold itself');
    assert.ok(/flattens here/i.test(html), 'it must explain the shape of the line');
    assert.ok(html.includes('$3,039'), 'what crossing the cliff would need per month');
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
    assert.ok(html.includes('chart-tip'), 'expected a drawn tooltip element');
    assert.ok(html.includes('<tspan'), 'expected the copy wrapped into tspans');
    // Scoped to the cliff group: the data points legitimately keep their own
    // <title> hover labels, so a document-wide check would never pass.
    const group = html.slice(html.indexOf('chart-marker--cliff'));
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

// --- Loan entry-point marker ---------------------------------------------

const entryFixture = {
  budget: 1181,
  vehicle: { make: 'BYD', model: 'Dolphin', listPrice: 29990 }
};

// wideSeries has a loan value at every point, so under the corrected
// anchoring there is nothing to mark. This fixture withholds the loan for the
// first few budgets, the way a real short-term, no-deposit loan does.
const lateLoanSeries = {
  points: Array.from({ length: 25 }, (_, i) => ({
    budget: 300 + i * 100,
    novated: 30000 + i * 500,
    loan: i < 9 ? null : 40000 + i * 900,
    upfront: 62835
  })),
  crossovers: []
};

test('the entry marker explains where the loan line starts and why', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, lateLoanSeries, 800, null, entryFixture);
    const html = getHtml();
    assert.ok(html.includes('chart-marker--entry'), 'expected an entry marker');
    assert.ok(/cheapest car on the market/i.test(html), 'expected the gap explained');
    // Deliberately no car named: the line is drawn from a typical EV's running
    // costs, so one real car's monthly figure beside it would invite a
    // comparison between two numbers that do not measure the same thing.
    assert.ok(!html.includes('Dolphin'), 'the capacity line is not about one car');
  });
});

// If the line already starts at the left edge there is no gap to account for.
test('no entry marker when the line starts at the beginning of the range', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    const atFirst = { ...entryFixture, budget: wideSeries.points[0].budget };
    // wideSeries has a loan value from the very first point, so the line
    // already starts at the left edge.
    renderChart(root, wideSeries, 800, null, atFirst);
    assert.ok(!getHtml().includes('chart-marker--entry'), 'nothing to explain at the left edge');
  });
});

test('no entry marker when none is supplied', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, null, null);
    assert.ok(!getHtml().includes('chart-marker--entry'));
  });
});

test('the cliff and entry markers can coexist without sharing a badge position', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, lateLoanSeries, 800, cliffFixture, entryFixture);
    const html = getHtml();
    assert.ok(html.includes('chart-marker--cliff'));
    assert.ok(html.includes('chart-marker--entry'));
    // Both badges are circles; they must sit at different heights so that two
    // markers landing on nearby budgets do not overlap into one blob.
    const cys = [...html.matchAll(/class="chart-marker__badge" cx="[\d.]+" cy="([\d.]+)"/g)].map(m => m[1]);
    assert.equal(cys.length, 2);
    assert.notEqual(cys[0], cys[1], 'the two badges must not share a y');
  });
});

// The chart samples budgets in fixed steps, so a line can only begin on a
// sampled point. Anchoring the marker at the true threshold left it floating
// to the left of the line it was pointing at — up to ~15px adrift once a
// deposit lowered the threshold mid-step.
test('the entry marker sits where the line actually starts, not at the raw threshold', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    // Loan unreachable until the third sampled point (budget 500).
    const stepped = {
      points: [
        { budget: 300, novated: 20000, loan: null, upfront: 40000 },
        { budget: 400, novated: 22000, loan: null, upfront: 40000 },
        { budget: 500, novated: 24000, loan: 30000, upfront: 40000 },
        { budget: 600, novated: 26000, loan: 31000, upfront: 40000 }
      ],
      crossovers: []
    };
    // A threshold of 432 falls between samples; the line begins at 500.
    renderChart(root, stepped, 350, null, {
      budget: 432, vehicle: { make: 'BYD', model: 'Dolphin', listPrice: 29990 }
    });
    const html = getHtml();
    const markerX = Number(/chart-marker--entry[\s\S]*?<line[^>]*x1="([\d.]+)"/.exec(html)[1]);
    // Index 2 of 3 across a 560-wide plot.
    assert.ok(Math.abs(markerX - (2 / 3) * 560) < 0.5,
      `marker at ${markerX} should sit on the first plotted loan point`);
    // No dollar figure is quoted any more — see the note on entryMarkup — so
    // this asserts only the anchoring, which is the point of the test.
    assert.ok(html.includes('chart-marker--entry'));
  });
});

test('no entry marker when the loan line never appears in range', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    const never = {
      points: [
        { budget: 300, novated: 20000, loan: null, upfront: 40000 },
        { budget: 400, novated: 22000, loan: null, upfront: 40000 }
      ],
      crossovers: []
    };
    renderChart(root, never, 350, null, { budget: 9999, vehicle: { make: 'BYD', model: 'Dolphin', listPrice: 29990 } });
    assert.ok(!getHtml().includes('chart-marker--entry'));
  });
});

// --- Axis explainers ------------------------------------------------------
// The axis titles are short names; hovering one gives the sentence that stops
// the axis being misread. The y axis especially reads as an affordability
// ceiling rather than as a cost.

// --- The chart plots capacity, not cost -----------------------------------
// Step 2 stopped knowing about cars, so the y axis is now "how much car does
// this budget reach", not "what does this car cost". Higher is better, which
// is the opposite of the series this replaced.

const capacitySeries = {
  points: [
    { budget: 300, novated: 12000, loan: 0, upfront: 47140 },
    { budget: 900, novated: 67342, loan: 27701, upfront: 47140 },
    { budget: 1500, novated: 91661, loan: 56000, upfront: 47140 },
    { budget: 2700, novated: 91661, loan: 115989, upfront: 47140 }
  ],
  crossovers: [{ budget: 2700, from: 'novated', to: 'loan' }]
};

test('the y axis is labelled as car price, not as cost', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, capacitySeries, 900);
    const html = getHtml();
    assert.ok(/most expensive car/i.test(html), 'the axis must name what it measures');
    assert.ok(!/total cost over the term/i.test(html), 'the old cost axis label must be gone');
  });
});

// A zero capacity means "this way of paying reaches nothing here". Plotted as
// a point it would read as a free car, so it must break the line the way a
// null did in the cost series.
test('a zero-capacity point breaks the line rather than plotting zero', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, capacitySeries, 900);
    const loan = /class="line line-loan"[^>]*points="([^"]+)"/.exec(getHtml());
    assert.ok(loan, 'expected a loan polyline');
    // Four budgets, but the loan reaches nothing at the first, so three points.
    assert.equal(loan[1].trim().split(' ').length, 3);
  });
});

test('the accessible description explains the axes in capacity terms', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, capacitySeries, 900);
    assert.ok(/how much car/i.test(getHtml()));
  });
});

// Under capacity the leader is the option reaching the DEAREST car, where the

// --- Round axis ticks ------------------------------------------------------
// niceTicks used to interpolate between the data's own min and max, so the axis
// read "$33k / $74k / $116k" — three numbers a reader has to decode before they
// can estimate where a line sits, which is the axis's only job.

test('ticks land on round numbers rather than on the data bounds', () => {
  const ticks = niceTicks(32606, 115989, 3);
  assert.ok(ticks.length >= 2, 'expected at least two gridlines');
  for (const tick of ticks) {
    assert.equal(tick % 25000, 0, `${tick} is not a round value`);
  }
});

test('every tick stays inside the plotted range', () => {
  // Ticks inside the bounds rather than extending them: the lines are scaled to
  // the true min and max, and stretching the axis outward would pad the plot
  // with space no data reaches.
  const ticks = niceTicks(32606, 115989, 3);
  for (const tick of ticks) {
    assert.ok(tick >= 32606 && tick <= 115989, `${tick} is outside the range`);
  }
});

test('the tick count never exceeds what was asked for', () => {
  for (const [min, max] of [[0, 10], [32606, 115989], [1000, 1_000_000], [45, 91]]) {
    assert.ok(niceTicks(min, max, 3).length <= 3, `${min}-${max} produced too many ticks`);
  }
});

test('a flat series still yields one tick rather than crashing', () => {
  assert.deepEqual(niceTicks(62835, 62835, 3), [62835]);
});

// The step candidates scale with the range, so even an absurdly narrow one gets
// real ticks rather than the endpoint fallback — which makes that fallback a
// guard against a range this function cannot currently be handed, not a path.
// Asserted here so the claim is checked rather than assumed.
test('even an absurdly narrow range gets round ticks', () => {
  const ticks = niceTicks(1.0001, 1.0002, 3);
  assert.ok(ticks.length >= 2 && ticks.length <= 3);
  for (const tick of ticks) {
    assert.ok(tick >= 1.0001 && tick <= 1.0002, `${tick} is outside the range`);
  }
});

// --- The explanations, in text --------------------------------------------
// The hover tooltips stay, but they cannot be the only way to reach this: a
// tooltip needs a pointer, and the viewport where the chart is smallest and
// hardest to read has none.

test('the notes carry both axis explanations', () => {
  const html = chartNotesMarkup(wideSeries, null, null);
  assert.match(html, /X-Axis/);
  assert.match(html, /Y-Axis/);
  assert.match(html, /the same figure as the slider above/);
});

test('the cliff explanation appears in the notes, not only in a tooltip', () => {
  const html = chartNotesMarkup(wideSeries, cliffFixture, null);
  assert.match(html, /Why the novated line flattens/);
  assert.match(html, /\$91,661/);
  assert.match(html, /lost outright/);
});

test('a note carries the glyph its badge draws, which is the key the two never had', () => {
  const html = chartNotesMarkup(wideSeries, cliffFixture, null);
  // The cliff is a warning and draws "!"; the entry point is information and
  // draws "i". Both used to draw "i", told apart only by colour.
  assert.match(html, /chart-notes__glyph--cliff" aria-hidden="true">!</);
});

test('a note with nothing to say is omitted rather than left blank', () => {
  const html = chartNotesMarkup(wideSeries, null, null);
  assert.ok(!/Why the novated line flattens/.test(html));
  assert.ok(!/Why the car loan line starts late/.test(html));
});

test('the explanations are shared with the markers rather than written twice', () => {
  // The same function feeds the badge tooltip and the note, so the two cannot
  // drift apart the way two copies of this copy would.
  assert.equal(cliffExplanation(null), null);
  assert.match(cliffExplanation(cliffFixture), /FBT cliff at \$91,661/);
  // The loan line starts at the left edge of wideSeries, so there is no entry
  // point to introduce.
  assert.equal(entryExplanation(wideSeries, { budget: 700 }), null);
});

test('the notes ship with the chart', () => {
  withMatchMedia(true, () => {
    const { root, getHtml } = fakeChartRoot();
    renderChart(root, wideSeries, 800, cliffFixture);
    assert.match(getHtml(), /chart-notes/);
  });
});
