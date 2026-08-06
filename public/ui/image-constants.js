// public/ui/image-constants.js — the two facts about car images that both the
// browser and the Node curation scripts need to agree on.
//
// It lives under public/ui/ for one reason: that is the only directory both
// sides can reach. The browser can only fetch what the static server exposes,
// which is public/; Node imports by relative path and can reach anywhere. So
// public/ui/ is the intersection, and escape.js and format.js already sit here
// being imported by the browser and by the Node test runner alike. This module
// makes that arrangement deliberate rather than incidental.
//
// Before this existed, the dimensions lived in data/image-schema.js and the two
// renderers hardcoded width="900" height="600" — so the constant that existed
// to stop the crop, the validator and the tests disagreeing was itself being
// routed around by the code that draws the image.

// Identical framing across every family is the whole reason the grid reads as
// designed rather than scraped, so this is the number the crop resizes to, the
// number the renderers declare to prevent reflow, and the number the repo
// invariant test enforces over the committed files.
export const IMAGE_DIMENSIONS = { width: 900, height: 600 };

// Relative to public/, which is what an <img src> in a served page resolves
// against and what the Node scripts join onto publicDir. Was previously spelled
// out at five call sites, so moving the directory would have broken four of
// them silently.
export const CAR_IMAGE_DIR = 'images/cars';
