// Bounds a raw parsed-preferences object to sane ranges and snaps termMonths to
// a supported ATO lease term. Used by the on-device Chrome Prompt API parse
// (public/ui/prompt-api.js) so a model never hands the form an out-of-range value.
//
// Pure core: no fetch, no Date.now(), no randomness, no I/O, no zod.

const TERMS = [12, 24, 36, 48, 60];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function clampParsed(parsed) {
  const out = { ...parsed };
  if (typeof out.grossSalary === 'number') out.grossSalary = clamp(out.grossSalary, 20000, 1000000);
  if (typeof out.monthlyBudget === 'number') out.monthlyBudget = clamp(out.monthlyBudget, 100, 10000);
  if (typeof out.minBootLitres === 'number') out.minBootLitres = clamp(out.minBootLitres, 0, 3000);
  if (typeof out.minRangeKm === 'number') out.minRangeKm = clamp(out.minRangeKm, 0, 1000);
  if (typeof out.seats === 'number') out.seats = clamp(out.seats, 2, 9);
  if (typeof out.termMonths === 'number') {
    out.termMonths = TERMS.reduce((best, t) =>
      Math.abs(t - out.termMonths) < Math.abs(best - out.termMonths) ? t : best
    );
  }
  return out;
}
