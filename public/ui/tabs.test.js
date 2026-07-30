import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTab, bindTabs } from './tabs.js';

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

// --- bindTabs -----------------------------------------------------------
// bindTabs binds to the .tablist element and reads aria-selected off the
// buttons to find "current", so the stub needs getAttribute alongside
// setAttribute, a focus() to record roving-tabindex focus moves, and a
// closest() on the click target the way a real DOM node would offer it.
// The tablist itself just needs to remember the handlers bindTabs registers,
// so a test can invoke them directly in place of a real Event dispatch.
function stubTablistRoot(selectedTab) {
  const listeners = {};
  const buttons = ['find', 'compare'].map(tab => ({
    dataset: { tab },
    attrs: { 'aria-selected': tab === selectedTab ? 'true' : 'false' },
    focused: false,
    getAttribute(name) { return this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    focus() { this.focused = true; },
    closest(selector) { return selector === '.tab-button' ? this : null; }
  }));
  const tablist = {
    addEventListener(type, handler) { listeners[type] = handler; }
  };
  return {
    buttons,
    listeners,
    querySelector: selector => (selector === '.tablist' ? tablist : null),
    querySelectorAll: selector => (selector.includes('tab-button') ? buttons : [])
  };
}

test('clicking a tab button reports its tab', () => {
  const root = stubTablistRoot('find');
  const changes = [];
  bindTabs(root, tab => changes.push(tab));
  root.listeners.click({ target: root.buttons[1] });
  assert.deepEqual(changes, ['compare']);
});

test('clicking outside a tab button reports nothing', () => {
  const root = stubTablistRoot('find');
  const changes = [];
  bindTabs(root, tab => changes.push(tab));
  root.listeners.click({ target: { closest: () => null } });
  assert.deepEqual(changes, []);
});

test('ArrowRight advances from the first tab to the next and focuses it', () => {
  const root = stubTablistRoot('find');
  const changes = [];
  bindTabs(root, tab => changes.push(tab));
  let prevented = false;
  root.listeners.keydown({ key: 'ArrowRight', preventDefault: () => { prevented = true; } });
  assert.deepEqual(changes, ['compare']);
  assert.equal(prevented, true);
  assert.equal(root.buttons[1].focused, true);
});

test('ArrowRight wraps from the last tab back to the first', () => {
  const root = stubTablistRoot('compare');
  const changes = [];
  bindTabs(root, tab => changes.push(tab));
  root.listeners.keydown({ key: 'ArrowRight', preventDefault: () => {} });
  assert.deepEqual(changes, ['find']);
  assert.equal(root.buttons[0].focused, true);
});

test('ArrowLeft retreats from the last tab to the previous one', () => {
  const root = stubTablistRoot('compare');
  const changes = [];
  bindTabs(root, tab => changes.push(tab));
  root.listeners.keydown({ key: 'ArrowLeft', preventDefault: () => {} });
  assert.deepEqual(changes, ['find']);
});

test('ArrowLeft wraps from the first tab back to the last', () => {
  const root = stubTablistRoot('find');
  const changes = [];
  bindTabs(root, tab => changes.push(tab));
  root.listeners.keydown({ key: 'ArrowLeft', preventDefault: () => {} });
  assert.deepEqual(changes, ['compare']);
});

test('a non-arrow key is left alone', () => {
  const root = stubTablistRoot('find');
  const changes = [];
  bindTabs(root, tab => changes.push(tab));
  root.listeners.keydown({ key: 'Enter', preventDefault: () => { throw new Error('should not be called'); } });
  assert.deepEqual(changes, []);
});

test('bindTabs does nothing when there is no tablist in the DOM', () => {
  const root = { querySelector: () => null };
  assert.doesNotThrow(() => bindTabs(root, () => { throw new Error('should not be called'); }));
});
