import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactSheet } from './contact-sheet.js';

const entries = [
  { familyId: 'kia-ev5', name: 'Kia EV5', file: 'kia-ev5.webp', author: 'A Photographer', licence: 'CC BY 4.0', verdict: 'auto', why: 'model matches with no sibling clash' },
  { familyId: 'byd-sealion-6', name: 'BYD Sealion 6', file: 'byd-sealion-6.webp', author: 'Alexander Migl', licence: 'CC BY-SA 4.0', verdict: 'manual', why: 'resolved via alias' }
];

test('every entry gets an image tag pointing at its file', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /src="[^"]*kia-ev5\.webp"/);
  assert.match(html, /src="[^"]*byd-sealion-6\.webp"/);
});

test('each entry is captioned with the car, the author and the licence', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /Kia EV5/);
  assert.match(html, /Alexander Migl/);
  assert.match(html, /CC BY-SA 4\.0/);
});

test('automatically accepted entries are visually distinguished from resolved flags', () => {
  // The reviewer's attention should go to what the classifier decided alone.
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /verdict--auto/);
  assert.match(html, /verdict--manual/);
});

test('the document is a complete standalone page', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<\/html>\s*$/);
  assert.match(html, /<title>Review<\/title>/);
});

test('an empty set renders a page saying so rather than an empty grid', () => {
  assert.match(contactSheet([], { title: 'Review' }), /nothing to review/i);
});

test('captions are escaped', () => {
  const html = contactSheet([{ ...entries[0], author: '<script>alert(1)</script>' }], { title: 'Review' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});
