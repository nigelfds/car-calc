// Shared currency formatter. Was previously duplicated verbatim in
// app.js, slider.js, cars.js and crossover-chart.js — each copy rendering
// a negative value as "$-500" instead of "-$500" (Math.round(-500) gives
// the string "-500", which the old `$${...}` template just glued a dollar
// sign onto the front of). Consolidated to one implementation, fixed once.
export function money(value) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${Math.abs(rounded).toLocaleString('en-AU')}`;
}

// Axis-sized currency. A phone leaves the chart roughly 310 units of plot
// width, and "$115,989" costs a fifth of that in the left margin before a
// single line is drawn. Only used where space is the binding constraint —
// everything a reader might act on still uses money() in full.
export function shortMoney(value) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}m`;
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}k`;
  return `${sign}$${abs.toLocaleString('en-AU')}`;
}
