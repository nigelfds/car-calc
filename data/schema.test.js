import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateVehicle, validateFamily, loadDataset, NUMERIC_BOUNDS } from './schema.js';

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

test('Kia EV5 Air seed listPrice is the manufacturer list price, not a drive-away figure', () => {
  const kia = vehicles.find(v => v.id === 'kia-ev5-air');
  assert.equal(kia.listPrice, 49720);
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
