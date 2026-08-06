// Task 19 — the crossover chart, the app's signature visual: three ways to
// pay for the same car, and where the cheapest one changes as the monthly
// budget rises.
//
// One rendering at every width, in two geometries picked at render time by
// the 900px breakpoint used throughout this project. Narrow viewports get a
// smaller viewBox rather than a different chart: the wide one is 784 units
// across and would scale to 0.4 on a phone, taking its labels down to 5px
// with it. That shrinkage is what the old "winner band" summary worked
// around; a 380-unit viewBox scales to about 0.8 instead, so the lines, the
// markers and their tooltips all survive the trip to a small screen.
//
// `null` on a point means "no car reaches this budget on this option", not
// "$0" — a line must break rather than dive to zero, or it reads as free.
// The upfront (cash) line is often flat: cash is bounded by savings, not by
// monthly budget, so its cost doesn't move as the slider does. That's
// correct, not a bug.

// Names and order both come from ui/labels.js now — this file used to carry its
// own copy of the map, which is how "Car loan" here and "Direct loan" in the
// verdict managed to disagree. Aliased on import because everything below
// already reads OPTION_LABEL, and the colour legend it matches
// (public/index.html's .line-legend) is unchanged.
import { OPTIONS, OPTION_NAME as OPTION_LABEL } from './labels.js';

// Colour distinguishes the three lines, but colour alone can't be relied on
// for CVD readers, so every option also gets its own stroke pattern —
// solid / dashed / dotted — matched consistently wherever a line for that
// option appears.
const OPTION_DASH = {
  novated: null,
  loan: '8 5',
  upfront: '2 5'
};

import { money, shortMoney } from './format.js';
// Was a private copy named escapeAttr, on the theory that SVG attributes were
// a different job from HTML text. They are not: half its call sites here were
// element content, and the five characters are the same five. Renamed to
// match the shared function it always was.
import { escapeHtml } from './escape.js';

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

// Round tick values, which this did not previously produce: it interpolated
// between the data's own min and max, so a range of $32,606-$115,989 gave an
// axis reading "$33k / $74k / $116k". Every one of those is a number the reader
// has to decode before they can use it to estimate where a line sits, which is
// the axis's only job.
//
// Steps are the conventional 1 / 2 / 2.5 / 5 series across neighbouring
// magnitudes, and the chosen step is the smallest that keeps the tick count
// within what was asked for — so the axis stays legible on a phone rather than
// gaining gridlines as the range widens. Ticks fall inside [min, max] rather
// than extending it: the lines are scaled to the true bounds, and stretching
// the axis to the nearest round number would leave the plot padded with space
// no data reaches.
const TICK_MANTISSAS = [1, 2, 2.5, 5];

function tickSteps(rawStep) {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const steps = [];
  for (const scale of [magnitude / 10, magnitude, magnitude * 10, magnitude * 100]) {
    for (const mantissa of TICK_MANTISSAS) steps.push(mantissa * scale);
  }
  return [...new Set(steps)].sort((a, b) => a - b);
}

function ticksAtStep(min, max, step) {
  const ticks = [];
  // A hair of tolerance on the top so a tick landing exactly on max survives
  // floating-point drift rather than being dropped.
  for (let tick = Math.ceil(min / step) * step; tick <= max + step * 1e-9; tick += step) {
    ticks.push(Math.round(tick * 1e6) / 1e6);
  }
  return ticks;
}

export function niceTicks(min, max, count) {
  if (min === max) return [min];
  const rawStep = (max - min) / Math.max(count - 1, 1);

  for (const step of tickSteps(rawStep)) {
    const ticks = ticksAtStep(min, max, step);
    if (ticks.length >= 2 && ticks.length <= count) return ticks;
  }

  // No round step fits — a range narrower than the smallest candidate step, or
  // a single-tick fit. The endpoints are still more use than nothing.
  return [min, max];
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
// Both markers used to draw a lowercase "i", told apart only by colour — a red
// circle and a blue one, meaning two unrelated things, with no key anywhere on
// the page. Colour alone was never enough (it is the same CVD problem the line
// dash patterns exist to solve), and two identical glyphs are not a key even in
// full colour. The cliff is a warning and gets "!"; the entry point is
// information and keeps "i".
const MARKER_GLYPH = { cliff: '!', entry: 'i' };

function chartMarker({ series, budget, explanation, variant, plotWidth, plotHeight, badgeY = 8, chars }) {
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
  return `<g class="chart-marker chart-marker--${variant}" role="img" aria-label="${escapeHtml(explanation)}">
      <line class="chart-marker__line" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${badgeY + 6}" y2="${plotHeight}" />
      <circle class="chart-marker__badge" cx="${x.toFixed(1)}" cy="${badgeY}" r="7" />
      <text class="chart-marker__glyph" x="${x.toFixed(1)}" y="${badgeY}" text-anchor="middle"
        dominant-baseline="central">${MARKER_GLYPH[variant] ?? 'i'}</text>
      <!-- A <g> has no fill of its own, so without this the only hoverable
           pixels are a 7px circle and a 1px rule. Transparent, and kept to
           the badge so it never covers the plotted points behind it. -->
      <circle class="chart-marker__hit" cx="${x.toFixed(1)}" cy="${badgeY}" r="13" />
      ${tipMarkup(explanation, { anchorX: x, plotWidth, boxY: badgeY + 12, chars })}
    </g>`;
}

// The novated line plateaus for a reason the chart cannot otherwise show:
// the FBT exemption is a cliff, not a taper, so past a certain car price the
// monthly cost roughly doubles and the lease simply stops being able to
// reach anything dearer.
// Split out from the marker so the same words can also be printed below the
// chart, where a reader with no pointer can get at them. This sentence explains
// the most important shape on the chart — the plateau — and it used to be
// reachable only by hovering a 12px circle.
//
// Kept tight on purpose: at disclaimer-sized text the tooltip box has to fit
// inside the plot, and a wall of small print is not much better than no note.
export function cliffExplanation(cliff) {
  if (!cliff) return null;
  return `FBT cliff at ${money(cliff.cliffPrice)}. A novated lease is FBT-exempt up to this ` +
    `price; one dollar over and the exemption is lost outright, with no taper, and the monthly ` +
    `cost roughly doubles. That is why the novated line flattens here: until your budget can ` +
    `absorb the unexempted cost, a lease cannot reach a dearer car however much the budget ` +
    `rises. Crossing it needs about ${money(cliff.budgetNeeded)}/mo.`;
}

function fbtCliffMarkup(series, cliff, plotWidth, plotHeight, chars) {
  const explanation = cliffExplanation(cliff);
  if (!explanation) return '';

  return chartMarker({
    series, budget: cliff.budgetAt, explanation,
    variant: 'cliff', plotWidth, plotHeight, chars
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
// Returns the budget the marker belongs at, or null when there is nothing to
// introduce — so the notes block below the chart can ask the same question the
// marker does without duplicating the reasoning.
function entryBudget(series, entry) {
  if (!entry) return null;
  const firstPlotted = series.points.findIndex(point => point.loan !== null);
  // The loan never appears in this range, so there is no line to introduce.
  if (firstPlotted < 0) return null;
  // Nothing to explain when the line starts at the left edge anyway.
  if (firstPlotted === 0) return null;
  return series.points[firstPlotted].budget;
}

// Deliberately no car named. The line is drawn from a typical EV's running
// costs, so quoting one real car's monthly figure beside it invites a comparison
// between two numbers that are not measuring the same thing.
export function entryExplanation(series, entry) {
  if (entryBudget(series, entry) === null) return null;
  return `The car loan line starts here. Below this budget a loan cannot cover even the ` +
    `cheapest car on the market, so there is nothing to plot. A longer term or a bigger ` +
    `deposit would lower the entry point and start the line sooner.`;
}

function entryMarkup(series, entry, plotWidth, plotHeight, chars) {
  const budget = entryBudget(series, entry);
  const explanation = entryExplanation(series, entry);
  if (budget === null || !explanation) return '';

  // Sits below the cliff badge so the two never overlap when they land close
  // together on the budget axis.
  return chartMarker({
    series, budget, explanation,
    variant: 'entry', plotWidth, plotHeight, badgeY: 26, chars
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
export function tipMarkup(explanation, { anchorX, plotWidth, boxY, chars = TIP_CHARS_PER_LINE }) {
  const lines = wrapText(explanation, chars);
  const boxWidth = chars * TIP_CHAR_WIDTH + TIP_PADDING * 2;
  const boxHeight = lines.length * TIP_LINE_HEIGHT + TIP_PADDING * 2;
  const fallbackX = Math.min(Math.max(anchorX - boxWidth / 2, 0), Math.max(0, plotWidth - boxWidth));

  const tspans = lines.map((line, i) =>
    `<tspan x="${TIP_PADDING}" dy="${i === 0 ? 0 : TIP_LINE_HEIGHT}">${escapeHtml(line)}</tspan>`
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

// The two axis titles used to live inside the SVG — one along the bottom, one
// rotated up the left margin (or squeezed above the plot when compact). Both
// now sit in an HTML key below the chart, named outright as "X-Axis:" and
// "Y-Axis:" so there is no guessing which line belongs to which edge, and both
// margins got the space back.
//
// HTML rather than more <text>: the copy wraps by itself at whatever width the
// column happens to be, so the compact geometry no longer needs its own
// shorter wording, and the hover explainer can be an ordinary element instead
// of a hand-wrapped <tspan> block in viewBox units.
const AXIS_KEY = [
  {
    axis: 'X-Axis',
    label: 'Monthly budget — the slider above',
    explanation:
      'What you can put toward the car each month — the same figure as the slider above. ' +
      'Each point on a line is the dearest car that way of paying reaches at that budget.'
  },
  {
    axis: 'Y-Axis',
    label: 'Most expensive car you could buy',
    explanation:
      'The dearest car each way of paying could get you at that budget, before on-road ' +
      'costs. Higher is more car. Running costs assume a typical EV from this dataset, so ' +
      'treat it as a guide rather than a quote — the cars below use their own real figures.'
  }
];

function axisKeyMarkup() {
  return `<dl class="axis-key">${AXIS_KEY.map(({ axis, label, explanation }) => `
    <div class="axis-key__row">
      <dt class="axis-key__axis">${axis}:</dt>
      <dd class="axis-key__label">${escapeHtml(label)}</dd>
      <span class="axis-key__tip" role="tooltip">${escapeHtml(explanation)}</span>
    </div>`).join('')}</dl>`;
}

// Everything the chart has to say, in text, below the chart.
//
// The hover tooltips stay — they are quick and well placed for a pointer — but
// they can no longer be the only way to reach this. A tooltip needs a pointer to
// hover with, and on the viewport where the chart is smallest and hardest to
// read there is no pointer at all. The axis explanations and both marker
// explanations were unreachable on every phone and tablet.
//
// A <details> rather than always-open prose: this is four paragraphs of
// explanation under a chart most readers will simply look at, and the summary
// says plainly what is inside. Each marker note is prefixed with the glyph its
// badge draws, which is also the key those two badges never had.
export function chartNotesMarkup(series, cliff, entry) {
  const notes = [
    ...AXIS_KEY.map(({ axis, label, explanation }) => ({
      term: `${axis} — ${label}`, body: explanation, glyph: null
    })),
    { term: 'Why the novated line flattens', body: cliffExplanation(cliff), glyph: MARKER_GLYPH.cliff },
    { term: 'Why the car loan line starts late', body: entryExplanation(series, entry), glyph: MARKER_GLYPH.entry }
  ].filter(note => note.body);

  return `<details class="chart-notes">
      <summary class="chart-notes__summary">What this chart is telling you</summary>
      <dl class="chart-notes__list">${notes.map(({ term, body, glyph }) => `
        <dt class="chart-notes__term">${
          glyph ? `<span class="chart-notes__glyph chart-notes__glyph--${glyph === MARKER_GLYPH.cliff ? 'cliff' : 'entry'}" aria-hidden="true">${glyph}</span>` : ''
        }${escapeHtml(term)}</dt>
        <dd class="chart-notes__body">${escapeHtml(body)}</dd>`).join('')}
      </dl>
    </details>`;
}

// Same behaviour the SVG notes had: the explainer appears on hover and follows
// the pointer, down and to the right so the cursor never covers the first
// words. CSS does the showing; this only does the following. Guarded like
// bindTipTracking — under `node --test` the target is a plain object with an
// innerHTML setter and none of this DOM exists.
function bindAxisKeyTracking(target) {
  if (!target || typeof target.querySelectorAll !== 'function') return;

  for (const row of target.querySelectorAll('.axis-key__row')) {
    const tip = row.querySelector?.('.axis-key__tip');
    if (!tip || typeof row.addEventListener !== 'function') continue;

    const follow = event => {
      // Clamp inside the viewport so a row near the right or bottom edge does
      // not push its explainer off screen.
      const maxX = window.innerWidth - tip.offsetWidth - 8;
      const maxY = window.innerHeight - tip.offsetHeight - 8;
      tip.style.left = `${clampTo(event.clientX + TIP_CURSOR_DX, 8, maxX)}px`;
      tip.style.top = `${clampTo(event.clientY + TIP_CURSOR_DY, 8, maxY)}px`;
    };
    // mouseenter as well as mousemove: a pointer that lands on the row without
    // moving again would otherwise show the tip at its unpositioned default.
    row.addEventListener('mouseenter', follow);
    row.addEventListener('mousemove', follow);
  }
}

function renderLineChart(target, series, budgetMonthly, cliff, entry, compact = false) {
  const { min, max } = bounds(series);
  // A phone gives the chart roughly 310 CSS pixels. The desktop viewBox is 780
  // wide, so it would scale to 0.4 and render 13.5-unit labels at 5.3px —
  // unreadable, and the reason this used to fall back to a winner band. A
  // narrower viewBox scales far less (0.8), so the same type stays legible.
  const plotWidth = compact ? 310 : 560;
  const plotHeight = compact ? 170 : 190;

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

  // Both axis titles now live in an HTML key below the SVG (axisKeyMarkup),
  // so no margin pays for them any more: bottom holds only the x tick labels,
  // and the left margin only the y ones. That is what shrank bottom from
  // 50/54 and, on the wide geometry, left from 96 — a rotated title used to
  // stand in there.
  //
  // Sized for the label type: "$101,973" at 13.5 units of mono needs ~65 plus
  // its 8-unit offset. Compact spends its width very differently — the right
  // margin goes to almost nothing because the end labels are dropped (the
  // legend above the chart already names all three lines, in the same colours
  // and dash patterns) and the left shrinks because the y ticks abbreviate to
  // "$116k".
  const margin = compact
    ? { top: 26, right: 14, bottom: 30, left: 56 }
    : { top: 26, right: 128, bottom: 30, left: 78 };
  const width = plotWidth + margin.left + margin.right;
  const height = plotHeight + margin.top + margin.bottom;
  const lastIndex = series.points.length - 1 || 1;

  const segments = toSegments(series, { width: plotWidth, height: plotHeight });

  const yTicks = niceTicks(min, max, 3);
  const gridlines = yTicks.map(tick => {
    const y = plotHeight - ((tick - min) / (max - min || 1)) * plotHeight;
    return `<g>
      <line class="grid-line" x1="0" x2="${plotWidth}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" />
      <text class="axis-label axis-label--y" x="-8" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle">${compact ? shortMoney(tick) : money(tick)}</text>
    </g>`;
  }).join('');

  const xTickIndices = [...new Set([0, Math.round(lastIndex / 2), lastIndex])];
  const xLabels = xTickIndices.map(index => {
    const point = series.points[index];
    const x = (index / lastIndex) * plotWidth;
    return `<text class="axis-label axis-label--x" x="${x.toFixed(1)}" y="${plotHeight + 22}" text-anchor="middle">$${point.budget}/mo</text>`;
  }).join('');

  // Tip copy has to fit the plot it sits in, and compact has half the width.
  const tipChars = compact ? 34 : TIP_CHARS_PER_LINE;

  // Dropped when compact: there is no right margin to put them in, and the
  // legend above the chart already names all three lines in matching colours.
  const endEntries = compact ? [] : OPTIONS
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
        ${fbtCliffMarkup(series, cliff, plotWidth, plotHeight, tipChars)}
        ${entryMarkup(series, entry, plotWidth, plotHeight, tipChars)}
        ${budgetMarkup}
      </g>
    </svg>
    ${axisKeyMarkup()}
    ${chartNotesMarkup(series, cliff, entry)}`;

  // Must run after the markup lands, since they bind to the new nodes.
  bindTipTracking(target);
  bindAxisKeyTracking(target);
}

// The wide geometry is a 784-unit viewBox whose font sizes are viewBox units,
// so it only reads at something near 1:1. The real question is therefore "does
// the chart have room", not "is this a phone" — and since step 2 became a
// half-width column, a wide viewport no longer implies a wide chart. Measure
// the element the SVG actually goes into.
const WIDE_CHART_MIN_PX = 620;

// A real measurement of the target, distinct from "we have no idea": a
// hidden (display:none) element genuinely measures 0, where a detached node
// or the plain objects the tests render into have no clientWidth at all
// (undefined). Those two must not be conflated — see renderChart's own guard
// below, which only fires on a real 0.
function measuredWidth(target) {
  const width = target?.clientWidth;
  if (typeof width === 'number') return width;
  return target?.getBoundingClientRect?.().width;
}

function hasRoomForWideChart(width, root) {
  if (typeof width === 'number' && width > 0) return width >= WIDE_CHART_MIN_PX;

  // Unmeasurable: a detached node, or the plain objects the tests render into.
  // Fall back to the viewport. I4: app.js always calls renderChart with `root
  // = document`, and Document has no clientWidth — `undefined < 900` was
  // always false, so the narrow geometry could never be picked at any
  // viewport. matchMedia is the standard way to ask how wide the viewport is
  // (and reacts to a real resize, unlike a one-off measurement);
  // documentElement.clientWidth covers an environment that stubs one but not
  // the other.
  if (typeof matchMedia === 'function') return matchMedia('(min-width: 900px)').matches;
  const docWidth = root?.documentElement?.clientWidth;
  return typeof docWidth === 'number' ? docWidth >= 900 : true;
}

export function renderChart(root, series, budgetMonthly = null, cliff = null, entry = null) {
  const target = root.querySelector('#crossover');
  if (!target) return;

  // The compare tab hides this panel with the `hidden` attribute, and the
  // resize/orientationchange listeners in app.js fire whichever tab is
  // showing. A hidden element measures zero, and painting against a zero
  // width bakes a broken layout into the cached SVG. Skip instead; app.js
  // repaints when tab 1 comes back (see the bindTabs callback there).
  //
  // Deliberately not `width === 0` on an *unmeasurable* target — the plain
  // objects the rest of this file's tests render into have no clientWidth at
  // all (undefined), which must keep falling through to hasRoomForWideChart's
  // own viewport fallback below, not be mistaken for a hidden element.
  const width = measuredWidth(target);
  if (width === 0) return;

  // A capacity of 0 means "this way of paying reaches nothing at this budget",
  // which is exactly what a null meant in the cost series it replaced: the
  // line must break. Plotted as a point it would sit on the axis and read as
  // a free car. Normalised once here so every downstream helper — bounds and
  // toSegments — keeps its existing null handling.
  const withGaps = {
    ...series,
    points: series.points.map(point => ({
      ...point,
      novated: point.novated > 0 ? point.novated : null,
      loan: point.loan > 0 ? point.loan : null,
      upfront: point.upfront > 0 ? point.upfront : null
    }))
  };

  // One chart everywhere now, in two geometries. The winner band existed
  // because the desktop viewBox shrank to 0.4 on a phone and took the labels
  // with it; a compact viewBox scales to about 0.8 instead, so the lines and
  // their markers survive the trip. A phone reader gets the same picture as
  // everyone else — the FBT plateau, the flat cash line, the crossover —
  // rather than a summary of it.
  renderLineChart(target, withGaps, budgetMonthly, cliff, entry, !hasRoomForWideChart(width, root));
}
