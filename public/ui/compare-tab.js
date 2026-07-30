// Renders the compare tab from the row model in calc/spec-compare.js.
// Formatting lives here rather than in calc/ because money() lives in
// ui/format.js and calc/ must not import from public/.

import { comparisonRows } from '../../calc/spec-compare.js';
import { money } from './format.js';

const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

const carName = v => `${v.make} ${v.model}`;

// The row model never formats — it returns raw values and a format tag, so
// that calc/ stays free of both the DOM and en-AU currency.
export function formatValue(value, format, unit) {
  if (value === null || value === undefined) return '—';
  const suffix = unit ? ` ${unit}` : '';
  if (format === 'money') return money(value);
  if (format === 'percent') return `${Math.round(value * 100)}%`;
  if (format === 'decimal1') return `${Number(value).toFixed(1)}${suffix}`;
  if (format === 'integer') return `${Number(value).toLocaleString('en-AU')}${suffix}`;
  return `${value}${suffix}`;
}

export function renderSlots(root, { slots, vehicles }) {
  const target = root.querySelector('#compare-slots');
  if (!target) return;

  target.innerHTML = slots.map((id, index) => {
    const vehicle = id ? vehicles.find(v => v.id === id) : null;
    if (vehicle) {
      return `
      <div class="compare-slot compare-slot--filled" data-slot="${index}">
        <p class="compare-slot__name">${escapeHtml(carName(vehicle))}</p>
        <p class="compare-slot__variant">${escapeHtml(vehicle.variant ?? '')}</p>
        <button type="button" class="compare-slot__clear" data-clear-slot="${index}"
                aria-label="Remove ${escapeHtml(carName(vehicle))} from the comparison">
          Remove
        </button>
      </div>`;
    }
    return `
      <div class="compare-slot" data-slot="${index}">
        <label class="compare-slot__label" for="compare-input-${index}">
          Car ${index + 1}${index === 2 ? ' (optional)' : ''}
        </label>
        <input class="compare-slot__input" id="compare-input-${index}" type="text"
               role="combobox" autocomplete="off" aria-expanded="false"
               aria-controls="compare-listbox-${index}"
               placeholder="Search make, model or variant">
        <div class="ac__list" id="compare-listbox-${index}" role="listbox" hidden></div>
      </div>`;
  }).join('');
}

function caveatMarkup(caveats, columns) {
  // At most two. bootDown can attract three rules at once, and three amber
  // bands under one row is a wall rather than an explanation — the precedence
  // order in calc/spec-compare.js puts the most specific wording first.
  // compare-caveat-row on the <tr> is load-bearing beyond this task: Task 8's
  // off-screen note is another full-width band row and Task 10 styles both
  // through this shared class, so a caveat row must carry it too.
  return caveats.slice(0, 2).map(caveat => `
    <tr class="compare-caveat-row">
      <td class="compare-caveat" colspan="${columns + 1}" data-caveat="${escapeHtml(caveat.id)}">
        ${escapeHtml(caveat.text)}
      </td>
    </tr>`).join('');
}

export function renderComparison(root, { vehicles, families, tables, benchIndex = null }) {
  const table = root.querySelector('#compare-table');
  const prose = root.querySelector('#compare-prose');
  if (!table || !prose) return;

  if (vehicles.length < 2) {
    table.innerHTML = `<p class="skeleton-note">Pick a second car to start comparing. ` +
      `Any two cars in the dataset can be compared, whatever their body type.</p>`;
    prose.innerHTML = '';
    return;
  }

  const model = comparisonRows(vehicles, tables);
  const columns = vehicles.length;

  const head = `
    <thead>
      <tr>
        <th scope="col"><span class="visually-hidden">Specification</span></th>
        ${vehicles.map((v, i) => `
          <th scope="col" class="compare-head compare-head--${i}">
            ${escapeHtml(carName(v))}
            <span class="compare-head__variant">${escapeHtml(v.variant ?? '')}</span>
          </th>`).join('')}
      </tr>
    </thead>`;

  const body = model.groups.map(group => `
    <tbody class="compare-group" data-group="${escapeHtml(group.key)}">
      <tr><th class="compare-group__label" colspan="${columns + 1}" scope="rowgroup">
        ${escapeHtml(group.label)}
      </th></tr>
      ${group.rows.map(row => `
        <tr data-row="${escapeHtml(row.key)}">
          <th scope="row" class="compare-row__label">${escapeHtml(row.label)}</th>
          ${row.values.map((value, i) => `
            <td class="compare-cell${row.winnerIndex === i ? ' compare-cell--win' : ''}">
              ${escapeHtml(formatValue(value, row.format, row.unit))}
            </td>`).join('')}
        </tr>
        ${caveatMarkup(row.caveats, columns)}`).join('')}
    </tbody>`).join('');

  table.innerHTML = `<table class="compare-grid">${head}${body}</table>`;

  // A variant whose family record is missing renders its table column and
  // simply omits the prose, rather than failing the whole comparison.
  prose.innerHTML = vehicles.map((vehicle, i) => {
    const family = families.find(f => f.id === vehicle.familyId);
    if (!family) return '';
    const list = (items, className) => (items ?? []).length === 0 ? '' : `
      <ul class="${className}">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    return `
      <section class="compare-prose__car compare-prose__car--${i}"
               ${benchIndex === i ? 'data-benched="true"' : ''}>
        <h3>${escapeHtml(carName(vehicle))}</h3>
        ${family.summary ? `<p>${escapeHtml(family.summary)}</p>` : ''}
        ${list(family.pros, 'compare-pros')}
        ${list(family.cons, 'compare-cons')}
        ${(family.sources ?? []).length > 0 ? `<details><summary>Sources</summary><ul>${
          family.sources.map(src =>
            `<li><a href="${escapeHtml(src)}" rel="noopener noreferrer" target="_blank">${escapeHtml(src)}</a></li>`
          ).join('')
        }</ul></details>` : ''}
      </section>`;
  }).join('');
}
