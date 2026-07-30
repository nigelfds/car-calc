// Shared HTML escaper. Was previously duplicated verbatim in cars.js,
// autocomplete.js and compare-tab.js — every renderer that builds markup as
// a string and assigns it to innerHTML needs the same five characters
// escaped before they reach the DOM. Consolidated to one implementation so
// the escaping rule can only be gotten right, or wrong, once.
export const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
