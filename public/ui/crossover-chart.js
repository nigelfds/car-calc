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
    // Capacity, not cost: the leader is whichever option reaches the DEAREST
    // car. The series this replaced took the lowest number.
    return priced.reduce((best, cur) => (point[cur] > point[best] ? cur : best));
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

// A vertical rule with an "i" badge and an instant hover explanation. Shared
// by every chart annotation so the tooltip geometry — wrapping, box sizing,
// edge clamping — exists once. `variant` only picks the colour.
//
// Returns '' when the marker would fall outside the charted budget range:
// valueToX clamps, so it would otherwise be pinned to an axis end and read as
// though it belonged there.
function chartMarker({ series, budget, explanation, variant, plotWidth, plotHeight, badgeY = 8 }) {
  const first = series.points[0].budget;
  const last = series.points[series.points.length - 1].budget;
  if (budget < first || budget > last) return '';

  const x = valueToX(series, budget, plotWidth);

  // A native <title> waits for the browser's ~1s tooltip delay before it
  // appears. This is drawn as part of the chart instead, so it shows the
  // instant the pointer arrives, via CSS only.
  //
  // aria-label carries the same text for screen readers. No tabindex: this
  // is an annotation, not a control, so it stays out of the tab order.
  return `<g class="chart-marker chart-marker--${variant}" role="img" aria-label="${escapeAttr(explanation)}">
      <line class="chart-marker__line" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${badgeY + 6}" y2="${plotHeight}" />
      <circle class="chart-marker__badge" cx="${x.toFixed(1)}" cy="${badgeY}" r="7" />
      <text class="chart-marker__glyph" x="${x.toFixed(1)}" y="${badgeY}" text-anchor="middle"
        dominant-baseline="central">i</text>
      <!-- A <g> has no fill of its own, so without this the only hoverable
           pixels are a 7px circle and a 1px rule. Transparent, and kept to
           the badge so it never covers the plotted points behind it. -->
      <circle class="chart-marker__hit" cx="${x.toFixed(1)}" cy="${badgeY}" r="13" />
      ${tipMarkup(explanation, { anchorX: x, plotWidth, boxY: badgeY + 12 })}
    </g>`;
}

// The novated line plateaus for a reason the chart cannot otherwise show:
// the FBT exemption is a cliff, not a taper, so past a certain car price the
// monthly cost roughly doubles and the lease simply stops being able to
// reach anything dearer.
function fbtCliffMarkup(series, cliff, plotWidth, plotHeight) {
  if (!cliff) return '';
  // Kept tight on purpose: at disclaimer-sized text the box has to fit inside
  // the plot, and a wall of small print is not much better than no note.
  const explanation =
    `FBT cliff at ${money(cliff.cliffPrice)}. Above this price a novated lease loses its ` +
    `FBT exemption outright — there is no taper. The dearest exempt car here is the ` +
    `${cliff.carBelow.make} ${cliff.carBelow.model} at ${money(cliff.carBelow.listPrice)} ` +
    `(${money(cliff.budgetAt)}/mo). The next one up, the ${cliff.carAbove.make} ` +
    `${cliff.carAbove.model} at ${money(cliff.carAbove.listPrice)}, would need ` +
    `${money(cliff.budgetNeeded)}/mo — which is why the novated line stops climbing.`;

  return chartMarker({
    series, budget: cliff.budgetAt, explanation,
    variant: 'cliff', plotWidth, plotHeight
  });
}

// A line that simply begins partway across reads as missing data. This says
// what the gap actually means: below here, that way of paying cannot buy the
// cheapest car on the market.
//
// Anchored to the first *plotted* point rather than to the raw threshold. The
// series is sampled in fixed budget steps, so a line can only begin on a
// sample: a threshold of $1,036.70 produces a line starting at $1,100, and
// placing the badge at the threshold left it floating ~15px clear of the line
// it was labelling. The precise threshold is still what the tooltip quotes —
// it is the number the reader needs — but the badge points at the line.
function entryMarkup(series, entry, plotWidth, plotHeight) {
  if (!entry) return '';

  const firstPlotted = series.points.findIndex(point => point.loan !== null);
  // The loan never appears in this range, so there is no line to introduce.
  if (firstPlotted < 0) return '';
  // Nothing to explain when the line starts at the left edge anyway.
  if (firstPlotted === 0) return '';

  const explanation =
    `The car loan line starts here. Below ${money(entry.budget)}/mo a loan cannot cover ` +
    `even the cheapest car available to you — the ${entry.vehicle.make} ${entry.vehicle.model} ` +
    `at ${money(entry.vehicle.listPrice)}, which needs ${money(entry.budget)}/mo over this term. ` +
    `A longer term or a bigger deposit would lower that and start the line sooner.`;

  // Sits below the cliff badge so the two never overlap when they land close
  // together on the budget axis.
  return chartMarker({
    series, budget: series.points[firstPlotted].budget, explanation,
    variant: 'entry', plotWidth, plotHeight, badgeY: 26
  });
}

// SVG <text> has no wrapping, so the tooltip copy is split into lines here
// and emitted as <tspan>s. Characters rather than measured pixels: a
// character budget is good enough for a fixed block of copy and testable
// without a layout engine.
//
// These are viewBox units, not CSS pixels. The chart's viewBox is 752 wide
// and renders around 600, so everything inside is scaled by ~0.8: the font
// size below is set in styles.css to 16.4 units so it lands at roughly the
// 13.1px of .disclaimer. TIP_CHAR_WIDTH is the average glyph advance at that
// size, and the two must be changed together or the box stops matching its
// text.
const TIP_CHARS_PER_LINE = 60;
const TIP_CHAR_WIDTH = 8.4;
const TIP_LINE_HEIGHT = 21;
const TIP_PADDING = 10;

// The hidden tooltip block shared by the chart markers and the axis notes:
// a rounded panel of wrapped copy, revealed by CSS on hover of whatever
// wraps it. `anchorX` is the point it wants to centre on; it is clamped so
// the box never leaves the plot.
// Built at its own origin and placed with a transform, so the same markup can
// be moved to follow the pointer (see bindTipTracking). The transform written
// here is the static fallback position, used before the first mousemove and
// if the tracking never binds.
export function tipMarkup(explanation, { anchorX, plotWidth, boxY }) {
  const lines = wrapText(explanation, TIP_CHARS_PER_LINE);
  const boxWidth = TIP_CHARS_PER_LINE * TIP_CHAR_WIDTH + TIP_PADDING * 2;
  const boxHeight = lines.length * TIP_LINE_HEIGHT + TIP_PADDING * 2;
  const fallbackX = Math.min(Math.max(anchorX - boxWidth / 2, 0), Math.max(0, plotWidth - boxWidth));

  const tspans = lines.map((line, i) =>
    `<tspan x="${TIP_PADDING}" dy="${i === 0 ? 0 : TIP_LINE_HEIGHT}">${escapeAttr(line)}</tspan>`
  ).join('');

  return `<g class="chart-tip" aria-hidden="true"
      data-tip-width="${boxWidth.toFixed(1)}" data-tip-height="${boxHeight.toFixed(1)}"
      transform="translate(${fallbackX.toFixed(1)},${boxY.toFixed(1)})">
      <rect class="chart-tip__box" x="0" y="0"
        width="${boxWidth.toFixed(1)}" height="${boxHeight.toFixed(1)}" rx="4" />
      <text class="chart-tip__text" y="${(TIP_PADDING + TIP_LINE_HEIGHT * 0.75).toFixed(1)}">${tspans}</text>
    </g>`;
}

// Offset from the cursor: down and to the right, so the pointer never covers
// the first words.
const TIP_CURSOR_DX = 14;
const TIP_CURSOR_DY = 18;

// Moves each tooltip to follow the pointer while its owner is hovered.
// Guarded throughout: renderChart is exercised under `node --test` against a
// plain object with only an innerHTML setter, so none of this DOM may be
// assumed to exist.
function bindTipTracking(target) {
  if (!target || typeof target.querySelectorAll !== 'function') return;

  for (const owner of target.querySelectorAll('.chart-marker, .axis-note')) {
    const tip = owner.querySelector?.('.chart-tip');
    if (!tip || typeof owner.addEventListener !== 'function') continue;

    owner.addEventListener('mousemove', event => {
      const svg = tip.ownerSVGElement;
      const parent = tip.parentNode;
      // getScreenCTM is null for a detached or display:none SVG.
      const ctm = parent?.getScreenCTM?.();
      if (!svg || !ctm || typeof DOMPoint !== 'function') return;

      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
      const boxWidth = Number(tip.dataset.tipWidth);
      const boxHeight = Number(tip.dataset.tipHeight);

      // The tip lives inside the margin-translated group, so the visible area
      // in these coordinates runs from -margin to viewBox - margin.
      const marginLeft = Number(svg.dataset.marginLeft ?? 0);
      const marginTop = Number(svg.dataset.marginTop ?? 0);
      const view = svg.viewBox.baseVal;

      const x = clampTo(local.x + TIP_CURSOR_DX, -marginLeft, view.width - marginLeft - boxWidth);
      const y = clampTo(local.y + TIP_CURSOR_DY, -marginTop, view.height - marginTop - boxHeight);
      tip.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    });
  }
}

const clampTo = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

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

function renderLineChart(target, series, budgetMonthly, cliff, entry) {
  const { min, max } = bounds(series);
  const plotWidth = 560;
  const plotHeight = 190;

  // The leader-change markers (a dashed rule and a "$N/mo" label at every
  // budget where the leading option changes) are still not drawn.
  //
  // The reason they were suspended has gone: they used to annotate a
  // comparison that was not sound, because the old series priced each option
  // against a different car and a "crossover" could mean nothing more than one
  // option starting to shop dearer. Under capacity a crossover is real — it is
  // the budget at which a different way of paying starts buying you more car.
  //
  // They stay off because the author asked for them off, not because they
  // would now mislead. layoutCrossoverLabels and its collision tests are kept
  // for whenever they are wanted back.

  // bottom/left carry an axis title each, beneath and beside the tick labels.
  // Sized for the enlarged label type: "$101,973" at 13.5 units of mono needs
  // ~65 plus its 8-unit offset, and "Novated lease" at 15 units of sans needs
  // ~98 plus its 10-unit leader.
  const margin = {
    top: 26,
    right: 128,
    bottom: 54,
    left: 96
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
    return `<text class="axis-label axis-label--x" x="${x.toFixed(1)}" y="${plotHeight + 22}" text-anchor="middle">$${point.budget}/mo</text>`;
  }).join('');

  // Bare tick labels never said what either axis measured. The y axis in
  // particular reads as an affordability ceiling unless it says otherwise —
  // it is what each option *costs* over the term, net of resale, not a limit
  // on what you can spend.
  //
  // rotate(-90) maps a local (x, y) to a global (y, -x), so the vertical
  // title sits at local x = -plotHeight/2 (vertically centred on the plot)
  // and local y = -(margin.left - 14) (just inside the left margin).
  //
  // Each title also carries a hover explainer. The title itself is a short
  // name; the note behind it is the sentence that stops the axis being
  // misread — particularly the y axis, which people read as an affordability
  // ceiling rather than as a cost.
  const axisTitles = `
    <g class="axis-note">
      <text class="axis-title axis-title--x" x="${(plotWidth / 2).toFixed(1)}" y="${plotHeight + 46}"
        text-anchor="middle">Monthly budget — the slider above</text>
      ${tipMarkup(
        'What you can put toward the car each month — the same figure as the slider above. ' +
        'Each point on a line is what that way of paying would cost you at that budget.',
        { anchorX: plotWidth / 2, plotWidth, boxY: plotHeight - 96 }
      )}
      <rect class="axis-note__hit" x="${(plotWidth / 2 - 130).toFixed(1)}" y="${plotHeight + 32}"
        width="260" height="20" />
    </g>
    <g class="axis-note">
      <text class="axis-title axis-title--y" transform="rotate(-90)"
        x="${(-plotHeight / 2).toFixed(1)}" y="${-(margin.left - 14)}"
        text-anchor="middle">Most expensive car you could buy</text>
      ${tipMarkup(
        'The dearest car each way of paying could get you at that budget, before on-road ' +
        'costs. Higher is more car. Running costs assume a typical EV from this dataset, so ' +
        'treat it as a guide rather than a quote — the cars below use their own real figures.',
        { anchorX: 0, plotWidth, boxY: 12 }
      )}
      <rect class="axis-note__hit" x="${(-margin.left + 4).toFixed(1)}" y="${(plotHeight / 2 - 100).toFixed(1)}"
        width="20" height="200" />
    </g>`;

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
    // Gap tracks the end-label type size (15 units): too small and two
    // lines finishing close together overprint.
    layoutEndLabels(endEntries, 18).map(entry => [entry.option, entry])
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
      data-margin-left="${margin.left}" data-margin-top="${margin.top}"
      aria-label="How much car each way of paying reaches, by monthly budget, from $${firstBudget} to $${lastBudget} a month. ${OPTION_LABEL.upfront} is flat because it is bounded by savings, not by the monthly budget.${budgetSummary}">
      <g transform="translate(${margin.left},${margin.top})">
        ${gridlines}
        ${lineGroups}
        ${xLabels}
        ${axisTitles}
        ${fbtCliffMarkup(series, cliff, plotWidth, plotHeight)}
        ${entryMarkup(series, entry, plotWidth, plotHeight)}
        ${budgetMarkup}
      </g>
    </svg>`;

  // Must run after the markup lands, since it binds to the new nodes.
  bindTipTracking(target);
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

export function renderChart(root, series, budgetMonthly = null, cliff = null, entry = null) {
  const target = root.querySelector('#crossover');
  if (!target) return;

  // A capacity of 0 means "this way of paying reaches nothing at this budget",
  // which is exactly what a null meant in the cost series it replaced: the
  // line must break. Plotted as a point it would sit on the axis and read as
  // a free car. Normalised once here so every downstream helper — bounds,
  // toSegments, toWinnerBands — keeps its existing null handling.
  const withGaps = {
    ...series,
    points: series.points.map(point => ({
      ...point,
      novated: point.novated > 0 ? point.novated : null,
      loan: point.loan > 0 ? point.loan : null,
      upfront: point.upfront > 0 ? point.upfront : null
    }))
  };

  const isMobile = !isDesktopViewport(root);
  if (isMobile) {
    // The band has no cost axis for the plateau to show up on, so there is
    // nothing for a cliff marker to explain there.
    renderWinnerBand(target, withGaps, budgetMonthly);
  } else {
    renderLineChart(target, withGaps, budgetMonthly, cliff, entry);
  }
}
