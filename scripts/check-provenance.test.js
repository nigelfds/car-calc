// Every held family must carry a provenance file that passes the check, so a
// row added or changed without a recorded source fails the pre-push hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkFamily } from './check-provenance.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const familyIds = readdirSync(join(dataDir, 'families'))
  .filter(n => n.endsWith('.json'))
  .map(n => n.slice(0, -5));

test('every family has a provenance file that passes check-provenance', () => {
  assert.ok(familyIds.length > 0);
  const failures = familyIds.flatMap(id => checkFamily(id).errors.map(e => `${id}: ${e}`));
  assert.deepEqual(failures, []);
});
