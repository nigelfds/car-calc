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
