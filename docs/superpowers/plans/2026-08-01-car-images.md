# Car Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render one consistently-cropped, freely-licensed photograph per car family on the shortlist cards and compare-tab columns, with a curation pipeline that picks safe matches automatically and flags ambiguous ones.

**Architecture:** Image data lives in `data/car-images.json`, deliberately separate from `data/families/*.json` so continuously-landing research batches cannot silently drop it. `build-dataset.js` joins the two when generating the aggregate. A curation CLI queries Wikimedia Commons, classifies candidates with a sibling-aware heuristic, and only writes what it can match safely.

**Tech Stack:** Node 22, native ES modules, no bundler, no build step. `node --test`. `sharp` as the single new devDependency.

## Global Constraints

- **Node 22** (pinned in `.nvmrc`). The only new dependency is `sharp`, and it is a **devDependency** — images are committed artefacts, so production never touches it and the Heroku slug is unaffected.
- **No build step for browser code.** Everything under `public/` must run unchanged in Node and the browser. No bare-specifier imports there.
- **`validateFamily` in `data/schema.js` must not change.** Research batches are landing continuously and validate against it. The dormant `images` array inside it is left untouched — deleting it is a separate commit after the waves finish.
- **Nothing writes to `data/families/*.json` or `data/vehicles/*.json`.** Those files belong to the research waves.
- Renderers build an HTML string and assign it to `innerHTML` via `root.querySelector`, matching `renderCards` in `public/ui/cars.js`. Listeners bind once on a stable parent and delegate.
- **Escape every interpolated string** before it reaches `innerHTML`, using the shared helper in `public/ui/escape.js`.
- Image files are exactly **900×600 WebP, quality 80**.
- `data/car-images.json` ships as `{}`. Bulk curation happens after the research waves finish; a family with no image must render exactly as it does today.
- House style: 2-space indent, single quotes, semicolons, comments that explain *why*.
- The pre-push hook runs the suite and refuses a red push. Every task ends green.

Spec: `docs/superpowers/specs/2026-07-31-car-images-design.md`.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `data/car-images.json` | The image records, keyed by family id. Ships as `{}`. |
| `data/model-aliases.json` | Market-name aliases, keyed by family id. Ships as `{}`. |
| `data/image-schema.js` | `validateImageRecord` — pure, separate from `schema.js`. |
| `data/image-schema.test.js` | Tests for the above. |
| `scripts/images/classify.js` | Normalisation + the auto/flag classifier. Pure. |
| `scripts/images/classify.test.js` | Tests, including the sibling and alias traps. |
| `scripts/images/commons.js` | Commons search and file metadata. Injectable `fetch`. |
| `scripts/images/commons.test.js` | Tests against a stub fetch. |
| `scripts/images/fetch-image.js` | Download, crop to 900×600, convert to WebP. |
| `scripts/images/fetch-image.test.js` | Tests against a generated fixture image. |
| `scripts/images/contact-sheet.js` | Builds the review HTML. Pure. |
| `scripts/images/contact-sheet.test.js` | Tests for the above. |
| `scripts/curate-images.js` | The CLI that orchestrates the above. |
| `public/credits.html` | Image credits, rendered client-side from `/api/dataset`. |
| `public/images/cars/.gitkeep` | So the directory exists before any image is curated. |

**Modify:**

| File | Change |
|---|---|
| `scripts/build-dataset.js` | Read and validate `car-images.json`; join into generated `families.json`. |
| `public/ui/cars.js` | `cardModel` carries `image`; `renderCards` emits the figure. |
| `public/ui/compare-tab.js` | Column headers carry the image. |
| `public/styles.css` | Card figure, compare-header figure, credits page. |
| `public/index.html` | Credits link in the footer. |
| `package.json` | `sharp` devDependency; `curate` script. |
| `README.md` | Replace the "no photography" statement. |
| `.gitignore` | Ignore the dry-run scratch directory. |

---

### Task 1: The image record validator

**Files:**
- Create: `data/image-schema.js`, `data/image-schema.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateImageRecord(record)` → `{ valid: boolean, errors: string[] }`, and `IMAGE_DIMENSIONS = { width: 900, height: 600 }`.

This lives in its own module rather than in `schema.js` because `validateFamily` must not change while research batches are validating against it.

- [ ] **Step 1: Write the failing test**

Create `data/image-schema.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageRecord, IMAGE_DIMENSIONS } from './image-schema.js';

const valid = {
  file: 'byd-sealion-6.webp',
  source: 'https://commons.wikimedia.org/wiki/File:BYD_Song_Plus_001.jpg',
  author: 'Alexander Migl',
  licence: 'CC BY-SA 4.0',
  note: 'Cropped and resized. Sold in China as the Song Plus DM-i.'
};

test('a complete record is valid', () => {
  assert.deepEqual(validateImageRecord(valid), { valid: true, errors: [] });
});

test('the file must be a lowercase slug ending in .webp', () => {
  for (const file of ['Byd.webp', 'byd sealion.webp', 'byd-sealion-6.jpg', '../escape.webp']) {
    assert.equal(validateImageRecord({ ...valid, file }).valid, false, file);
  }
});

test('the source must be an https commons URL', () => {
  assert.equal(validateImageRecord({ ...valid, source: 'http://commons.wikimedia.org/wiki/File:x.jpg' }).valid, false);
  assert.equal(validateImageRecord({ ...valid, source: 'https://example.com/x.jpg' }).valid, false);
});

test('author and licence must be non-empty', () => {
  assert.equal(validateImageRecord({ ...valid, author: '' }).valid, false);
  assert.equal(validateImageRecord({ ...valid, licence: '   ' }).valid, false);
});

test('only recognised free licences are accepted', () => {
  for (const licence of ['CC BY 4.0', 'CC BY-SA 4.0', 'CC0', 'Public domain']) {
    assert.equal(validateImageRecord({ ...valid, licence }).valid, true, licence);
  }
  // A non-free or unknown licence must not slip through — this is the check that
  // stops an all-rights-reserved press photo being committed by mistake.
  assert.equal(validateImageRecord({ ...valid, licence: 'All rights reserved' }).valid, false);
});

test('a share-alike licence requires the modification to be noted', () => {
  // CC BY-SA obliges us to indicate that the work was changed, and every image
  // here is cropped. A record without that note is not compliant.
  const noNote = { ...valid };
  delete noNote.note;
  assert.equal(validateImageRecord(noNote).valid, false);
  assert.equal(validateImageRecord({ ...noNote, licence: 'CC0' }).valid, true);
});

test('errors name every problem, not just the first', () => {
  const result = validateImageRecord({ file: 'X.png', source: 'nope', author: '', licence: 'CC BY 4.0' });
  assert.ok(result.errors.length >= 3, result.errors.join('; '));
});

test('the canonical dimensions are exported for the crop and the tests to share', () => {
  assert.deepEqual(IMAGE_DIMENSIONS, { width: 900, height: 600 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test data/image-schema.test.js`
Expected: FAIL — cannot find module `./image-schema.js`.

- [ ] **Step 3: Implement**

Create `data/image-schema.js`:

```javascript
// data/image-schema.js — validation for the per-family image records in
// data/car-images.json.
//
// Deliberately NOT part of data/schema.js. validateFamily is what the research
// waves validate against, batches are landing continuously, and changing it
// while they run buys nothing. Image data is a separate concern with a
// separate cadence, so it gets a separate validator that only
// scripts/build-dataset.js calls.

// One shared constant so the crop, the validator and the tests cannot disagree
// about what "consistent" means. Identical framing across every family is the
// whole reason the grid reads as designed rather than scraped.
export const IMAGE_DIMENSIONS = { width: 900, height: 600 };

// Lowercase slug plus .webp, anchored. The anchoring matters: the value is
// interpolated into a filesystem path, and "../escape.webp" must not pass.
const FILE_RE = /^[a-z0-9]+(-[a-z0-9]+)*\.webp$/;
const SOURCE_RE = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/;

// Only licences that actually permit republication. An unrecognised string is
// rejected rather than assumed free — the failure mode we are guarding against
// is an all-rights-reserved press photo being committed because nobody checked.
const FREE_LICENCES = new Set(['CC BY 4.0', 'CC BY-SA 4.0', 'CC BY 3.0', 'CC BY-SA 3.0', 'CC0', 'Public domain']);

// Share-alike obliges us to indicate that the work was modified, and every
// image here is cropped to 3:2. So on those licences the note is a licence
// obligation, not documentation.
const REQUIRES_MODIFICATION_NOTE = licence => licence.includes('BY-SA');

const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

export function validateImageRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['record is not an object'] };
  }

  if (typeof record.file !== 'string' || !FILE_RE.test(record.file)) {
    errors.push('file must be a lowercase slug ending in .webp');
  }
  if (typeof record.source !== 'string' || !SOURCE_RE.test(record.source)) {
    errors.push('source must be an https commons.wikimedia.org File: URL');
  }
  if (!nonEmpty(record.author)) errors.push('author must be a non-empty string');

  if (!nonEmpty(record.licence)) {
    errors.push('licence must be a non-empty string');
  } else if (!FREE_LICENCES.has(record.licence.trim())) {
    errors.push(`licence ${record.licence} is not a recognised free licence`);
  } else if (REQUIRES_MODIFICATION_NOTE(record.licence) && !nonEmpty(record.note)) {
    errors.push('a share-alike licence requires note to record that the image was cropped');
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test data/image-schema.test.js`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add data/image-schema.js data/image-schema.test.js
git commit -m "feat: validation for per-family image records"
```

---

### Task 2: Join images into the built dataset

**Files:**
- Create: `data/car-images.json`, `data/model-aliases.json`, `public/images/cars/.gitkeep`
- Modify: `scripts/build-dataset.js`
- Test: `scripts/build-dataset.test.js` (create)

**Interfaces:**
- Consumes: `validateImageRecord` from `data/image-schema.js`.
- Produces: each entry in the generated `data/families.json` carries an `image` object when one exists in `data/car-images.json`. Families without one are unchanged.

- [ ] **Step 1: Create the empty data files**

`data/car-images.json`:

```json
{}
```

`data/model-aliases.json`:

```json
{}
```

Create `public/images/cars/.gitkeep` as an empty file so the directory exists before anything is curated.

- [ ] **Step 2: Write the failing test**

`scripts/build-dataset.js` is a top-to-bottom script rather than a module, so test the joining logic by extracting it. Create `scripts/build-dataset.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinImages } from './build-dataset.js';

const families = [{ id: 'kia-ev5' }, { id: 'byd-seal' }];
const images = {
  'kia-ev5': {
    file: 'kia-ev5.webp',
    source: 'https://commons.wikimedia.org/wiki/File:Kia_EV5_001.jpg',
    author: 'A Photographer',
    licence: 'CC BY 4.0'
  }
};

test('a family with an image record carries it into the aggregate', () => {
  const { joined } = joinImages(families, images);
  assert.equal(joined.find(f => f.id === 'kia-ev5').image.file, 'kia-ev5.webp');
});

test('a family without an image record is untouched and carries no image key', () => {
  const { joined } = joinImages(families, images);
  const seal = joined.find(f => f.id === 'byd-seal');
  assert.equal('image' in seal, false);
});

test('an empty image map leaves every family unchanged', () => {
  const { joined, errors } = joinImages(families, {});
  assert.deepEqual(errors, []);
  assert.deepEqual(joined, families);
});

test('an image keyed to an unknown family is an error, not a silent no-op', () => {
  // Catches a typo'd family id in car-images.json, which would otherwise mean an
  // image that is committed, validated, and never rendered anywhere.
  const { errors } = joinImages(families, { ...images, 'kia-ev99': images['kia-ev5'] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /kia-ev99/);
});

test('an invalid image record is reported against its family id', () => {
  const { errors } = joinImages(families, { 'kia-ev5': { file: 'NOPE.png' } });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /kia-ev5/);
});

test('joining does not mutate the families passed in', () => {
  const input = [{ id: 'kia-ev5' }];
  joinImages(input, images);
  assert.equal('image' in input[0], false);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test scripts/build-dataset.test.js`
Expected: FAIL — `joinImages` is not exported.

- [ ] **Step 4: Implement**

In `scripts/build-dataset.js`, add to the imports:

```javascript
import { validateImageRecord } from '../data/image-schema.js';
```

Add the exported function above the top-level script body:

```javascript
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
```

Then wire it into the script body. After the existing family validation loop and before the duplicate-id check, add:

```javascript
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
```

Add `publicDir` beside the existing `dataDir`:

```javascript
const publicDir = new URL('../public/', import.meta.url).pathname;
```

Change the write to use the joined array:

```javascript
  writeFileSync(join(dataDir, 'families.json'), JSON.stringify([...familiesWithImages].sort(sortById), null, 2) + '\n');
```

**Guard the script body so importing the module doesn't run it.** Wrap everything from `const families = readAll('families')` to the final `process.exit` in:

```javascript
if (process.argv[1] === new URL(import.meta.url).pathname) {
  // ... existing script body ...
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test scripts/build-dataset.test.js`
Expected: PASS, all 6 tests.

- [ ] **Step 6: Verify the real build still works**

Run: `node scripts/build-dataset.js`
Expected: the same variant and family counts as before, 0 failures, and `git diff --stat data/families.json` shows **no change** — `car-images.json` is empty, so the aggregate must be byte-identical. If it differs, the guard or the join is wrong.

- [ ] **Step 7: Run the full suite and commit**

```bash
npm test
git add data/car-images.json data/model-aliases.json data/image-schema.js public/images/cars/.gitkeep scripts/build-dataset.js scripts/build-dataset.test.js
git commit -m "feat: join per-family images into the built dataset"
```

---

### Task 3: The candidate classifier

**Files:**
- Create: `scripts/images/classify.js`, `scripts/images/classify.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `normalise(text)` → comparable string
  - `containsTerm(haystack, needle)` → boolean
  - `classify({ family, candidateTitle, families })` → `{ verdict: 'auto' | 'manual', why: string }`

`family` and each entry of `families` is `{ id, make, model }`.

This is the heart of the feature and gets the most test weight. It measured 74 auto / 25 manual against 99 families; the bias is deliberate — a false flag costs twenty seconds, a false auto-accept ships the wrong car above a correct price.

- [ ] **Step 1: Write the failing test**

Create `scripts/images/classify.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, containsTerm, classify } from './classify.js';

// A slice of the real dataset, chosen for the traps it contains.
const families = [
  { id: 'byd-seal', make: 'BYD', model: 'Seal' },
  { id: 'byd-seal-6', make: 'BYD', model: 'Seal 6' },
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/images/classify.test.js`
Expected: FAIL — cannot find module `./classify.js`.

- [ ] **Step 3: Implement**

Create `scripts/images/classify.js`:

```javascript
// scripts/images/classify.js — decides whether a Commons search hit can be
// accepted for a family automatically, or needs a human to confirm it.
//
// The problem this exists for: these cars carry different badges in different
// markets, so the Australian name is often not the name the photograph is filed
// under. A Sealion 6 is filed as a Song Plus, an EX5 as a Galaxy E5. Most such
// hits are the right car — but not all, and nothing in the filename says which.
// A survey of the live dataset turned up an ID.5 offered for the ID.4, a 1959
// Morris Mini for the Mini Cooper, and a Seal U for the Seal.
//
// That is the failure docs/phev-research-wave.md describes for REEVs mis-filed
// as PHEVs: "wrong in a way the schema cannot catch". A photograph of the wrong
// car above a correct price costs the same credibility a wrong price would.
//
// So the bias is deliberate and one-directional: a false flag costs the reader
// twenty seconds, a false auto-accept ships the wrong car.

// Fold the three ways the same name is written differently across Commons:
// diacritics (Škoda / Skoda), glued letter-digit pairs (MG4 / MG 4) and
// zero-padded numbers (Sealion 07 / Sealion 7). Each of these caused a false
// flag in the survey before it was handled.
export function normalise(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b0+(\d)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Whole-term containment, not substring. " seal " must not match inside
// "sealion", which is exactly the pair the dataset contains.
export function containsTerm(haystack, needle) {
  const n = normalise(needle);
  return n.length > 0 && ` ${normalise(haystack)} `.includes(` ${n} `);
}

// Families of the same make whose model name overlaps this one in either
// direction — BYD Seal against Seal 6 and Sealion 6. Derived from the dataset
// rather than hand-listed, so it stays correct as the research waves add
// families.
function siblingsOf(family, families) {
  return families.filter(other =>
    other.id !== family.id &&
    normalise(other.make) === normalise(family.make) &&
    (containsTerm(other.model, family.model) || containsTerm(family.model, other.model))
  );
}

export function classify({ family, candidateTitle, families }) {
  if (!candidateTitle) {
    return { verdict: 'manual', why: 'no candidate returned for this family' };
  }

  // The make is advisory: the search query already constrained the brand, and
  // requiring it caused false flags on files titled "Ora 5 001.jpg" and
  // "MERCEDES-EQ EQB China". The model is what must be present.
  if (!containsTerm(candidateTitle, family.model)) {
    return { verdict: 'manual', why: 'model absent from the title — probably a market alias' };
  }

  // A more specific sibling matching the same title means the hit is more
  // likely to be that car than this one.
  const clash = siblingsOf(family, families).find(sibling =>
    containsTerm(candidateTitle, sibling.model) &&
    normalise(sibling.model).length > normalise(family.model).length
  );
  if (clash) {
    return { verdict: 'manual', why: `ambiguous with ${clash.make} ${clash.model}` };
  }

  return { verdict: 'auto', why: 'model matches with no sibling clash' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/images/classify.test.js`
Expected: PASS, all 14 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/images/classify.js scripts/images/classify.test.js
git commit -m "feat: sibling-aware classifier for Commons image candidates"
```

---

### Task 4: The Commons client

**Files:**
- Create: `scripts/images/commons.js`, `scripts/images/commons.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `searchFiles(query, { fetchImpl, limit })` → `Promise<string[]>` of file titles without the `File:` prefix
  - `fileMetadata(title, { fetchImpl })` → `Promise<{ downloadUrl, author, licence, descriptionUrl }>`
  - `USER_AGENT` — the string sent on every request

`fetchImpl` defaults to global `fetch` and is injected in tests, so no test touches the network.

Commons asks API clients to identify themselves; `USER_AGENT` does that.

- [ ] **Step 1: Write the failing test**

Create `scripts/images/commons.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchFiles, fileMetadata, USER_AGENT } from './commons.js';

const stub = payload => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => payload };
  };
  return { fetchImpl, calls };
};

test('searchFiles returns titles with the File: prefix stripped', async () => {
  const { fetchImpl } = stub({
    query: { search: [{ title: 'File:BYD Atto 3 001.jpg' }, { title: 'File:BYD Atto 3 rear.jpg' }] }
  });
  assert.deepEqual(await searchFiles('BYD Atto 3', { fetchImpl }), ['BYD Atto 3 001.jpg', 'BYD Atto 3 rear.jpg']);
});

test('searchFiles returns an empty array when nothing matches', async () => {
  const { fetchImpl } = stub({ query: { search: [] } });
  assert.deepEqual(await searchFiles('Forthing Taikon 5', { fetchImpl }), []);
});

test('searchFiles restricts results to the File namespace', async () => {
  const { fetchImpl, calls } = stub({ query: { search: [] } });
  await searchFiles('Kia EV5', { fetchImpl });
  assert.match(calls[0].url, /srnamespace=6/);
});

test('every request identifies the client', async () => {
  const { fetchImpl, calls } = stub({ query: { search: [] } });
  await searchFiles('Kia EV5', { fetchImpl });
  assert.equal(calls[0].options.headers['User-Agent'], USER_AGENT);
  assert.ok(USER_AGENT.includes('car-calc'));
});

test('fileMetadata extracts the download URL, author and licence', async () => {
  const { fetchImpl } = stub({
    query: { pages: { 123: { imageinfo: [{
      url: 'https://upload.wikimedia.org/x/BYD.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:BYD.jpg',
      extmetadata: {
        Artist: { value: '<a href="/wiki/User:Migl">Alexander Migl</a>' },
        LicenseShortName: { value: 'CC BY-SA 4.0' }
      }
    }] } } }
  });
  const meta = await fileMetadata('BYD.jpg', { fetchImpl });
  assert.equal(meta.downloadUrl, 'https://upload.wikimedia.org/x/BYD.jpg');
  assert.equal(meta.licence, 'CC BY-SA 4.0');
  assert.equal(meta.descriptionUrl, 'https://commons.wikimedia.org/wiki/File:BYD.jpg');
});

test('the author is stripped of the markup Commons wraps it in', async () => {
  // extmetadata returns HTML. Storing it raw would put a live anchor into the
  // credits page and into the committed data file.
  const { fetchImpl } = stub({
    query: { pages: { 1: { imageinfo: [{
      url: 'https://u/x.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
      extmetadata: { Artist: { value: '<a href="/wiki/User:Migl" title="x">Alexander Migl</a>' }, LicenseShortName: { value: 'CC0' } }
    }] } } }
  });
  assert.equal((await fileMetadata('x.jpg', { fetchImpl })).author, 'Alexander Migl');
});

test('a file with no usable metadata throws rather than returning blanks', async () => {
  const { fetchImpl } = stub({ query: { pages: { '-1': { missing: '' } } } });
  await assert.rejects(() => fileMetadata('nope.jpg', { fetchImpl }), /nope\.jpg/);
});

test('a non-ok response throws', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(() => searchFiles('Kia EV5', { fetchImpl }), /429/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/images/commons.test.js`
Expected: FAIL — cannot find module `./commons.js`.

- [ ] **Step 3: Implement**

Create `scripts/images/commons.js`:

```javascript
// scripts/images/commons.js — the two Wikimedia Commons calls this feature
// needs: search for candidate files, and read one file's licence, author and
// download URL.
//
// fetch is injected so the tests never touch the network. Commons asks API
// clients to identify themselves with a contactable User-Agent; anonymous
// clients get rate-limited harder.

const API = 'https://commons.wikimedia.org/w/api.php';
export const USER_AGENT = 'car-calc-images/1.0 (https://github.com/nigelfds/car-calc; nigel@nigel.in)';

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Commons request failed: ${response.status}`);
  return response.json();
}

export async function searchFiles(query, { fetchImpl = fetch, limit = 5 } = {}) {
  // srnamespace=6 is the File namespace. Without it the search returns article
  // and category pages, which have no image to download.
  const url = `${API}?action=query&list=search&srsearch=${encodeURIComponent(query)}`
    + `&srnamespace=6&srlimit=${limit}&format=json&origin=*`;
  const payload = await getJson(url, fetchImpl);
  return (payload.query?.search ?? []).map(hit => hit.title.replace(/^File:/, ''));
}

export async function fileMetadata(title, { fetchImpl = fetch } = {}) {
  const url = `${API}?action=query&titles=${encodeURIComponent(`File:${title}`)}`
    + '&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*';
  const payload = await getJson(url, fetchImpl);
  const page = Object.values(payload.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`no image info for ${title}`);

  const meta = info.extmetadata ?? {};
  // extmetadata values are HTML fragments — Artist is typically an anchor to
  // the uploader's user page. Strip the markup: this string is written into a
  // committed data file and rendered on the credits page.
  const author = String(meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim();

  return {
    downloadUrl: info.url,
    descriptionUrl: info.descriptionurl,
    author,
    licence: String(meta.LicenseShortName?.value ?? '').trim()
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/images/commons.test.js`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/images/commons.js scripts/images/commons.test.js
git commit -m "feat: Wikimedia Commons search and file metadata client"
```

---

### Task 5: Download, crop and convert

**Files:**
- Create: `scripts/images/fetch-image.js`, `scripts/images/fetch-image.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `IMAGE_DIMENSIONS` from `data/image-schema.js`.
- Produces: `cropToCard(buffer)` → `Promise<Buffer>` (900×600 WebP), and `downloadAndCrop(url, destPath, { fetchImpl })` → `Promise<void>`.

- [ ] **Step 1: Add sharp**

```bash
npm install --save-dev sharp
```

`sharp` ships native binaries. It is a **devDependency**: images are committed artefacts, so nothing in `server/` or `public/` imports it and the Heroku slug is unaffected. Confirm `package.json` lists it under `devDependencies`, not `dependencies`.

- [ ] **Step 2: Write the failing test**

Create `scripts/images/fetch-image.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { cropToCard, downloadAndCrop } from './fetch-image.js';
import { IMAGE_DIMENSIONS } from '../../data/image-schema.js';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// A generated source image, so the test needs no fixture file and no network.
const source = (width, height) => sharp({
  create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } }
}).jpeg().toBuffer();

test('a wide source is cropped to exactly the card dimensions', async () => {
  const out = await cropToCard(await source(2400, 1000));
  const meta = await sharp(out).metadata();
  assert.equal(meta.width, IMAGE_DIMENSIONS.width);
  assert.equal(meta.height, IMAGE_DIMENSIONS.height);
});

test('a tall source is cropped to exactly the card dimensions', async () => {
  const out = await cropToCard(await source(800, 1600));
  const meta = await sharp(out).metadata();
  assert.equal(meta.width, IMAGE_DIMENSIONS.width);
  assert.equal(meta.height, IMAGE_DIMENSIONS.height);
});

test('a source smaller than the target is still produced at the target size', async () => {
  // Commons has plenty of modest-resolution uploads; upscaling is better than
  // a grid where some cards are short.
  const meta = await sharp(await cropToCard(await source(600, 400))).metadata();
  assert.equal(meta.width, IMAGE_DIMENSIONS.width);
  assert.equal(meta.height, IMAGE_DIMENSIONS.height);
});

test('the output is webp', async () => {
  assert.equal((await sharp(await cropToCard(await source(1800, 1200))).metadata()).format, 'webp');
});

test('downloadAndCrop writes a cropped webp to the destination', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'carimg-'));
  try {
    const body = await source(1800, 1200);
    const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) });
    const dest = join(dir, 'kia-ev5.webp');
    await downloadAndCrop('https://upload.wikimedia.org/x.jpg', dest, { fetchImpl });
    const meta = await sharp(readFileSync(dest)).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, IMAGE_DIMENSIONS.width);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a failed download throws and writes nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'carimg-'));
  try {
    const fetchImpl = async () => ({ ok: false, status: 404 });
    await assert.rejects(() => downloadAndCrop('https://u/x.jpg', join(dir, 'x.webp'), { fetchImpl }), /404/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test scripts/images/fetch-image.test.js`
Expected: FAIL — cannot find module `./fetch-image.js`.

- [ ] **Step 4: Implement**

Create `scripts/images/fetch-image.js`:

```javascript
// scripts/images/fetch-image.js — download a Commons file and produce the
// committed card image.
//
// Every output is exactly the same size. That is the point: consistent framing
// across every family is what makes the grid read as designed rather than
// scraped, and a set of differently-shaped photographs would look worse than
// the no-image state this replaces.

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { USER_AGENT } from './commons.js';
import { IMAGE_DIMENSIONS } from '../../data/image-schema.js';

export async function cropToCard(buffer) {
  return sharp(buffer)
    // cover crops rather than letterboxes, so no card gets bars down the side.
    // Centre is the right anchor for press and motor-show shots, where the car
    // is the subject and roughly central.
    .resize(IMAGE_DIMENSIONS.width, IMAGE_DIMENSIONS.height, { fit: 'cover', position: 'centre' })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function downloadAndCrop(url, destPath, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  const cropped = await cropToCard(Buffer.from(await response.arrayBuffer()));
  await writeFile(destPath, cropped);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test scripts/images/fetch-image.test.js`
Expected: PASS, all 6 tests.

- [ ] **Step 6: Run the full suite and commit**

```bash
npm test
git add package.json package-lock.json scripts/images/fetch-image.js scripts/images/fetch-image.test.js
git commit -m "feat: download, crop and convert Commons images to card size"
```

---

### Task 6: The contact sheet

**Files:**
- Create: `scripts/images/contact-sheet.js`, `scripts/images/contact-sheet.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `contactSheet(entries, { title })` → HTML string. Each entry is `{ familyId, name, file, author, licence, verdict, why }`.

Reviewing 105 crops on one page takes under a minute and catches anything the classifier got confidently wrong. This is the safety net that makes automatic acceptance comfortable.

- [ ] **Step 1: Write the failing test**

Create `scripts/images/contact-sheet.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactSheet } from './contact-sheet.js';

const entries = [
  { familyId: 'kia-ev5', name: 'Kia EV5', file: 'kia-ev5.webp', author: 'A Photographer', licence: 'CC BY 4.0', verdict: 'auto', why: 'model matches with no sibling clash' },
  { familyId: 'byd-sealion-6', name: 'BYD Sealion 6', file: 'byd-sealion-6.webp', author: 'Alexander Migl', licence: 'CC BY-SA 4.0', verdict: 'manual', why: 'resolved via alias' }
];

test('every entry gets an image tag pointing at its file', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /src="[^"]*kia-ev5\.webp"/);
  assert.match(html, /src="[^"]*byd-sealion-6\.webp"/);
});

test('each entry is captioned with the car, the author and the licence', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /Kia EV5/);
  assert.match(html, /Alexander Migl/);
  assert.match(html, /CC BY-SA 4\.0/);
});

test('automatically accepted entries are visually distinguished from resolved flags', () => {
  // The reviewer's attention should go to what the classifier decided alone.
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /verdict--auto/);
  assert.match(html, /verdict--manual/);
});

test('the document is a complete standalone page', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<\/html>\s*$/);
  assert.match(html, /<title>Review<\/title>/);
});

test('an empty set renders a page saying so rather than an empty grid', () => {
  assert.match(contactSheet([], { title: 'Review' }), /nothing to review/i);
});

test('captions are escaped', () => {
  const html = contactSheet([{ ...entries[0], author: '<script>alert(1)</script>' }], { title: 'Review' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/images/contact-sheet.test.js`
Expected: FAIL — cannot find module `./contact-sheet.js`.

- [ ] **Step 3: Implement**

Create `scripts/images/contact-sheet.js`. Build a complete standalone HTML document with an inline `<style>` and a CSS grid of figures, one per entry, each showing the image, the car name, `author · licence`, and the verdict as a class (`verdict--auto` / `verdict--manual`) so accepted-alone entries can be spotted. Escape every interpolated value with the same helper pattern used elsewhere in the repo. Return the "nothing to review" page when `entries` is empty.

Images are referenced relatively (`images/cars/<file>` or the dry-run directory's own layout), so the sheet works when opened from the directory it is written into.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/images/contact-sheet.test.js`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/images/contact-sheet.js scripts/images/contact-sheet.test.js
git commit -m "feat: contact sheet for reviewing curated images"
```

---

### Task 7: The curation CLI

**Files:**
- Create: `scripts/curate-images.js`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: everything from Tasks 1 and 3–6, plus `data/families.json`, `data/vehicles.json`, `data/car-images.json`, `data/model-aliases.json`.
- Produces: a CLI. No exports needed by other tasks.

```bash
node scripts/curate-images.js                              # curate every family lacking an image
node scripts/curate-images.js --dry-run --limit 6          # prove the chain, write nothing to data/
node scripts/curate-images.js --alias byd-sealion-6="BYD Song Plus"
node scripts/curate-images.js --only kia-ev5,byd-seal
```

- [ ] **Step 1: Implement the CLI**

Behaviour, in order:

1. Load families from `data/families.json` and derive `{ id, make, model }` per family by taking the first variant in `data/vehicles.json` with that `familyId`. Families with no variants are skipped with a warning — they have no make or model to search on.
2. Apply `--alias` first: merge any supplied aliases into `data/model-aliases.json` and save. An alias is a durable fact about the car, so it persists whether or not this run succeeds.
3. For each family without an entry in `data/car-images.json` (filtered by `--only`, capped by `--limit`):
   - Search Commons for the alias if one exists, otherwise `make model`.
   - Classify the top hit with `classify`.
   - **auto** → fetch metadata, download, crop, write the image, record it.
   - **manual** → collect for the report; write nothing.
   - Sleep ~120ms between families. Commons is a donated service.
4. Validate every new record with `validateImageRecord` **before** writing `car-images.json`. A record that fails is dropped from the run and reported, so a bad record never lands on disk.
5. Write `data/car-images.json` sorted by key, and the contact sheet.
6. Print a summary: accepted, flagged, failed; then the flagged families with the reason and the top candidate title, each with the exact `--alias` command to resolve it.

Flags:
- `--dry-run` writes images and the contact sheet to `.image-dryrun/` and touches neither `data/` nor `public/images/`.
- `--limit N` caps how many families are processed (default: no cap; 6 with `--dry-run`).
- `--only a,b,c` restricts to those family ids.
- `--alias id="Name"` may be repeated.

The `note` on each record is composed automatically: `"Cropped and resized."`, plus `" Searched as <alias>."` when an alias was used. That satisfies the share-alike modification requirement and records the badge-engineering provenance in one line.

**The classifier's verdict is never overridden by a flag.** There is no `--yes` that accepts flagged families in bulk; resolving a flag means supplying the alias, which is a statement of fact that can be checked.

- [ ] **Step 2: Add the npm script and gitignore entry**

In `package.json` scripts: `"curate": "node scripts/curate-images.js"`.

In `.gitignore`, add `.image-dryrun/`.

- [ ] **Step 3: Verify against live Commons**

```bash
node scripts/curate-images.js --dry-run --limit 6 --only kia-ev5,byd-atto-3,byd-seal,byd-sealion-6,skoda-elroq,vw-id4
```

Expected: `kia-ev5`, `byd-atto-3` and `skoda-elroq` accepted automatically; `byd-seal` flagged as ambiguous with a sibling; `byd-sealion-6` and `vw-id4` flagged as probable aliases. Images appear in `.image-dryrun/`, all 900×600 WebP. `git status` shows **no change** to `data/` or `public/images/`.

Then confirm alias resolution works end to end:

```bash
node scripts/curate-images.js --dry-run --limit 1 --only byd-sealion-6 --alias byd-sealion-6="BYD Song Plus"
```

Expected: accepted, with a note recording the alias.

Open `.image-dryrun/contact-sheet.html` and confirm the crops are all the same shape and actually show cars.

- [ ] **Step 4: Run the full suite and commit**

```bash
npm test
git add scripts/curate-images.js package.json .gitignore
git commit -m "feat: image curation CLI with alias resolution and dry-run"
```

---

### Task 8: Images on the shortlist cards

**Files:**
- Modify: `public/ui/cars.js`, `public/styles.css`
- Test: `public/ui/cars.test.js`

**Interfaces:**
- Consumes: `family.image` from the joined dataset (Task 2).
- Produces: `cardModel` output carries `image`; `renderCards` emits a `<figure class="car-figure">` when it is present.

- [ ] **Step 1: Write the failing test**

Append to `public/ui/cars.test.js`. The existing `families` fixture gains an image on `fa`:

```javascript
test('cardModel carries the family image through', () => {
  const withImage = [{ ...families[0], image: { file: 'a.webp', author: 'P', licence: 'CC BY 4.0' } }];
  assert.equal(cardModel(fleet[0], withImage).image.file, 'a.webp');
});

test('a family with no image yields no image on the card', () => {
  assert.equal(cardModel(fleet[1], families).image, null);
});

test('renderCards emits a figure pointing at the image when there is one', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = { ...cardModel(fleet[0], [{ ...families[0], image: { file: 'a.webp', author: 'P', licence: 'CC BY 4.0' } }]), bandLabel: 'At your budget' };
  renderCards({ querySelector: () => target }, [card], '');
  assert.match(html, /images\/cars\/a\.webp/);
  // Explicit dimensions, or the card reflows as each image arrives.
  assert.match(html, /width="900"/);
  assert.match(html, /height="600"/);
  assert.match(html, /loading="lazy"/);
});

test('the alt text names the car, not the photographer', () => {
  // alt describes the image; attribution belongs in title and on the credits page.
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = { ...cardModel(fleet[0], [{ ...families[0], image: { file: 'a.webp', author: 'Alexander Migl', licence: 'CC BY 4.0' } }]), bandLabel: 'x' };
  renderCards({ querySelector: () => target }, [card], '');
  assert.match(html, /alt="Kia EV5[^"]*"/);
  assert.doesNotMatch(html, /alt="[^"]*Alexander Migl/);
});

test('a card without an image renders no figure and no broken img', () => {
  // This is the normal state until the research waves finish, not an edge case.
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  renderCards({ querySelector: () => target }, [{ ...cardModel(fleet[1], families), bandLabel: 'x' }], '');
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /car-figure/);
});

test('the image file name is escaped', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = { ...cardModel(fleet[0], [{ ...families[0], image: { file: 'a".webp', author: '<b>P</b>', licence: 'CC BY 4.0' } }]), bandLabel: 'x' };
  renderCards({ querySelector: () => target }, [card], '');
  assert.doesNotMatch(html, /<b>P<\/b>/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/ui/cars.test.js`
Expected: FAIL — `cardModel(...).image` is undefined.

- [ ] **Step 3: Implement**

In `cardModel`, alongside the other family fields:

```javascript
    // One image per family, shared by every variant — the trims differ in price
    // and range, not in what the car looks like.
    image: family?.image ?? null,
```

In `renderCards`, immediately inside `<article class="car-card...">` and **before** `<div class="car-body">`:

```javascript
      ${card.image ? `
      <figure class="car-figure">
        <img src="images/cars/${escapeHtml(card.image.file)}"
             alt="${escapeHtml(`${card.make} ${card.model}`)}"
             title="${escapeHtml(`${card.image.author} · ${card.image.licence}`)}"
             width="900" height="600" loading="lazy">
      </figure>` : ''}
```

The photograph sits across the top of the card rather than beside the text. The body-type silhouette this replaces was removed because it "cost a fixed 3.5rem of every card's width to convey one fact" — height is what a card has spare, width is not.

- [ ] **Step 4: Style it**

In `public/styles.css`, reusing the existing custom properties and type scale — introduce no new colour, size or spacing token:

```css
.car-figure {
  margin: 0;
  /* Matches the card's own corner radius on the top two corners only, so the
     image sits flush inside the border rather than floating in a rounded box. */
  border-radius: var(--radius) var(--radius) 0 0;
  overflow: hidden;
  background: var(--paper);
  aspect-ratio: 3 / 2;
}

.car-figure img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

Check `.car-card` has `overflow: hidden` (or add it) so the figure's corners clip correctly, and that its padding does not inset the figure — the image is full-bleed.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test public/ui/cars.test.js`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 6: Run the full suite and commit**

```bash
npm test
git add public/ui/cars.js public/ui/cars.test.js public/styles.css
git commit -m "feat: car photograph across the top of each shortlist card"
```

---

### Task 9: Images on the compare tab

**Files:**
- Modify: `public/ui/compare-tab.js`, `public/styles.css`
- Test: `public/ui/compare-tab.test.js`

**Interfaces:**
- Consumes: `families` (already passed to `renderComparison`) and `vehicle.familyId`.
- Produces: each rendered column header carries the family image when there is one.

Note the wiring detail: the header builder currently maps over `shown` and has `vehicle` but no family. The image must be resolved by `familyId` against the `families` array `renderComparison` already receives.

- [ ] **Step 1: Write the failing test**

Append to `public/ui/compare-tab.test.js`:

```javascript
test('a column header carries its family image', () => {
  const root = stubRoot();
  const withImage = [{ id: 'f-ev5', summary: 'x', pros: [], cons: [], sources: [], image: { file: 'ev5.webp', author: 'P', licence: 'CC BY 4.0' } }];
  renderComparison(root, { vehicles: [ev5, sealion], families: withImage, tables, benchIndex: null });
  const html = root.targets['compare-table'].innerHTML;
  assert.match(html, /images\/cars\/ev5\.webp/);
  assert.match(html, /loading="lazy"/);
});

test('a car whose family has no image gets a header with no img', () => {
  const root = stubRoot();
  renderComparison(root, { vehicles: [ev5, sealion], families, tables, benchIndex: null });
  const head = root.targets['compare-table'].innerHTML.split('<tbody')[0];
  assert.doesNotMatch(head, /<img/);
});

test('the benched car contributes no header image on mobile', () => {
  const root = stubRoot();
  const withImage = [{ id: 'f-sl6', summary: 'x', pros: [], cons: [], sources: [], image: { file: 'sl6.webp', author: 'P', licence: 'CC BY 4.0' } }];
  renderComparison(root, { vehicles: [ev5, sealion, { ...ev5, id: 'c' }], families: withImage, tables, benchIndex: 1 });
  const head = root.targets['compare-table'].innerHTML.split('<tbody')[0];
  assert.doesNotMatch(head, /sl6\.webp/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/ui/compare-tab.test.js`
Expected: FAIL — no image markup in the header.

- [ ] **Step 3: Implement**

In `renderComparison`, before building `head`:

```javascript
  // The header maps over `shown`, which carries vehicles rather than families,
  // so the image is resolved by familyId against the families already passed in.
  const imageFor = vehicle => families.find(f => f.id === vehicle.familyId)?.image ?? null;
```

Then inside the `shown.map` for `head`, above the car name:

```javascript
            ${imageFor(vehicle) ? `<img class="compare-head__img"
              src="images/cars/${escapeHtml(imageFor(vehicle).file)}"
              alt="${escapeHtml(carName(vehicle))}"
              title="${escapeHtml(`${imageFor(vehicle).author} · ${imageFor(vehicle).licence}`)}"
              width="900" height="600" loading="lazy">` : ''}
```

- [ ] **Step 4: Style it**

```css
.compare-head__img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: var(--radius);
  margin-bottom: var(--space-2);
}
```

Three columns at 1280px give roughly 300px each, so the 900px source downscales cleanly. Below the 700px breakpoint the comparison shows two columns and the images scale again rather than being hidden — the two visible cars are exactly the ones worth showing.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test public/ui/compare-tab.test.js`
Expected: PASS, including every pre-existing test.

- [ ] **Step 6: Run the full suite and commit**

```bash
npm test
git add public/ui/compare-tab.js public/ui/compare-tab.test.js public/styles.css
git commit -m "feat: car photograph in each compare-tab column header"
```

---

### Task 10: The credits page

**Files:**
- Create: `public/credits.html`
- Modify: `public/index.html`, `public/styles.css`

**Interfaces:** none — a standalone page.

CC BY and CC BY-SA both require attribution, and share-alike additionally requires modifications to be indicated. This page discharges both.

- [ ] **Step 1: Build the page**

Create `public/credits.html`: a standalone document reusing `styles.css`, with the site header wordmark, a short paragraph explaining that photographs come from Wikimedia Commons and have been cropped, and an empty `<ul id="credits-list">`.

An inline `<script type="module">` fetches `/api/dataset`, filters families to those with an `image`, sorts by name, and renders one list item each: the car name, the photographer, the licence, a link to the original Commons file, and the crop note. When none have images it renders a line saying so.

Deriving the list from the live dataset rather than generating a file means it **cannot drift** from what the site actually ships — and it matches how the app already boots from a single `/api/dataset` fetch.

- [ ] **Step 2: Link it from the footer**

In `public/index.html`, in `.site-footer` after the colophon:

```html
    <p class="site-footer__credits"><a href="credits.html">Image credits</a></p>
```

- [ ] **Step 3: Verify**

```bash
npm start
```

Open `http://localhost:3000/credits.html`. With `car-images.json` empty it must render the "no images yet" line rather than an empty page or a JS error — check the console is clean. Confirm the footer link works from the main page.

- [ ] **Step 4: Run the full suite and commit**

```bash
npm test
git add public/credits.html public/index.html public/styles.css
git commit -m "feat: image credits page, rendered from the live dataset"
```

---

### Task 11: Update the documentation

**Files:**
- Modify: `README.md`, `public/ui/cars.js`

**Interfaces:** none.

Two places currently assert the opposite of what this branch does. Leaving them is worse than never having written them.

- [ ] **Step 1: Update the comment in `cars.js`**

Replace the "No car imagery at all: photography was always out of scope…" comment in `renderCards` with one that says what is true now: one freely-licensed photograph per family, cropped to a single frame, full-bleed across the top of the card because height is what a card has spare — and that the silhouette it replaced was removed for costing width, which is a different trade.

- [ ] **Step 2: Update the README**

`README.md` says "No photography; car imagery is out of scope" in the step 3 description. Replace it with a sentence covering: one photograph per family shared across its variants, sourced from Wikimedia Commons under free licences, cropped to a consistent 3:2 frame, credited on `/credits.html`, and curated by `npm run curate` with automatic matching for safe cases and explicit aliases where market names differ.

Add a short subsection under "Refreshing the dataset" describing `data/car-images.json` and `data/model-aliases.json` as separate from the per-family research files, and saying why: research batches own `data/families/*.json`, and a batch rewriting a family would otherwise drop an image with no error.

Check nothing else in the README contradicts the change, and correct the test count if it names one.

- [ ] **Step 3: Run the full suite and commit**

```bash
npm test
git add README.md public/ui/cars.js
git commit -m "docs: describe car images and retire the no-photography position"
```

---

## Self-Review

**Spec coverage** — each spec section against a task:

| Spec section | Task |
|---|---|
| 1. Data model — decoupled files | 2 |
| 1. Image record shape and `note` provenance | 1, 7 |
| 1. `validateFamily` unchanged | 1 (separate module), verified in 2 |
| 2. Files on disk, 900×600 WebP | 5 |
| 3. Rendering — shortlist cards | 8 |
| 3. Rendering — compare headers | 9 |
| 3. Graceful absence | 8, 9, 10 |
| 4. Credits page | 10 |
| 5. Classifier, auto/flag split | 3 |
| 5. Alias resolution, `model-aliases.json` | 7 |
| 5. Contact sheet | 6 |
| 6. Sequencing — empty data, `--dry-run` proof | 2 (empty file), 7 (dry-run) |
| 7. Testing — dimensions, orphans, references | 2 (existence), 5 (dimensions) |
| 8. Out of scope | nothing implements these |

**Type consistency** — the image record is `{ file, source, author, licence, note }` in Tasks 1, 2, 7, 8, 9 and 10. `IMAGE_DIMENSIONS` is defined in Task 1 and consumed in Task 5. `classify({ family, candidateTitle, families })` → `{ verdict, why }` matches between Tasks 3 and 7. `searchFiles` / `fileMetadata` signatures match between Tasks 4 and 7. `cropToCard` / `downloadAndCrop` match between Tasks 5 and 7.

**Gaps found and closed during review:**

- Task 2 originally imported `joinImages` from a script that executes top-to-bottom on import, which would have run the whole build inside the test. The `import.meta.url` guard is now an explicit step, with a check that the regenerated `families.json` is byte-identical.
- The spec's test list included "every committed image is referenced (no orphans)". That check only becomes meaningful once images exist, and would pass vacuously against an empty `public/images/cars/`. It is deliberately **not** in this plan; it belongs with the bulk curation pass after the research waves finish, and is noted here so it is not silently lost.
- Task 9 needed an explicit `imageFor` helper: the compare header maps over vehicles and has no family in scope, so the image has to be resolved by `familyId`.
