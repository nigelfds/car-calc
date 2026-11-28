import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from './build-site.js';
import { renderSite, moduleGraph } from '../server/app.js';

let out;
before(() => { out = buildSite(mkdtempSync(join(tmpdir(), 'car-calc-site-'))); });
after(() => rmSync(out, { recursive: true, force: true }));

test('the static index.html and dataset match what the server sends', () => {
  const { indexHtml, datasetBody } = renderSite();
  assert.equal(readFileSync(join(out, 'index.html'), 'utf8'), indexHtml);
  assert.equal(readFileSync(join(out, 'dataset.json'), 'utf8'), datasetBody);
});

test('every preloaded module is in the build', () => {
  for (const path of moduleGraph()) assert.ok(existsSync(join(out, path)), `${path} missing from dist/`);
});

test('no test files and no contact sheet ship', () => {
  assert.deepEqual(readdirSync(join(out, 'calc')).filter(f => f.endsWith('.test.js')), []);
  assert.ok(!existsSync(join(out, 'contact-sheet.html')));
  assert.ok(existsSync(join(out, 'credits.html')));
});
