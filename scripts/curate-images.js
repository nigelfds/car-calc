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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { searchFiles, fileMetadata } from './images/commons.js';
import { classify } from './images/classify.js';
import { downloadAndCrop } from './images/fetch-image.js';
import { contactSheet } from './images/contact-sheet.js';
import { validateImageRecord } from '../data/image-schema.js';

// fileURLToPath, not new URL(...).pathname — the latter percent-encodes
// spaces rather than decoding them, so a checkout under a path containing a
// space would resolve every join() built on these to a directory that does
// not exist. See server/index.js for the same precedent.
const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, '..');
const dataDir = join(rootDir, 'data');
const publicDir = join(rootDir, 'public');

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
      const id = raw.slice(0, eq).trim();
      const name = raw.slice(eq + 1).trim();
      // An empty value would otherwise be treated as "alias supplied" by the
      // truthiness check at the search-query step but as "no alias" by the
      // ones further down that also check truthiness — an inconsistency
      // that only shows up once such a value is actually in play.
      if (!name) throw new Error(`--alias value for ${id} must not be empty`);
      opts.aliases[id] = name;
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

// --dry-run must round-trip into the printed remedy, or the operator's copy-
// pasted "fix" is a real run against the one flag that's supposed to be safe
// to resolve without touching anything.
const aliasResolveCommand = (id, dryRun) =>
  `node scripts/curate-images.js --alias ${id}="<the car's other name>"${dryRun ? ' --dry-run' : ''}`;

// Aliases are stored make-inclusive ("BYD Song Plus") because that's how a
// human naturally writes down "what this car is badged as" — but classify()
// deliberately checks the model only, not the make (see classify.js's own
// comment: requiring the make caused false flags on files legitimately
// titled "Ora 5 001.jpg" and "MERCEDES-EQ EQB China"). Substituting the
// alias whole would silently re-impose the make requirement on exactly the
// path where a human has already done the hard part of naming the car, so
// strip a leading make before using the alias as the model to check for.
// Both "BYD Song Plus" and "Song Plus" work: the make prefix is optional.
function aliasModelFor(alias, make) {
  const prefix = `${make.trim()} `.toLowerCase();
  return alias.toLowerCase().startsWith(prefix) ? alias.slice(prefix.length).trim() : alias.trim();
}

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
  const knownIds = new Set(derivedFamilies.map(f => f.id));

  // Unlike --only (which only warns), an unresolvable --alias must stop the
  // run: it is the sole sanctioned way to resolve a classifier flag, and a
  // typo'd id here would otherwise be sorted, persisted to
  // data/model-aliases.json and committed while never actually applying —
  // the operator believing the flag is resolved when it is not.
  try {
    for (const id of Object.keys(opts.aliases)) {
      if (!knownIds.has(id)) throw new Error(`--alias names ${id}, which is not a known family (check data/vehicles.json)`);
    }
  } catch (err) {
    console.error(`usage error: ${err.message}`);
    process.exit(1);
    return;
  }

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

      // When an alias is supplied, the family's real (Australian) model name
      // is exactly what will NOT appear in the Commons title — that's the
      // whole reason an alias was needed. So the model the classifier checks
      // for is derived from the alias (make prefix stripped, since classify
      // deliberately checks the model only — see aliasModelFor above).
      const classifyFamily = alias ? { ...family, model: aliasModelFor(alias, family.make) } : family;

      // Unaliased families still classify strictly the top hit only — that
      // is the conservative behaviour the 74/25 auto/flag split was measured
      // against. But when a human has already supplied an alias, they have
      // asserted the identity; trusting Commons' relevance ranking to also
      // put the right file first is a second, unrelated bet. If it doesn't
      // land, the one sanctioned way to resolve a flag (supply a true fact)
      // becomes unreachable for that family no matter what correct text is
      // given — worse than the inconvenience of a wrong top hit. Scanning
      // costs no extra requests; all five hits are already in hand.
      let candidateIndex = alias
        ? hits.findIndex(title => classify({ family: classifyFamily, candidateTitle: title, families: derivedFamilies }).verdict === 'auto')
        : 0;
      if (candidateIndex === -1) candidateIndex = 0; // nothing matched; fall back to reporting on the top hit as before
      const candidateTitle = hits[candidateIndex];
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
      // Record the rank when the accepted hit wasn't the top one — the
      // contact sheet is the documented backstop, and a reviewer should be
      // able to see that an entry was picked from candidate 3 of 5 rather
      // than assume every accepted image was the obvious first result.
      const rankNote = candidateIndex > 0 ? ` (candidate ${candidateIndex + 1} of ${hits.length})` : '';
      contactEntries.push({
        familyId: family.id,
        name: `${family.make} ${family.model}`,
        file,
        // The Commons title and a link back to it are the single most
        // legible signal a reviewer has that the car is wrong — the BYD
        // Seal U auto-accepted for the Seal was caught by opening the file,
        // not by anything the sheet showed at the time.
        candidateTitle,
        source: record.source,
        author: record.author,
        licence: record.licence,
        verdict: alias ? 'manual' : 'auto',
        why: alias ? `resolved via alias${rankNote} — searched as "${alias}"` : verdict.why
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
      console.log(`    ${aliasResolveCommand(f.family.id, opts.dryRun)}`);
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
