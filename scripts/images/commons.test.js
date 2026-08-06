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
