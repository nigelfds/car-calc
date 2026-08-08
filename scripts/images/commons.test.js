import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchFiles, fileMetadata, USER_AGENT } from './commons.js';

const stub = payload => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => payload };
  };
  return { fetchImpl, calls };
};

test('searchFiles returns titles with the File: prefix stripped', async () => {
  const { fetchImpl } = stub({
    query: { search: [{ title: 'File:BYD Atto 3 001.jpg' }, { title: 'File:BYD Atto 3 rear.jpg' }] }
  });
  assert.deepEqual(await searchFiles('BYD Atto 3', { fetchImpl }), ['BYD Atto 3 001.jpg', 'BYD Atto 3 rear.jpg']);
});

test('searchFiles returns an empty array when nothing matches', async () => {
  const { fetchImpl } = stub({ query: { search: [] } });
  assert.deepEqual(await searchFiles('Forthing Taikon 5', { fetchImpl }), []);
});

test('searchFiles restricts results to the File namespace', async () => {
  const { fetchImpl, calls } = stub({ query: { search: [] } });
  await searchFiles('Kia EV5', { fetchImpl });
  assert.match(calls[0].url, /srnamespace=6/);
});

test('searchFiles asks the search server for raster images only', async () => {
  const { fetchImpl, calls } = stub({ query: { search: [] } });
  await searchFiles('Kia EV5', { fetchImpl });
  // The keyword rides inside srsearch, so it arrives percent-encoded.
  assert.match(decodeURIComponent(calls[0].url), /srsearch=Kia EV5 filetype:bitmap/);
});

test('searchFiles drops any non-image the search still returns', async () => {
  // The real failure: Commons searches document CONTENTS, so "MG HS Super
  // Hybrid" matched text inside OCR'd books and returned five PDFs, led by an
  // 1874 journal of horticulture. sharp cannot decode a PDF, so one reaching
  // the cropper fails with a much less obvious error than this filter gives.
  const { fetchImpl } = stub({
    query: {
      search: [
        { title: 'File:The Journal of horticulture (IA journalofhorticu1874lond).pdf' },
        { title: 'File:MG HS (second generation) DSC 7229.jpg' },
        { title: 'File:Some diagram.svg' },
        { title: 'File:An interview.ogv' },
        { title: 'File:2024 MG HS 3.png' }
      ]
    }
  });
  assert.deepEqual(
    await searchFiles('MG HS Super Hybrid', { fetchImpl }),
    ['MG HS (second generation) DSC 7229.jpg', '2024 MG HS 3.png']
  );
});

test('searchFiles accepts the raster extensions Commons actually serves', async () => {
  const titles = ['a.jpg', 'b.jpeg', 'c.png', 'd.gif', 'e.tif', 'f.tiff', 'g.webp', 'h.JPG'];
  const { fetchImpl } = stub({ query: { search: titles.map(t => ({ title: `File:${t}` })) } });
  assert.deepEqual(await searchFiles('x', { fetchImpl }), titles);
});

test('a search returning only non-images yields no candidate at all', async () => {
  // Better than a wrong one: curate-images reports "no candidate returned for
  // this family", which is the truth and sends it to manual review.
  const { fetchImpl } = stub({
    query: { search: [{ title: 'File:book.pdf' }, { title: 'File:scan.djvu' }] }
  });
  assert.deepEqual(await searchFiles('MG HS Super Hybrid', { fetchImpl }), []);
});

test('every request identifies the client', async () => {
  const { fetchImpl, calls } = stub({ query: { search: [] } });
  await searchFiles('Kia EV5', { fetchImpl });
  assert.equal(calls[0].options.headers['User-Agent'], USER_AGENT);
  assert.ok(USER_AGENT.includes('car-calc'));
});

test('fileMetadata also identifies the client', async () => {
  const { fetchImpl, calls } = stub({
    query: { pages: { 1: { imageinfo: [{
      url: 'https://u/x.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
      extmetadata: { Artist: { value: 'P' }, LicenseShortName: { value: 'CC0' } }
    }] } } }
  });
  await fileMetadata('x.jpg', { fetchImpl });
  assert.equal(calls[0].options.headers['User-Agent'], USER_AGENT);
});

test('fileMetadata extracts the download URL, author and licence', async () => {
  const { fetchImpl } = stub({
    query: { pages: { 123: { imageinfo: [{
      url: 'https://upload.wikimedia.org/x/BYD.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:BYD.jpg',
      extmetadata: {
        Artist: { value: '<a href="/wiki/User:Migl">Alexander Migl</a>' },
        LicenseShortName: { value: 'CC BY-SA 4.0' }
      }
    }] } } }
  });
  const meta = await fileMetadata('BYD.jpg', { fetchImpl });
  assert.equal(meta.downloadUrl, 'https://upload.wikimedia.org/x/BYD.jpg');
  assert.equal(meta.licence, 'CC BY-SA 4.0');
  assert.equal(meta.descriptionUrl, 'https://commons.wikimedia.org/wiki/File:BYD.jpg');
});

test('the author is stripped of the markup Commons wraps it in', async () => {
  // extmetadata returns HTML. Storing it raw would put a live anchor into the
  // credits page and into the committed data file.
  const { fetchImpl } = stub({
    query: { pages: { 1: { imageinfo: [{
      url: 'https://u/x.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
      extmetadata: { Artist: { value: '<a href="/wiki/User:Migl" title="x">Alexander Migl</a>' }, LicenseShortName: { value: 'CC0' } }
    }] } } }
  });
  assert.equal((await fileMetadata('x.jpg', { fetchImpl })).author, 'Alexander Migl');
});

test('a file with no usable metadata throws rather than returning blanks', async () => {
  const { fetchImpl } = stub({ query: { pages: { '-1': { missing: '' } } } });
  await assert.rejects(() => fileMetadata('nope.jpg', { fetchImpl }), /nope\.jpg/);
});

test('a non-ok response throws', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(() => searchFiles('Kia EV5', { fetchImpl }), /429/);
});
