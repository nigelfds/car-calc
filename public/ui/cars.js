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
    sources: family?.sources ?? [],
    image: family?.images?.[0] ?? null
  };
}

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

const SILHOUETTE_IDS = new Set(['SUV', 'Sedan', 'Hatch', 'Wagon', 'Ute']);

// Photography is deliberately out of scope for this project (see the sprite
// in index.html) — the silhouette is the normal rendering for every car,
// not a fallback for a missing/broken image. A family's `images[0]` (when
// present) is layered on top of it; the sprite is what's still there if
// that image URL 404s.
function silhouetteMarkup(bodyType) {
  const id = SILHOUETTE_IDS.has(bodyType) ? bodyType : 'Sedan';
  return `<svg class="car-card__silhouette" viewBox="0 0 120 44" aria-hidden="true"><use href="#silhouette-${id}"></use></svg>`;
}

export function renderCards(root, cards) {
  const target = root.querySelector('#car-list');
  if (!target) return;

  if (cards.length === 0) {
    target.innerHTML = '<p class="skeleton-note">No car in the dataset matches these filters at this budget. Try relaxing one.</p>';
    return;
  }

  target.innerHTML = cards.map(card => {
    const bodyType = SILHOUETTE_IDS.has(card.bodyType) ? card.bodyType : 'Sedan';
    return `
    <article class="car-card" data-id="${escapeHtml(card.id)}">
      <div class="car-image">
        ${card.image
          ? `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.make)} ${escapeHtml(card.model)}" loading="lazy"
                  onerror="this.replaceWith(document.querySelector('#silhouette-${bodyType}').cloneNode(true))">`
          : silhouetteMarkup(card.bodyType)}
      </div>
      <div class="car-body">
        <h3>${escapeHtml(card.make)} ${escapeHtml(card.model)} ${escapeHtml(card.variant ?? '')}</h3>
        <p class="car-specs">${card.bootLitresSeatsUp}L boot &middot; ${card.rangeKm}km range &middot; ${money(card.listPrice)}</p>
        ${card.reason ? `<p class="car-reason">${escapeHtml(card.reason)}</p>` : ''}
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
