// Matching for the compare tab's slot autocomplete. Pure and DOM-free so it
// can be tested directly; the combobox that consumes it lives in
// ui/autocomplete.js.

export const SEARCH_LIMIT = 8;

// Every term has to match somewhere in "make model variant", so "kia 5" finds
// the EV5 and "sealion dynamic" finds one trim. Splitting on whitespace rather
// than substring-matching the whole query is what makes word order irrelevant.
function matches(vehicle, terms) {
  const haystack = `${vehicle.make} ${vehicle.model} ${vehicle.variant ?? ''}`.toLowerCase();
  return terms.every(term => haystack.includes(term));
}

export function searchVehicles(vehicles, query, limit = SEARCH_LIMIT) {
  const terms = String(query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  // An empty box means "no suggestions", not "every car we have". 216 rows
  // dumped under an untouched input is a wall, not a help.
  if (terms.length === 0) return [];

  const hits = vehicles.filter(vehicle => matches(vehicle, terms)).slice(0, limit);

  // Grouped under the model, because four EV5 trims listed flat reads as four
  // unrelated cars. Insertion order is dataset order, which is alphabetical by
  // make — good enough, and stable.
  const groups = [];
  for (const vehicle of hits) {
    const modelLabel = `${vehicle.make} ${vehicle.model}`;
    const existing = groups.find(group => group.modelLabel === modelLabel);
    if (existing) existing.items.push(vehicle);
    else groups.push({ modelLabel, items: [vehicle] });
  }
  return groups;
}
