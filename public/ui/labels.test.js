import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPTIONS, OPTION_NAME, OPTION_NAME_SHORT, OPTION_PHRASE } from './labels.js';

// The failure this guards against is not a typo, it is drift: a fourth way of
// paying added to one map and forgotten in the others, which is exactly how
// the page ended up with four names for a car loan.
test('every map covers every option, and nothing else', () => {
  for (const map of [OPTION_NAME, OPTION_NAME_SHORT, OPTION_PHRASE]) {
    assert.deepEqual(Object.keys(map).sort(), [...OPTIONS].sort());
  }
});

test('no label is blank', () => {
  for (const map of [OPTION_NAME, OPTION_NAME_SHORT, OPTION_PHRASE]) {
    for (const option of OPTIONS) {
      assert.ok(map[option]?.trim().length > 0, `${option} needs a label`);
    }
  }
});

// The short form is a shortening, not a rename: whatever it says has to be a
// word the long form already used, or the reader is being taught two names for
// one thing again.
test('the short form only ever drops words from the long form', () => {
  for (const option of OPTIONS) {
    const longWords = OPTION_NAME[option].toLowerCase().split(' ');
    for (const word of OPTION_NAME_SHORT[option].toLowerCase().split(' ')) {
      assert.ok(longWords.includes(word), `"${word}" is not in "${OPTION_NAME[option]}"`);
    }
  }
});

// Same rule for the sentence form, allowing only the articles that make it a
// sentence. "Paying cash" is the one deliberate exception — "cash reaches up to
// $X" reads as the money doing the reaching, so the verb earns its place.
test('the sentence form is the long form plus an article or a verb', () => {
  const permitted = new Set(['a', 'an', 'the', 'paying']);
  for (const option of OPTIONS) {
    const longWords = new Set(OPTION_NAME[option].toLowerCase().split(' '));
    for (const word of OPTION_PHRASE[option].toLowerCase().split(' ')) {
      assert.ok(
        longWords.has(word) || permitted.has(word),
        `"${word}" is neither in "${OPTION_NAME[option]}" nor a permitted connective`
      );
    }
  }
});
