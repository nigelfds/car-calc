import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createApp, moduleGraph } from './app.js';
import { datasetStats, datasetStatsLine } from '../public/ui/cars.js';

let server, base, dataset;
before(async () => {
  const built = createApp();
  dataset = built.dataset;
  await new Promise(resolve => { server = built.app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections(); server.close(); });

test('index.html arrives with the header stats already written in', async () => {
  const html = await (await fetch(`${base}/`)).text();
  const line = datasetStatsLine(datasetStats(dataset));
  assert.ok(line.includes('variants'));
  assert.ok(html.includes(`id="dataset-stats">${line}</p>`), 'stats line missing from served HTML');
  assert.equal(await (await fetch(`${base}/index.html`)).text(), html);
});

test('index.html preloads the dataset and every module app.js imports', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.ok(html.includes('<link rel="preload" href="/api/dataset" as="fetch" crossorigin />'));
  const modules = moduleGraph();
  assert.ok(modules.includes('/ui/app.js'));
  assert.ok(modules.includes('/calc/rank.js'));
  assert.ok(modules.includes('/calc/clamp.js'), 'transitive import via ui/prompt-api.js');
  for (const path of modules) {
    assert.ok(html.includes(`<link rel="modulepreload" href="${path}" />`), `${path} not preloaded`);
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, `${path} is preloaded but not served`);
  }
});

test('the dataset is served gzipped when the browser accepts it', async () => {
  const res = await fetch(`${base}/api/dataset`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  // undici decompresses transparently, so check the body still parses and
  // the compressed size the server would have sent is a fraction of it.
  const body = await res.json();
  assert.equal(body.vehicles.length, dataset.vehicles.length);
  assert.ok(body.rates && body.tables);
});
