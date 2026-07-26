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

// Colour distinguishes the three lines, but colour alone can't be relied on
// for CVD readers, so every option also gets its own stroke pattern —
// solid / dashed / dotted — matched consistently wherever a line for that
// option appears.
const OPTION_DASH = {
  novated: null,
  loan: '8 5',
  upfront: '2 5'
};

const money = value => `$${Math.round(value).toLocaleString('en-AU')}`;

function bounds(series) {
  const values = series.points
    .flatMap(p => OPTIONS.map(o => p[o]))
    .filter(v => v !== null);
  return { min: Math.min(...values), max: Math.max(...values) };
}

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

  series.points.forEach((point, index) => {
    const leader = leaderAt(point);
    if (leader === null) return;
    const pct = (index / total) * 100;
    const last = bands[bands.length - 1];

    if (last && last.option === leader) {
      last.toPct = pct;
    } else {
      if (last) last.toPct = pct;
      bands.push({ option: leader, fromPct: pct, toPct: pct });
    }
  });

  if (bands.length > 0) {
    bands[0].fromPct = 0;
    bands[bands.length - 1].toPct = 100;
  }
  return bands;
}

// ---------------------------------------------------------------------------
// Rendering support below this line. toPolylines() above deliberately
// returns one joined `points` string per option — that's the tested
// contract, and it's the right shape for "does this option have any
// reachable points at all". It is the wrong shape for painting: filtering
// out nulls and joining what's left draws one continuous <polyline> that
// bridges straight across a gap instead of breaking it, which would read as
// "the cost dipped" rather than "this option was out of reach here".
//
// toSegments() re-walks the same coordinate maths but keeps each contiguous
// run of reachable points separate, so the renderer below draws one
// <polyline> per run and a real gap shows as a real gap.
function toSegments(series, { width, height }) {
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

function renderLineChart(target, series) {
  const { min, max } = bounds(series);
  const margin = { top: 26, right: 112, bottom: 30, left: 64 };
  const plotWidth = 560;
  const plotHeight = 190;
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

  // The point of this chart: mark exactly where the cheapest option flips.
  const crossoverMarkers = series.crossovers.map(crossover => {
    const x = budgetToX(series, crossover.budget, plotWidth);
    return `<g>
      <line class="crossover-line" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="${plotHeight}" />
      <text class="axis-label axis-label--crossover" x="${x.toFixed(1)}" y="-10" text-anchor="middle">$${crossover.budget}/mo</text>
    </g>`;
  }).join('');

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

  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="crossover-chart" role="img"
      aria-label="Total cost of a novated lease, a car loan and paying cash, plotted against monthly budget from $${firstBudget} to $${lastBudget} a month. ${OPTION_LABEL.upfront} is flat because it is bounded by savings, not by the monthly budget.">
      <g transform="translate(${margin.left},${margin.top})">
        ${gridlines}
        ${crossoverMarkers}
        ${lineGroups}
        ${xLabels}
      </g>
    </svg>`;
}

function renderWinnerBand(target, series) {
  const bands = toWinnerBands(series);
  const firstBudget = series.points[0].budget;
  const lastBudget = series.points[series.points.length - 1].budget;
  const pctToBudget = pct => Math.round(firstBudget + (pct / 100) * (lastBudget - firstBudget));

  const summary = bands
    .map(b => `${OPTION_LABEL[b.option]} from $${pctToBudget(b.fromPct)} to $${pctToBudget(b.toPct)} a month`)
    .join('; then ');

  const segmentsHtml = bands.map(b => {
    const widthPct = b.toPct - b.fromPct;
    const showLabel = widthPct >= 16;
    return `<span class="band band-${b.option}" style="left:${b.fromPct}%;width:${widthPct}%">` +
      (showLabel ? `<span class="band__label">${OPTION_SHORT_LABEL[b.option]}</span>` : '') +
    `</span>`;
  }).join('');

  target.innerHTML = `
    <div class="winner-band" role="img" aria-label="Cheapest way to pay, by monthly budget: ${summary}.">
      ${segmentsHtml}
    </div>
    <div class="winner-band__scale" aria-hidden="true">
      <span>$${firstBudget}/mo</span>
      <span>$${lastBudget}/mo</span>
    </div>`;
}

export function renderChart(root, series) {
  const target = root.querySelector('#crossover');
  if (!target) return;

  const isMobile = root.clientWidth < 900;
  if (isMobile) {
    renderWinnerBand(target, series);
  } else {
    renderLineChart(target, series);
  }
}
