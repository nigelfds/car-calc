import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  filterVehicles, cardModel, renderCards, datasetStats, diagnoseEmptyFilters
} from './cars.js';
import { valueRatio } from '../../calc/compare.js';
import { rankVehicles } from '../../calc/rank.js';

const fleet = [
  { id: 'a', familyId: 'fa', make: 'Kia', model: 'EV5', bodyType: 'SUV', bootLitresSeatsUp: 513, rangeKm: 400, seats: 5, listPrice: 56000 },
  { id: 'b', familyId: 'fb', make: 'BYD', model: 'Dolphin', bodyType: 'Hatch', bootLitresSeatsUp: 345, rangeKm: 340, seats: 5, listPrice: 34000 }
];
const families = [
  { id: 'fa', summary: 'Roomy electric SUV.', pros: ['Big boot'], cons: ['Slow charging'], sources: ['https://x'], images: ['https://press/a.jpg'] }
];

test('body type filters the fleet', () => {
  assert.deepEqual(filterVehicles(fleet, { bodyTypes: ['SUV'] }).map(v => v.id), ['a']);
});

test('a boot minimum excludes cars that fall short', () => {
  assert.deepEqual(filterVehicles(fleet, { minBootLitres: 500 }).map(v => v.id), ['a']);
});

test('filters combine', () => {
  assert.equal(filterVehicles(fleet, { bodyTypes: ['SUV'], minRangeKm: 500 }).length, 0);
});

test('an empty filter returns everything', () => {
  assert.equal(filterVehicles(fleet, {}).length, 2);
});

// --- Which filter is doing the excluding -----------------------------------
// "Try relaxing one" left the reader to bisect five filters by hand. The
// diagnosis drops each active filter in turn and reports the one that alone
// brings the list back, with a value read off the data rather than guessed.

test('nothing to diagnose while the list has cars in it', () => {
  assert.equal(diagnoseEmptyFilters(fleet, { bodyTypes: ['SUV'] }), null);
});

test('the binding filter is named, with the value that would work', () => {
  // Nothing has a 600L boot; the roomiest is the EV5 at 513L.
  const d = diagnoseEmptyFilters(fleet, { minBootLitres: 600 });
  assert.equal(d.field, 'minBootLitres');
  assert.equal(d.suggestion, '513L');
  assert.equal(d.count, 2);
});

// The suggestion has to be reachable with the OTHER filters still applied, not
// across the whole fleet — otherwise it names a value that still returns nothing.
test('the suggested value respects the filters that are staying', () => {
  const d = diagnoseEmptyFilters(fleet, { bodyTypes: ['Hatch'], minBootLitres: 600 });
  assert.equal(d.field, 'minBootLitres');
  // The Hatch's 345L, not the SUV's 513L, because Hatch is still selected.
  assert.equal(d.suggestion, '345L');
  assert.equal(d.count, 1);
});

test('a body type nothing satisfies is named as the body type', () => {
  const d = diagnoseEmptyFilters(fleet, { bodyTypes: ['Ute'] });
  assert.equal(d.field, 'bodyTypes');
  assert.equal(d.count, 2);
});

// Two jointly-binding filters have no single fix, and saying "ease one" would be
// wrong. The caller falls back to advice that admits it.
test('no candidate is returned when no single filter unblocks the list', () => {
  const d = diagnoseEmptyFilters(fleet, { bodyTypes: ['Ute'], minBootLitres: 600 });
  assert.equal(d, null);
});

// Where two filters are each individually binding, the one reported is the
// relaxation that opens the list widest — the change that costs the reader
// least. Needs a fixture where the two relaxations differ in what they return,
// which the two-car fleet above cannot produce.
test('the relaxation that opens the list widest is the one reported', () => {
  const wider = [
    ...fleet,
    { id: 'c', bodyType: 'SUV', bootLitresSeatsUp: 400, rangeKm: 500, seats: 7 },
    { id: 'd', bodyType: 'SUV', bootLitresSeatsUp: 520, rangeKm: 450, seats: 5 }
  ];
  // Boot >= 500 and seats >= 7 together match nothing: the two roomy cars seat
  // five, and the seven-seater has a 400L boot.
  const d = diagnoseEmptyFilters(wider, { minBootLitres: 500, seats: 7 });
  // Dropping the seat minimum returns two cars (a at 513L, d at 520L); dropping
  // the boot minimum returns only the seven-seater. So the seat minimum is the
  // one worth naming.
  assert.equal(d.field, 'seats');
  assert.equal(d.count, 2);
  assert.equal(d.suggestion, '5 seats');
});

// --- Plug-in hybrids in the filter -----------------------------------------
// A PHEV row carries powertrain: 'phev' plus a combined (tank+battery) range;
// everything else in data/schema.js's 114 existing rows omits powertrain and
// is a BEV by default.

// consumptionKwhPer100km, insuranceAnnual, fuelConsumptionL100km and
// depreciationCurve are not part of the brief's filter fixtures, but the
// cardModel tests below feed these same fixtures through optionCosts, which
// needs them to produce real numbers (resaleValue reads depreciationCurve.length
// unconditionally). Added here rather than duplicating a second pair of
// fixtures, and overridable via `over` like everything else.
const phev = (over = {}) => ({
  id: 'p1', familyId: 'p', make: 'Test', model: 'PHEV', variant: 'Base',
  bodyType: 'SUV', powertrain: 'phev', listPrice: 60000,
  rangeKm: 84, combinedRangeKm: 760, bootLitresSeatsUp: 500, seats: 5,
  consumptionKwhPer100km: 16, fuelConsumptionL100km: 1.8, insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47], ...over
});
const bev = (over = {}) => ({
  id: 'b1', familyId: 'b', make: 'Test', model: 'BEV', variant: 'Base',
  bodyType: 'SUV', listPrice: 60000, rangeKm: 450,
  bootLitresSeatsUp: 500, seats: 5,
  consumptionKwhPer100km: 16, insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47], ...over
});

test('plug-in hybrids are excluded unless asked for', () => {
  const out = filterVehicles([bev(), phev()], { includePhev: false });
  assert.deepEqual(out.map(v => v.id), ['b1']);
});

test('plug-in hybrids appear when asked for', () => {
  const out = filterVehicles([bev(), phev()], { includePhev: true });
  assert.deepEqual(out.map(v => v.id), ['b1', 'p1']);
});

// A user asking for 400km means "before I have to stop", and a PHEV genuinely
// does that on a tank. Judging it on its 84km electric range would exclude
// every plug-in hybrid from any range filter worth setting.
test('the range filter judges a PHEV on combined range, not electric range', () => {
  const out = filterVehicles([phev()], { includePhev: true, minRangeKm: 400 });
  assert.deepEqual(out.map(v => v.id), ['p1'], '760km combined clears a 400km bar');
});

test('a BEV is still judged on its own range', () => {
  assert.equal(filterVehicles([bev({ rangeKm: 300 })], { minRangeKm: 400 }).length, 0);
});

test('a PHEV whose combined range is short is still excluded', () => {
  const out = filterVehicles([phev({ combinedRangeKm: 350 })], { includePhev: true, minRangeKm: 400 });
  assert.equal(out.length, 0);
});

// The separate control, for someone buying a PHEV to commute on electricity.
test('the electric-range filter judges a PHEV on its electric range', () => {
  assert.equal(filterVehicles([phev({ rangeKm: 84 })], { includePhev: true, minElectricRangeKm: 60 }).length, 1);
  assert.equal(filterVehicles([phev({ rangeKm: 42 })], { includePhev: true, minElectricRangeKm: 60 }).length, 0);
});

// A BEV's electric range is its whole range, so this filter would silently
// become a second, stricter minRangeKm for every EV on the list.
test('the electric-range filter never applies to a BEV', () => {
  const out = filterVehicles([bev({ rangeKm: 450 })], { includePhev: true, minElectricRangeKm: 600 });
  assert.deepEqual(out.map(v => v.id), ['b1']);
});

test('a card carries its family review when one exists', () => {
  const card = cardModel(fleet[0], families);
  assert.equal(card.summary, 'Roomy electric SUV.');
  assert.deepEqual(card.pros, families[0].pros ?? []);
});

test('a card without a family still renders', () => {
  const card = cardModel(fleet[1], families);
  assert.equal(card.summary, null);
  assert.equal(card.make, 'BYD');
});

// Car imagery is gone from the UI: no photography, and no body-type
// silhouette standing in for it. A family may still carry an `images` array
// in the data (the schema keeps it optional), but the card model must not
// surface it, or a future renderer will silently start painting cars again.
test('the card model does not carry an image, even when the family has one', () => {
  const withImages = [{ ...families[0], images: ['https://press/a.jpg'] }];
  const card = cardModel(fleet[0], withImages);
  assert.equal(card.image, undefined);
  assert.ok(!('image' in card), 'cardModel must not expose an image field');
});

// --- Dataset stats in the header -----------------------------------------
// Written from the data rather than typed into the markup, so the counts
// cannot drift from what actually ships.

test('the stats line counts brands, models and variants and dates the data', () => {
  const stats = datasetStats({
    vehicles: [
      { familyId: 'a', make: 'Kia', sourcedAt: '2026-07-26' },
      { familyId: 'a', make: 'Kia', sourcedAt: '2026-07-27' },
      { familyId: 'b', make: 'BYD', sourcedAt: '2026-07-20' }
    ],
    families: [{ id: 'a' }, { id: 'b' }]
  });
  assert.equal(stats.brands, 2);
  assert.equal(stats.models, 2);
  assert.equal(stats.variants, 3);
  assert.equal(stats.updated, 'July 2026');
});

test('the date is the most recent sourcedAt, not the first or the clock', () => {
  const stats = datasetStats({
    vehicles: [
      { familyId: 'a', sourcedAt: '2025-02-10' },
      { familyId: 'a', sourcedAt: '2026-11-03' }
    ],
    families: [{ id: 'a' }]
  });
  assert.equal(stats.updated, 'November 2026');
});

test('missing or malformed dates do not produce an Invalid Date', () => {
  const stats = datasetStats({
    vehicles: [{ familyId: 'a' }, { familyId: 'a', sourcedAt: 'not-a-date' }],
    families: [{ id: 'a' }]
  });
  assert.equal(stats.updated, null);
  assert.equal(stats.variants, 2);
});

test('an empty dataset reports zeroes rather than throwing', () => {
  const stats = datasetStats({ vehicles: [], families: [] });
  assert.equal(stats.brands, 0);
  assert.equal(stats.models, 0);
  assert.equal(stats.variants, 0);
  assert.equal(stats.updated, null);
});

// Brands and models are different counts and must not be confused: the header
// said "40 cars" for what was really 40 models across 24 brands.
test('one brand with several models counts once as a brand', () => {
  const stats = datasetStats({
    vehicles: [
      { familyId: 'ev3', make: 'Kia', sourcedAt: '2026-07-27' },
      { familyId: 'ev5', make: 'Kia', sourcedAt: '2026-07-27' },
      { familyId: 'ev6', make: 'Kia', sourcedAt: '2026-07-27' }
    ],
    families: [{ id: 'ev3' }, { id: 'ev5' }, { id: 'ev6' }]
  });
  assert.equal(stats.brands, 1);
  assert.equal(stats.models, 3);
  assert.equal(stats.variants, 3);
});

// Same rule as models: a brand present only in families.json, with no rows
// behind it, is one this site cannot show you a car from.
test('a brand with no variants is not counted', () => {
  const stats = datasetStats({
    vehicles: [{ familyId: 'a', make: 'Kia', sourcedAt: '2026-07-27' }],
    families: [{ id: 'a', make: 'Kia' }, { id: 'orphan', make: 'Rivian' }]
  });
  assert.equal(stats.brands, 1, 'Rivian has no variants to show');
});

test('a vehicle with no make does not count as a brand', () => {
  const stats = datasetStats({
    vehicles: [{ familyId: 'a', make: 'Kia' }, { familyId: 'b' }],
    families: [{ id: 'a' }, { id: 'b' }]
  });
  assert.equal(stats.brands, 1);
});

test('models counts families that actually have variants', () => {
  // A family with no rows is not a car anyone can be shown.
  const stats = datasetStats({
    vehicles: [{ familyId: 'a', sourcedAt: '2026-07-27' }],
    families: [{ id: 'a' }, { id: 'orphan' }]
  });
  assert.equal(stats.models, 1);
});

// --- Each card costed under all three funding options ---------------------
// Step 2 no longer names a car, so the cost comparison moved here — and here
// it is a fair one, because all three options price the SAME car.

const costTables = JSON.parse(readFileSync(new URL('../../data/tax-tables.json', import.meta.url)));
const costInputs = {
  grossSalary: 145000, savings: 80000, termMonths: 60, annualKm: 15000,
  leaseStartDate: '2026-07-25', deposit: 0, leaseRatePct: 7.5, loanRatePct: 6.5,
  opportunityRatePct: 4.5, adminFeeAnnual: 1020,
  electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240, residualPctOverride: null
};
const vehicleFixture = {
  id: 'a', familyId: 'fa', make: 'Kia', model: 'EV5', listPrice: 56000,
  consumptionKwhPer100km: 16, insuranceAnnual: 1850, bootLitresSeatsUp: 513,
  rangeKm: 400, seats: 5, bodyType: 'SUV',
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
};

test('a card carries the cost of that car under all three options', () => {
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  for (const option of ['novated', 'loan', 'upfront']) {
    assert.equal(typeof card.costs[option].tco, 'number', `${option} must be costed`);
  }
  assert.ok(card.costs.novated.tco < card.costs.loan.tco, 'packaging beats a loan on this salary');
});

test('an unaffordable cash purchase is marked, not silently costed', () => {
  const card = cardModel(vehicleFixture, [], {
    inputs: { ...costInputs, savings: 1000 }, tables: costTables
  });
  assert.equal(card.costs.upfront.feasible, false);
});

test('the card model still works with no costing context', () => {
  const card = cardModel(vehicleFixture, []);
  assert.equal(card.costs, null);
});

// The reason valueRatio survives the rework: across five differently-priced
// cars, the total alone cannot say which holds its value.
test('two similarly-priced cars can differ sharply on value retained', () => {
  const holder = { ...vehicleFixture, id: 'holder', depreciationCurve: [1, 0.9, 0.84, 0.79, 0.75, 0.71] };
  const sinker = { ...vehicleFixture, id: 'sinker', depreciationCurve: [1, 0.6, 0.45, 0.35, 0.28, 0.22] };
  const a = cardModel(holder, [], { inputs: costInputs, tables: costTables });
  const b = cardModel(sinker, [], { inputs: costInputs, tables: costTables });
  assert.ok(valueRatio(a.costs.novated) > valueRatio(b.costs.novated) + 0.1,
    'the same price with a very different curve must show a very different ratio');
});

test('renderCards prints all three totals and marks the winning option', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  renderCards({ querySelector: () => target }, [
    { ...card, bandLabel: 'At your budget', band: 'at', winningOption: 'novated' }
  ]);
  assert.ok(html.includes('car-costs'), 'expected the cost table');
  assert.ok(html.includes('Novated') && html.includes('Loan') && html.includes('Cash'));
  assert.ok(/is-winner/.test(html), 'the winning option must be marked');
  assert.ok(/keeps \d+c/.test(html), 'expected the value-retained figure per option');
});

// --- Monthly first ---------------------------------------------------------
// Everything above the shortlist is denominated in dollars per month. The cost
// table used to answer in term totals only, so a reader could not check a card
// against the budget they had just set.

const renderOne = (overrides = {}) => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  renderCards({ querySelector: () => target }, [{ ...card, winningOption: 'novated', ...overrides }]);
  return html;
};

test('the financed options lead with a monthly figure', () => {
  const html = renderOne();
  // Two of the three rows carry a "/mo" headline; cash's monthly appears only
  // as its secondary running-cost line, which the next test pins down.
  assert.ok(/car-costs__lead">\$[\d,]+\/mo</.test(html), 'expected a $X/mo headline');
});

test('cash leads with what it wants up front, not with a monthly figure', () => {
  const html = renderOne();
  // The trap: cash's monthlyCost is running costs alone, so a "$103/mo"
  // headline beside a lease's "$712/mo" would read as cash being seven times
  // cheaper, when the difference is the outlay on day one.
  assert.match(html, /car-costs__lead">\$[\d,]+ up front</);
  assert.match(html, /car-costs__aside">then \$[\d,]+\/mo to run</);
});

test('the caption says what period the totals cover, and that they are net of resale', () => {
  const html = renderOne();
  assert.match(html, /Totals are over 5 years, after resale/);
});

// termLabel itself is tested in format.test.js, where it now lives — a 30-month
// fixture here would only exercise the engine rejecting the term.

// --- The lease balloon, back where a car price exists ---------------------
// Step 2 used to disclose the residual, but it no longer names a car, so
// there is nothing to compute one from. It belongs per card. The
// affordability test is still monthly-only, so a five-figure bill on the last
// day of the term is otherwise invisible.

test('a card discloses the balloon on its novated option', () => {
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  assert.ok(card.balloon > 0, 'the residual must be surfaced, not buried in the total');
  assert.equal(card.balloon, card.costs.novated.detail.residual);
});

test('a card flags a balloon the car will not be worth enough to clear', () => {
  const sinker = { ...vehicleFixture, depreciationCurve: [1, 0.4, 0.28, 0.2, 0.15, 0.1] };
  const card = cardModel(sinker, [], { inputs: costInputs, tables: costTables });
  assert.ok(card.costs.novated.detail.resale < card.balloon, 'fixture must be underwater');
  assert.equal(card.balloonCovered, false);
});

test('a card that holds its value covers its own balloon', () => {
  const holder = { ...vehicleFixture, depreciationCurve: [1, 0.95, 0.92, 0.9, 0.88, 0.85] };
  const card = cardModel(holder, [], { inputs: costInputs, tables: costTables });
  assert.equal(card.balloonCovered, true);
});

test('no costing context means no balloon rather than a crash', () => {
  const card = cardModel(vehicleFixture, []);
  assert.equal(card.balloon, null);
  assert.equal(card.balloonCovered, null);
});

test('renderCards prints the balloon under the cost table', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  renderCards({ querySelector: () => target }, [{ ...card, bandLabel: 'At your budget' }]);
  assert.ok(/balloon/i.test(html), `expected the balloon named, got: ${html}`);
});

test('an underwater balloon is marked so it reads as a warning', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const sinker = { ...vehicleFixture, depreciationCurve: [1, 0.4, 0.28, 0.2, 0.15, 0.1] };
  const card = cardModel(sinker, [], { inputs: costInputs, tables: costTables });
  renderCards({ querySelector: () => target }, [{ ...card, bandLabel: 'At your budget' }]);
  assert.ok(/is-short/.test(html), 'a shortfall must be visually distinct from a covered balloon');
});

// --- Plug-in hybrids on the card --------------------------------------------
// PHEVs keep their normal price band, so the card is where the fact that a
// PHEV lost the FBT exemption (and can therefore cost more per month than an
// EV in the same band) has to surface.

test('a card reports its powertrain and FBT status', () => {
  const card = cardModel(phev(), [], { inputs: costInputs, tables: costTables, monthlyBudget: 1200 });
  assert.equal(card.powertrain, 'phev');
  assert.equal(card.phevIneligible, true);
});

// The card sits under "At your budget" because it is banded on price, so the
// one thing it must not do is stay quiet about not being affordable there.
test('a card flags a novated cost above the budget', () => {
  const card = cardModel(phev(), [], { inputs: costInputs, tables: costTables, monthlyBudget: 1 });
  assert.equal(card.novatedOverBudget, true);
});

test('a card within budget is not flagged', () => {
  const card = cardModel(bev(), [], { inputs: costInputs, tables: costTables, monthlyBudget: 100000 });
  assert.equal(card.novatedOverBudget, false);
});

test('the rendered PHEV card discloses the lost exemption and the date', () => {
  const target = { innerHTML: '' };
  renderCards({ querySelector: () => target }, [
    cardModel(phev(), [], { inputs: costInputs, tables: costTables, monthlyBudget: 1 })
  ]);
  assert.match(target.innerHTML, /FBT exemption/i);
  assert.match(target.innerHTML, /1 April 2025/);
});

test('a BEV card says nothing about FBT eligibility', () => {
  const target = { innerHTML: '' };
  renderCards({ querySelector: () => target }, [
    cardModel(bev(), [], { inputs: costInputs, tables: costTables, monthlyBudget: 100000 })
  ]);
  assert.ok(!/FBT exemption/i.test(target.innerHTML));
});

// C1: rolling the lease start date back one day makes a PHEV FBT-exempt and
// ~$47,000 cheaper over the term. The disclosure used to appear only in the
// expensive case, so the cheap, load-bearing assumption went unstated.
const earlyLease = { ...costInputs, leaseStartDate: '2025-03-31' };

test('a PHEV exempt only by an early lease date carries that on the card', () => {
  const card = cardModel(phev(), [], { inputs: earlyLease, tables: costTables, monthlyBudget: 1200 });
  assert.equal(card.phevExemptByDate, true);
  assert.equal(card.phevIneligible, false);
});

test('the rendered card names the date and the binding commitment behind the exemption', () => {
  const target = { innerHTML: '' };
  renderCards({ querySelector: () => target }, [
    cardModel(phev(), [], { inputs: earlyLease, tables: costTables, monthlyBudget: 1200 })
  ]);
  assert.match(target.innerHTML, /1 April 2025/);
  assert.match(target.innerHTML, /binding commitment/i);
});

// The two notes describe opposite treatments, so a card must never carry both.
test('a PHEV leased after the cut-off keeps the ineligibility note and not the exempt one', () => {
  const target = { innerHTML: '' };
  renderCards({ querySelector: () => target }, [
    cardModel(phev(), [], { inputs: costInputs, tables: costTables, monthlyBudget: 1200 })
  ]);
  assert.match(target.innerHTML, /lost the FBT exemption/i);
  assert.ok(!/binding commitment/i.test(target.innerHTML));
});

test('a BEV on an early lease date carries neither note', () => {
  const target = { innerHTML: '' };
  renderCards({ querySelector: () => target }, [
    cardModel(bev(), [], { inputs: earlyLease, tables: costTables, monthlyBudget: 100000 })
  ]);
  assert.ok(!/FBT exemption/i.test(target.innerHTML));
  assert.ok(!/binding commitment/i.test(target.innerHTML));
});

// --- The empty shortlist must name the right lever ------------------------
// Every ute in the dataset is a plug-in hybrid, so ticking Ute with the
// toggle off matches nothing. "Try relaxing a preference" is wrong advice
// there: the preference is fine, the toggle is what is hiding everything.

test('a body type that is entirely PHEV matches nothing with the toggle off', () => {
  const fleet = [
    bev({ id: 'suv', bodyType: 'SUV' }),
    phev({ id: 'ute1', bodyType: 'Ute' }),
    phev({ id: 'ute2', bodyType: 'Ute' })
  ];
  assert.equal(filterVehicles(fleet, { bodyTypes: ['Ute'] }).length, 0);
  assert.equal(filterVehicles(fleet, { bodyTypes: ['Ute'], includePhev: true }).length, 2);
});

// The message is chosen by re-running the filter, not by hardcoding "Ute", so
// it stays correct for whatever body type turns out to be PHEV-only next.
test('the toggle is only the answer when it would genuinely change the result', () => {
  const fleet = [bev({ id: 'suv', bodyType: 'SUV' }), phev({ id: 'ute1', bodyType: 'Ute' })];
  const wouldHelp = filters =>
    filterVehicles(fleet, filters).length === 0 &&
    !filters.includePhev &&
    filterVehicles(fleet, { ...filters, includePhev: true }).length > 0;

  assert.equal(wouldHelp({ bodyTypes: ['Ute'] }), true, 'utes are all PHEV — the toggle is the fix');
  assert.equal(wouldHelp({ bodyTypes: ['Sedan'] }), false, 'no sedan of any powertrain — relaxing is the fix');
  assert.equal(wouldHelp({ bodyTypes: ['Ute'], includePhev: true }), false, 'already on');
});
