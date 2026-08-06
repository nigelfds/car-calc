import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactSheet } from './contact-sheet.js';

const entries = [
  {
    familyId: 'kia-ev5', name: 'Kia EV5', file: 'kia-ev5.webp',
    candidateTitle: 'Kia EV5 GT-Line 2024 01.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Kia_EV5_GT-Line_2024_01.jpg',
    author: 'A Photographer', licence: 'CC BY 4.0', verdict: 'auto', why: 'model matches with no sibling clash'
  },
  {
    familyId: 'byd-sealion-6', name: 'BYD Sealion 6', file: 'byd-sealion-6.webp',
    candidateTitle: 'BYD Song Plus EV 2023.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:BYD_Song_Plus_EV_2023.jpg',
    author: 'Alexander Migl', licence: 'CC BY-SA 4.0', verdict: 'manual', why: 'resolved via alias'
  }
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

// Fix 4: a live dry run auto-accepted a BYD Seal U for the BYD Seal, and the
// reviewer who caught it did so by opening the file, not by reading the
// sheet — the Commons title never reached the caption at all. It's the
// single most legible signal that the candidate is the wrong car.
test('the Commons candidate title reaches the caption as text', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /Kia EV5 GT-Line 2024 01\.jpg/);
  assert.match(html, /BYD Song Plus EV 2023\.jpg/);
});

test('the Commons source renders as a link back to Commons', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /<a class="source" href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Kia_EV5_GT-Line_2024_01\.jpg"/);
});

test('the candidate title and source are escaped like every other field', () => {
  const nasty = { ...entries[0], candidateTitle: '<script>alert(2)</script>', source: 'https://commons.wikimedia.org/wiki/File:"><script>alert(3)</script>' };
  const html = contactSheet([nasty], { title: 'Review' });
  assert.doesNotMatch(html, /<script>alert\(2\)/);
  assert.doesNotMatch(html, /<script>alert\(3\)/);
});

// familyId was already part of the documented entry shape but was dropped on
// the floor — never rendered anywhere on the page.
test('the family id reaches the caption', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /kia-ev5/);
  assert.match(html, /byd-sealion-6/);
});

// Every committed crop is 900x600 (3:2). A 4:3 frame clips ~5.5% off each
// side under object-fit: cover, which is exactly where badging sits — the
// reviewer needs to see the crop that actually ships.
test('the image is framed at its true 3:2 crop, not stretched to 4:3', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /aspect-ratio:\s*3\s*\/\s*2/);
  assert.doesNotMatch(html, /aspect-ratio:\s*4\s*\/\s*3/);
});

test('the thumbnail links to its own file so a suspicious crop can be opened full-size', () => {
  const html = contactSheet(entries, { title: 'Review' });
  assert.match(html, /<a href="images\/cars\/kia-ev5\.webp"><img src="images\/cars\/kia-ev5\.webp"/);
});
