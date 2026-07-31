# Car images — design

**Date:** 2026-07-31
**Branch:** `feature/car-images`
**Status:** approved, ready for implementation planning

## What this is

One photograph per car family, rendered across the top of each shortlist card and each
compare-tab column. Images are Creative Commons files from Wikimedia Commons, cropped to a
single consistent frame, committed to the repo, and credited on a dedicated page.

This reverses a documented decision. `public/ui/cars.js` says "No car imagery at all:
photography was always out of scope", and `README.md` repeats it. Both are updated as part
of this work rather than left contradicting the code.

## Why Commons, and not an image API

A survey of the commercial vehicle-image services found them structurally wrong for this
dataset:

- **imagin.studio** is the best technical fit — parameterised URLs, transparent studio
  renders, client-side embedding. But the licence is per-image and paid, pricing is not
  public, images may not be cached server-side, and **coverage cannot be verified without a
  paid key**. Its CDN returns a placeholder image rather than a 404 on a miss, so an
  integration would silently show a red dust sheet for every model it lacks.
- **Vehicle Databases** states it covers "vehicle listings within the United States".
  **PlateToVIN** advertises "every US make, model and year".

That last point is decisive. Roughly 40% of this dataset is brands with no US presence —
BYD, Zeekr, Chery, Jaecoo, Deepal, GWM, Leapmotor, KGM, Geely, Xpeng. A US-catalogue
service is weakest exactly where this dataset is densest.

Against that, a measured survey of Wikimedia Commons found **96 of 99 families returned five
or more file hits**, all under free licences. The problem there is not coverage. It is
naming.

## The badge-engineering problem

These cars are sold under different names in different markets, so the Australian name is
not the name the photograph is filed under. Measured against the live dataset:

| Family | Top Commons hit |
|---|---|
| BYD Sealion 6 | BYD **Song Plus** |
| BYD Sealion 8 | BYD **Tang L** |
| BYD Atto 1 | BYD **Dolphin Surf** |
| Geely EX5 | Geely **Galaxy E5** |
| Geely EX2 | Geely **Xingyuan** |
| GWM Cannon Alpha PHEV | GWM **Poer Sahar** |
| Volvo EX40 | Volvo **XC40 Recharge** |

Most of those are the right car under its home-market badge. But some are not, and nothing
in the filename says which is which. The survey turned up three outright wrong top hits:
**Volkswagen ID.4 → an ID.5 GTX**, **Mini Cooper → a 1959 Morris Mini-Minor**, and **MG HS
Super Hybrid → a 19th-century horticulture journal**.

There is also a same-brand trap: searching **BYD Seal** returns **BYD Seal U** first, which
is a different vehicle — the Seal U is the Sealion 6 in some markets.

This is the failure mode `docs/phev-research-wave.md` describes for REEVs mis-filed as
PHEVs: *"wrong in a way the schema cannot catch."* A photograph of the wrong car above a
correct price damages credibility exactly as a wrong price would. **Image selection is
therefore never fully automatic.**

## 1. Data model — deliberately decoupled

Image data does **not** live in `data/families/<slug>.json`. Two new files, keyed by family
id:

```
data/car-images.json     { "byd-sealion-6": { file, source, author, licence, note } }
data/model-aliases.json  { "byd-sealion-6": "BYD Song Plus" }
```

The separation is load-bearing. Research batches from the BEV and PHEV waves write
`data/families/*.json`, and batches are landing continuously — three since the compare tab
merged, taking the dataset from 87 to 105 families. If images lived in those files, a batch
rewriting a family would drop the image block, `build-dataset.js` would regenerate the
aggregates without it, and the photograph would vanish from the site with no error and no
failed validation.

Decoupling also means **`validateFamily` in `schema.js` does not change at all**, so nothing
about the in-flight research pipeline is disturbed. Image validation is a new, separate
function that only `build-dataset.js` calls.

`build-dataset.js` joins images into the generated `data/families.json` at build time.

The dormant `images` array already in `validateFamily` — used by zero families — is left
**untouched** by this work. Removing it would be a change to the validator that batches are
currently running against, for no benefit while the waves are in flight. It becomes
redundant once this lands and should be deleted in a separate commit after the waves
finish.

### The image record

```json
"byd-sealion-6": {
  "file": "byd-sealion-6.webp",
  "source": "https://commons.wikimedia.org/wiki/File:BYD_Song_Plus_DM-i_001.jpg",
  "author": "Alexander Migl",
  "licence": "CC BY-SA 4.0",
  "note": "Cropped and resized. Sold in China as the Song Plus DM-i."
}
```

`note` records why this photograph is the right one. It turns the badge-engineering trap
from a hidden risk into recorded provenance: when someone later asks why the Sealion 6's
credit reads "Song Plus", the answer is in the data rather than lost.

## 2. Files on disk

`public/images/cars/<familyId>.webp`, committed. **900×600, 3:2, WebP quality 80** —
roughly 30–40KB each.

The fixed dimensions are not incidental. Identical framing across every family is what makes
a grid look designed rather than scraped, and inconsistent crops would look worse than the
current no-image state. A test enforces the exact dimensions.

## 3. Rendering

Full-bleed across the **top** of the shortlist card, not a thumbnail beside the text. The
previous imagery was removed because a body-type silhouette "cost a fixed 3.5rem of every
card's width to convey one fact". A photograph at the top of the card costs height, which
cards have, rather than width, which they do not.

The compare tab's column headers get the same image scaled down — three columns at 1280px
give roughly 300px each, so the 900px source downscales cleanly. On mobile, where the
comparison drops to two columns, they scale again rather than being hidden: the two visible
cars are exactly the ones worth showing.

- Explicit `width`/`height` attributes so the image cannot cause layout shift.
- `loading="lazy"`.
- `alt` describes the car ("Kia EV5"). Attribution belongs in `title` and on the credits
  page — alt text describes the image, it is not a credit line.
- **A family with no image renders exactly as it does today**: no broken icon, no grey
  placeholder box. This is the normal state, not an edge case — `data/car-images.json` ships
  empty and stays that way until the research waves finish.

## 4. Credits

`public/credits.html`, linked from the footer. It **fetches `/api/dataset` and renders the
list client-side** — photographer, licence, a link to the original, and the crop note. No
build step and no generated artefact, so it cannot drift from the data, and it matches how
the app already boots.

CC BY-SA requires attribution and requires modifications to be indicated; cropping counts as
adapting the work, so the crop note is a licence obligation rather than a nicety. Where CC
BY, CC0 or public-domain files exist they are preferred, which sidesteps share-alike on the
derivative entirely.

## 5. Curation

`node scripts/curate-images.js` — idempotent, only touches families with no image yet.

For each family it queries Commons and classifies the top candidate:

**Auto-accept** when the normalised candidate title contains the model, and no sibling
family of the same make matches the title more specifically. Normalisation folds diacritics
(`Škoda` → `Skoda`), splits letter–digit boundaries (`MG4` → `MG 4`) and strips leading
zeros (`Sealion 07` → `Sealion 7`).

**Flag for the human** when the model is absent from the title (a probable market alias),
when a sibling family matches more specifically (the Seal/Seal U trap), or when there are no
candidates at all.

Measured against 99 families, this split **74 automatic and 25 flagged**. The heuristic is
deliberately biased toward flagging: a false flag costs twenty seconds, a false auto-accept
ships the wrong car.

### Resolving a flag is naming, not picking

For the alias cases — the large majority — what the human supplies is not an image but the
car's other name:

```bash
node scripts/curate-images.js --alias byd-sealion-6="BYD Song Plus"
```

The script re-searches under that name; the model now matches, so the same heuristic
auto-accepts. Aliases persist in `data/model-aliases.json`, so the fact is established once
and every later run — including after new research batches — resolves automatically.

Families with no Commons candidate at all (three at the time of survey: Forthing Taikon 5,
GWM Cannon Alpha PHEV, GWM Haval H6 GT) fall back to a press image or stay imageless.

### The contact sheet

After a run, the script writes a local HTML contact sheet showing every crop with its
caption. Scanning 105 images takes under a minute and catches anything the heuristic got
confidently wrong. This is the safety net that makes automatic acceptance comfortable.

## 6. Sequencing

The machinery lands now; **bulk curation waits until the research waves finish.** The
dataset is roughly 60% of its final size — around 165 families are expected — and curating
now would mean doing it twice.

Because `data/car-images.json` ships empty and a family without an image renders as it does
today, landing the machinery changes nothing visually. There is no half-populated grid in
the meantime.

The pipeline is proven without touching the dataset: unit tests over the pure parts, plus
`--dry-run [--limit N]`, which fetches and crops N families (default 6) into a scratch
directory and writes the contact sheet there. That exercises the whole chain — search,
heuristic, fetch, crop, convert, caption — against live Commons data while leaving `data/`
and `public/images/` untouched.

The six should be chosen to cover the interesting cases rather than the first six
alphabetically: at least one clean auto-accept, one market alias resolved via
`model-aliases.json`, and one sibling-clash family such as `byd-seal`.

## 7. Testing

`node --test`, beside each module, matching the repo.

- The classifier: auto/flag verdicts over fixture candidates, including the Seal/Seal U
  sibling trap, the ID.4/ID.5 case, diacritics, and letter–digit splitting.
- The image record validator.
- Every `file` referenced in `data/car-images.json` exists in `public/images/cars/`.
- Every committed image is referenced (no orphans).
- Every committed image is exactly 900×600 WebP — this is what keeps the grid consistent as
  families are added.
- Card rendering with and without an image, against the existing stub-root convention.

Network calls are not unit-tested; `--dry-run` is the manual check.

**Dependency:** `sharp` as a **devDependency**, for cropping and WebP conversion. Images are
committed artefacts, so production never touches it and the Heroku slug is unaffected.

## 8. Out of scope

- Any paid image API.
- Per-variant images. One image per family, shared by every variant.
- Interior shots, multiple angles, or a gallery.
- Automatic image selection without human confirmation of flagged families.
- Backfilling images for families that do not yet exist — curation runs after the waves.
