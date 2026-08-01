#!/usr/bin/env node
// scripts/curate-images.js — the curation CLI that ties together the Commons
// client, the classifier, the cropper and the contact sheet into one run.
//
// Usage:
//   node scripts/curate-images.js                                # curate every family lacking an image
//   node scripts/curate-images.js --dry-run --limit 6             # prove the chain, write nothing to data/
//   node scripts/curate-images.js --alias byd-sealion-6="BYD Song Plus"
//   node scripts/curate-images.js --only kia-ev5,byd-seal
//
// The classifier's verdict is never overridden by a flag. There is no --yes
// that bulk-accepts flagged families — resolving a flag means supplying an
// alias, a checkable statement of fact about what the car is badged as
// elsewhere, not a promise that a human glanced at a thumbnail.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { searchFiles, fileMetadata } from './images/commons.js';
import { classify } from './images/classify.js';
import { downloadAndCrop } from './images/fetch-image.js';
import { contactSheet } from './images/contact-sheet.js';
import { validateImageRecord } from '../data/image-schema.js';

const dataDir = new URL('../data/', import.meta.url).pathname;
const publicDir = new URL('../public/', import.meta.url).pathname;
const rootDir = new URL('../', import.meta.url).pathname;

const FAMILIES_PATH = join(dataDir, 'families.json');
const VEHICLES_PATH = join(dataDir, 'vehicles.json');
const CAR_IMAGES_PATH = join(dataDir, 'car-images.json');
const MODEL_ALIASES_PATH = join(dataDir, 'model-aliases.json');

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

// -- argument parsing --------------------------------------------------------

function parseArgs(argv) {
  const opts = { dryRun: false, limit: undefined, only: null, aliases: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--limit') {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) throw new Error(`--limit must be a non-negative integer, got: ${raw}`);
      opts.limit = n;
    } else if (arg === '--only') {
      const raw = argv[++i];
      if (!raw) throw new Error('--only requires a comma-separated list of family ids');
      opts.only = new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
    } else if (arg === '--alias') {
      const raw = argv[++i];
      const eq = raw ? raw.indexOf('=') : -1;
      if (eq <= 0) throw new Error(`--alias must be id="Name", got: ${raw}`);
      opts.aliases[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  // The prose spec sets a different default depending on --dry-run: no cap
  // for a real run (curate everything outstanding), but 6 for a bare
  // --dry-run so a habit of running it without --limit can't hammer Commons.
  if (opts.limit === undefined) opts.limit = opts.dryRun ? 6 : Infinity;
  return opts;
}

// -- family derivation --------------------------------------------------------

// A family's make/model live on its vehicles, not on the family record
// itself, because a family can carry several variants (trims) that all share
// one photograph. "First variant in data/vehicles.json" is arbitrary but
// deterministic — any variant's make/model names the same car for our
// purposes, and the file's order doesn't change between runs.
function deriveFamilies(families, vehicles) {
  const firstVariantByFamily = new Map();
  for (const v of vehicles) {
    if (!firstVariantByFamily.has(v.familyId)) firstVariantByFamily.set(v.familyId, v);
  }

  const derived = [];
  for (const family of families) {
    const variant = firstVariantByFamily.get(family.id);
    if (!variant) {
      console.warn(`WARN skipping ${family.id}: no variants in data/vehicles.json, nothing to search on`);
      continue;
    }
    derived.push({ id: family.id, make: variant.make, model: variant.model });
  }
  return derived;
}

// -- helpers ------------------------------------------------------------------

const sortedByKey = obj => Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]));

const aliasResolveCommand = id => `node scripts/curate-images.js --alias ${id}="<the car's other name>"`;

// -- main -----------------------------------------------------------------

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`usage error: ${err.message}`);
    process.exit(1);
    return;
  }

  const families = readJson(FAMILIES_PATH);
  const vehicles = readJson(VEHICLES_PATH);
  const existingImages = readJson(CAR_IMAGES_PATH);
  const existingAliases = readJson(MODEL_ALIASES_PATH);

  const derivedFamilies = deriveFamilies(families, vehicles);

  // Step 2: apply --alias first, and persist immediately if this is a real
  // run. An alias is a durable fact about the car ("this is badged as the
  // Song Plus in China"), not a side effect of a successful curation — so it
  // is saved before anything that might fail, and saved even under --dry-run
  // is the one thing it does NOT do, because --dry-run's whole contract is
  // that data/ is untouched. The alias is still applied in-memory for this
  // run either way, so --dry-run can prove alias resolution works without
  // writing the fact down permanently.
  const aliases = { ...existingAliases, ...opts.aliases };
  if (Object.keys(opts.aliases).length > 0 && !opts.dryRun) {
    writeFileSync(MODEL_ALIASES_PATH, JSON.stringify(sortedByKey(aliases), null, 2) + '\n');
    console.log(`Saved ${Object.keys(opts.aliases).length} alias(es) to data/model-aliases.json.`);
  }

  // Where this run's output goes. Dry-run writes to a scratch directory that
  // mirrors the real layout (images alongside the contact sheet) so the
  // contact sheet's relative image paths resolve identically in both modes.
  const imagesDir = opts.dryRun ? join(rootDir, '.image-dryrun', 'images', 'cars') : join(publicDir, 'images', 'cars');
  const contactSheetPath = opts.dryRun ? join(rootDir, '.image-dryrun', 'contact-sheet.html') : join(publicDir, 'contact-sheet.html');
  mkdirSync(imagesDir, { recursive: true });

  // Step 3: the families this run will actually attempt — missing an image,
  // filtered by --only, capped by --limit.
  let queue = derivedFamilies.filter(f => !(f.id in existingImages));
  if (opts.only) {
    const knownIds = new Set(derivedFamilies.map(f => f.id));
    for (const id of opts.only) {
      if (!knownIds.has(id)) console.warn(`WARN --only names ${id}, which is not a known family (check data/vehicles.json)`);
      else if (id in existingImages) console.warn(`WARN --only names ${id}, which already has an image — skipping`);
    }
    queue = queue.filter(f => opts.only.has(f.id));
  }
  queue = queue.slice(0, opts.limit);

  const acceptedRecords = {};
  const contactEntries = [];
  const flagged = [];
  const failed = [];

  for (let i = 0; i < queue.length; i++) {
    if (i > 0) await delay(120); // be polite to a donated service between families
    const family = queue[i];
    const alias = aliases[family.id];

    try {
      const query = alias ?? `${family.make} ${family.model}`;
      const hits = await searchFiles(query, { limit: 5 });
      const candidateTitle = hits[0];

      // When an alias is supplied, the family's real (Australian) model name
      // is exactly what will NOT appear in the Commons title — that's the
      // whole reason an alias was needed. So the model the classifier checks
      // for is the alias itself: the same containment check, applied to the
      // name we now believe the file is filed under.
      const classifyFamily = alias ? { ...family, model: alias } : family;
      const verdict = classify({ family: classifyFamily, candidateTitle, families: derivedFamilies });

      if (verdict.verdict !== 'auto') {
        flagged.push({ family, candidateTitle, why: verdict.why });
        continue;
      }

      const meta = await fileMetadata(candidateTitle);
      const file = `${family.id}.webp`;
      const note = 'Cropped and resized.' + (alias ? ` Searched as ${alias}.` : '');
      const record = { file, source: meta.descriptionUrl, author: meta.author, licence: meta.licence, note };

      // Validate before any write happens — of the JSON record AND of the
      // image file. Metadata (author/licence/source) is known without
      // downloading a single byte, so a record that fails validation here
      // never causes a download, and never leaves an orphaned image on disk
      // that data/car-images.json doesn't reference.
      const { valid, errors } = validateImageRecord(record);
      if (!valid) {
        failed.push({ family, errors });
        continue;
      }

      await downloadAndCrop(meta.downloadUrl, join(imagesDir, file));
      acceptedRecords[family.id] = record;

      // Display verdict for the contact sheet is deliberately not the same
      // thing as classify()'s verdict. classify() always says "auto" once an
      // alias makes the title match — but a human already supplied that
      // alias, so from the reviewer's point of view this case is already
      // resolved and should get the quiet treatment. Only a family that the
      // heuristic accepted entirely on its own, with nobody involved, should
      // get the loud "unreviewed" treatment.
      contactEntries.push({
        familyId: family.id,
        name: `${family.make} ${family.model}`,
        file,
        author: record.author,
        licence: record.licence,
        verdict: alias ? 'manual' : 'auto',
        why: alias ? `resolved via alias — searched as "${alias}"` : verdict.why
      });
    } catch (err) {
      failed.push({ family, errors: [err.message] });
    }
  }

  // Step 4/5: write data/car-images.json (only for a real run) and the
  // contact sheet (always — it's how both modes get reviewed).
  if (!opts.dryRun && Object.keys(acceptedRecords).length > 0) {
    const merged = sortedByKey({ ...existingImages, ...acceptedRecords });
    writeFileSync(CAR_IMAGES_PATH, JSON.stringify(merged, null, 2) + '\n');
  }
  writeFileSync(contactSheetPath, contactSheet(contactEntries, { title: 'Car image curation review' }));

  // Step 6: the summary. The point of printing the exact --alias command is
  // that the human's next action is obvious — no guessing the flag syntax.
  console.log(`\n${Object.keys(acceptedRecords).length} accepted, ${flagged.length} flagged, ${failed.length} failed.`);

  if (flagged.length > 0) {
    console.log('\nFlagged — resolve by supplying the car\'s other name as an alias:');
    for (const f of flagged) {
      const candidate = f.candidateTitle ? ` (top candidate: "${f.candidateTitle}")` : '';
      console.log(`  ${f.family.id}: ${f.why}${candidate}`);
      console.log(`    ${aliasResolveCommand(f.family.id)}`);
    }
  }

  if (failed.length > 0) {
    console.log('\nFailed:');
    for (const f of failed) console.log(`  ${f.family.id}: ${f.errors.join('; ')}`);
  }

  console.log(`\nContact sheet: ${contactSheetPath}`);
  if (opts.dryRun) console.log('Dry run — data/ and public/images/ were not touched.');
}

main();
