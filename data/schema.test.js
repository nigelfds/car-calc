import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateVehicle, validateFamily, loadDataset, NUMERIC_BOUNDS, POWERTRAINS } from './schema.js';

const vehicles = JSON.parse(readFileSync(new URL('./vehicles.json', import.meta.url)));
const families = JSON.parse(readFileSync(new URL('./families.json', import.meta.url)));

const goodVehicle = {
  id: 'kia-ev5-air',
  familyId: 'kia-ev5',
  make: 'Kia',
  model: 'EV5',
  variant: 'Air Standard Range',
  bodyType: 'SUV',
  listPrice: 56000,
  batteryKwh: 64.2,
  rangeKm: 400,
  consumptionKwhPer100km: 16,
  bootLitresSeatsUp: 513,
  bootLitresSeatsDown: 1714,
  seats: 5,
  towKg: 1000,
  warrantyYears: 7,
  insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47],
  sourcedAt: '2026-07-25'
};

const bevRow = (over = {}) => ({
  id: 'test-bev', familyId: 'test', make: 'Test', model: 'Car', variant: 'Base',
  bodyType: 'SUV', sourcedAt: '2026-07-28',
  listPrice: 55000, batteryKwh: 60, rangeKm: 450, consumptionKwhPer100km: 13.3,
  bootLitresSeatsUp: 450, bootLitresSeatsDown: 1200, seats: 5, towKg: 750,
  warrantyYears: 5, insuranceAnnual: 1600,
  depreciationCurve: [1, 0.75, 0.64, 0.56, 0.49, 0.43],
  ...over
});

const phevRow = (over = {}) => ({
  ...bevRow(),
  id: 'test-phev', powertrain: 'phev',
  batteryKwh: 18.1, rangeKm: 84, consumptionKwhPer100km: 21.5,
  combinedRangeKm: 760, fuelConsumptionL100km: 6.8,
  isFuelEfficientForLct: true, isGreenForVicDuty: true,
  ...over
});

test('a complete vehicle row validates', () => {
  assert.equal(validateVehicle(goodVehicle).valid, true);
});

test('a missing required field is reported by name', () => {
  const { bootLitresSeatsUp, ...missing } = goodVehicle;
  const result = validateVehicle(missing);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('bootLitresSeatsUp')));
});

test('a non-numeric price is rejected', () => {
  const result = validateVehicle({ ...goodVehicle, listPrice: '56,000' });
  assert.equal(result.valid, false);
});

test('a depreciation curve must start at 1 and decline', () => {
  assert.equal(validateVehicle({ ...goodVehicle, depreciationCurve: [0.9, 0.8] }).valid, false);
  assert.equal(validateVehicle({ ...goodVehicle, depreciationCurve: [1, 0.8, 0.9] }).valid, false);
});

const goodFamily = {
  id: 'kia-ev5',
  summary: 'Roomy mid-size electric SUV with a big boot.',
  pros: ['Large boot', 'Long warranty', 'Comfortable ride'],
  cons: ['Slow charging', 'Firm seats'],
  sources: ['https://www.carexpert.com.au/kia/ev5'],
  images: ['https://press.kia.com/ev5-front.jpg'],
  sourcedAt: '2026-07-25'
};

test('a family entry requires summary, pros, cons, and sources (but images is optional)', () => {
  assert.equal(validateFamily(goodFamily).valid, true);
  assert.equal(validateFamily({ id: 'kia-ev5', summary: 'x' }).valid, false);
});

test('every committed vehicle row is valid', () => {
  for (const row of vehicles) {
    const result = validateVehicle(row);
    assert.equal(result.valid, true, `${row.id}: ${result.errors.join(', ')}`);
  }
});

test('every committed family entry is valid', () => {
  for (const entry of families) {
    const result = validateFamily(entry);
    assert.equal(result.valid, true, `${entry.id}: ${result.errors.join(', ')}`);
  }
});

test('every vehicle points at a family that exists', () => {
  const ids = new Set(families.map(f => f.id));
  for (const row of vehicles) {
    assert.ok(ids.has(row.familyId), `${row.id} references missing family ${row.familyId}`);
  }
});

test('loadDataset skips invalid rows rather than throwing', () => {
  const result = loadDataset({
    vehicles: [goodVehicle, { id: 'broken' }],
    families
  });
  assert.equal(result.vehicles.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].id, 'broken');
});

// --- Item 1: loadDataset must validate families too --------------------

test('loadDataset validates families and skips invalid ones, reporting why', () => {
  const brokenFamily = { id: 'broken-family' };
  const result = loadDataset({ vehicles: [goodVehicle], families: [...families, brokenFamily] });
  assert.equal(result.families.some(f => f.id === 'broken-family'), false);
  assert.ok(result.families.some(f => f.id === 'kia-ev5'));
  assert.ok(result.skippedFamilies.some(f => f.id === 'broken-family' && f.errors.length > 0));
});

// --- Item 2: familyId must be cross-referenced inside the gate ---------

test('loadDataset skips a vehicle whose familyId does not reference any known family', () => {
  const orphan = { ...goodVehicle, id: 'orphan-vehicle', familyId: 'does-not-exist' };
  const result = loadDataset({ vehicles: [orphan], families });
  assert.equal(result.vehicles.length, 0);
  assert.ok(result.skipped.some(s => s.id === 'orphan-vehicle' && s.errors.some(e => e.includes('familyId'))));
});

test('loadDataset also skips a vehicle whose family was itself skipped as invalid', () => {
  const brokenFamilies = families.map(f => (f.id === 'kia-ev5' ? { id: 'kia-ev5' } : f));
  const result = loadDataset({ vehicles: [goodVehicle], families: brokenFamilies });
  assert.equal(result.vehicles.length, 0);
  assert.ok(result.skipped.some(s => s.id === goodVehicle.id));
});

// --- Item 3: numeric bounds and plausibility checks ---------------------

test('numeric fields outside their plausible range are rejected by name', () => {
  for (const [field, [min, max]] of Object.entries(NUMERIC_BOUNDS)) {
    for (const bad of [min - 1, max + 1]) {
      const result = validateVehicle({ ...goodVehicle, [field]: bad });
      assert.equal(result.valid, false, `${field}=${bad} should be rejected`);
      assert.ok(result.errors.some(e => e.includes(field)), `${field}=${bad} error should mention the field name`);
    }
  }
});

test('numeric fields within their plausible range still validate', () => {
  for (const field of Object.keys(NUMERIC_BOUNDS)) {
    assert.equal(validateVehicle(goodVehicle).valid, true, field);
  }
});

test('seats and warrantyYears must be whole numbers', () => {
  assert.equal(validateVehicle({ ...goodVehicle, seats: 5.5 }).valid, false);
  assert.equal(validateVehicle({ ...goodVehicle, warrantyYears: 6.5 }).valid, false);
});

// --- Item 4: battery/range/consumption internal consistency ------------

test('consumption must be consistent with batteryKwh / rangeKm, catching unit mix-ups', () => {
  // bootLitres etc all still in-range individually, but rangeKm halved implies
  // roughly double the real-world consumption figure -- a classic unit mix-up.
  const result = validateVehicle({ ...goodVehicle, rangeKm: 200 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('consumptionKwhPer100km') && e.includes('32')));
});

test('consumption within 25% of the implied figure passes', () => {
  assert.equal(validateVehicle(goodVehicle).valid, true);
});

// --- Item 5: image URLs must be direct image files ----------------------

test('a family with no images key is valid', () => {
  const { images, ...noImages } = goodFamily;
  assert.equal(validateFamily(noImages).valid, true);
});

test('a family with an empty images array is valid', () => {
  assert.equal(validateFamily({ ...goodFamily, images: [] }).valid, true);
});

test('family images must be https and end in a real image extension when supplied', () => {
  assert.equal(validateFamily({ ...goodFamily, images: ['https://www.kiapressoffice.com/models/ev5'] }).valid, false);
  assert.equal(validateFamily({ ...goodFamily, images: ['http://press.kia.com/ev5-front.jpg'] }).valid, false);
  assert.equal(validateFamily({ ...goodFamily, images: ['https://press.kia.com/ev5-front.jpg?w=800'] }).valid, true);
  assert.equal(validateFamily({ ...goodFamily, images: ['https://press.kia.com/ev5-front.webp'] }).valid, true);
});

// --- Item 6: bootLitresSeatsDown >= bootLitresSeatsUp -------------------

test('bootLitresSeatsDown must be at least bootLitresSeatsUp', () => {
  assert.equal(validateVehicle({ ...goodVehicle, bootLitresSeatsDown: 400 }).valid, false);
  assert.equal(validateVehicle({ ...goodVehicle, bootLitresSeatsDown: 513 }).valid, true);
});

// --- Item 7: Kia EV5 Air price corrected to a pre-on-road list price ---

// The EV5 is the canary for the drive-away trap: Kia's GT-Line is widely
// reported at "over $75,000", but that is its drive-away price — every variant
// is under the threshold on list price. If a refresh ever pastes drive-away
// figures into listPrice, this family is where it will show up first.
test('Kia EV5 listPrices are manufacturer list prices, not drive-away figures', () => {
  const air = vehicles.find(v => v.id === 'kia-ev5-air-standard-range');
  assert.ok(air, 'kia-ev5-air-standard-range is missing from the dataset');
  assert.equal(air.listPrice, 56770);

  // The whole family sits below the $75,000 FBT threshold on list price, even
  // though the GT-Line's drive-away price clears it.
  const ev5 = vehicles.filter(v => v.familyId === 'kia-ev5');
  assert.equal(ev5.length, 4);
  for (const row of ev5) {
    assert.ok(row.listPrice < 75000, `${row.id} at ${row.listPrice} looks like a drive-away price`);
  }
});

// --- Item 8: depreciationCurve values must be between 0 and 1 ----------

test('depreciationCurve values must all be between 0 and 1', () => {
  assert.equal(validateVehicle({ ...goodVehicle, depreciationCurve: [1.2, 0.8] }).valid, false);
  assert.equal(validateVehicle({ ...goodVehicle, depreciationCurve: [1, -0.1] }).valid, false);
});

// --- Item 9: family sources must all be https URLs ----------------------

test('family sources must all be https URLs', () => {
  assert.equal(validateFamily({ ...goodFamily, sources: ['http://carexpert.com.au/kia/ev5'] }).valid, false);
});

// --- Item 10: pros/cons must be non-empty strings -----------------------

test('family pros and cons must contain only non-empty strings', () => {
  assert.equal(validateFamily({ ...goodFamily, pros: ['', 'Long warranty', 'Comfortable ride'] }).valid, false);
  assert.equal(validateFamily({ ...goodFamily, cons: ['Slow charging', '   '] }).valid, false);
});

// --- Item 11: sourcedAt must match YYYY-MM-DD ---------------------------

test('sourcedAt must match YYYY-MM-DD for both vehicles and families', () => {
  assert.equal(validateVehicle({ ...goodVehicle, sourcedAt: '25/07/2026' }).valid, false);
  assert.equal(validateFamily({ ...goodFamily, sourcedAt: '25-07-2026' }).valid, false);
});

// --- Item 12: loadDataset must detect duplicate vehicle ids ------------

test('loadDataset detects and reports duplicate vehicle ids', () => {
  const dup = { ...goodVehicle, id: 'dup-vehicle' };
  const result = loadDataset({ vehicles: [dup, { ...dup }], families });
  assert.equal(result.vehicles.length, 1);
  assert.ok(result.skipped.some(s => s.id === 'dup-vehicle' && s.errors.some(e => e.toLowerCase().includes('duplicate'))));
});

// --- Item 13: loadDataset must guard against malformed containers -------

test('loadDataset handles missing families key gracefully', () => {
  const result = loadDataset({ vehicles: [] });
  assert.ok(result);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.families.length, 0);
  assert.equal(result.skipped.length, 0);
  assert.equal(result.skippedFamilies.length, 0);
});

test('loadDataset handles missing vehicles key gracefully', () => {
  const result = loadDataset({ families: [] });
  assert.ok(result);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.families.length, 0);
  assert.equal(result.skipped.length, 0);
  assert.equal(result.skippedFamilies.length, 0);
});

test('loadDataset handles null families gracefully', () => {
  const result = loadDataset({ vehicles: [], families: null });
  assert.ok(result);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.families.length, 0);
  assert.equal(result.skipped.length, 0);
  assert.equal(result.skippedFamilies.length, 0);
});

test('loadDataset handles undefined input gracefully', () => {
  const result = loadDataset();
  assert.ok(result);
  assert.equal(result.vehicles.length, 0);
  assert.equal(result.families.length, 0);
  assert.equal(result.skipped.length, 0);
  assert.equal(result.skippedFamilies.length, 0);
});

// --- Item 14: powertrain field (PHEV support) ---------------------------

// A row that says nothing about its powertrain is a BEV. This is what keeps
// the existing 40 families from needing a migration.
test('a row with no powertrain is still valid and treated as a BEV', () => {
  const row = bevRow();
  delete row.powertrain;
  assert.equal(validateVehicle(row).valid, true);
});

test('powertrain must be one of the known values', () => {
  const result = validateVehicle({ ...bevRow(), powertrain: 'diesel' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /powertrain/);
});

test('POWERTRAINS names exactly the two supported drivetrains', () => {
  assert.deepEqual(POWERTRAINS, ['bev', 'phev']);
});

// The dangerous failure mode: a PHEV that forgets to say so is scored as an
// FBT-exempt EV, which is wrong by thousands of dollars. Closed from both
// directions rather than trusting the author to remember.
test('PHEV-only fields without powertrain: phev is rejected', () => {
  const result = validateVehicle({ ...bevRow(), fuelConsumptionL100km: 6.8 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /powertrain/);
});

test('powertrain phev without its required fields is rejected', () => {
  const result = validateVehicle({ ...bevRow(), powertrain: 'phev' });
  assert.equal(result.valid, false);
  for (const field of ['combinedRangeKm', 'fuelConsumptionL100km', 'isFuelEfficientForLct', 'isGreenForVicDuty']) {
    assert.match(result.errors.join(' '), new RegExp(field), `expected ${field} to be required`);
  }
});

test('a complete PHEV row validates', () => {
  assert.equal(validateVehicle(phevRow()).valid, true);
});

// A PHEV's electric range and battery are both far below the BEV floors.
test('PHEV battery and electric range use their own bounds', () => {
  const row = phevRow({ batteryKwh: 11.8, rangeKm: 55, consumptionKwhPer100km: 21 });
  assert.equal(validateVehicle(row).valid, true, validateVehicle(row).errors.join('; '));
});

test('a BEV still may not have a 55km range', () => {
  const result = validateVehicle(bevRow({ rangeKm: 55 }));
  assert.equal(result.valid, false);
});

test('combined range must exceed electric range', () => {
  const result = validateVehicle(phevRow({ rangeKm: 84, combinedRangeKm: 80 }));
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /combinedRangeKm/);
});

test('the electric consistency check uses electric range for a PHEV', () => {
  // 11.8kWh over 84km implies 14.0kWh/100km; stating 25 is a real error.
  const result = validateVehicle(phevRow({ batteryKwh: 11.8, rangeKm: 84, consumptionKwhPer100km: 25 }));
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /consumptionKwhPer100km/);
});

// Optional on any powertrain: a battery-electric ute would be a goods vehicle
// too, so this is not a PHEV-only field and must not be rejected on a BEV.
test('the non-passenger duty flag is accepted on any row', () => {
  assert.equal(validateVehicle({ ...bevRow(), isNonPassengerForVicDuty: true }).valid, true);
  assert.equal(validateVehicle({ ...phevRow(), isNonPassengerForVicDuty: true }).valid, true);
});

test('a row with no non-passenger flag is still valid, and means passenger car', () => {
  assert.equal(validateVehicle(bevRow()).valid, true);
});

test('the non-passenger flag must be a boolean when present', () => {
  const result = validateVehicle({ ...bevRow(), isNonPassengerForVicDuty: 'yes' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /isNonPassengerForVicDuty/);
});
