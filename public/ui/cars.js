// Section 3 — cars that match. filterVehicles narrows the fleet by stated
// hard requirements; cardModel decorates a vehicle with its family's review
// copy (if any exists — a vehicle with no matching family still renders,
// just without a "why this one" panel); renderCards paints the shortlist.
//
// Ranking is deliberately not this module's job: calc/rank.js's
// rankVehicles is deterministic (no API call, same inputs -> same order,
// works with no network) and callers (ui/app.js) are expected to filter
// here, then rank, then slice, then pass the result to renderCards.

import { money, termLabel, blockerText } from './format.js';
import { OPTIONS, OPTION_NAME_SHORT } from './labels.js';
import { optionCosts, valueRatio, optionBlocker } from '../../calc/compare.js';
import { escapeHtml } from './escape.js';

export function filterVehicles(vehicles, filters) {
  return vehicles.filter(v => {
    // Read inline rather than importing data/schema.js's powertrainOf: that
    // module is never served to the browser, so an import here would pass
    // node --test and then 404 in the browser with nothing to catch it.
    const isPhev = v.powertrain === 'phev';
    // Opt-in. A plug-in hybrid is not an EV, does not get the FBT exemption,
    // and would change every answer on the page for someone who never asked.
    if (isPhev && !filters.includePhev) return false;
    if (filters.bodyTypes?.length && !filters.bodyTypes.includes(v.bodyType)) return false;
    if (filters.minBootLitres && v.bootLitresSeatsUp < filters.minBootLitres) return false;
    // "Minimum range" means "how far before I have to stop", which for a
    // plug-in hybrid is the tank as well as the battery. Its electric-only
    // range answers a different question — the one minElectricRangeKm asks.
    const rangeForFilter = isPhev ? (v.combinedRangeKm ?? v.rangeKm) : v.rangeKm;
    if (filters.minRangeKm && rangeForFilter < filters.minRangeKm) return false;
    // PHEVs only. A BEV's electric range is its whole range, so applying this
    // to one would just be a second, stricter minRangeKm applied behind the
    // user's back.
    if (isPhev && filters.minElectricRangeKm && v.rangeKm < filters.minElectricRangeKm) return false;
    if (filters.seats && v.seats < filters.seats) return false;
    return true;
  });
}

// Which preference is doing the excluding, and what it would have to become.
//
// "No car matches these preferences. Try relaxing one." left the reader to
// bisect five filters by hand. filterVehicles is pure and runs in well under a
// millisecond over 124 rows, so the honest answer is simply computable: drop
// each active filter in turn, and see which one alone brings the list back.
//
// `relaxed` is what switching the filter off looks like for that field — an
// empty array for the multi-select, null for the numeric minimums, and `true`
// for the plug-in hybrid toggle, which excludes rather than restricts and so is
// relaxed by turning it ON.
//
// `available` reads the value the filter tests against, mirroring
// filterVehicles' own logic — including that "minimum range" means combined
// range for a plug-in hybrid, which is the trap a second implementation here
// would fall into.
const RELAXABLE = [
  { field: 'bodyTypes', label: 'body type', relaxed: [] },
  {
    field: 'minBootLitres', label: 'boot minimum', relaxed: null,
    format: value => `${value}L`, available: v => v.bootLitresSeatsUp
  },
  {
    field: 'minRangeKm', label: 'range minimum', relaxed: null,
    format: value => `${value}km`,
    available: v => (v.powertrain === 'phev' ? (v.combinedRangeKm ?? v.rangeKm) : v.rangeKm)
  },
  {
    field: 'minElectricRangeKm', label: 'electric-range minimum', relaxed: null,
    format: value => `${value}km`, available: v => v.rangeKm
  },
  {
    field: 'seats', label: 'seat minimum', relaxed: null,
    format: value => `${value} seats`, available: v => v.seats
  },
  { field: 'includePhev', label: 'the exclusion of plug-in hybrids', relaxed: true }
];

// A filter only counts as binding if it is actually switched on. includePhev is
// the odd one out: its restrictive state is `false`.
function isActive(spec, filters) {
  const value = filters[spec.field];
  if (spec.field === 'includePhev') return value === false;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

export function diagnoseEmptyFilters(vehicles, filters) {
  if (filterVehicles(vehicles, filters).length > 0) return null;

  const candidates = [];
  for (const spec of RELAXABLE) {
    if (!isActive(spec, filters)) continue;
    const relaxed = { ...filters, [spec.field]: spec.relaxed };
    const matches = filterVehicles(vehicles, relaxed);
    if (matches.length === 0) continue;

    // The value that would work: with everything else still applied, the best
    // any remaining car can offer. Reported rather than a round number, because
    // "try about 500" is a guess and "480L gives you 6 cars" is an answer.
    const achievable = spec.available
      ? Math.max(...matches.map(spec.available).filter(Number.isFinite))
      : null;

    candidates.push({
      field: spec.field,
      label: spec.label,
      count: matches.length,
      suggestion: achievable !== null && spec.format ? spec.format(achievable) : null
    });
  }

  if (candidates.length === 0) return null;
  // The relaxation that opens the list widest. Where two filters are each
  // individually binding, this is the one that costs the reader least.
  return candidates.sort((a, b) => b.count - a.count)[0];
}

// Header provenance: how much data is behind the answers, and how fresh it
// is. Derived from the dataset itself rather than written into the markup, so
// the numbers cannot quietly drift from what actually ships.
export function datasetStats({ vehicles = [], families = [] } = {}) {
  const withVariants = new Set(vehicles.map(v => v.familyId));
  // Families with no rows are not cars anyone can be shown, so they are not
  // counted as models.
  const models = families.filter(f => withVariants.has(f.id)).length;
  // Counted off the variants, not the families, for the same reason: a brand
  // present only in families.json with no rows behind it is a brand this site
  // cannot actually show you a car from.
  const brands = new Set(vehicles.map(v => v.make).filter(Boolean)).size;

  const dates = [...vehicles, ...families]
    .map(row => row?.sourcedAt)
    .filter(value => typeof value === 'string' && !Number.isNaN(Date.parse(value)))
    .sort();
  const latest = dates[dates.length - 1];

  return {
    brands,
    models,
    variants: vehicles.length,
    // UTC so the month never shifts backwards for a reader west of the data's
    // timezone.
    updated: latest
      ? new Date(latest).toLocaleString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : null
  };
}

// `context` ({ inputs, tables }) is optional: without it the card carries only
// review copy, which keeps the model usable in tests and in any caller that
// does not need money. With it, the card is costed under all three funding
// options — a fair comparison here in a way it never was in step 2, because
// all three price the SAME car.
export function cardModel(vehicle, families, context = null) {
  const family = families.find(f => f.id === vehicle.familyId) ?? null;
  const costs = context
    ? optionCosts({ vehicle, inputs: context.inputs }, context.tables)
    : null;

  // A novated lease ends with a lump-sum residual. It is already inside the
  // novated total, but a total is not a cash-flow warning: affordability is
  // tested on the monthly figure alone, so a lease that fits comfortably each
  // month can still leave a five-figure bill due on the last day of the term.
  // Whether selling the car would clear it is the part worth flagging.
  const balloon = costs ? costs.novated.detail.residual : null;
  const balloonCovered = balloon === null
    ? null
    : costs.novated.detail.resale >= balloon;

  const powertrain = vehicle.powertrain ?? 'bev';
  const phevIneligible = costs?.novated.detail.phevIneligible ?? false;
  // The cheap case needs disclosing more than the dear one does. A lease start
  // date before 1 April 2025 hands a PHEV the exemption and takes tens of
  // thousands off its novated total, on an assumption the form never asks
  // about — so the card says which assumption it made. Read off the treatment
  // (calc/fbt.js via compare.js) rather than comparing dates here: when the
  // exemption ended is tax knowledge, and it lives in calc/.
  const phevExemptByDate = costs?.novated.detail.phevExemptByDate ?? false;
  // Cards are banded on list price, so a PHEV can legitimately sit under
  // "At your budget" while costing more per month than the budget allows —
  // the budget was worked out from an FBT-exempt EV. Saying so on the card is
  // what keeps the band label honest.
  const novatedOverBudget = costs && typeof context?.monthlyBudget === 'number'
    ? costs.novated.monthlyCost > context.monthlyBudget
    : false;

  return {
    ...vehicle,
    summary: family?.summary ?? null,
    pros: family?.pros ?? [],
    cons: family?.cons ?? [],
    sources: family?.sources ?? [],
    // One image per family, shared by every variant — the trims differ in price
    // and range, not in what the car looks like.
    image: family?.image ?? null,
    costs,
    balloon,
    balloonCovered,
    powertrain,
    phevIneligible,
    phevExemptByDate,
    novatedOverBudget,
    // Carried onto the card so the cost table can say "over 5 years" rather
    // than "over the term" — the table has the numbers but not the period they
    // cover, and a total means little without it.
    termMonths: context?.inputs?.termMonths ?? null,
    // What it would take to unblock an option that cannot reach this car. In
    // practice only cash is ever infeasible (calc/compare.js marks novated and
    // loan feasible unconditionally), but this comes from the shared
    // optionBlocker for all three rather than being special-cased to cash, so it
    // stays correct if that ever changes.
    blockers: costs
      ? Object.fromEntries(
        OPTIONS.map(option => [option, optionBlocker(costs[option], context?.monthlyBudget)])
      )
      : null
  };
}

// The short forms, from the one place the option names live. Short because the
// table sits in a narrow column, not because the shortlist calls these three
// things something different from the rest of the page.
const COST_LABEL = OPTION_NAME_SHORT;

// What each way of paying costs, monthly first.
//
// The whole page above this table is denominated in dollars per month — the
// slider, the verdict, the summary bar, the chart's x axis — and this table
// used to answer in term totals only, so a reader could not check a card
// against the budget they had just set. The monthly figure leads now and the
// total sits under it.
//
// Cash is deliberately not parallel with the other two. Its `monthlyCost` is
// running costs alone (calc/upfront.js's netMonthlyRunningCost — there is no
// repayment to add), so giving it a "$103/mo" headline beside a lease's
// "$712/mo" would say cash is seven times cheaper, when the difference is that
// sixty thousand dollars left the bank on day one. The honest headline for cash
// is the money it wants up front, with the running cost second.
function costTableMarkup(card) {
  if (!card.costs) return '';
  const rows = OPTIONS.map(option => {
    const entry = card.costs[option];
    const ratio = valueRatio(entry);
    // Two columns, not three: the shortlist lives in a narrow column and a
    // third column crushed the figures into each other. Everything after the
    // headline figure stacks underneath it instead.
    const lead = option === 'upfront'
      ? `<span class="car-costs__lead">${money(entry.detail.driveAway)} up front</span>
         <span class="car-costs__aside">then ${money(entry.monthlyCost)}/mo to run</span>`
      : `<span class="car-costs__lead">${money(entry.monthlyCost)}/mo</span>`;

    // The option's own class on the row, so a stylesheet can find "the novated
    // row" by name. It used to be reachable only as `tr:first-child`, which is
    // true today and silently wrong the first time OPTIONS is reordered.
    return `<tr class="cost-row cost-row--${option}${option === card.winningOption ? ' is-winner' : ''}">
        <th scope="row">${COST_LABEL[option]}</th>
        <td>
          ${entry.feasible
            ? `${lead}<span class="car-costs__total">${money(entry.tco)} total</span>`
            // A bare "out of reach" cost three lines and told the reader nothing
            // they could act on — and at the default $0 savings that was every
            // cash row on every card. One line naming the lever instead: what
            // this particular car would need saved, which is more use than the
            // verdict panel's version because it is this car's drive-away price
            // rather than a ceiling.
            : `<span class="car-costs__lead car-costs__lead--blocked">${
              blockerText(card.blockers?.[option]) || 'out of reach'
            }</span>`}
          ${entry.feasible && ratio !== null
            ? `<span class="car-costs__ratio">keeps ${Math.round(ratio * 100)}c of every $1</span>`
            : ''}
          ${option === 'novated' && card.novatedOverBudget
            ? `<span class="cost-row__warn">over your budget</span>`
            : ''}
        </td>
      </tr>`;
  }).join('');

  const balloonNote = card.balloon
    ? `<p class="car-balloon${card.balloonCovered ? '' : ' is-short'}">
        Novated ends with a ${money(card.balloon)} balloon to own it${
          card.balloonCovered
            ? `, roughly covered by selling it (${money(card.costs.novated.detail.resale)})`
            : ` — more than its projected ${money(card.costs.novated.detail.resale)} resale, so selling would not clear it`
        }.</p>`
    : '';

  // The caption carries the two qualifiers that used to be missing, once,
  // rather than repeating them on three rows: what period the totals cover, and
  // that they are net of what the car is worth at the end. Without the second,
  // a $43,404 total under a $61,990 car reads as an arithmetic error.
  return `<table class="car-costs">
        <caption>What each way of paying costs
          <span class="car-costs__caption-note">Totals are over ${termLabel(card.termMonths)}, after resale</span>
        </caption>
        <tbody>${rows}</tbody>
      </table>${balloonNote}`;
}

export function renderCards(root, cards, emptyMessage) {
  const target = root.querySelector('#car-list');
  if (!target) return;

  if (cards.length === 0) {
    // Which lever to pull depends on which stage emptied the list — the
    // caller knows, because it filtered on preferences and budget in turn.
    const note = emptyMessage
      ?? 'No car in the dataset matches these filters at this budget. Try relaxing one.';
    target.innerHTML = `<p class="skeleton-note">${escapeHtml(note)}</p>`;
    return;
  }

  // One freely-licensed photograph per family, shared across every variant of
  // it, cropped to a single consistent frame. It runs full-bleed across the
  // top of the card rather than beside the text, because height is what a
  // card has spare and width is not. This is not a reversal of the earlier
  // decision to drop the body-type silhouette — that silhouette was removed
  // for costing a fixed 3.5rem of every card's *width* to convey one fact the
  // specs line already carried; a top-of-card photograph costs *height*
  // instead, which is a genuinely different trade, not the same one undone.
  // A family with no image yet renders exactly as it did with neither: no
  // broken icon, no placeholder box.
  target.innerHTML = cards.map(card => {
    return `
    <article class="car-card${card.band ? ` car-card--${card.band}` : ''}" data-id="${escapeHtml(card.id)}">
      ${card.image ? `
      <figure class="car-figure">
        <!-- alt="": the <h3> immediately below carries make, model AND
             variant, a superset of what the alt text could say — a
             non-empty alt here would just have a screen reader repeat the
             heading a moment before it's read. -->
        <img src="images/cars/${escapeHtml(card.image.file)}"
             alt=""
             title="${escapeHtml(`${card.image.author} · ${card.image.licence}`)}"
             width="900" height="600" loading="lazy">
      </figure>` : ''}
      <div class="car-body">
        ${card.bandLabel ? `<p class="car-card__band">${escapeHtml(card.bandLabel)}</p>` : ''}
        <h3>${escapeHtml(card.make)} ${escapeHtml(card.model)} ${escapeHtml(card.variant ?? '')}</h3>
        <p class="car-specs">${card.bootLitresSeatsUp}L boot &middot; ${
          card.powertrain === 'phev'
            ? `${card.rangeKm}km electric, ${card.combinedRangeKm}km combined`
            : `${card.rangeKm}km range`
        } &middot; ${money(card.listPrice)}</p>
        ${costTableMarkup(card)}
        ${card.phevIneligible ? `<p class="car-phev-note">Plug-in hybrids lost the FBT exemption on
          1 April 2025, so a novated lease costs far more than for an equivalent EV.</p>` : ''}
        ${card.phevExemptByDate ? `<p class="car-phev-note">These figures treat the lease as FBT-exempt
          only because it starts before 1 April 2025, when plug-in hybrids lost the exemption. That
          holds only if you had a binding commitment in place by then. On a later start date the
          novated cost is far higher.</p>` : ''}
        ${card.reason ? `<p class="car-reason">${escapeHtml(card.reason)}</p>` : ''}
        ${card.otherTrimsText ? `<p class="car-other-trims">${escapeHtml(card.otherTrimsText)}</p>` : ''}
        ${card.summary ? `<details>
          <summary>Why this one</summary>
          <p>${escapeHtml(card.summary)}</p>
          ${card.pros.length ? `<ul class="pros">${card.pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
          ${card.cons.length ? `<ul class="cons">${card.cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
          ${card.sources.length ? `<p class="sources">${card.sources.map(s => `<a href="${escapeHtml(s)}" target="_blank" rel="noopener">review</a>`).join(' &middot; ')}</p>` : ''}
        </details>` : ''}
      </div>
    </article>`;
  }).join('');
}
