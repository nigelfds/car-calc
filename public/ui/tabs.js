// The two-tab shell. The ARIA tab pattern wants exactly one tab in the page's
// tab order, with the arrow keys moving between them — hence the roving
// tabindex below rather than leaving all buttons focusable.

import { TABS } from './state.js';

export function applyTab(root, tab) {
  // A tab value naming no panel would blank the page. Fall back rather than
  // render nothing; state.js does the same on the way in from the URL.
  const active = TABS.includes(tab) ? tab : TABS[0];

  for (const button of root.querySelectorAll('.tab-button')) {
    const selected = button.dataset.tab === active;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.setAttribute('tabindex', selected ? '0' : '-1');
  }
  for (const panel of root.querySelectorAll('.tab-panel')) {
    panel.hidden = panel.dataset.tab !== active;
  }
}

export function bindTabs(root, onChange) {
  const list = root.querySelector('.tablist');
  if (!list) return;

  list.addEventListener('click', event => {
    const button = event.target.closest?.('.tab-button');
    if (button) onChange(button.dataset.tab);
  });

  list.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const buttons = [...root.querySelectorAll('.tab-button')];
    const current = buttons.findIndex(b => b.getAttribute('aria-selected') === 'true');
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = buttons[(current + step + buttons.length) % buttons.length];
    event.preventDefault();
    onChange(next.dataset.tab);
    next.focus?.();
  });
}
