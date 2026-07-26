// Merges the per-family research files under data/families/*.json and
// data/vehicles/*.json into the two aggregate files data/vehicles.json and
// data/families.json.
//
// data/vehicles.json and data/families.json are GENERATED ARTEFACTS.
// Do not hand-edit them — edit the per-family source files instead and
// re-run this script (`node scripts/build-dataset.js`) to regenerate them.
// A failed validation pass leaves the existing aggregate files untouched.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateVehicle, validateFamily } from '../data/schema.js';

const dataDir = new URL('../data/', import.meta.url).pathname;
const readAll = folder => {
  const dir = join(dataDir, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .flatMap(name => {
      const parsed = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      return Array.isArray(parsed) ? parsed : [parsed];
    });
};

const families = readAll('families');
const vehicles = readAll('vehicles');
const familyIds = new Set(families.map(f => f.id));
let failures = 0;

const fail = message => { console.error(`FAIL ${message}`); failures++; };

for (const row of vehicles) {
  const result = validateVehicle(row);
  if (!result.valid) fail(`${row.id ?? 'unknown'}: ${result.errors.join('; ')}`);
  if (!familyIds.has(row.familyId)) fail(`${row.id}: missing family ${row.familyId}`);
}

for (const entry of families) {
  const result = validateFamily(entry);
  if (!result.valid) fail(`family ${entry.id ?? 'unknown'}: ${result.errors.join('; ')}`);
}

const ids = vehicles.map(v => v.id);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicates.length) fail(`duplicate vehicle ids: ${[...new Set(duplicates)].join(', ')}`);

const covered = new Set(vehicles.map(v => v.familyId));
for (const id of familyIds) {
  if (!covered.has(id)) console.warn(`WARN family ${id} has no variants`);
}

if (failures === 0) {
  const sortById = (a, b) => a.id.localeCompare(b.id);
  writeFileSync(join(dataDir, 'vehicles.json'), JSON.stringify([...vehicles].sort(sortById), null, 2) + '\n');
  writeFileSync(join(dataDir, 'families.json'), JSON.stringify([...families].sort(sortById), null, 2) + '\n');
}

console.log(`${vehicles.length} variants across ${families.length} families, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);
