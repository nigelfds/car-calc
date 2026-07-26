import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDataset } from '../data/schema.js';
import parseRoute from './routes/parse.js';
import explainRoute from './routes/explain.js';

const here = dirname(fileURLToPath(import.meta.url));
const readJson = name =>
  JSON.parse(readFileSync(join(here, '..', 'data', name), 'utf8'));

const dataset = loadDataset({
  vehicles: readJson('vehicles.json'),
  families: readJson('families.json')
});

if (dataset.skipped.length > 0) {
  console.warn(`Skipped ${dataset.skipped.length} invalid vehicle rows:`);
  for (const s of dataset.skipped) console.warn(`  ${s.id}: ${s.errors.join('; ')}`);
}

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(join(here, '..', 'public')));
// ui/prompt-api.js imports calc/clamp.js directly by relative path (native ES
// modules, no bundler) — the browser resolves that to /calc/clamp.js, so the
// pure core needs to be reachable at that path too. Test files live
// alongside the source in calc/ but must never be shipped to the browser —
// block them before they reach express.static rather than trying to filter
// them out of the mounted directory.
app.use('/calc', (req, res, next) => (req.path.endsWith('.test.js') ? res.sendStatus(404) : next()));
app.use('/calc', express.static(join(here, '..', 'calc')));
app.use('/api/parse', parseRoute);
app.use('/api/explain', explainRoute);

app.get('/api/dataset', (req, res) => {
  res.json({
    vehicles: dataset.vehicles,
    families: dataset.families,
    rates: readJson('rates.json'),
    tables: readJson('tax-tables.json'),
    aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY)
  });
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));

export { app, dataset };
