import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProvenance, unmatchedProsePrices } from './provenance-schema.js';

const bev = {
  id: 'kia-ev5-air', familyId: 'kia-ev5', listPrice: 49720, batteryKwh: 62.4, rangeKm: 400,
  consumptionKwhPer100km: 15.6, bootLitresSeatsUp: 513, bootLitresSeatsDown: 1714, seats: 5,
  towKg: 300, warrantyYears: 7, insuranceAnnual: 1800, depreciationCurve: [1, 0.78, 0.68]
};
const phev = {
  ...bev, id: 'byd-sealion-6-essential', familyId: 'byd-sealion-6', powertrain: 'phev',
  combinedRangeKm: 1092, fuelConsumptionL100km: 4.8, isFuelEfficientForLct: true, isGreenForVicDuty: true
};
const url = 'https://example.com.au/page';

function entriesFor(row) {
  const entries = { availability: { basis: 'sourced', url } };
  for (const [field, value] of Object.entries(row)) {
    if (['id', 'familyId', 'powertrain'].includes(field)) continue;
    entries[field] = { value, basis: 'sourced', url };
  }
  entries.rangeKm.standard = 'WLTP';
  return entries;
}
const provenanceFor = (rows, extra = {}) => ({
  familyId: rows[0].familyId, researchedAt: '2026-11-27', mode: 'update', lowConfidence: [],
  variants: Object.fromEntries(rows.map(row => [row.id, entriesFor(row)])), ...extra
});
const errorsOf = (prov, rows) => validateProvenance(prov, rows[0].familyId, rows).errors;

test('a complete BEV provenance record passes', () => {
  assert.deepEqual(errorsOf(provenanceFor([bev]), [bev]), []);
});

test('a complete PHEV provenance record passes', () => {
  assert.deepEqual(errorsOf(provenanceFor([phev]), [phev]), []);
});

test('a PHEV row missing a PHEV-only field fails', () => {
  const prov = provenanceFor([phev]);
  delete prov.variants[phev.id].fuelConsumptionL100km;
  assert.match(errorsOf(prov, [phev]).join(), /fuelConsumptionL100km: missing/);
});

test('a row with no provenance fails, and so does provenance for a row that is gone', () => {
  const prov = provenanceFor([bev]);
  prov.variants['kia-ev5-gone'] = prov.variants[bev.id];
  const other = { ...bev, id: 'kia-ev5-earth' };
  const errors = errorsOf(prov, [bev, other]).join();
  assert.match(errors, /kia-ev5-earth: no provenance/);
  assert.match(errors, /kia-ev5-gone: provenance for a row that does not exist/);
});

test('a value that disagrees with the row fails, arrays included', () => {
  const prov = provenanceFor([bev]);
  prov.variants[bev.id].listPrice.value = 49990;
  prov.variants[bev.id].depreciationCurve.value = [1, 0.8, 0.68];
  const errors = errorsOf(prov, [bev]).join();
  assert.match(errors, /listPrice: value 49990 does not match/);
  assert.match(errors, /depreciationCurve: value/);
});

test('sourced and backed-out figures need a url; derived, judged and carried need a note', () => {
  const prov = provenanceFor([bev]);
  const v = prov.variants[bev.id];
  v.batteryKwh = { value: bev.batteryKwh, basis: 'sourced' };
  v.listPrice = { value: bev.listPrice, basis: 'backed-out', url };
  v.insuranceAnnual = { value: bev.insuranceAnnual, basis: 'judged' };
  const errors = errorsOf(prov, [bev]).join();
  assert.match(errors, /batteryKwh: a sourced figure needs the url/);
  assert.match(errors, /listPrice: a backed-out figure needs a note/);
  assert.match(errors, /insuranceAnnual: a judged figure needs a note/);
});

test('listPrice can never be carried, and nothing can be carried on a new family', () => {
  const prov = provenanceFor([bev]);
  prov.variants[bev.id].listPrice = { value: bev.listPrice, basis: 'carried', note: 'same as before' };
  assert.match(errorsOf(prov, [bev]).join(), /listPrice is re-verified/);

  const fresh = provenanceFor([bev], { mode: 'new' });
  fresh.variants[bev.id].towKg = { value: bev.towKg, basis: 'carried', note: 'unchanged' };
  assert.match(errorsOf(fresh, [bev]).join(), /towKg: nothing can be carried on a new family/);
});

test('a sourced range must name its standard', () => {
  const prov = provenanceFor([bev]);
  delete prov.variants[bev.id].rangeKm.standard;
  assert.match(errorsOf(prov, [bev]).join(), /rangeKm: a sourced range must name its standard/);
});

test('availability must be sourced from a page', () => {
  const prov = provenanceFor([bev]);
  prov.variants[bev.id].availability = { basis: 'judged', note: 'probably still on sale' };
  assert.match(errorsOf(prov, [bev]).join(), /availability must be sourced/);
});

test('header fields are checked', () => {
  const prov = provenanceFor([bev], { familyId: 'kia-ev3', researchedAt: '27/11/2026', mode: 'refresh' });
  delete prov.lowConfidence;
  const errors = errorsOf(prov, [bev]).join();
  assert.match(errors, /familyId must be kia-ev5/);
  assert.match(errors, /researchedAt must match/);
  assert.match(errors, /mode must be update or new/);
  assert.match(errors, /lowConfidence must be an array/);
});

test('prose prices that match no row are listed, row prices and small figures are not', () => {
  const family = {
    summary: 'From $49,720 before on-roads, against the $71,770 GT-Line.',
    pros: ['Undercuts the $54,900 Model Y'],
    cons: ['Charging adds $1,200 a year', 'GT-Line costs $5k more']
  };
  assert.deepEqual(unmatchedProsePrices(family, [bev]), [71770, 54900]);
});
