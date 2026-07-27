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

export function filterVehicles(vehicles, filters) {
  return vehicles.filter(v => {
    if (filters.bodyTypes?.length && !filters.bodyTypes.includes(v.bodyType)) return false;
    if (filters.minBootLitres && v.bootLitresSeatsUp < filters.minBootLitres) return false;
    if (filters.minRangeKm && v.rangeKm < filters.minRangeKm) return false;
    if (filters.seats && v.seats < filters.seats) return false;
    return true;
  });
}

export function cardModel(vehicle, families) {
  const family = families.find(f => f.id === vehicle.familyId) ?? null;
  return {
    ...vehicle,
    summary: family?.summary ?? null,
    pros: family?.pros ?? [],
    cons: family?.cons ?? [],
    sources: family?.sources ?? []
  };
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
        <p class="car-specs">${card.bootLitresSeatsUp}L boot &middot; ${card.rangeKm}km range &middot; ${money(card.listPrice)}</p>
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
