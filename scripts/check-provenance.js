#!/usr/bin/env node
// Checks data/provenance/<familyId>.json against data/vehicles/<familyId>.json.
//
// Usage:
//   node scripts/check-provenance.js kia-ev5 byd-seal   # check these families
//   node scripts/check-provenance.js --all              # every family that has a provenance file
//
// Exits non-zero if any named family fails. Also prints, as warnings, dollar
// figures in the family's prose that match none of its rows' list prices, the
// usual sign of a price update that missed a sentence.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateProvenance, unmatchedProsePrices } from '../data/provenance-schema.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

export function checkFamily(familyId, dir = dataDir) {
  const paths = {
    provenance: join(dir, 'provenance', `${familyId}.json`),
    vehicles: join(dir, 'vehicles', `${familyId}.json`),
    family: join(dir, 'families', `${familyId}.json`)
  };
  for (const [name, path] of Object.entries(paths)) {
    if (!existsSync(path)) return { errors: [`no ${name} file at data/${name === 'family' ? 'families' : name}/${familyId}.json`], warnings: [] };
  }
  const vehicles = readJson(paths.vehicles);
  const { errors } = validateProvenance(readJson(paths.provenance), familyId, vehicles);
  const warnings = unmatchedProsePrices(readJson(paths.family), vehicles)
    .map(price => `prose quotes $${price.toLocaleString('en-AU')}, which is no row's list price`);
  return { errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const provenanceDir = join(dataDir, 'provenance');
  const ids = args[0] === '--all'
    ? (existsSync(provenanceDir) ? readdirSync(provenanceDir) : [])
        .filter(n => n.endsWith('.json')).map(n => n.slice(0, -5))
    : args;
  if (ids.length === 0 && args[0] === '--all') {
    console.log('no provenance files yet');
    process.exit(0);
  }
  if (ids.length === 0) {
    console.error('usage: node scripts/check-provenance.js <familyId>... | --all');
    process.exit(2);
  }

  let failed = 0;
  for (const id of ids) {
    const { errors, warnings } = checkFamily(id);
    for (const e of errors) console.error(`FAIL ${id}: ${e}`);
    for (const w of warnings) console.warn(`WARN ${id}: ${w}`);
    if (errors.length) failed++;
    else console.log(`ok   ${id}`);
  }
  process.exit(failed ? 1 : 0);
}
