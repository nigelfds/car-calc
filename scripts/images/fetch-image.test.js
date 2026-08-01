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
