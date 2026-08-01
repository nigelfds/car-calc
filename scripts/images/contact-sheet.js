// scripts/images/contact-sheet.js — renders the human review page for
// curated car images: one figure per family, captioned with the car name,
// the author and the licence, with the classifier's verdict carried as a
// class so auto-accepted entries stand out from entries a human already
// resolved.
//
// This page is the safety net classify.js describes: the sibling-clash rule
// can only flag a confusable model against a family we already hold, so a
// Seal U offered for the Seal auto-accepts silently. Nothing computed can
// catch that; a human scanning this page is the actual backstop. So the
// design bias here is the opposite of the app's — auto entries (nobody has
// looked at these) get the louder treatment, manual entries (already
// resolved by a human) get the quieter one. That's the whole point of the
// page, not decoration.

// Duplicated from public/ui/escape.js rather than imported: this file runs
// as offline Node tooling that writes a static file to disk, not as part of
// the shipped browser app. Importing app-side UI code into the curation
// pipeline would couple two things that should be free to change
// independently — same five characters escaped, same rule, kept separate.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

// Inline and self-contained: this page is opened directly off disk (the real
// public/ tree or a dry-run scratch directory), so it cannot depend on the
// app's stylesheet being reachable from wherever it lands.
const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 2rem;
    background: #f3f4f6;
    color: #111827;
  }
  h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
  .subtitle { margin: 0 0 1.5rem; color: #4b5563; font-size: 0.9rem; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
  }
  figure {
    margin: 0;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    border-left: 6px solid transparent;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
  figure img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    background: #d1d5db;
  }
  figcaption { padding: 0.6rem 0.75rem; font-size: 0.85rem; line-height: 1.4; }
  .badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    margin-bottom: 0.35rem;
  }
  .name { display: block; font-weight: 600; }
  .credit { display: block; color: #4b5563; }
  .why { display: block; color: #6b7280; font-style: italic; margin-top: 0.25rem; }

  /* Auto: nobody has looked at this one yet — make it impossible to miss. */
  .verdict--auto { border-left-color: #d97706; }
  .verdict--auto .badge { background: #fef3c7; color: #92400e; }

  /* Manual: already resolved by a human — quiet on purpose, so the eye
     doesn't linger here at the expense of the entries that need scrutiny. */
  .verdict--manual { border-left-color: #16a34a; }
  .verdict--manual .badge { background: #dcfce7; color: #166534; }

  .empty { font-size: 1rem; color: #374151; }

  @media (prefers-color-scheme: dark) {
    body { background: #111827; color: #f3f4f6; }
    figure { background: #1f2937; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); }
    .subtitle { color: #9ca3af; }
    .credit { color: #9ca3af; }
    .why { color: #6b7280; }
    .empty { color: #d1d5db; }
  }
`;

const BADGES = { auto: 'auto — unreviewed', manual: 'manual — resolved' };

function figureFor(entry) {
  const verdictClass = `verdict--${escapeHtml(entry.verdict)}`;
  const badge = BADGES[entry.verdict] ?? entry.verdict;
  return `      <figure class="${verdictClass}">
        <img src="images/cars/${escapeHtml(entry.file)}" alt="${escapeHtml(entry.name)}" loading="lazy">
        <figcaption>
          <span class="badge">${escapeHtml(badge)}</span>
          <span class="name">${escapeHtml(entry.name)}</span>
          <span class="credit">${escapeHtml(entry.author)} &middot; ${escapeHtml(entry.licence)}</span>
          <span class="why">${escapeHtml(entry.why)}</span>
        </figcaption>
      </figure>`;
}

export function contactSheet(entries, { title }) {
  const body = entries.length === 0
    ? '    <p class="empty">Nothing to review — this run curated no images.</p>'
    : `    <div class="grid">\n${entries.map(figureFor).join('\n')}\n    </div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>${STYLE}</style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${entries.length} image${entries.length === 1 ? '' : 's'} curated — auto-accepted entries are unreviewed, manual entries are already resolved.</p>
${body}
  </body>
</html>`;
}
