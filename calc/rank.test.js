import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreVehicle, rankVehicles, bracketAroundPrice, bootReferenceFor } from './rank.js';

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

// Price is the strongest unstated signal: someone who has stated nothing but
// a budget is telling you the budget is what they care about.
test('a cheaper car outscores a dearer one when nothing else is stated', () => {
  assert.ok(
    scoreVehicle(car('cheap', { listPrice: 45000 }), {}) >
    scoreVehicle(car('dear', { listPrice: 75000 }), {})
  );
});

test('price outweighs every other unstated dimension', () => {
  const prefs = {};
  const priceSpread = Math.abs(
    scoreVehicle(car('cheap', { listPrice: 30000 }), prefs) -
    scoreVehicle(car('dear', { listPrice: 90000 }), prefs)
  );
  for (const [name, over] of [
    ['boot', [{ bootLitresSeatsUp: 900 }, { bootLitresSeatsUp: 300 }]],
    ['range', [{ rangeKm: 700 }, { rangeKm: 300 }]],
    ['warranty', [{ warrantyYears: 10 }, { warrantyYears: 3 }]]
  ]) {
    const spread = Math.abs(
      scoreVehicle(car('a', over[0]), prefs) - scoreVehicle(car('b', over[1]), prefs)
    );
    assert.ok(priceSpread > spread, `a $60,000 price gap should beat the ${name} spread`);
  }
});

// A stated boot preference is a direct instruction and still outranks price —
// raising the value weight was meant to stop cheapness being ignored, not to
// start overruling what the user actually asked for.
test('a stated boot preference still outweighs price', () => {
  const prefs = { minBootLitres: 500 };
  assert.ok(
    scoreVehicle(car('roomy-dear', { bootLitresSeatsUp: 800, listPrice: 75000 }), prefs) >
    scoreVehicle(car('small-cheap', { bootLitresSeatsUp: 520, listPrice: 45000 }), prefs)
  );
});

// --- Boot is measured against the pool ------------------------------------
// A fixed 900L ceiling was one outlier's yardstick: in the real SUV pool 94 of
// 97 cars are 603L or less and three Model Y variants sit at 854L, so an
// ordinary 500L boot scored 0.56 and the outlier took a lead nothing could
// close.

test('the boot reference comes from the pool, not a constant', () => {
  const smallFleet = Array.from({ length: 10 }, (_, i) => car(`v${i}`, { bootLitresSeatsUp: 300 + i * 10 }));
  // floor((10 - 1) * 0.9) = index 8 of 300,310,...,390.
  assert.equal(bootReferenceFor(smallFleet), 380, 'the 90th percentile of 300..390');
});

// The whole point: one enormous boot must not rescale everyone else.
test('a single outlier does not drag the reference up', () => {
  const ordinary = Array.from({ length: 20 }, (_, i) => car(`v${i}`, { bootLitresSeatsUp: 400 + i * 5 }));
  const withOutlier = [...ordinary, car('huge', { bootLitresSeatsUp: 1400 })];
  const before = bootReferenceFor(ordinary);
  const after = bootReferenceFor(withOutlier);
  assert.ok(after - before < 60, `reference moved ${before} -> ${after}, an outlier should barely shift it`);
});

test('a pool with no usable boot figures falls back rather than dividing by zero', () => {
  assert.equal(bootReferenceFor([]), 900);
  assert.equal(bootReferenceFor([car('a', { bootLitresSeatsUp: 0 }), car('b', { bootLitresSeatsUp: null })]), 900);
});

test('an ordinary boot scores mid-pack against its pool, not against an outlier', () => {
  const pool = [
    ...Array.from({ length: 9 }, (_, i) => car(`v${i}`, { bootLitresSeatsUp: 450 + i * 15 })),
    car('outlier', { bootLitresSeatsUp: 900 })
  ];
  const prefs = { minBootLitres: 400 };
  const mid = car('mid', { bootLitresSeatsUp: 540 });
  const againstPool = scoreVehicle(mid, prefs, { bootReference: bootReferenceFor(pool) });
  const againstConstant = scoreVehicle(mid, prefs);
  assert.ok(againstPool > againstConstant, 'a pool-relative boot must not be penalised by the outlier');
});

test('scoreVehicle still works with no pool context', () => {
  assert.equal(
    scoreVehicle(car('a', { bootLitresSeatsUp: 450 }), {}),
    scoreVehicle(car('a', { bootLitresSeatsUp: 450 }), {}, { bootReference: 900 })
  );
});

// Ranking must stay a comparison, so cars at or above the reference tie on
// this dimension and are separated by the others.
test('every car in the roomiest tenth is treated as roomy enough', () => {
  const pool = [
    ...Array.from({ length: 8 }, (_, i) => car(`v${i}`, { bootLitresSeatsUp: 300 + i * 20 })),
    car('big', { bootLitresSeatsUp: 700, listPrice: 60000 }),
    car('bigger', { bootLitresSeatsUp: 900, listPrice: 60000 })
  ];
  const ctx = { bootReference: bootReferenceFor(pool) };
  const prefs = { minBootLitres: 400 };
  assert.equal(
    scoreVehicle(pool.at(-1), prefs, ctx),
    scoreVehicle(pool.at(-2), prefs, ctx),
    '700L and 900L are both past the reference, so neither out-boots the other'
  );
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

test('the SUV + 500L shortlist scenario: five cards do not all share one reason', () => {
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
  const shortlist = bracketAroundPrice(ranked, 56000).map(b => b.entry);

  assert.equal(shortlist.length, 5);

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
  assert.deepEqual(bands.map(b => b.band), ['at', 'below', 'above']);
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
  assert.deepEqual(bands.map(b => b.band), ['at', 'below']);
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
  // At-budget first: those are the answer to the question the page asked.
  // Cheaper alternatives follow, then the stretch.
  assert.deepEqual(bands.map(b => b.band), ['at', 'at', 'below', 'below', 'above']);
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

test('the at-budget band leads, then cheaper, then the stretch', () => {
  const ranked = rankVehicles([
    priced('under', 47000), priced('spot-on', 53000), priced('stretch', 60000)
  ], {}, 3);
  assert.deepEqual(
    bracketAroundPrice(ranked, 53000).map(b => b.band),
    ['at', 'below', 'above']
  );
});

// --- Bands fill from variants, not from pre-collapsed families ------------
// The shortlist used to collapse each family to its single best-scoring
// variant BEFORE bracketing, which starved the bands: a family whose best
// variant sits under budget could never supply the stretch card, even when it
// had a variant sitting squarely in that band. With SUV, 400L and 5 seats
// selected the real dataset offered 7 at-budget variants, 33 below and 4
// above, and the page rendered three cards.

const trim = (id, familyId, listPrice, over = {}) =>
  car(id, { familyId, listPrice, ...over });

test('a family can supply the stretch card even when its cheap trim is under budget', () => {
  const ranked = rankVehicles([
    trim('ev6-air', 'kia-ev6', 72000),
    trim('ev6-gt', 'kia-ev6', 99000),
    trim('other', 'other-fam', 86000)
  ], {}, 3);
  const bands = bracketAroundPrice(ranked, 86643, { counts: { below: 1, at: 1, above: 1 } });
  assert.ok(bands.some(b => b.band === 'above'),
    'the GT trim is in the stretch band and must be reachable');
});

// Within a band, two trims of one car at nearly the same price would just be
// the same recommendation twice.
test('a band never shows two trims of the same family', () => {
  const ranked = rankVehicles([
    trim('a1', 'fam-a', 84000), trim('a2', 'fam-a', 86000),
    trim('b1', 'fam-b', 85000)
  ], {}, 3);
  const bands = bracketAroundPrice(ranked, 86643, { counts: { below: 0, at: 2, above: 0 } });
  const families = bands.map(b => b.entry.vehicle.familyId);
  assert.deepEqual(new Set(families).size, families.length, `repeated family in ${families}`);
  assert.equal(bands.length, 2, 'the second slot goes to a different family');
});

// Across bands it is allowed, and wanted: the cheap trim and the expensive
// trim of one car are different propositions at different price points.
test('the same family may appear in two different bands', () => {
  const ranked = rankVehicles([
    trim('ev6-air', 'kia-ev6', 72000),
    trim('ev6-gt', 'kia-ev6', 99000)
  ], {}, 2);
  const bands = bracketAroundPrice(ranked, 86643, { counts: { below: 1, at: 1, above: 1 } });
  assert.deepEqual(bands.map(b => b.band), ['below', 'above']);
});

test('cards come back in display order: at budget, then below, then stretch', () => {
  const ranked = rankVehicles([
    trim('a-at', 'fam-a', 86000),
    trim('b-below', 'fam-b', 71000),
    trim('c-above', 'fam-c', 98000)
  ], {}, 3);
  const bands = bracketAroundPrice(ranked, 86643, { counts: { below: 1, at: 1, above: 1 } });
  assert.deepEqual(bands.map(b => b.entry.vehicle.id), ['a-at', 'b-below', 'c-above']);
});

test('each card still reports its family\'s other trims and their cheapest price', () => {
  const ranked = rankVehicles([
    trim('g6-a', 'xpeng-g6', 86000),
    trim('g6-b', 'xpeng-g6', 88000),
    trim('g6-c', 'xpeng-g6', 84000)
  ], {}, 3);
  const bands = bracketAroundPrice(ranked, 86643, { counts: { below: 0, at: 1, above: 0 } });
  assert.equal(bands.length, 1);
  // Which trim wins the slot is the ranker's call, so derive the expectation
  // from the one it picked rather than assuming.
  const chosen = bands[0].entry.vehicle.id;
  const others = [['g6-a', 86000], ['g6-b', 88000], ['g6-c', 84000]].filter(([id]) => id !== chosen);
  assert.deepEqual(bands[0].entry.otherTrims, {
    count: 2,
    fromPrice: Math.min(...others.map(([, price]) => price))
  });
});

test('a family with a single matching variant reports no other trims', () => {
  const ranked = rankVehicles([trim('solo', 'fam-solo', 86000)], {}, 1);
  const bands = bracketAroundPrice(ranked, 86643, { counts: { below: 0, at: 1, above: 0 } });
  assert.equal(bands[0].entry.otherTrims, null);
});

// Fixtures elsewhere in this file build vehicles with no familyId at all, and
// they must not all collapse into one notional family.
test('vehicles without a familyId are treated as distinct', () => {
  const ranked = rankVehicles([priced('a', 84000), priced('b', 86000)], {}, 2);
  const bands = bracketAroundPrice(ranked, 86643, { counts: { below: 0, at: 2, above: 0 } });
  assert.equal(bands.length, 2);
});
