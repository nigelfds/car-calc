import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDataset } from '../data/schema.js';

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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));

export { app, dataset };
