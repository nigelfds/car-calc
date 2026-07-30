// The slot combobox for the compare tab. Markup is built as a string and
// assigned to innerHTML, matching renderCards (ui/cars.js), so it can be
// asserted in Node without a DOM. Every listener binds once on the tab
// container and delegates, matching bindPresets (ui/sections.js) — a listener
// bound to a rendered option would be destroyed by the next keystroke.

import { searchVehicles, SEARCH_LIMIT } from './vehicle-search.js';
import { money } from './format.js';

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

export function suggestionsMarkup(groups, activeId) {
  if (groups.length === 0) {
    return '<p class="ac__empty">No car matches that. Try a make or a model.</p>';
  }
  return groups.map(group => `
    <div class="ac__group" role="group" aria-label="${escapeHtml(group.modelLabel)}">
      <p class="ac__group-label">${escapeHtml(group.modelLabel)}</p>
      ${group.items.map(v => `
        <div class="ac__option" role="option" id="opt-${escapeHtml(v.id)}"
             data-vehicle-id="${escapeHtml(v.id)}"
             aria-selected="${v.id === activeId ? 'true' : 'false'}">
          <span class="ac__variant">${escapeHtml(v.variant ?? '')}</span>
          <span class="ac__meta">${escapeHtml(v.bodyType)} &middot; ${money(v.listPrice)}${
            (v.powertrain ?? 'bev') === 'phev' ? ' &middot; <b>PHEV</b>' : ''
          }</span>
        </div>`).join('')}
    </div>`).join('');
}

export function renderSuggestions(root, slotIndex, groups, activeId) {
  const list = root.querySelector(`#compare-listbox-${slotIndex}`);
  if (!list) return;
  list.innerHTML = suggestionsMarkup(groups, activeId);
  // Results present -> show the list; no results -> hide it. The empty-state
  // paragraph still renders into the listbox (so a screen reader hears "No
  // car matches that" if the box is ever shown), but there is nothing gained
  // by leaving an empty listbox open under the input, and every caller here
  // already has an explicit reason to render (an edit, a search, an arrow
  // key) so "hidden tracks emptiness" is the whole rule — activeId plays no
  // part in it.
  list.hidden = groups.length === 0;
}

// Bound once, on the compare panel. `getVehicles` is a getter rather than an
// array because the dataset arrives after boot.
export function bindAutocomplete(root, { getVehicles, onSelect }) {
  const panel = root.querySelector('#compare-panel');
  if (!panel) return;

  // Which option the arrow keys have landed on, per slot. Not in app state:
  // it is transient interaction, gone the moment the box closes.
  const active = new Map();

  const slotOf = el => {
    const slot = el.closest?.('[data-slot]');
    return slot ? Number(slot.dataset.slot) : null;
  };

  const optionIds = slotIndex => {
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    return [...(list?.querySelectorAll('[data-vehicle-id]') ?? [])]
      .map(el => el.dataset.vehicleId);
  };

  const close = slotIndex => {
    active.delete(slotIndex);
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    if (list) list.hidden = true;
  };

  const commit = (slotIndex, vehicleId) => {
    if (!vehicleId) return;
    close(slotIndex);
    // Picking commits immediately — there is no Apply button, and the
    // comparison repaints on the spot.
    onSelect(slotIndex, vehicleId);
  };

  panel.addEventListener('input', event => {
    const input = event.target.closest?.('.compare-slot__input');
    if (!input) return;
    const slotIndex = slotOf(input);
    if (slotIndex === null) return;
    const groups = searchVehicles(getVehicles(), input.value, SEARCH_LIMIT);
    active.delete(slotIndex);
    renderSuggestions(root, slotIndex, groups, null);
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    if (list) list.hidden = input.value.trim() === '';
  });

  panel.addEventListener('keydown', event => {
    const input = event.target.closest?.('.compare-slot__input');
    if (!input) return;
    const slotIndex = slotOf(input);
    if (slotIndex === null) return;
    const ids = optionIds(slotIndex);

    if (event.key === 'Escape') { close(slotIndex); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(slotIndex, active.get(slotIndex) ?? ids[0]);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (ids.length === 0) return;

    event.preventDefault();
    const current = ids.indexOf(active.get(slotIndex));
    const step = event.key === 'ArrowDown' ? 1 : -1;
    // Wraps at both ends: from the last option, down returns to the first.
    const next = (current + step + ids.length) % ids.length;
    active.set(slotIndex, ids[next]);
    renderSuggestions(
      root, slotIndex, searchVehicles(getVehicles(), input.value, SEARCH_LIMIT), ids[next]
    );
    input.setAttribute('aria-activedescendant', `opt-${ids[next]}`);
  });

  panel.addEventListener('click', event => {
    const option = event.target.closest?.('[data-vehicle-id]');
    if (option) { commit(slotOf(option), option.dataset.vehicleId); return; }
    const clear = event.target.closest?.('[data-clear-slot]');
    // Clearing empties the slot in place. It must not promote slot 3 into
    // slot 2 — the URL carries position, and a share should survive a clear.
    if (clear) onSelect(Number(clear.dataset.clearSlot), '');
  });
}
