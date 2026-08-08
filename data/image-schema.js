// data/image-schema.js — validation for the per-family image records in
// data/car-images.json.
//
// Deliberately NOT part of data/schema.js. validateFamily is what the research
// waves validate against, batches are landing continuously, and changing it
// while they run buys nothing. Image data is a separate concern with a
// separate cadence, so it gets a separate validator that only
// scripts/build-dataset.js calls.

// IMAGE_DIMENSIONS used to live here, but nothing in this file ever used it —
// it was declared beside a validator that validates record shape, not pixels.
// It now sits in public/ui/image-constants.js, the one directory both the
// browser and the Node scripts can import from, so the renderers share it too
// rather than hardcoding the same numbers.

// Lowercase slug plus .webp, anchored. The anchoring matters: the value is
// interpolated into a filesystem path, and "../escape.webp" must not pass.
const FILE_RE = /^[a-z0-9]+(-[a-z0-9]+)*\.webp$/;
const SOURCE_RE = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/;

// Only licences that actually permit republication. An unrecognised string is
// rejected rather than assumed free — the failure mode we are guarding against
// is an all-rights-reserved press photo being committed because nobody checked.
//
// Attribution licences are matched by pattern rather than enumerated. Commons
// reports every CC BY and CC BY-SA version still in circulation, and often an
// unversioned "CC BY-SA"; a full curation run lost the Tesla Model 3, Cadillac
// Lyriq, Hyundai Inster, Mitsubishi Outlander PHEV, Zeekr X and Chery Omoda E5
// to an allowlist that stopped at 3.0 and 4.0. Every version of BY and BY-SA
// is free, so the version was never the thing worth checking.
//
// The pattern is anchored and admits ONLY BY and BY-SA — never -NC or -ND, and
// both exclusions are load-bearing. NC forbids commercial use; ND forbids
// derivative works, and every image here is cropped to 3:2, which makes an ND
// image unusable however it is credited. The anchor is what stops
// "CC BY-NC 4.0" matching on its "CC BY" prefix.
const ATTRIBUTION_LICENCE_RE = /^CC BY(-SA)?(?: \d(?:\.\d)?)?$/;

// Public-domain dedications carry no attribution obligation, so they stay an
// explicit list — there is no version axis worth generalising over.
const PUBLIC_DOMAIN_LICENCES = new Set(['CC0', 'CC0 1.0', 'Public domain']);

const isFreeLicence = licence =>
  ATTRIBUTION_LICENCE_RE.test(licence) || PUBLIC_DOMAIN_LICENCES.has(licence);

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
  } else if (!isFreeLicence(record.licence.trim())) {
    errors.push(`licence ${record.licence} is not a recognised free licence`);
  } else if (REQUIRES_MODIFICATION_NOTE(record.licence) && !nonEmpty(record.note)) {
    errors.push('a share-alike licence requires note to record that the image was cropped');
  }

  return { valid: errors.length === 0, errors };
}
