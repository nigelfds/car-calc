// What a sum stops earning once it is spent on a car instead of left in
// savings, compounded over the term.
//
// Exported because two options withdraw cash, not one: a cash purchase pays
// the whole drive-away price, and a loan deposit pays part of it. Both stop
// earning on the day they are handed over, so both must be charged the same
// way — a deposit that escaped this made any deposit-funded loan look cheaper
// than it is, by more as the deposit grew.
export function forgoneReturn({ amount, opportunityRatePct, termMonths }) {
  const years = termMonths / 12;
  const growth = Math.pow(1 + opportunityRatePct / 100, years);
  return amount * (growth - 1);
}

export function upfrontQuote({
  driveAwayTotal,
  termMonths,
  opportunityRatePct,
  runningCostsAnnualIncGst
}) {
  const years = termMonths / 12;
  return {
    cashOutlay: driveAwayTotal,
    opportunityCost: forgoneReturn({
      amount: driveAwayTotal, opportunityRatePct, termMonths
    }),
    runningCostsTotal: runningCostsAnnualIncGst * years,
    netMonthlyRunningCost: runningCostsAnnualIncGst / 12
  };
}
