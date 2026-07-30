import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionsMarkup, renderSuggestions, nextActiveId } from './autocomplete.js';
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
  // `input` listener), verified in the browser during Task 9 since it needs
  // a real input element and DOM.
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
