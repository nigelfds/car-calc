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
