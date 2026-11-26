// data/provenance-schema.js — validation for data/provenance/<familyId>.json,
// the per-figure record of where each number on a family's vehicle rows came
// from. Written by research agents following
// .claude/skills/research-car-family/, checked by scripts/check-provenance.js.
//
// Kept out of data/schema.js and out of scripts/build-dataset.js on purpose:
// families researched before provenance existed have no file, and the build
// must keep accepting them. The app never reads provenance.

import { powertrainOf } from './schema.js';

export const BASES = ['sourced', 'backed-out', 'derived', 'judged', 'carried'];
export const RANGE_STANDARDS = ['AU-certified', 'WLTP', 'NEDC', 'other'];

const SHARED_FIELDS = [
  'listPrice', 'batteryKwh', 'rangeKm', 'consumptionKwhPer100km',
  'bootLitresSeatsUp', 'bootLitresSeatsDown', 'seats', 'towKg',
  'warrantyYears', 'insuranceAnnual', 'depreciationCurve'
];
const PHEV_FIELDS = [
  'combinedRangeKm', 'fuelConsumptionL100km', 'isFuelEfficientForLct', 'isGreenForVicDuty'
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https:\/\/\S+$/;

export const requiredFieldsFor = row =>
  powertrainOf(row) === 'phev' ? [...SHARED_FIELDS, ...PHEV_FIELDS] : SHARED_FIELDS;

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasNote = entry => typeof entry.note === 'string' && entry.note.trim().length > 0;

function checkEntry(where, field, entry, row) {
  const errors = [];
  if (!entry || typeof entry !== 'object') return [`${where}: missing`];

  if (!BASES.includes(entry.basis)) {
    errors.push(`${where}: basis must be one of ${BASES.join(', ')}, got ${entry.basis}`);
  }
  if (entry.url !== undefined && !URL_RE.test(entry.url)) {
    errors.push(`${where}: url must be an https:// URL`);
  }
  if ((entry.basis === 'sourced' || entry.basis === 'backed-out') && !URL_RE.test(entry.url ?? '')) {
    errors.push(`${where}: a ${entry.basis} figure needs the url it came from`);
  }
  if (['backed-out', 'derived', 'judged', 'carried'].includes(entry.basis) && !hasNote(entry)) {
    errors.push(`${where}: a ${entry.basis} figure needs a note explaining it`);
  }

  if (field === 'availability') {
    if (entry.basis !== 'sourced') errors.push(`${where}: availability must be sourced from a page`);
    return errors;
  }

  if (!sameValue(entry.value, row[field])) {
    errors.push(`${where}: value ${JSON.stringify(entry.value)} does not match the row's ${JSON.stringify(row[field])}`);
  }
  if (field === 'listPrice' && entry.basis === 'carried') {
    errors.push(`${where}: listPrice is re-verified every refresh and cannot be carried`);
  }
  if (field === 'rangeKm' && entry.basis === 'sourced' && !RANGE_STANDARDS.includes(entry.standard)) {
    errors.push(`${where}: a sourced range must name its standard (${RANGE_STANDARDS.join(', ')})`);
  }
  return errors;
}

// Validates one family's provenance against that family's vehicle rows.
export function validateProvenance(provenance, familyId, vehicles) {
  const errors = [];
  if (!provenance || typeof provenance !== 'object') {
    return { valid: false, errors: ['provenance is not an object'] };
  }
  if (provenance.familyId !== familyId) {
    errors.push(`familyId must be ${familyId}, got ${provenance.familyId}`);
  }
  if (!DATE_RE.test(provenance.researchedAt ?? '')) errors.push('researchedAt must match YYYY-MM-DD');
  if (!['update', 'new'].includes(provenance.mode)) errors.push('mode must be update or new');
  if (!Array.isArray(provenance.lowConfidence) || provenance.lowConfidence.some(s => typeof s !== 'string')) {
    errors.push('lowConfidence must be an array of strings (empty only when nothing is soft)');
  }

  const variants = provenance.variants;
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) {
    errors.push('variants must be an object keyed by vehicle id');
    return { valid: false, errors };
  }

  const rowIds = new Set(vehicles.map(row => row.id));
  for (const id of Object.keys(variants)) {
    if (!rowIds.has(id)) errors.push(`${id}: provenance for a row that does not exist`);
  }

  for (const row of vehicles) {
    const entries = variants[row.id];
    if (!entries || typeof entries !== 'object') {
      errors.push(`${row.id}: no provenance`);
      continue;
    }
    errors.push(...checkEntry(`${row.id}.availability`, 'availability', entries.availability, row));
    for (const field of requiredFieldsFor(row)) {
      errors.push(...checkEntry(`${row.id}.${field}`, field, entries[field], row));
    }
    if (provenance.mode === 'new') {
      for (const field of requiredFieldsFor(row)) {
        if (entries[field]?.basis === 'carried') {
          errors.push(`${row.id}.${field}: nothing can be carried on a new family`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Dollar figures quoted in a family's prose that match no row's list price.
// Advisory only: prose legitimately quotes rivals, drive-away and past prices,
// so this is a list for the author to look over, not a failure.
export function unmatchedProsePrices(family, vehicles) {
  const prices = new Set(vehicles.map(row => row.listPrice));
  const text = [family.summary, ...(family.pros ?? []), ...(family.cons ?? [])].join(' ');
  const quoted = [...text.matchAll(/\$(\d{1,3}(?:,\d{3})+|\d{4,})(?!\s*(?:k\b|\/|per\b))/g)]
    .map(match => Number(match[1].replaceAll(',', '')))
    .filter(value => value >= 15000);
  return [...new Set(quoted)].filter(value => !prices.has(value));
}
