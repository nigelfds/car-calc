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
  // This function only owns half the visibility rule: whenever there are
  // results, the box must be open, so `groups.length > 0` always opens it —
  // no caller ever needs to second-guess that. An empty groups array is
  // ambiguous on its own, though: it means either "nothing typed yet" (stay
  // closed) or "typed something, found nothing" (open on the "No car
  // matches" message), and telling those apart needs the query text, which
  // this function is never given (see the interface list this task must
  // keep). So the default here is closed, and bindAutocomplete's `input`
  // listener — which does hold the query — is the caller that reopens the
  // box for the second case.
  list.hidden = groups.length === 0;
}

// Where the arrow keys land next. Pure and DOM-free on purpose: it is the one
// piece of the keydown handler that needs no element at all, just the
// rendered option ids, so it can be unit-tested directly rather than deferred
// to the browser check the rest of the handler needs. `step` is +1 (down) or
// -1 (up); wraps at both ends, and treats "nothing active yet" the same way
// the original inline computation did — activeId absent from ids reads as
// index -1, one before the first option.
export function nextActiveId(ids, activeId, step) {
  if (ids.length === 0) return null;
  const current = ids.indexOf(activeId);
  return ids[(current + step + ids.length) % ids.length];
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

  const inputFor = slotIndex => root.querySelector(`[data-slot="${slotIndex}"] .compare-slot__input`);

  // A combobox's aria-expanded must track whether its listbox is actually
  // open — nothing did that before this fix, so a screen reader announced a
  // collapsed combobox while suggestions sat visible on screen. Every path
  // that changes the listbox's `hidden` state funnels its result through
  // here, the same way close() is the single funnel for ending a dropdown
  // session.
  const setExpanded = (slotIndex, expanded) => {
    inputFor(slotIndex)?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };

  const optionIds = slotIndex => {
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    return [...(list?.querySelectorAll('[data-vehicle-id]') ?? [])]
      .map(el => el.dataset.vehicleId);
  };

  const close = slotIndex => {
    active.delete(slotIndex);
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    if (list) {
      list.hidden = true;
      // Escape (or a commit) ends this dropdown's session, not just its
      // visibility. Leaving the old options sitting in the DOM let a stray
      // ArrowDown right afterward silently reopen the previous, now-stale,
      // search with no new input driving it — closed means closed until the
      // next edit regenerates suggestions.
      list.innerHTML = '';
    }
    // The old aria-activedescendant would otherwise keep pointing at an
    // option id that no longer exists once the innerHTML above (or the next
    // render) replaces it — a screen reader left referencing a dead node.
    // Every path that ends the active option (Escape, a commit, a clear)
    // funnels through close(), so clearing it here covers all of them.
    inputFor(slotIndex)?.removeAttribute('aria-activedescendant');
    // close() always collapses the box, so aria-expanded follows unconditionally.
    setExpanded(slotIndex, false);
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
    // A fresh keystroke abandons whatever the arrow keys had landed on, so
    // the input must stop pointing the screen reader at it too.
    input.removeAttribute('aria-activedescendant');
    renderSuggestions(root, slotIndex, groups, null);
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    if (list) list.hidden = input.value.trim() === '';
    setExpanded(slotIndex, Boolean(list && !list.hidden));
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
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = nextActiveId(ids, active.get(slotIndex), step);
    active.set(slotIndex, next);
    renderSuggestions(
      root, slotIndex, searchVehicles(getVehicles(), input.value, SEARCH_LIMIT), next
    );
    input.setAttribute('aria-activedescendant', `opt-${next}`);
    const list = root.querySelector(`#compare-listbox-${slotIndex}`);
    setExpanded(slotIndex, Boolean(list && !list.hidden));
  });

  panel.addEventListener('click', event => {
    const option = event.target.closest?.('[data-vehicle-id]');
    if (option) { commit(slotOf(option), option.dataset.vehicleId); return; }
    const clear = event.target.closest?.('[data-clear-slot]');
    if (!clear) return;
    const slotIndex = Number(clear.dataset.clearSlot);
    // Clearing empties the slot in place. It must not promote slot 3 into
    // slot 2 — the URL carries position, and a share should survive a clear.
    // It also ends that slot's dropdown session (stale options, a lingering
    // aria-activedescendant), the same as any other commit — close() covers
    // both.
    close(slotIndex);
    onSelect(slotIndex, '');
  });
}
