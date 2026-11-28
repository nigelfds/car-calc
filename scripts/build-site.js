// Writes the whole site as static files to dist/, for Cloudflare (see
// wrangler.jsonc). Run after scripts/build-dataset.js — `npm run build`
// does both.
//
// The Express server in server/ computes nothing per request: index.html
// (header stats, module preloads) and the dataset body are fixed once the
// dataset is built. So this script asks the server's own renderSite() for
// them and writes them next to copies of public/ and calc/, and the static
// site serves exactly what `npm start` serves.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { renderSite } from '../server/app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Left out of the deployed site: index.html is written below with the
// header filled in, and contact-sheet.html is a local review page that
// `npm run curate` generates (gitignored).
const PUBLIC_SKIP = new Set(['index.html', 'contact-sheet.html']);

export function buildSite(outDir = join(root, 'dist')) {
  const { datasetBody, indexHtml } = renderSite();
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  cpSync(join(root, 'public'), outDir, {
    recursive: true,
    filter: src => !PUBLIC_SKIP.has(basename(src)) || dirname(src) !== join(root, 'public')
  });
  // Test files sit beside the calc/ source but must never ship.
  cpSync(join(root, 'calc'), join(outDir, 'calc'), {
    recursive: true,
    filter: src => !src.endsWith('.test.js')
  });
  writeFileSync(join(outDir, 'index.html'), indexHtml);
  writeFileSync(join(outDir, 'dataset.json'), datasetBody);
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Site written to ${buildSite()}`);
}
