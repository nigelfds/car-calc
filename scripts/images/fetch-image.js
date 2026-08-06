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
