// Renders the compare tab from the row model in calc/spec-compare.js.
// Formatting lives here rather than in calc/ because money() lives in
// ui/format.js and calc/ must not import from public/.

import { comparisonRows } from '../../calc/spec-compare.js';
import { money } from './format.js';
import { escapeHtml } from './escape.js';

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

// Best-in-row is scored across every filled slot, including the one that is
// off-screen on a phone (calc/spec-compare.js never sees the bench). So a
// two-up view has to account for a winner it is not showing — otherwise the
// marker lands on the best *visible* car and quietly misreports the set.
export function offScreenNote(row, vehicles, benchIndex) {
  if (benchIndex === null || benchIndex === undefined) return null;
  if (row.caveats.length > 0) return null;
  if (row.winnerIndex !== benchIndex) return null;

  const vehicle = vehicles[benchIndex];
  const value = formatValue(row.values[benchIndex], row.format, row.unit);
  return `Off screen · ${carName(vehicle)} — ${value}, best of the three.`;
}

export function renderBench(root, { vehicles, benchIndex, model }) {
  const target = root.querySelector('#compare-bench');
  if (!target) return;
  if (benchIndex === null || benchIndex === undefined || vehicles.length < 3) {
    target.innerHTML = '';
    return;
  }

  // A dot warns that the benched car appears in at least one callout, so the
  // reader knows before scrolling that it is doing more than sitting out.
  const rows = model.groups.flatMap(group => group.rows);
  const mentioned = rows.some(row =>
    row.winnerIndex === benchIndex ||
    row.caveats.some(caveat => caveat.text.includes(carName(vehicles[benchIndex])))
  );

  // Every chip is a real action, both ways: tapping the benched one brings
  // it on screen, tapping a visible one sends it off (see app.js's click
  // handler). There is no persistent on/off state for a single chip to
  // report — pressing one doesn't toggle *that* chip, it changes which car
  // this position on screen names — so aria-pressed does not belong here,
  // and neither does aria-disabled: every chip does something now. The
  // accessible name carries the action and the current state instead, since
  // the bare car name said neither.
  target.innerHTML = `
    <p class="compare-bench__hint" id="compare-bench-hint">
      Two cars show at a time. Tap a chip to bring it on screen or send it off.
    </p>
    ${vehicles.map((vehicle, index) => {
      const benched = index === benchIndex;
      // aria-label overrides an element's contents entirely, so the visual
      // dot below (aria-hidden, and only ever painted on the benched chip)
      // reaches no screen-reader user unless what it conveys — that this
      // car is doing more than sitting out — is folded into the name itself.
      const label = benched
        ? `Show ${carName(vehicle)}, currently off screen${mentioned ? ' — appears in a note below' : ''}`
        : `Hide ${carName(vehicle)}`;
      return `
      <button type="button" class="compare-chip${benched ? ' compare-chip--benched' : ''}"
              data-bench-index="${index}" aria-describedby="compare-bench-hint"
              aria-label="${escapeHtml(label)}">
        ${escapeHtml(carName(vehicle))}${
          benched && mentioned ? '<span class="compare-chip__dot" aria-hidden="true"></span>' : ''
        }
      </button>`;
    }).join('')}`;
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

  // The row model is always built from ALL filled slots — that is what keeps
  // the winner honest. Only the *rendering* drops the benched column.
  const model = comparisonRows(vehicles, tables);
  const shown = vehicles
    .map((vehicle, index) => ({ vehicle, index }))
    .filter(entry => entry.index !== benchIndex);
  const columns = shown.length;

  // The header maps over `shown`, which carries vehicles rather than families,
  // so the image is resolved by familyId against the families already passed in.
  const imageFor = vehicle => families.find(f => f.id === vehicle.familyId)?.image ?? null;

  const head = `
    <thead>
      <tr>
        <th scope="col"><span class="visually-hidden">Specification</span></th>
        ${shown.map(({ vehicle, index }) => `
          <th scope="col" class="compare-head compare-head--${index}">
            ${imageFor(vehicle) ? `<img class="compare-head__img"
              src="images/cars/${escapeHtml(imageFor(vehicle).file)}"
              alt="${escapeHtml(carName(vehicle))}"
              title="${escapeHtml(`${imageFor(vehicle).author} · ${imageFor(vehicle).licence}`)}"
              width="900" height="600" loading="lazy">` : ''}
            ${escapeHtml(carName(vehicle))}
            <span class="compare-head__variant">${escapeHtml(vehicle.variant ?? '')}</span>
          </th>`).join('')}
      </tr>
    </thead>`;

  const body = model.groups.map(group => `
    <tbody class="compare-group" data-group="${escapeHtml(group.key)}">
      <tr><th class="compare-group__label" colspan="${columns + 1}" scope="rowgroup">
        ${escapeHtml(group.label)}
      </th></tr>
      ${group.rows.map(row => {
        const note = offScreenNote(row, vehicles, benchIndex);
        return `
        <tr data-row="${escapeHtml(row.key)}">
          <th scope="row" class="compare-row__label">${escapeHtml(row.label)}</th>
          ${shown.map(({ index }) => `
            <td class="compare-cell${row.winnerIndex === index ? ' compare-cell--win' : ''}">
              ${escapeHtml(formatValue(row.values[index], row.format, row.unit))}
            </td>`).join('')}
        </tr>
        ${caveatMarkup(row.caveats, columns)}
        ${note ? `<tr class="compare-caveat-row"><td class="compare-offscreen" colspan="${columns + 1}">
          ${escapeHtml(note)}</td></tr>` : ''}`;
      }).join('')}
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
