import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTab } from './tabs.js';

// A stub root just rich enough for applyTab: two tab buttons and two panels.
function stubRoot() {
  const make = tab => ({
    dataset: { tab }, attrs: {}, hidden: false,
    setAttribute(name, value) { this.attrs[name] = value; }
  });
  const buttons = [make('find'), make('compare')];
  const panels = [make('find'), make('compare')];
  return {
    buttons, panels,
    querySelectorAll: selector =>
      selector.includes('tab-button') ? buttons : panels
  };
}

test('the selected tab is the only one marked selected', () => {
  const root = stubRoot();
  applyTab(root, 'compare');
  assert.deepEqual(root.buttons.map(b => b.attrs['aria-selected']), ['false', 'true']);
});

test('only the selected panel is visible', () => {
  const root = stubRoot();
  applyTab(root, 'compare');
  assert.deepEqual(root.panels.map(p => p.hidden), [true, false]);
});

test('switching back hides the other panel again', () => {
  const root = stubRoot();
  applyTab(root, 'compare');
  applyTab(root, 'find');
  assert.deepEqual(root.panels.map(p => p.hidden), [false, true]);
  assert.deepEqual(root.buttons.map(b => b.attrs['aria-selected']), ['true', 'false']);
});

test('only the selected tab is reachable by tabbing into the tablist', () => {
  const root = stubRoot();
  applyTab(root, 'compare');
  assert.deepEqual(root.buttons.map(b => b.attrs.tabindex), ['-1', '0']);
});

test('an unrecognised tab shows the default panel rather than none', () => {
  const root = stubRoot();
  applyTab(root, 'nonsense');
  assert.deepEqual(root.panels.map(p => p.hidden), [false, true]);
});
