export function upfrontQuote({
  driveAwayTotal,
  termMonths,
  opportunityRatePct,
  runningCostsAnnualIncGst
}) {
  const years = termMonths / 12;
  const growth = Math.pow(1 + opportunityRatePct / 100, years);
  return {
    cashOutlay: driveAwayTotal,
    opportunityCost: driveAwayTotal * (growth - 1),
    runningCostsTotal: runningCostsAnnualIncGst * years,
    netMonthlyRunningCost: runningCostsAnnualIncGst / 12
  };
}
