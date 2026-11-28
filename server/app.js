// server/app.js — builds the Express app. server/index.js only listens, so
// tests can start the app on a spare port without binding $PORT.
import express from 'express';
import compression from 'compression';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDataset } from '../data/schema.js';
import { datasetStats, datasetStatsLine } from '../public/ui/cars.js';
import { escapeHtml } from '../public/ui/escape.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const calcDir = join(root, 'calc');
const readJson = name => JSON.parse(readFileSync(join(root, 'data', name), 'utf8'));

// Every module the browser will fetch for /ui/app.js, found by following its
// static imports. Listed as <link rel="modulepreload"> in index.html so the
// browser requests them all at once, instead of discovering them one import
// level at a time (six round trips deep before the first fetch could start).
// Walked at startup rather than hand-listed, so the list cannot drift.
export function moduleGraph(entry = '/ui/app.js') {
  const toFile = path => (path.startsWith('/calc/') ? join(calcDir, path.slice(6)) : join(publicDir, path));
  const seen = new Set();
  const visit = path => {
    if (seen.has(path)) return;
    seen.add(path);
    const source = readFileSync(toFile(path), 'utf8');
    for (const [, spec] of source.matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) {
      if (spec && spec.startsWith('.')) visit(new URL(spec, `http://x${path}`).pathname);
    }
  };
  visit(entry);
  return [...seen];
}

export function createApp() {
  const dataset = loadDataset({
    vehicles: readJson('vehicles.json'),
    families: readJson('families.json')
  });

  if (dataset.skipped.length > 0) {
    console.warn(`Skipped ${dataset.skipped.length} invalid vehicle rows:`);
    for (const s of dataset.skipped) console.warn(`  ${s.id}: ${s.errors.join('; ')}`);
  }

  // The dataset never changes while the process runs (it is rebuilt at
  // deploy), so serialise it once rather than on every request.
  const datasetBody = JSON.stringify({
    vehicles: dataset.vehicles,
    families: dataset.families,
    rates: readJson('rates.json'),
    tables: readJson('tax-tables.json')
  });

  // index.html with the header stats already written in and the module
  // graph preloaded, so the header is complete on first paint.
  const statsLine = escapeHtml(datasetStatsLine(datasetStats(dataset)));
  const preloads = moduleGraph()
    .map(path => `  <link rel="modulepreload" href="${path}" />`)
    .join('\n');
  const indexHtml = readFileSync(join(publicDir, 'index.html'), 'utf8')
    .replace('<p class="site-header__stats" id="dataset-stats"></p>',
      `<p class="site-header__stats" id="dataset-stats">${statsLine}</p>`)
    .replace('</head>', `${preloads}\n</head>`);

  const app = express();
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));
  const sendIndex = (req, res) => res.type('html').send(indexHtml);
  app.get(['/', '/index.html'], sendIndex);
  app.use(express.static(publicDir, { index: false }));
  // ui/prompt-api.js imports calc/clamp.js directly by relative path (native ES
  // modules, no bundler) — the browser resolves that to /calc/clamp.js, so the
  // pure core needs to be reachable at that path too. Test files live
  // alongside the source in calc/ but must never be shipped to the browser —
  // block them before they reach express.static rather than trying to filter
  // them out of the mounted directory.
  app.use('/calc', (req, res, next) => (req.path.endsWith('.test.js') ? res.sendStatus(404) : next()));
  app.use('/calc', express.static(calcDir));

  app.get('/api/dataset', (req, res) => {
    res.type('json').send(datasetBody);
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, vehicles: dataset.vehicles.length });
  });

  // Catch-all error handler: log the real error server-side, but never leak
  // stack traces or internal details to the client (e.g. in production on Heroku).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, dataset, indexHtml };
}
