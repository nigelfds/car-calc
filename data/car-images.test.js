// Repo invariants for the curated car images. Unlike image-schema.test.js,
// which checks record shape against fixtures, these two tests read the actual
// committed state — data/car-images.json and public/images/cars/ — and assert
// that the two agree with each other and with the canonical crop size.
//
// Both tests pass vacuously while no images are committed. That is the honest
// state today (curation is deferred until the research waves finish), and it
// is why each test names its subject count in the assertion message: a run
// that checked nothing reads as "0 images" rather than as a silent green.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IMAGE_DIMENSIONS, CAR_IMAGE_DIR } from '../public/ui/image-constants.js';

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(here, '..', 'public', CAR_IMAGE_DIR);

const manifest = JSON.parse(readFileSync(join(here, 'car-images.json'), 'utf8'));

// .gitkeep holds the directory in git while it is empty; it is not an image.
const onDisk = readdirSync(imagesDir).filter(name => !name.startsWith('.'));
const referenced = Object.values(manifest).map(record => record.file);

test('every committed image is exactly the canonical crop', async () => {
  // Imported lazily so a checkout with no images — or a production install,
  // where sharp is absent as a devDependency — does not fail on the import
  // alone. Where there ARE images, sharp is the same library that produced
  // them, so requiring it here costs nothing a curation run does not already.
  const { default: sharp } = onDisk.length > 0 ? await import('sharp') : { default: null };

  for (const name of onDisk) {
    const meta = await sharp(join(imagesDir, name)).metadata();
    assert.equal(meta.format, 'webp', `${name} is ${meta.format}, not webp`);
    assert.equal(
      `${meta.width}x${meta.height}`,
      `${IMAGE_DIMENSIONS.width}x${IMAGE_DIMENSIONS.height}`,
      `${name} is not the canonical crop`
    );
  }
  console.log(`  checked ${onDisk.length} committed image(s)`);
});

test('the manifest and the images directory agree in both directions', () => {
  // Checked both ways on purpose. A referenced file that is missing renders a
  // broken image in the browser; an unreferenced file on disk is a committed
  // binary nothing points at — usually the leftover of a family whose record
  // was removed, and invisible unless something looks for it.
  const missing = referenced.filter(file => !onDisk.includes(file));
  assert.deepEqual(missing, [], `referenced but not on disk: ${missing.join(', ')}`);

  const orphaned = onDisk.filter(file => !referenced.includes(file));
  assert.deepEqual(orphaned, [], `on disk but referenced by no family: ${orphaned.join(', ')}`);

  console.log(`  ${referenced.length} referenced, ${onDisk.length} on disk`);
});
