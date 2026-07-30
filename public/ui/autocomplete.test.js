import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionsMarkup } from './autocomplete.js';
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
