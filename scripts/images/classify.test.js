import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, containsTerm, classify } from './classify.js';

// A slice of the real dataset, chosen for the traps it contains.
const families = [
  { id: 'byd-seal', make: 'BYD', model: 'Seal' },
  { id: 'byd-seal-6', make: 'BYD', model: 'Seal 6' },
  // Real, distinct vehicle (see task background: "the Seal U is the Sealion 6
  // in some markets") — without it as a family the sibling-clash check below
  // has nothing to disambiguate the "Seal U" title against, and the test is
  // unfalsifiable. Its absence from the brief's fixture was a bug; see report.
  { id: 'byd-seal-u', make: 'BYD', model: 'Seal U' },
  { id: 'byd-sealion-6', make: 'BYD', model: 'Sealion 6' },
  { id: 'byd-sealion-7', make: 'BYD', model: 'Sealion 7' },
  { id: 'byd-atto-3', make: 'BYD', model: 'Atto 3' },
  { id: 'vw-id4', make: 'Volkswagen', model: 'ID.4' },
  { id: 'mini-cooper', make: 'Mini', model: 'Cooper' },
  { id: 'skoda-elroq', make: 'Skoda', model: 'Elroq' },
  { id: 'mg-4', make: 'MG', model: '4' },
  { id: 'kia-ev5', make: 'Kia', model: 'EV5' }
];
const family = id => families.find(f => f.id === id);
const verdict = (id, title) => classify({ family: family(id), candidateTitle: title, families });

test('normalise folds diacritics so Skoda matches Škoda', () => {
  assert.equal(normalise('Škoda Elroq'), normalise('Skoda Elroq'));
});

test('normalise splits letter-digit boundaries so MG4 matches MG 4', () => {
  assert.equal(normalise('MG4 EV'), 'mg 4 ev');
});

test('normalise strips leading zeros so Sealion 07 matches Sealion 7', () => {
  assert.equal(normalise('BYD Sealion 07 EV'), 'byd sealion 7 ev');
});

test('containsTerm matches whole terms, not substrings of words', () => {
  assert.equal(containsTerm('BYD Sealion 6', 'Sealion 6'), true);
  assert.equal(containsTerm('BYD Sealion 6', 'Seal'), false);
});

test('an exact make and model match is accepted automatically', () => {
  assert.equal(verdict('byd-atto-3', 'BYD Atto 3 1X7A6495.jpg').verdict, 'auto');
  assert.equal(verdict('kia-ev5', 'Kia EV5 Air 2WD 001.jpg').verdict, 'auto');
});

test('digit padding still auto-accepts', () => {
  assert.equal(verdict('byd-sealion-7', 'BYD Sealion 07 EV DSC 8264.jpg').verdict, 'auto');
});

test('a market alias is flagged because the model is absent', () => {
  // The real trap: the Sealion 6 is filed under its Chinese name.
  const v = verdict('byd-sealion-6', 'BYD Song Plus DM-i 001.jpg');
  assert.equal(v.verdict, 'manual');
  assert.match(v.why, /alias/i);
});

test('a sibling with a longer model name is flagged, not auto-accepted', () => {
  // "BYD Seal" appears in "BYD Seal U", but the Seal U is a different vehicle.
  // Substring matching alone would accept this and ship the wrong car.
  const v = verdict('byd-seal', 'BYD Seal U IAA 2023 1X7A0045.jpg');
  assert.equal(v.verdict, 'manual');
});

test('a family whose model is a prefix of a sibling still auto-accepts its own match', () => {
  assert.equal(verdict('byd-seal', 'BYD Seal Automesse 2023 001.jpg').verdict, 'auto');
});

test('the ID.4 / ID.5 case is flagged', () => {
  assert.equal(verdict('vw-id4', 'Volkswagen ID.5 GTX 1X7A0318.jpg').verdict, 'manual');
});

test('the Morris Mini case is flagged', () => {
  assert.equal(verdict('mini-cooper', 'Morris Mini-Minor 1959 (621 AOK).jpg').verdict, 'manual');
});

test('a diacritic in the candidate does not cause a false flag', () => {
  assert.equal(verdict('skoda-elroq', 'Škoda Elroq Auto Zuerich 2024 DSC 6550.jpg').verdict, 'auto');
});

test('no candidate at all is flagged with its own reason', () => {
  const v = verdict('kia-ev5', '');
  assert.equal(v.verdict, 'manual');
  assert.match(v.why, /no candidate/i);
});

test('why is always a non-empty explanation', () => {
  for (const [id, title] of [['byd-atto-3', 'BYD Atto 3 x.jpg'], ['byd-seal', 'BYD Seal U x.jpg'], ['kia-ev5', '']]) {
    assert.ok(verdict(id, title).why.length > 0);
  }
});
