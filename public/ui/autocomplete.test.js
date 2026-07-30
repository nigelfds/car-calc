import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionsMarkup, renderSuggestions, nextActiveId, bindAutocomplete } from './autocomplete.js';
import { searchVehicles } from './vehicle-search.js';

const fleet = [
  { id: 'ev5-air', make: 'Kia', model: 'EV5', variant: 'Air 2WD LR', listPrice: 61170, bodyType: 'SUV' },
  { id: 'ev5-earth', make: 'Kia', model: 'EV5', variant: 'Earth AWD', listPrice: 64770, bodyType: 'SUV' },
  { id: 'sl6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic', listPrice: 46990, bodyType: 'SUV', powertrain: 'phev' }
];

test('each option carries the id the click handler needs', () => {
  const html = suggestionsMarkup(searchVehicles(fleet, 'ev5'), null);
  assert.match(html, /data-vehicle-id="ev5-air"/);
  assert.match(html, /data-vehicle-id="ev5-earth"/);
});

test('options are grouped under the model name', () => {
  const html = suggestionsMarkup(searchVehicles(fleet, 'ev5'), null);
  assert.match(html, /Kia EV5/);
  assert.equal(html.match(/role="option"/g).length, 2);
});

test('an option shows enough to pick the right trim without leaving the list', () => {
  const html = suggestionsMarkup(searchVehicles(fleet, 'ev5'), null);
  assert.match(html, /Air 2WD LR/);
  assert.match(html, /\$61,170/);
  assert.match(html, /SUV/);
});

test('a plug-in hybrid is badged and a battery-electric car is not', () => {
  assert.match(suggestionsMarkup(searchVehicles(fleet, 'sealion'), null), /PHEV/);
  assert.doesNotMatch(suggestionsMarkup(searchVehicles(fleet, 'ev5'), null), /PHEV/);
});

test('the active option is the only one flagged for the screen reader', () => {
  const html = suggestionsMarkup(searchVehicles(fleet, 'ev5'), 'ev5-earth');
  assert.equal(html.match(/aria-selected="true"/g).length, 1);
  assert.match(html, /id="opt-ev5-earth"[^>]*aria-selected="true"/);
});

test('no matches produces a spoken empty state rather than a blank box', () => {
  const html = suggestionsMarkup([], null);
  assert.match(html, /No car matches/i);
  assert.doesNotMatch(html, /role="option"/);
});

test('markup escapes anything that could close a tag', () => {
  const nasty = [{ modelLabel: '<script>x</script>', items: [
    { id: 'a"b', make: 'X', model: 'Y', variant: '<img>', listPrice: 1, bodyType: 'SUV' }
  ] }];
  const html = suggestionsMarkup(nasty, null);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img>/);
  assert.match(html, /&lt;script&gt;/);
});

// --- renderSuggestions -------------------------------------------------
// Stubbed the same way renderCards is tested (ui/cars.test.js): a fake root
// whose querySelector always returns one fake element, extended with
// `hidden` since that is the property this function's visibility contract
// turns on.
function fakeListbox() {
  let html = '';
  const target = {
    set innerHTML(v) { html = v; },
    get innerHTML() { return html; },
    hidden: true
  };
  return { root: { querySelector: () => target }, target };
}

test('renderSuggestions opens the listbox when there are results', () => {
  const { root, target } = fakeListbox();
  renderSuggestions(root, 0, searchVehicles(fleet, 'ev5'), null);
  assert.equal(target.hidden, false);
  assert.match(target.innerHTML, /role="option"/);
});

test('renderSuggestions defaults the listbox to closed when there are no results', () => {
  // This is the "nothing typed yet" half of the ambiguity documented on the
  // function: on its own, an empty groups array closes the box. The "typed
  // something, found nothing" half is the caller's job (bindAutocomplete's
  // `input` listener) — see the "types a query that matches nothing" test
  // in the bindAutocomplete section below, which now covers it directly.
  const { root, target } = fakeListbox();
  target.hidden = false; // starts open, to prove this call closes it
  renderSuggestions(root, 0, [], null);
  assert.equal(target.hidden, true);
  assert.match(target.innerHTML, /No car matches/i);
});

test('renderSuggestions does nothing when the slot has no listbox in the DOM', () => {
  assert.doesNotThrow(() => renderSuggestions({ querySelector: () => null }, 0, [], null));
});

// --- nextActiveId -------------------------------------------------------
// Pure and DOM-free, extracted from the keydown handler so the wrap-around
// arithmetic can be checked directly rather than only through a browser.
test('nextActiveId wraps from the last option back to the first going down', () => {
  assert.equal(nextActiveId(['a', 'b', 'c'], 'c', 1), 'a');
});

test('nextActiveId wraps from the first option back to the last going up', () => {
  assert.equal(nextActiveId(['a', 'b', 'c'], 'a', -1), 'c');
});

test('nextActiveId lands on the first option going down when nothing is active yet', () => {
  assert.equal(nextActiveId(['a', 'b', 'c'], null, 1), 'a');
});

// Fix 6: the wrap-around formula treated "nothing active" as index -1 on the
// ring, so ArrowUp from nothing landed on the second-to-last option — with
// eight results, option 7 of 8, silently skipping the last. Standard combobox
// behaviour is to land on the last option, mirroring ArrowDown landing on
// the first.
test('nextActiveId lands on the last option going up when nothing is active yet', () => {
  assert.equal(nextActiveId(['a', 'b', 'c'], null, -1), 'c');
  assert.equal(nextActiveId(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], undefined, -1), 'h');
});

test('nextActiveId with a single option always returns that option', () => {
  assert.equal(nextActiveId(['a'], null, 1), 'a');
  assert.equal(nextActiveId(['a'], null, -1), 'a');
  assert.equal(nextActiveId(['a'], 'a', 1), 'a');
  assert.equal(nextActiveId(['a'], 'a', -1), 'a');
});

test('nextActiveId returns null for an empty list', () => {
  assert.equal(nextActiveId([], null, 1), null);
  assert.equal(nextActiveId([], null, -1), null);
});

// --- bindAutocomplete ----------------------------------------------------
// bindAutocomplete delegates from #compare-panel and reads closest() off the
// event target, the same pattern as bindTabs (ui/tabs.js) — and ui/tabs.test.js
// already stubs that pattern with a lightweight closest() that does a direct
// selector check rather than walking a real ancestor chain. This is the same
// harness, sized for three slots instead of two tab buttons: a fake panel
// whose addEventListener records the handler so a test can invoke it
// directly, a fake input per slot with attrs recorded via
// setAttribute/getAttribute/removeAttribute, and a fake listbox per slot
// whose querySelectorAll('[data-vehicle-id]') reads the ids back out of the
// html string renderSuggestions actually wrote (suggestionsMarkup always
// renders them as data-vehicle-id="...", so a regex is enough — no real
// parser needed for these fixtures).
function stubCompareRoot() {
  const listeners = {};
  const panel = { addEventListener(type, handler) { listeners[type] = handler; } };

  const makeInput = slotIndex => {
    const input = {
      value: '',
      attrs: {},
      setAttribute(name, value) { this.attrs[name] = value; },
      getAttribute(name) { return this.attrs[name]; },
      removeAttribute(name) { delete this.attrs[name]; },
      // Mirrors real closest(): matches itself for its own selector, and
      // stands in for the ancestor slot div (which carries data-slot) for
      // slotOf's lookup — there is no real ancestor chain in this stub, so
      // the container is synthesized on demand rather than walked to.
      closest(selector) {
        if (selector === '.compare-slot__input') return input;
        if (selector === '[data-slot]') return { dataset: { slot: String(slotIndex) } };
        return null;
      }
    };
    return input;
  };

  const makeListbox = () => {
    let html = '';
    return {
      hidden: true,
      get innerHTML() { return html; },
      set innerHTML(v) { html = v; },
      querySelectorAll(selector) {
        if (selector !== '[data-vehicle-id]') return [];
        return [...html.matchAll(/data-vehicle-id="([^"]*)"/g)]
          .map(([, id]) => ({ dataset: { vehicleId: id } }));
      }
    };
  };

  const inputs = [0, 1, 2].map(makeInput);
  const listboxes = [0, 1, 2].map(makeListbox);

  return {
    listeners,
    inputs,
    listboxes,
    querySelector(selector) {
      if (selector === '#compare-panel') return panel;
      const inputMatch = selector.match(/^\[data-slot="(\d+)"\] \.compare-slot__input$/);
      if (inputMatch) return inputs[Number(inputMatch[1])];
      const listboxMatch = selector.match(/^#compare-listbox-(\d+)$/);
      if (listboxMatch) return listboxes[Number(listboxMatch[1])];
      return null;
    }
  };
}

// A fake option/clear-button target, standing in for the element a real
// click would report as event.target — matched by whichever selector its
// own data attribute names, and (for an option) also answering slotOf's
// '[data-slot]' lookup the way the input fakes above do.
function fakeOption(slotIndex, vehicleId) {
  return {
    dataset: { vehicleId },
    closest(selector) {
      if (selector === '[data-vehicle-id]') return this;
      if (selector === '[data-slot]') return { dataset: { slot: String(slotIndex) } };
      return null;
    }
  };
}

function fakeClearButton(slotIndex) {
  return {
    dataset: { clearSlot: String(slotIndex) },
    closest(selector) { return selector === '[data-clear-slot]' ? this : null; }
  };
}

test('typing a query that matches something expands the combobox', () => {
  const root = stubCompareRoot();
  bindAutocomplete(root, { getVehicles: () => fleet, onSelect: () => {} });
  root.inputs[0].value = 'ev5';
  root.listeners.input({ target: root.inputs[0] });
  assert.equal(root.listboxes[0].hidden, false);
  assert.equal(root.inputs[0].attrs['aria-expanded'], 'true');
});

test('typing a query that matches nothing still opens the box on the empty state, so it still expands', () => {
  // Confirmed against the actual code rather than assumed: renderSuggestions
  // defaults a zero-result box to closed, but bindAutocomplete's own `input`
  // listener overrides that with `list.hidden = input.value.trim() === ''`
  // right afterward — a non-blank query re-opens it regardless of hit count,
  // so the reader sees "No car matches" rather than a silently closed box.
  const root = stubCompareRoot();
  bindAutocomplete(root, { getVehicles: () => fleet, onSelect: () => {} });
  root.inputs[0].value = 'zzz-no-such-car';
  root.listeners.input({ target: root.inputs[0] });
  assert.equal(root.listboxes[0].hidden, false);
  assert.match(root.listboxes[0].innerHTML, /No car matches/i);
  assert.equal(root.inputs[0].attrs['aria-expanded'], 'true');
});

test('clearing the input back to blank collapses the combobox', () => {
  const root = stubCompareRoot();
  bindAutocomplete(root, { getVehicles: () => fleet, onSelect: () => {} });
  root.inputs[0].value = 'ev5';
  root.listeners.input({ target: root.inputs[0] }); // opens it first
  root.inputs[0].value = '';
  root.listeners.input({ target: root.inputs[0] });
  assert.equal(root.listboxes[0].hidden, true);
  assert.equal(root.inputs[0].attrs['aria-expanded'], 'false');
});

test('Escape collapses the combobox and clears aria-activedescendant', () => {
  const root = stubCompareRoot();
  bindAutocomplete(root, { getVehicles: () => fleet, onSelect: () => {} });
  root.inputs[0].value = 'ev5';
  root.listeners.input({ target: root.inputs[0] });
  root.listeners.keydown({ target: root.inputs[0], key: 'ArrowDown', preventDefault: () => {} });
  assert.equal(root.inputs[0].attrs['aria-activedescendant'], 'opt-ev5-air');

  root.listeners.keydown({ target: root.inputs[0], key: 'Escape' });
  assert.equal(root.inputs[0].attrs['aria-expanded'], 'false');
  assert.equal(root.inputs[0].attrs['aria-activedescendant'], undefined);
  assert.equal(root.listboxes[0].hidden, true);
});

test('selecting an option by click commits it and collapses the combobox', () => {
  const root = stubCompareRoot();
  const selections = [];
  bindAutocomplete(root, { getVehicles: () => fleet, onSelect: (slot, id) => selections.push([slot, id]) });
  root.inputs[0].value = 'ev5';
  root.listeners.input({ target: root.inputs[0] });

  root.listeners.click({ target: fakeOption(0, 'ev5-air') });
  assert.deepEqual(selections, [[0, 'ev5-air']]);
  assert.equal(root.inputs[0].attrs['aria-expanded'], 'false');
});

test('Enter commits the first option when arrow keys never landed on one', () => {
  const root = stubCompareRoot();
  const selections = [];
  bindAutocomplete(root, { getVehicles: () => fleet, onSelect: (slot, id) => selections.push([slot, id]) });
  root.inputs[0].value = 'ev5';
  root.listeners.input({ target: root.inputs[0] });

  let prevented = false;
  root.listeners.keydown({ target: root.inputs[0], key: 'Enter', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(selections, [[0, 'ev5-air']]);
  assert.equal(root.inputs[0].attrs['aria-expanded'], 'false');
});

test('clicking a slot\'s clear button empties that slot without touching the others', () => {
  const root = stubCompareRoot();
  const selections = [];
  bindAutocomplete(root, { getVehicles: () => fleet, onSelect: (slot, id) => selections.push([slot, id]) });
  root.listeners.click({ target: fakeClearButton(1) });
  assert.deepEqual(selections, [[1, '']]);
});

test('bindAutocomplete does nothing when there is no compare panel in the DOM', () => {
  assert.doesNotThrow(() =>
    bindAutocomplete({ querySelector: () => null }, { getVehicles: () => fleet, onSelect: () => {} }));
});
