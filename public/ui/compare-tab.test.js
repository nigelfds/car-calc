import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatValue, renderComparison, renderSlots, renderBench, offScreenNote } from './compare-tab.js';
import { comparisonRows } from '../../calc/spec-compare.js';

const tables = JSON.parse(readFileSync(new URL('../../data/tax-tables.json', import.meta.url), 'utf8'));

const ev5 = {
  id: 'ev5', make: 'Kia', model: 'EV5', variant: 'Air 2WD LR', bodyType: 'SUV', familyId: 'f-ev5',
  listPrice: 61170, batteryKwh: 88.1, rangeKm: 555, consumptionKwhPer100km: 18,
  bootLitresSeatsUp: 513, bootLitresSeatsDown: 1450, seats: 5, towKg: 1250,
  warrantyYears: 7, insuranceAnnual: 1800,
  depreciationCurve: [1, 0.78, 0.66, 0.57, 0.51, 0.47], sourcedAt: '2026-07-27'
};
const sealion = {
  id: 'sl6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic ER', bodyType: 'SUV', familyId: 'f-sl6',
  powertrain: 'phev', listPrice: 46990, batteryKwh: 26.6, rangeKm: 140,
  combinedRangeKm: 1340, consumptionKwhPer100km: 19, fuelConsumptionL100km: 5,
  bootLitresSeatsUp: 425, bootLitresSeatsDown: 1200, seats: 5, towKg: 750,
  warrantyYears: 6, insuranceAnnual: 1500,
  depreciationCurve: [1, 0.72, 0.6, 0.5, 0.46, 0.42], sourcedAt: '2026-07-28'
};
const families = [
  { id: 'f-ev5', summary: 'Roomy electric SUV.', pros: ['Big boot'], cons: ['Slow charging'], sources: ['https://x'] }
];

// The codebase's renderer convention: a stub whose querySelector hands back
// one innerHTML sink per id (see cars.test.js).
function stubRoot() {
  const targets = {};
  return {
    targets,
    querySelector(selector) {
      const id = selector.replace('#', '');
      targets[id] ??= { innerHTML: '' };
      return targets[id];
    }
  };
}

test('a null value renders as an em-dash, not "null"', () => {
  assert.equal(formatValue(null, 'integer', 'km'), '—');
});

test('money, percent and decimals each format their own way', () => {
  assert.equal(formatValue(61170, 'money', ''), '$61,170');
  assert.equal(formatValue(0.47, 'percent', ''), '47%');
  assert.equal(formatValue(88.1, 'decimal1', 'kWh'), '88.1 kWh');
  assert.equal(formatValue(513, 'integer', 'L'), '513 L');
  assert.equal(formatValue('SUV', 'text', ''), 'SUV');
});

test('fewer than two cars gets an empty state rather than half a table', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5], families, tables, benchIndex: null });
  assert.match(root.targets['compare-table'].innerHTML, /Pick a second car/i);
  assert.doesNotMatch(root.targets['compare-table'].innerHTML, /<table/);
});

test('the table carries a column per car and a row per specification', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  assert.match(html, /Kia EV5/);
  assert.match(html, /BYD Sealion 6/);
  assert.match(html, /List price/);
  assert.match(html, /\$61,170/);
  assert.match(html, /\$46,990/);
});

test('the winner is marked on a clean row', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  assert.match(root.targets['compare-table'].innerHTML, /compare-cell--win/);
});

test('a caveated row prints the caveat and marks no winner', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  assert.match(html, /Not like for like/);
  assert.match(html, /Sealion 6/);
  // The total-range row is caveated, so its cells carry no winner class.
  const totalRange = html.split('data-row="totalRange"')[1].split('data-row="')[0];
  assert.doesNotMatch(totalRange, /compare-cell--win/);
});

test('at most two caveats render on one row', () => {
  const ranger = {
    ...sealion, id: 'rgr', make: 'Ford', model: 'Ranger', bodyType: 'Ute', seats: 5,
    bootLitresSeatsUp: 1185, bootLitresSeatsDown: 1185
  };
  const sixSeat = { ...ev5, id: 'my6', seats: 6 };
  const root = stubRoot();
  renderComparison(root, { vehicles: [ranger, sixSeat], families, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  const bootDown = html.split('data-row="bootDown"')[1].split('data-row="')[0];
  // Count rendered caveats via data-caveat="..." rather than /compare-caveat/,
  // which also substring-matches the wrapping <tr>'s compare-caveat-row class
  // (shared with Task 8's off-screen band row) and would double-count.
  assert.ok((bootDown.match(/data-caveat="/g) ?? []).length <= 2);
});

test('pros and cons come from the family record', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  const html = root.targets['compare-prose'].innerHTML;
  assert.match(html, /Big boot/);
  assert.match(html, /Slow charging/);
});

test('a car with no family record still renders its column', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families: [], tables, benchIndex: null });
  assert.match(root.targets['compare-table'].innerHTML, /Kia EV5/);
  assert.doesNotMatch(root.targets['compare-prose'].innerHTML, /undefined/);
});

test('an empty slot renders an input and a filled slot renders a clear button', () => {
  const root = stubRoot();
  renderSlots(root, { slots: ['ev5', '', ''], vehicles: [ev5, sealion] });
  const html = root.targets['compare-slots'].innerHTML;
  assert.match(html, /Kia EV5/);
  assert.match(html, /data-clear-slot="0"/);
  assert.equal((html.match(/compare-slot__input/g) ?? []).length, 2);
});

test('rendered car names are escaped', () => {
  const root = stubRoot();
  const nasty = { ...ev5, model: '<script>x</script>' };
  renderComparison(root, { vehicles: [nasty, sealion], families, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  assert.doesNotMatch(html, /<script>/);
  // Absence alone would also pass if the value were silently dropped —
  // assert the escaped form actually made it through, as autocomplete.test.js
  // does for the same class of input.
  assert.match(html, /&lt;script&gt;/);
});

const cheap = { ...sealion, id: 'chp', make: 'BYD', model: 'Dolphin', powertrain: 'bev',
  listPrice: 29840, combinedRangeKm: undefined, fuelConsumptionL100km: undefined };

test('the benched car is left out of the table', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion, cheap], families, tables, benchIndex: 2 });
  const html = root.targets['compare-table'].innerHTML;
  const head = html.split('<tbody')[0];
  assert.match(html, /Kia EV5/);
  // The benched car gets no column of its own — though (see the next test)
  // it can still be named further down, in an off-screen note.
  assert.doesNotMatch(head, /Dolphin/);
  // Two car columns, not three.
  assert.equal((html.match(/compare-head--/g) ?? []).length, 2);
  // The header check above says nothing about the <tbody>: a row loop that
  // regressed to iterating all three vehicles (while the header stayed fixed)
  // would slip a third, benched <td> onto every data row unnoticed. Anchor on
  // `<td class="compare-cell` (not a bare /compare-cell/g) so a winning cell's
  // extra "compare-cell--win" class doesn't get counted twice.
  const warrantyRow = html.split('data-row="warrantyYears"')[1].split('data-row="')[0];
  assert.equal((warrantyRow.match(/<td class="compare-cell/g) ?? []).length, 2);
});

test('a row the benched car wins says so, and names the number', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion, cheap], families, tables, benchIndex: 2 });
  const html = root.targets['compare-table'].innerHTML;
  const priceRow = html.split('data-row="listPrice"')[1].split('data-row="')[0];
  assert.match(priceRow, /compare-offscreen/);
  assert.match(priceRow, /Dolphin/);
  assert.match(priceRow, /\$29,840/);
});

test('no off-screen note on a row a visible car wins', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion, cheap], families, tables, benchIndex: 2 });
  const html = root.targets['compare-table'].innerHTML;
  const warranty = html.split('data-row="warrantyYears"')[1].split('data-row="')[0];
  assert.doesNotMatch(warranty, /compare-offscreen/);
});

test('a caveated row gets no off-screen note, because it has no winner to report', () => {
  const model = comparisonRows([ev5, sealion, cheap], tables);
  const totalRange = model.groups.flatMap(g => g.rows).find(r => r.key === 'totalRange');
  assert.equal(offScreenNote(totalRange, [ev5, sealion, cheap], 1), null);
});

test('desktop passes no bench and gets no notes at all', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion, cheap], families, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  assert.doesNotMatch(html, /compare-offscreen/);
  assert.match(html, /Dolphin/);
  // All three cars get a column when there is no bench.
  assert.equal((html.match(/compare-head--/g) ?? []).length, 3);
});

test('the bench names the car and flags that it appears in a callout', () => {
  const root = stubRoot();
  const model = comparisonRows([ev5, sealion, cheap], tables);
  renderBench(root, { vehicles: [ev5, sealion, cheap], benchIndex: 2, model });
  const html = root.targets['compare-bench'].innerHTML;
  assert.match(html, /Dolphin/);
  assert.match(html, /data-bench-index="2"/);
  assert.match(html, /compare-chip__dot/);
});

test('the bench is empty when only two cars are being compared', () => {
  const root = stubRoot();
  const model = comparisonRows([ev5, sealion], tables);
  renderBench(root, { vehicles: [ev5, sealion], benchIndex: null, model });
  assert.equal(root.targets['compare-bench'].innerHTML.trim(), '');
});
