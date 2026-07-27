import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreVehicle, rankVehicles, collapseToTopPerFamily, bracketAroundPrice } from './rank.js';

const car = (id, over = {}) => ({
  id, listPrice: 55000, bootLitresSeatsUp: 450, rangeKm: 450,
  warrantyYears: 5, seats: 5, bodyType: 'SUV', ...over
});

test('a bigger boot scores higher when boot space is wanted', () => {
  const prefs = { minBootLitres: 500 };
  assert.ok(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), prefs) >
    scoreVehicle(car('small', { bootLitresSeatsUp: 520 }), prefs)
  );
});

test('boot space barely matters when it was never mentioned', () => {
  const prefs = {};
  const spread = Math.abs(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), prefs) -
    scoreVehicle(car('small', { bootLitresSeatsUp: 300 }), prefs)
  );
  const bootSpread = Math.abs(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), { minBootLitres: 500 }) -
    scoreVehicle(car('small', { bootLitresSeatsUp: 300 }), { minBootLitres: 500 })
  );
  assert.ok(spread < bootSpread, 'an unstated preference carries less weight');
});

test('longer range scores higher when range is wanted', () => {
  const prefs = { minRangeKm: 400 };
  assert.ok(
    scoreVehicle(car('far', { rangeKm: 600 }), prefs) >
    scoreVehicle(car('near', { rangeKm: 410 }), prefs)
  );
});

test('ranking is deterministic — same input, same order, every time', () => {
  const fleet = [car('a'), car('b', { bootLitresSeatsUp: 600 }), car('c', { rangeKm: 520 })];
  const prefs = { minBootLitres: 500, minRangeKm: 400 };
  const first = rankVehicles(fleet, prefs).map(r => r.vehicle.id);
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(rankVehicles(fleet, prefs).map(r => r.vehicle.id), first);
  }
});

test('ranking respects the limit', () => {
  const fleet = Array.from({ length: 12 }, (_, i) => car(`v${i}`));
  assert.equal(rankVehicles(fleet, {}, 3).length, 3);
});

test('each result carries human-readable reasons', () => {
  const ranked = rankVehicles([car('a', { bootLitresSeatsUp: 700 })], { minBootLitres: 500 });
  assert.ok(Array.isArray(ranked[0].reasons));
  assert.ok(ranked[0].reasons.length > 0);
  assert.equal(typeof ranked[0].reasons[0], 'string');
});

test('an empty fleet ranks to an empty list', () => {
  assert.deepEqual(rankVehicles([], { minBootLitres: 500 }), []);
});

test('ties break on a stable, documented rule rather than array order', () => {
  const fleet = [car('zzz'), car('aaa')];
  assert.deepEqual(rankVehicles(fleet, {}).map(r => r.vehicle.id), ['aaa', 'zzz']);
});

// --- collapseToTopPerFamily -------------------------------------------------

test('collapsing keeps only the highest-scoring variant per family', () => {
  const fleet = [
    car('g6-a', { familyId: 'xpeng-g6', bootLitresSeatsUp: 571, listPrice: 55000 }),
    car('g6-b', { familyId: 'xpeng-g6', bootLitresSeatsUp: 571, listPrice: 60000 }),
    car('g6-c', { familyId: 'xpeng-g6', bootLitresSeatsUp: 571, listPrice: 65000 }),
    car('g6-d', { familyId: 'xpeng-g6', bootLitresSeatsUp: 571, listPrice: 70000 }),
    car('model-y', { familyId: 'tesla-model-y', bootLitresSeatsUp: 500, listPrice: 58000 })
  ];
  const prefs = { minBootLitres: 500 };
  const ranked = rankVehicles(fleet, prefs, fleet.length);
  const collapsed = collapseToTopPerFamily(ranked, 5);

  assert.equal(collapsed.length, 2, 'one card per family, not one per variant');
  const familyIds = collapsed.map(entry => entry.vehicle.familyId);
  assert.deepEqual(new Set(familyIds), new Set(['xpeng-g6', 'tesla-model-y']));

  // Among identical boots, value (cheaper is better) breaks the tie, so the
  // cheapest G6 variant should be the one that survives.
  const g6Entry = collapsed.find(entry => entry.vehicle.familyId === 'xpeng-g6');
  assert.equal(g6Entry.vehicle.id, 'g6-a');
});

test('collapsing then slicing to N still returns N distinct families when enough exist', () => {
  const fleet = [
    car('g6-a', { familyId: 'xpeng-g6', listPrice: 50000 }),
    car('g6-b', { familyId: 'xpeng-g6', listPrice: 55000 }),
    car('g6-c', { familyId: 'xpeng-g6', listPrice: 60000 }),
    car('y-a', { familyId: 'tesla-model-y', listPrice: 58000 }),
    car('ev5-a', { familyId: 'kia-ev5', listPrice: 56000 }),
    car('atto3-a', { familyId: 'byd-atto3', listPrice: 45000 })
  ];
  const ranked = rankVehicles(fleet, {}, fleet.length);
  const collapsed = collapseToTopPerFamily(ranked, 3);
  assert.equal(collapsed.length, 3);
  assert.equal(new Set(collapsed.map(e => e.vehicle.familyId)).size, 3, 'no family repeats');
});

test('a surviving card reports how many other trims its family has and their cheapest price', () => {
  const fleet = [
    car('g6-a', { familyId: 'xpeng-g6', listPrice: 50000 }),
    car('g6-b', { familyId: 'xpeng-g6', listPrice: 55000 }),
    car('g6-c', { familyId: 'xpeng-g6', listPrice: 51800 }),
    car('y-a', { familyId: 'tesla-model-y', listPrice: 58000 })
  ];
  const ranked = rankVehicles(fleet, {}, fleet.length);
  const collapsed = collapseToTopPerFamily(ranked, 5);

  const g6Entry = collapsed.find(entry => entry.vehicle.familyId === 'xpeng-g6');
  assert.deepEqual(g6Entry.otherTrims, { count: 2, fromPrice: 51800 });

  const yEntry = collapsed.find(entry => entry.vehicle.familyId === 'tesla-model-y');
  assert.equal(yEntry.otherTrims, null, 'a family with only one matching variant gets no "other trims" line');
});

test('otherTrims is derived from the full filtered set, not the collapsed list', () => {
  // Even though only one xpeng-g6 card survives collapsing, the count of
  // "other trims" must reflect all four matching variants that were passed
  // in, not the single survivor.
  const fleet = Array.from({ length: 4 }, (_, i) =>
    car(`g6-${i}`, { familyId: 'xpeng-g6', listPrice: 50000 + i * 1000 })
  );
  const ranked = rankVehicles(fleet, {}, fleet.length);
  const collapsed = collapseToTopPerFamily(ranked, 5);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].otherTrims.count, 3);
  assert.equal(collapsed[0].otherTrims.fromPrice, 51000);
});

test('collapsing is deterministic — same input, same collapsed order, every time', () => {
  const fleet = [
    car('g6-a', { familyId: 'xpeng-g6', listPrice: 50000 }),
    car('g6-b', { familyId: 'xpeng-g6', listPrice: 55000 }),
    car('y-a', { familyId: 'tesla-model-y', listPrice: 58000 }),
    car('ev5-a', { familyId: 'kia-ev5', listPrice: 56000 })
  ];
  const ranked = rankVehicles(fleet, {}, fleet.length);
  const first = collapseToTopPerFamily(ranked, 5).map(e => e.vehicle.id);
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(collapseToTopPerFamily(ranked, 5).map(e => e.vehicle.id), first);
  }
});

test('collapsing an empty ranked list returns an empty list', () => {
  assert.deepEqual(collapseToTopPerFamily([], 5), []);
});

// --- reasonsFor --------------------------------------------------------------

test('two cars with different strengths produce different reasons', () => {
  const fleet = [
    car('big-boot', { familyId: 'fam-a', bootLitresSeatsUp: 900, rangeKm: 420, listPrice: 60000 }),
    car('long-range', { familyId: 'fam-b', bootLitresSeatsUp: 460, rangeKm: 680, listPrice: 60000 }),
    car('plain-1', { familyId: 'fam-c', bootLitresSeatsUp: 470, rangeKm: 430, listPrice: 59000 }),
    car('plain-2', { familyId: 'fam-d', bootLitresSeatsUp: 465, rangeKm: 425, listPrice: 61000 })
  ];
  const ranked = rankVehicles(fleet, { minBootLitres: 450 }, fleet.length);
  const byId = Object.fromEntries(ranked.map(r => [r.vehicle.id, r.reasons]));

  assert.notDeepEqual(byId['big-boot'], byId['long-range']);
  assert.ok(byId['big-boot'].some(r => /boot/.test(r)), 'the big-boot car should mention its boot');
  assert.ok(byId['long-range'].some(r => /range/.test(r)), 'the long-range car should mention its range');
});

test('reasons no longer just echo the user\'s own filter numbers back at them', () => {
  const fleet = [
    car('a', { familyId: 'fam-a', bootLitresSeatsUp: 520 }),
    car('b', { familyId: 'fam-b', bootLitresSeatsUp: 530 })
  ];
  const prefs = { minBootLitres: 500 };
  const ranked = rankVehicles(fleet, prefs, fleet.length);
  for (const entry of ranked) {
    for (const reason of entry.reasons) {
      assert.ok(!reason.includes('more than you asked for'), `reason "${reason}" still echoes the filter`);
    }
  }
});

test('the SUV + 500L shortlist scenario: five collapsed cards do not all share one reason', () => {
  // Regression for the exact bug report: four near-identical XPeng G6 trims
  // used to fill four of five slots with an identical reason string.
  const g6 = (id, over) => car(id, { familyId: 'xpeng-g6', bodyType: 'SUV', bootLitresSeatsUp: 571, rangeKm: 505, ...over });
  const fleet = [
    car('tesla-model-y', { familyId: 'tesla-model-y', bodyType: 'SUV', bootLitresSeatsUp: 500, rangeKm: 533, listPrice: 68000 }),
    g6('g6-rwd-lr', { listPrice: 51800 }),
    g6('g6-rwd-sr', { listPrice: 48800 }),
    g6('g6-awd-perf', { listPrice: 58800 }),
    g6('g6-awd-perf-black', { listPrice: 61800 }),
    car('kia-ev5', { familyId: 'kia-ev5', bodyType: 'SUV', bootLitresSeatsUp: 513, rangeKm: 470, listPrice: 56000 }),
    car('byd-atto3', { familyId: 'byd-atto3', bodyType: 'SUV', bootLitresSeatsUp: 500, rangeKm: 420, listPrice: 44000 }),
    car('hyundai-ioniq5', { familyId: 'hyundai-ioniq5', bodyType: 'SUV', bootLitresSeatsUp: 527, rangeKm: 488, warrantyYears: 8, listPrice: 72000 })
  ];
  const prefs = { minBootLitres: 500, bodyTypes: ['SUV'] };
  const ranked = rankVehicles(fleet, prefs, fleet.length);
  const shortlist = collapseToTopPerFamily(ranked, 5);

  assert.equal(shortlist.length, 5);
  assert.equal(new Set(shortlist.map(e => e.vehicle.familyId)).size, 5, 'five distinct families');

  const firstReasons = shortlist.map(e => e.reasons[0]);
  assert.notEqual(new Set(firstReasons).size, 1, 'not every card should share the same headline reason');
});

// --- Bracketing the shortlist around the affordable ceiling --------------
// Section 3 no longer shows "the five best matches". It answers a narrower,
// more useful question: given the dearest car the winning payment option
// reaches, what is the best car just under that price, at it, and one step
// beyond it if you stretched?

const priced = (id, listPrice) => car(id, { listPrice });

test('the three bands sit below, at and above the anchor price', () => {
  const ranked = rankVehicles(
    [priced('a', 48000), priced('b', 60000), priced('c', 72000)],
    {}, 3
  );
  const bands = bracketAroundPrice(ranked, 60000);
  assert.deepEqual(bands.map(b => b.band), ['below', 'at', 'above']);
  assert.equal(bands.find(b => b.band === 'at').entry.vehicle.id, 'b');
  assert.equal(bands.find(b => b.band === 'below').entry.vehicle.id, 'a');
  assert.equal(bands.find(b => b.band === 'above').entry.vehicle.id, 'c');
});

test('a car within the tolerance of the anchor counts as "at", not "below"', () => {
  // 58,000 is inside 5% of 60,000, so it is at the ceiling, not under it.
  const ranked = rankVehicles([priced('near', 58000)], {}, 1);
  const bands = bracketAroundPrice(ranked, 60000);
  assert.equal(bands.length, 1);
  assert.equal(bands[0].band, 'at');
});

test('a band fills in rank order, best car first', () => {
  // Same price bracket, different quality. The band takes two cards, and the
  // better car must be the first of them rather than the nearer-priced one.
  const ranked = rankVehicles([
    car('poor', { listPrice: 48000, bootLitresSeatsUp: 200, rangeKm: 250 }),
    car('good', { listPrice: 49000, bootLitresSeatsUp: 600, rangeKm: 600 })
  ], {}, 2);
  const bands = bracketAroundPrice(ranked, 60000);
  assert.deepEqual(bands.map(b => b.band), ['below', 'below']);
  assert.equal(bands[0].entry.vehicle.id, 'good', 'the better car leads the band');
});

test('missing bands are omitted rather than padded', () => {
  // Nothing above the anchor at all.
  const ranked = rankVehicles([priced('a', 48000), priced('b', 60000)], {}, 2);
  const bands = bracketAroundPrice(ranked, 60000);
  assert.deepEqual(bands.map(b => b.band), ['below', 'at']);
});

test('an empty pool produces no bands rather than throwing', () => {
  assert.deepEqual(bracketAroundPrice([], 60000), []);
});

test('no car is used twice across the bands', () => {
  const ranked = rankVehicles(
    [priced('a', 40000), priced('b', 60000), priced('c', 90000)],
    {}, 3
  );
  const ids = bracketAroundPrice(ranked, 60000).map(b => b.entry.vehicle.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('a car far outside the window belongs to no band', () => {
  // A $62,000 car against a $37,000 ceiling is a fantasy, not a stretch.
  const ranked = rankVehicles([priced('miles-away', 62000)], {}, 1);
  assert.deepEqual(bracketAroundPrice(ranked, 37000), []);
});

test('the stretch card is a near miss, not the best car at any price', () => {
  const ranked = rankVehicles([
    car('reachable-stretch', { listPrice: 44000, bootLitresSeatsUp: 400 }),
    car('dream-car', { listPrice: 90000, bootLitresSeatsUp: 900, rangeKm: 700 })
  ], {}, 2);
  const bands = bracketAroundPrice(ranked, 37000);
  const above = bands.find(b => b.band === 'above');
  assert.ok(above, 'expected a stretch card');
  assert.equal(above.entry.vehicle.id, 'reachable-stretch',
    'the far better but far dearer car must not take the stretch slot');
});

test('the window is configurable for callers that want a wider net', () => {
  const ranked = rankVehicles([priced('far', 62000)], {}, 1);
  assert.deepEqual(bracketAroundPrice(ranked, 37000, { window: 0.8 }).map(b => b.band), ['above']);
});

// --- Band counts -----------------------------------------------------------
// Five cards rather than three: two just under the ceiling, two at it, and one
// stretch. Two at the ceiling gives the price point the user can actually
// reach a genuine choice rather than a single take-it-or-leave-it.

test('the bracket returns two below, two at and one above', () => {
  const ranked = rankVehicles([
    priced('b1', 46000), priced('b2', 47000),
    priced('a1', 53000), priced('a2', 53500),
    priced('x1', 60000), priced('x2', 61000)
  ], {}, 6);
  const bands = bracketAroundPrice(ranked, 53000, { counts: { below: 2, at: 2, above: 1 } });
  assert.deepEqual(bands.map(b => b.band), ['below', 'below', 'at', 'at', 'above']);
  assert.equal(new Set(bands.map(b => b.entry.vehicle.id)).size, 5, 'no car appears twice');
});

test('two below, two at and one above is the default', () => {
  const ranked = rankVehicles([
    priced('b1', 46000), priced('b2', 47000),
    priced('a1', 53000), priced('a2', 53500),
    priced('x1', 60000)
  ], {}, 5);
  assert.equal(bracketAroundPrice(ranked, 53000).length, 5);
});

test('a band short of cars yields fewer cards rather than borrowing from another', () => {
  const ranked = rankVehicles([priced('a1', 53000)], {}, 1);
  const bands = bracketAroundPrice(ranked, 53000, { counts: { below: 2, at: 2, above: 1 } });
  assert.deepEqual(bands.map(b => b.band), ['at']);
});

test('each band still takes its best-ranked cars, not the closest priced', () => {
  const ranked = rankVehicles([
    car('poor', { listPrice: 48000, bootLitresSeatsUp: 200, rangeKm: 250 }),
    car('good', { listPrice: 49000, bootLitresSeatsUp: 600, rangeKm: 600 }),
    car('best', { listPrice: 47500, bootLitresSeatsUp: 700, rangeKm: 650 })
  ], {}, 3);
  const bands = bracketAroundPrice(ranked, 60000, { counts: { below: 2, at: 2, above: 1 } });
  assert.deepEqual(bands.map(b => b.entry.vehicle.id), ['best', 'good'],
    'the two best in the band, in rank order');
});
