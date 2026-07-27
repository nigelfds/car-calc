// Task 19 — the crossover chart, the app's signature visual: three ways to
// pay for the same car, and where the cheapest one changes as the monthly
// budget rises.
//
// Two renderings of the same series, picked at render time by container
// width (the 900px breakpoint used throughout this project):
//   - >=900px: three SVG lines plotting total cost against budget.
//   - <900px:  a single "winner band" — coloured segments showing which
//     option leads at each budget, because three thin lines in ~96px of
//     height is illegible on a phone. Not a shortcut — a deliberate choice.
//
// `null` on a point means "no car reaches this budget on this option", not
// "$0" — a line must break rather than dive to zero, or it reads as free.
// The upfront (cash) line is often flat: cash is bounded by savings, not by
// monthly budget, so its cost doesn't move as the slider does. That's
// correct, not a bug.

const OPTIONS = ['novated', 'loan', 'upfront'];

// Matches the colour legend already on the page (public/index.html's
// .line-legend) and the CSS custom properties in styles.css — lease, loan,
// cash. Kept as one map so this file never invents its own palette.
const OPTION_LABEL = {
  novated: 'Novated lease',
  loan: 'Car loan',
  upfront: 'Cash'
};

const OPTION_SHORT_LABEL = {
  novated: 'Novated',
  loan: 'Loan',
  upfront: 'Cash'
};

// Even a sliver of a winner band still needs an identity that isn't colour —
// used in place of OPTION_SHORT_LABEL when a band is too narrow for the full
// word. '$' for cash is a symbol, not a colour, and reads unambiguously next
// to the other two initials.
const OPTION_ABBR = {
  novated: 'N',
  loan: 'L',
  upfront: '$'
};

// Sentinel winner used only by toWinnerBands()/renderWinnerBand() when no
// option is reachable at any sampled budget — never a member of OPTIONS, so
// it never touches bounds()/toPolylines()/toSegments()/renderLineChart().
const NO_OPTION = 'none';

// Colour distinguishes the three lines, but colour alone can't be relied on
// for CVD readers, so every option also gets its own stroke pattern —
// solid / dashed / dotted — matched consistently wherever a line for that
// option appears.
const OPTION_DASH = {
  novated: null,
  loan: '8 5',
  upfront: '2 5'
};

import { money } from './format.js';

function bounds(series) {
  const values = series.points
    .flatMap(p => OPTIONS.map(o => p[o]))
    .filter(v => v !== null);
  return { min: Math.min(...values), max: Math.max(...values) };
}

// UNSAFE FOR DIRECT PAINTING. Nulls are filtered out and what remains is
// joined into one continuous points string per option, so a real gap in the
// middle of a series (option unreachable, then reachable again) is bridged
// by a straight line — exactly the "the cost dipped" misread this module's
// top comment warns against. This export exists for callers who only need
// "does this option have any reachable points at all" (its shape is a
// simple joined string, which is what its tests check). Anyone painting a
// chart should use the exported toSegments() below instead: it keeps each
// contiguous run separate so a real gap renders as a real gap.
export function toPolylines(series, { width, height }) {
  const { min, max } = bounds(series);
  const span = max - min || 1;
  const lastIndex = series.points.length - 1 || 1;
  const lines = {};

  for (const option of OPTIONS) {
    const coordinates = series.points
      .map((point, index) => {
        if (point[option] === null) return null;
        const x = (index / lastIndex) * width;
        const y = height - ((point[option] - min) / span) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter(Boolean);
    lines[option] = coordinates.join(' ');
  }
  return lines;
}

export function toWinnerBands(series) {
  const leaderAt = point => {
    const priced = OPTIONS.filter(o => point[o] !== null);
    if (priced.length === 0) return null;
    return priced.reduce((best, cur) => (point[cur] < point[best] ? cur : best));
  };

  const bands = [];
  const total = series.points.length - 1 || 1;
  // pct of the last point that had any leader at all — not necessarily the
  // previous index, if leaderless points sit between two priced ones.
  let prevPct = null;

  series.points.forEach((point, index) => {
    const leader = leaderAt(point);
    if (leader === null) return;
    const pct = (index / total) * 100;
    const last = bands[bands.length - 1];

    if (last && last.option === leader) {
      last.toPct = pct;
    } else if (last) {
      // The true crossover lies somewhere between the two sampled points —
      // the midpoint is the honest estimate. Placing the boundary at `pct`
      // for both edges (the old fix) collapses the new band to zero width
      // whenever the leader flips on the very last sample.
      const boundary = prevPct === null ? pct : (prevPct + pct) / 2;
      last.toPct = boundary;
      bands.push({ option: leader, fromPct: boundary, toPct: pct });
    } else {
      bands.push({ option: leader, fromPct: pct, toPct: pct });
    }
    prevPct = pct;
  });

  if (bands.length > 0) {
    bands[0].fromPct = 0;
    bands[bands.length - 1].toPct = 100;
  } else {
    // Nothing was affordable at any sampled budget. [] would violate "first
    // band starts at 0, last ends at 100" and render a blank strip with a
    // stub aria-label — make the empty state explicit instead.
    bands.push({ option: NO_OPTION, fromPct: 0, toPct: 100 });
  }
  return bands;
}

// ---------------------------------------------------------------------------
// Rendering support below this line.
//
// toSegments() is the public painting interface: same coordinate maths as
// toPolylines() above, but it keeps each contiguous run of reachable points
// separate instead of joining everything that survives the null filter, so
// a real gap in the data renders as a real gap — one <polyline> per run —
// rather than a straight line bridging across it. Any future caller that
// wants to draw this series should call this, not toPolylines().
export function toSegments(series, { width, height }) {
  const { min, max } = bounds(series);
  const span = max - min || 1;
  const lastIndex = series.points.length - 1 || 1;
  const segments = {};

  for (const option of OPTIONS) {
    const runs = [];
    let current = null;

    series.points.forEach((point, index) => {
      const value = point[option];
      if (value === null) {
        current = null;
        return;
      }
      const x = (index / lastIndex) * width;
      const y = height - ((value - min) / span) * height;
      if (!current) {
        current = [];
        runs.push(current);
      }
      current.push({ x, y, budget: point.budget, value });
    });

    segments[option] = runs;
  }
  return segments;
}

function budgetToX(series, budget, width) {
  const lastIndex = series.points.length - 1 || 1;
  const index = series.points.findIndex(p => p.budget === budget);
  return ((index < 0 ? 0 : index) / lastIndex) * width;
}

// I7: the user's current budget (from the slider) almost never lands
// exactly on one of the series' sampled points (sampled every $100;
// dragged in $25 steps), so budgetToX's exact-match lookup isn't the right
// tool here — it silently falls back to index 0 for anything that doesn't
// match. This interpolates linearly between the series' first and last
// budget instead, and clamps so a budget outside the charted range (which
// I7 also fixes at the source, by keeping the slider's range and the
// charted range in agreement) still places a marker at the nearest edge
// rather than off the plot.
function valueToX(series, value, width) {
  const first = series.points[0].budget;
  const last = series.points[series.points.length - 1].budget;
  const span = last - first || 1;
  const clamped = Math.min(Math.max(value, first), last);
  return ((clamped - first) / span) * width;
}

function niceTicks(min, max, count) {
  if (min === max) return [min];
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1));
}

// Direct end-labels sit beside whichever line ends highest/lowest on
// screen; when two lines finish close together their labels would collide.
// Nudge the lower one down just enough to clear, and let the caller draw a
// short leader line back to the true data point when a label moves.
function layoutEndLabels(entries, minGap) {
  const sorted = [...entries].sort((a, b) => a.y - b.y);
  const laidOut = sorted.map(e => ({ ...e, labelY: e.y }));
  for (let i = 1; i < laidOut.length; i++) {
    if (laidOut[i].labelY - laidOut[i - 1].labelY < minGap) {
      laidOut[i].labelY = laidOut[i - 1].labelY + minGap;
    }
  }
  return laidOut;
}

// Every crossover label sits above the plot at the same height, so two
// crossovers close together used to overprint into mush ("$110$1200/mo").
// A denser dataset makes that routine: more variants means more budgets at
// which the cheapest option flips. Sliding a label sideways is not an option
// — it would sit above the wrong budget — so each label keeps the x of its
// own marker line and collisions are stacked onto additional rows instead.
const CROSSOVER_LABEL_CHAR_WIDTH = 5.4; // 9px monospace
const CROSSOVER_LABEL_GAP = 4;
const CROSSOVER_LABEL_ROW_HEIGHT = 11;

export function layoutCrossoverLabels(entries, options = {}) {
  const charWidth = options.charWidth ?? CROSSOVER_LABEL_CHAR_WIDTH;
  const gap = options.gap ?? CROSSOVER_LABEL_GAP;
  // Rightmost edge claimed so far on each row. A label may drop back to an
  // earlier row as soon as it clears whatever is already sitting there.
  const rowRightEdge = [];
  return [...entries]
    .sort((a, b) => a.x - b.x)
    .map(entry => {
      const halfWidth = (`$${entry.budget}/mo`.length * charWidth) / 2;
      const left = entry.x - halfWidth;
      let row = 0;
      while (rowRightEdge[row] !== undefined && left < rowRightEdge[row] + gap) row++;
      rowRightEdge[row] = Math.max(rowRightEdge[row] ?? -Infinity, entry.x + halfWidth);
      return { ...entry, row };
    });
}

// The novated line plateaus for a reason the chart cannot otherwise show:
// the FBT exemption is a cliff, not a taper, so past a certain car price the
// monthly cost roughly doubles and the lease simply stops being able to
// reach anything dearer. Marked with an "i" carrying the explanation.
function fbtCliffMarkup(series, cliff, plotWidth, plotHeight) {
  if (!cliff) return '';
  const first = series.points[0].budget;
  const last = series.points[series.points.length - 1].budget;
  // valueToX clamps, so a cliff outside the charted range would be pinned to
  // an edge and read as though it sat there. Better to draw nothing.
  if (cliff.budgetAt < first || cliff.budgetAt > last) return '';

  const x = valueToX(series, cliff.budgetAt, plotWidth);
  const explanation =
    `FBT cliff at ${money(cliff.cliffPrice)}. A novated lease is FBT-exempt up to this price; ` +
    `one dollar over and the exemption is lost outright, with no taper. ` +
    `The dearest exempt car here is the ${cliff.carBelow.make} ${cliff.carBelow.model} at ` +
    `${money(cliff.carBelow.listPrice)}, costing ${money(cliff.budgetAt)}/mo. The next car up, the ` +
    `${cliff.carAbove.make} ${cliff.carAbove.model} at ${money(cliff.carAbove.listPrice)}, ` +
    `would cost ${money(cliff.budgetNeeded)}/mo. That is why the novated lease line stops climbing here.`;

  // A native <title> waits for the browser's ~1s tooltip delay before it
  // appears. This is drawn as part of the chart instead, so it shows the
  // instant the pointer arrives, via CSS only.
  const lines = wrapText(explanation, TIP_CHARS_PER_LINE);
  const boxWidth = TIP_CHARS_PER_LINE * TIP_CHAR_WIDTH + TIP_PADDING * 2;
  const boxHeight = lines.length * TIP_LINE_HEIGHT + TIP_PADDING * 2;
  // Keep the box inside the plot: nudged left when the marker sits near the
  // right-hand edge, rather than overflowing the SVG.
  const boxX = Math.min(Math.max(x - boxWidth / 2, 0), Math.max(0, plotWidth - boxWidth));
  const boxY = 20;

  const tspans = lines.map((line, i) =>
    `<tspan x="${(boxX + TIP_PADDING).toFixed(1)}" dy="${i === 0 ? 0 : TIP_LINE_HEIGHT}">${escapeAttr(line)}</tspan>`
  ).join('');

  // aria-label carries the same text for screen readers. No tabindex: this
  // is an annotation, not a control, so it stays out of the tab order.
  return `<g class="fbt-cliff" role="img" aria-label="${escapeAttr(explanation)}">
      <line class="fbt-cliff__line" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="14" y2="${plotHeight}" />
      <circle class="fbt-cliff__badge" cx="${x.toFixed(1)}" cy="8" r="7" />
      <text class="fbt-cliff__glyph" x="${x.toFixed(1)}" y="8" text-anchor="middle"
        dominant-baseline="central">i</text>
      <!-- A <g> has no fill of its own, so without this the only hoverable
           pixels are a 7px circle and a 1px rule. Transparent, and kept to
           the badge so it never covers the plotted points behind it. -->
      <circle class="fbt-cliff__hit" cx="${x.toFixed(1)}" cy="8" r="13" />
      <g class="fbt-cliff__tip" aria-hidden="true">
        <rect class="fbt-cliff__tip-box" x="${boxX.toFixed(1)}" y="${boxY}"
          width="${boxWidth.toFixed(1)}" height="${boxHeight.toFixed(1)}" rx="4" />
        <text class="fbt-cliff__tip-text" y="${boxY + TIP_PADDING + TIP_LINE_HEIGHT * 0.75}">${tspans}</text>
      </g>
    </g>`;
}

// SVG <text> has no wrapping, so the tooltip copy is split into lines here
// and emitted as <tspan>s. Characters rather than measured pixels: the tip
// is a fixed-size monospace-ish block, and a character budget is both good
// enough and testable without a layout engine.
const TIP_CHARS_PER_LINE = 52;
const TIP_CHAR_WIDTH = 4.6;
const TIP_LINE_HEIGHT = 12;
const TIP_PADDING = 8;

export function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    // A single word longer than the limit goes on its own line rather than
    // being cut in half.
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

const escapeAttr = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

function renderLineChart(target, series, budgetMonthly, cliff) {
  const { min, max } = bounds(series);
  const plotWidth = 560;
  const plotHeight = 190;

  // The leader-change markers (a dashed rule and a "$N/mo" label at every
  // budget where the cheapest option flips) are not drawn at present. They
  // annotate a comparison that is not yet sound: crossoverSeries prices each
  // option against a different car, so a "crossover" can mean nothing more
  // than one option starting to shop dearer. Marking those as decision points
  // gave them a confidence the underlying numbers do not support.
  //
  // layoutCrossoverLabels and its tests are kept — the markers come back once
  // the series compares like with like, and the collision handling will be
  // needed again then.

  // bottom/left carry an axis title each, beneath and beside the tick labels.
  const margin = {
    top: 26,
    right: 112,
    bottom: 48,
    left: 80
  };
  const width = plotWidth + margin.left + margin.right;
  const height = plotHeight + margin.top + margin.bottom;
  const lastIndex = series.points.length - 1 || 1;

  const segments = toSegments(series, { width: plotWidth, height: plotHeight });

  const yTicks = niceTicks(min, max, 3);
  const gridlines = yTicks.map(tick => {
    const y = plotHeight - ((tick - min) / (max - min || 1)) * plotHeight;
    return `<g>
      <line class="grid-line" x1="0" x2="${plotWidth}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" />
      <text class="axis-label axis-label--y" x="-8" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle">${money(tick)}</text>
    </g>`;
  }).join('');

  const xTickIndices = [...new Set([0, Math.round(lastIndex / 2), lastIndex])];
  const xLabels = xTickIndices.map(index => {
    const point = series.points[index];
    const x = (index / lastIndex) * plotWidth;
    return `<text class="axis-label axis-label--x" x="${x.toFixed(1)}" y="${plotHeight + 20}" text-anchor="middle">$${point.budget}/mo</text>`;
  }).join('');

  // Bare tick labels never said what either axis measured. The y axis in
  // particular reads as an affordability ceiling unless it says otherwise —
  // it is what each option *costs* over the term, net of resale, not a limit
  // on what you can spend.
  //
  // rotate(-90) maps a local (x, y) to a global (y, -x), so the vertical
  // title sits at local x = -plotHeight/2 (vertically centred on the plot)
  // and local y = -(margin.left - 14) (just inside the left margin).
  const axisTitles = `
    <text class="axis-title axis-title--x" x="${(plotWidth / 2).toFixed(1)}" y="${plotHeight + 42}"
      text-anchor="middle">Monthly budget — the slider above</text>
    <text class="axis-title axis-title--y" transform="rotate(-90)"
      x="${(-plotHeight / 2).toFixed(1)}" y="${-(margin.left - 14)}"
      text-anchor="middle">Total cost over the term</text>`;

  const endEntries = OPTIONS
    .map(option => {
      const runs = segments[option];
      if (runs.length === 0) return null;
      const lastRun = runs[runs.length - 1];
      const point = lastRun[lastRun.length - 1];
      return { option, x: point.x, y: point.y };
    })
    .filter(Boolean);
  const endLabelByOption = new Map(
    layoutEndLabels(endEntries, 14).map(entry => [entry.option, entry])
  );

  const lineGroups = OPTIONS.map(option => {
    const runs = segments[option];
    if (runs.length === 0) return '';

    const dash = OPTION_DASH[option] ? ` stroke-dasharray="${OPTION_DASH[option]}"` : '';
    const polylines = runs.map(run => {
      const points = run.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      return `<polyline class="line line-${option}" points="${points}" fill="none" stroke-width="2"${dash} />`;
    }).join('');

    const markers = runs.flatMap(run => run).map(p =>
      `<circle class="marker marker-${option}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4">` +
        `<title>${OPTION_LABEL[option]} at $${p.budget}/mo: ${money(p.value)}</title>` +
      `</circle>`
    ).join('');

    const end = endLabelByOption.get(option);
    const needsLeader = end && Math.abs(end.labelY - end.y) > 0.5;
    const endMarkup = end ? `
      <circle class="end-dot end-dot-${option}" cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="4" />
      ${needsLeader ? `<line class="leader-line" x1="${(end.x + 5).toFixed(1)}" y1="${end.y.toFixed(1)}" x2="${(end.x + 9).toFixed(1)}" y2="${end.labelY.toFixed(1)}" />` : ''}
      <text class="end-label" x="${(end.x + 10).toFixed(1)}" y="${end.labelY.toFixed(1)}" dominant-baseline="middle">${OPTION_LABEL[option]}</text>
    ` : '';

    return `<g>${polylines}${markers}${endMarkup}</g>`;
  }).join('');

  const firstBudget = series.points[0].budget;
  const lastBudget = series.points[series.points.length - 1].budget;

  // I7: mark where the user's own budget sits on the chart — previously
  // renderChart never received the budget at all, so neither rendering
  // could show the user's own position, only the crossover points.
  const budgetMarkup = budgetMonthly !== null ? (() => {
    const x = valueToX(series, budgetMonthly, plotWidth);
    return `<g class="budget-marker">
      <line class="budget-marker__line" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="-8" y2="${plotHeight}" />
      <polygon class="budget-marker__flag" points="${(x - 5).toFixed(1)},-8 ${(x + 5).toFixed(1)},-8 ${x.toFixed(1)},0" />
    </g>`;
  })() : '';
  const budgetSummary = budgetMonthly !== null
    ? ` Your current budget of $${budgetMonthly}/mo is marked on the chart.`
    : '';

  // No crossover summary here either: the visual markers are suspended (see
  // the note in renderLineChart), and an accessible description must describe
  // the chart as drawn, not a version of it that no longer exists.
  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="crossover-chart" role="img"
      aria-label="Total cost of a novated lease, a car loan and paying cash, plotted against monthly budget from $${firstBudget} to $${lastBudget} a month. ${OPTION_LABEL.upfront} is flat because it is bounded by savings, not by the monthly budget.${budgetSummary}">
      <g transform="translate(${margin.left},${margin.top})">
        ${gridlines}
        ${lineGroups}
        ${xLabels}
        ${axisTitles}
        ${fbtCliffMarkup(series, cliff, plotWidth, plotHeight)}
        ${budgetMarkup}
      </g>
    </svg>`;
}

function renderWinnerBand(target, series, budgetMonthly) {
  const bands = toWinnerBands(series);
  const firstBudget = series.points[0].budget;
  const lastBudget = series.points[series.points.length - 1].budget;
  const pctToBudget = pct => Math.round(firstBudget + (pct / 100) * (lastBudget - firstBudget));
  const isUnaffordable = bands.length === 1 && bands[0].option === NO_OPTION;

  const summary = isUnaffordable
    ? `No option is affordable anywhere from $${firstBudget} to $${lastBudget} a month.`
    : bands
        .map(b => `${OPTION_LABEL[b.option]} from $${pctToBudget(b.fromPct)} to $${pctToBudget(b.toPct)} a month`)
        .join('; then ') + '.';

  // I7: the spec requires the band to show the user's own position, not
  // just where the winner changes. Percent-of-range, same maths as
  // valueToX above but expressed as a CSS left% for this non-SVG rendering.
  const budgetPct = budgetMonthly !== null
    ? Math.min(100, Math.max(0, ((budgetMonthly - firstBudget) / (lastBudget - firstBudget || 1)) * 100))
    : null;
  const budgetMarkerHtml = budgetPct !== null
    ? `<span class="winner-band__budget-marker" style="left:${budgetPct}%" aria-hidden="true"></span>`
    : '';
  const budgetSummary = budgetMonthly !== null ? ` Your current budget of $${budgetMonthly}/mo is marked.` : '';

  // Identity never depends on colour alone: every segment gets a text
  // label, full word when there's room, a short abbreviation when there
  // isn't. Never nothing, even for a sliver crossover band.
  const segmentsHtml = bands.map(b => {
    const widthPct = b.toPct - b.fromPct;
    const label = b.option === NO_OPTION
      ? 'Not affordable'
      : (widthPct >= 16 ? OPTION_SHORT_LABEL[b.option] : OPTION_ABBR[b.option]);
    return `<span class="band band-${b.option}" style="left:${b.fromPct}%;width:${widthPct}%">` +
      `<span class="band__label">${label}</span>` +
    `</span>`;
  }).join('');

  target.innerHTML = `
    <div class="winner-band" role="img" aria-label="Cheapest way to pay, by monthly budget: ${summary}${budgetSummary}">
      ${segmentsHtml}
      ${budgetMarkerHtml}
    </div>
    <div class="winner-band__scale" aria-hidden="true">
      <span>$${firstBudget}/mo</span>
      <span>$${lastBudget}/mo</span>
    </div>
    <p class="winner-band__axis-title" aria-hidden="true">Monthly budget — the slider above</p>`;
}

// I4: root is always `document` in the real app (public/ui/app.js calls
// renderChart(document, ...)), and Document has no `clientWidth` — the old
// `root.clientWidth < 900` was `undefined < 900`, always false, so the
// mobile winner band could never render at any viewport. matchMedia is the
// standard way to ask "how wide is the viewport" in a browser (and reacts
// correctly to a real window resize, unlike a one-off element measurement);
// document.documentElement.clientWidth is the fallback for an environment
// with no matchMedia (there is none in practice among supported browsers,
// but this keeps the function from throwing under, say, a headless runner
// that stubs one but not the other).
function isDesktopViewport(root) {
  if (typeof matchMedia === 'function') return matchMedia('(min-width: 900px)').matches;
  const width = root?.documentElement?.clientWidth;
  return typeof width === 'number' ? width >= 900 : true;
}

export function renderChart(root, series, budgetMonthly = null, cliff = null) {
  const target = root.querySelector('#crossover');
  if (!target) return;

  const isMobile = !isDesktopViewport(root);
  if (isMobile) {
    // The band has no cost axis for the plateau to show up on, so there is
    // nothing for a cliff marker to explain there.
    renderWinnerBand(target, series, budgetMonthly);
  } else {
    renderLineChart(target, series, budgetMonthly, cliff);
  }
}
