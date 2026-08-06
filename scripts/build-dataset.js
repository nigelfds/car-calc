// Merges the per-family research files under data/families/*.json and
// data/vehicles/*.json into the two aggregate files data/vehicles.json and
// data/families.json.
//
// data/vehicles.json and data/families.json are GENERATED ARTEFACTS.
// Do not hand-edit them — edit the per-family source files instead and
// re-run this script (`node scripts/build-dataset.js`) to regenerate them.
// A failed validation pass leaves the existing aggregate files untouched.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateVehicle, validateFamily } from '../data/schema.js';
import { validateImageRecord } from '../data/image-schema.js';

// fileURLToPath, not new URL(...).pathname — the latter percent-encodes
// spaces (and other reserved characters) rather than decoding them, so a
// checkout under a path containing a space silently breaks both this guard
// and every join() built on it. See server/index.js for the same precedent.
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const publicDir = join(here, '..', 'public');
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

// Images live in data/car-images.json rather than in the per-family files under
// data/families/. Those files belong to the research waves, which are landing
// continuously — a batch rewriting a family would drop an image block, this
// script would regenerate the aggregate without it, and the photograph would
// disappear from the site with no error and nothing to notice. Separate files
// cannot collide.
//
// Returns a new array; the caller's families are not mutated.
export function joinImages(families, images) {
  const errors = [];
  const ids = new Set(families.map(f => f.id));

  for (const [familyId, record] of Object.entries(images)) {
    if (!ids.has(familyId)) {
      // A typo'd key would otherwise mean an image that is committed, passes
      // validation, and renders nowhere at all.
      errors.push(`image for unknown family ${familyId}`);
      continue;
    }
    const result = validateImageRecord(record);
    if (!result.valid) errors.push(`image ${familyId}: ${result.errors.join('; ')}`);
  }

  const joined = families.map(family =>
    images[family.id] ? { ...family, image: images[family.id] } : family
  );
  return { joined, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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

  const imagesPath = join(dataDir, 'car-images.json');
  const images = existsSync(imagesPath) ? JSON.parse(readFileSync(imagesPath, 'utf8')) : {};
  const { joined: familiesWithImages, errors: imageErrors } = joinImages(families, images);
  for (const message of imageErrors) fail(message);

  // Every referenced file must actually be on disk. Without this a record can
  // validate, join cleanly, and still render a broken image in the browser.
  for (const [familyId, record] of Object.entries(images)) {
    const file = join(publicDir, 'images', 'cars', record.file ?? '');
    if (record.file && !existsSync(file)) fail(`image ${familyId}: ${record.file} is not in public/images/cars`);
  }

  if (failures === 0) {
    const sortById = (a, b) => a.id.localeCompare(b.id);
    writeFileSync(join(dataDir, 'vehicles.json'), JSON.stringify([...vehicles].sort(sortById), null, 2) + '\n');
    writeFileSync(join(dataDir, 'families.json'), JSON.stringify([...familiesWithImages].sort(sortById), null, 2) + '\n');
  }

  console.log(`${vehicles.length} variants across ${families.length} families, ${failures} failures`);
  process.exit(failures > 0 ? 1 : 0);
}
