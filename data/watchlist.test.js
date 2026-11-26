// data/watchlist.json is read by the dataset refresh's market sweep, so a bad
// entry means a model silently never gets re-checked. Not read by the app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const { entries } = JSON.parse(readFileSync(new URL('./watchlist.json', import.meta.url), 'utf8'));
const held = id => existsSync(new URL(`./families/${id}.json`, import.meta.url));

const STATUSES = ['backlog', 'pre-launch', 'not-on-sale', 'unrepresentable', 'out-of-scope'];
const SCOPES = ['brand', 'model', 'variant'];
const POWERTRAINS = ['bev', 'phev', 'any'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test('every watchlist entry has a valid shape', () => {
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    const where = entry.name;
    assert.ok(typeof entry.name === 'string' && entry.name.length > 0, 'name');
    assert.ok(typeof entry.make === 'string' && entry.make.length > 0, `${where}: make`);
    assert.ok(STATUSES.includes(entry.status), `${where}: status ${entry.status}`);
    assert.ok(SCOPES.includes(entry.scope), `${where}: scope ${entry.scope}`);
    assert.ok(POWERTRAINS.includes(entry.powertrain), `${where}: powertrain ${entry.powertrain}`);
    assert.match(entry.checkedAt, DATE_RE, `${where}: checkedAt`);
    assert.match(entry.recheckAfter, DATE_RE, `${where}: recheckAfter`);
    assert.ok(entry.recheckAfter >= entry.checkedAt, `${where}: recheckAfter before checkedAt`);
    assert.ok(typeof entry.note === 'string' && entry.note.length > 0, `${where}: note`);
    if (entry.familyId !== undefined) assert.match(entry.familyId, SLUG_RE, `${where}: familyId`);
  }
});

test('a variant entry names a held family; a model entry waiting to be researched does not', () => {
  for (const entry of entries) {
    if (entry.scope === 'variant') {
      assert.ok(entry.familyId && held(entry.familyId), `${entry.name}: variant entries need a held familyId`);
    }
    if (entry.scope === 'model' && ['backlog', 'pre-launch'].includes(entry.status) && entry.familyId) {
      assert.ok(!held(entry.familyId), `${entry.name}: ${entry.familyId} is already held, so this entry is stale`);
    }
  }
});

test('names are unique', () => {
  const names = entries.map(e => e.name);
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), []);
});
