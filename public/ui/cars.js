// Section 3 — cars that match. filterVehicles narrows the fleet by stated
// hard requirements; cardModel decorates a vehicle with its family's review
// copy (if any exists — a vehicle with no matching family still renders,
// just without a "why this one" panel); renderCards paints the shortlist.
//
// Ranking is deliberately not this module's job: calc/rank.js's
// rankVehicles is deterministic (no API call, same inputs -> same order,
// works with no network) and callers (ui/app.js) are expected to filter
// here, then rank, then slice, then pass the result to renderCards.

import { money } from './format.js';
import { optionCosts, valueRatio } from '../../calc/compare.js';

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
    costs,
    balloon,
    balloonCovered,
    powertrain,
    phevIneligible,
    novatedOverBudget
  };
}

const COST_LABEL = { novated: 'Novated', loan: 'Loan', upfront: 'Cash' };

// Three totals for one car, plus how much of each dollar survives as resale.
// The ratio is the tiebreaker the totals cannot give you: two cards $600 apart
// on sticker can be 13c apart on what they retain.
function costTableMarkup(card) {
  if (!card.costs) return '';
  const rows = ['novated', 'loan', 'upfront'].map(option => {
    const entry = card.costs[option];
    const ratio = valueRatio(entry);
    // Two columns, not three: the shortlist lives in a ~236px column and a
    // third column crushed the figures into each other. The ratio sits under
    // its own total instead.
    return `<tr${option === card.winningOption ? ' class="is-winner"' : ''}>
        <th scope="row">${COST_LABEL[option]}</th>
        <td>
          <span class="car-costs__total">${entry.feasible ? money(entry.tco) : 'out of reach'}</span>
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

  return `<table class="car-costs">
        <caption>Total cost over the term</caption>
        <tbody>${rows}</tbody>
      </table>${balloonNote}`;
}

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

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

  // No car imagery at all: photography was always out of scope, and the
  // body-type silhouette that stood in for it was costing a fixed 3.5rem of
  // every card's width to convey one fact ("it's an SUV") that the specs line
  // and the filters already carry. The space goes to the text instead.
  target.innerHTML = cards.map(card => {
    return `
    <article class="car-card${card.band ? ` car-card--${card.band}` : ''}" data-id="${escapeHtml(card.id)}">
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
