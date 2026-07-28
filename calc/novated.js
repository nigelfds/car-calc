import { netIncome } from './tax.js';
import { fbtTreatment, annualFbt as computeFbt } from './fbt.js';
import { monthlyRepayment } from './loan.js';

export function gstCredit(driveAwayTotal, tables) {
  return Math.min(driveAwayTotal / 11, tables.carLimit.maxGstCredit);
}

export function residualAmount({ vehicleCost, termMonths, residualPctOverride = null }, tables) {
  const minimum = tables.residuals[String(termMonths)];
  if (minimum === undefined) {
    throw new Error(`No ATO residual defined for a ${termMonths} month term`);
  }
  const pct = residualPctOverride === null
    ? minimum
    : Math.max(minimum, residualPctOverride);
  return vehicleCost * pct;
}

export function novatedQuote(input, tables) {
  const {
    driveAwayTotal, termMonths, leaseRatePct, adminFeeAnnual,
    runningCostsAnnualExGst, leaseStartDate, vehicleValue,
    grossSalary, residualPctOverride = null, powertrain = 'bev'
  } = input;

  const credit = gstCredit(driveAwayTotal, tables);
  const financedAmount = driveAwayTotal - credit;

  // The ATO minimum-residual guidance applies to the cost of the car itself,
  // not to the on-road extras (stamp duty, LCT, registration) that inflate
  // driveAwayTotal — see calc/onroad.js's driveAwayPrice(), where
  // total = listPrice + lct + stampDuty + registration. vehicleValue is that
  // list price, so it is the correct base for the residual.
  const residual = residualAmount(
    { vehicleCost: vehicleValue, termMonths, residualPctOverride },
    tables
  );

  const monthlyRate = leaseRatePct / 100 / 12;
  const residualPresentValue = residual / Math.pow(1 + monthlyRate, termMonths);
  const monthlyLeasePayment = monthlyRepayment({
    principal: financedAmount - residualPresentValue,
    annualRatePct: leaseRatePct,
    termMonths
  });

  const annualPreTaxDeduction =
    monthlyLeasePayment * 12 + runningCostsAnnualExGst + adminFeeAnnual;

  const treatment = fbtTreatment({ leaseStartDate, vehicleValue, powertrain }, tables);
  const fbt = computeFbt({ baseValue: vehicleValue, treatment }, tables);

  // Where FBT is payable it is reduced to nil by a post-tax employee
  // contribution equal to the FBT taxable value (the "employee contribution
  // method"): contributing that amount cancels the taxable value to zero.
  // annualFbt below reports the liability that the contribution offsets —
  // it is NOT re-zeroed here, otherwise the module would silently hide the
  // very cost (the contribution) that this quote exists to surface.
  const annualPostTaxContribution = treatment.exempt
    ? 0
    : vehicleValue * tables.fbt.statutoryRate * (1 - treatment.discountRate);

  const withoutPackaging = netIncome({ grossSalary }, tables);

  // Defence in depth for C3: a pre-tax deduction bigger than the salary it's
  // deducted from isn't a real scenario — netIncome (calc/tax.js) floors
  // taxable income at zero either way, so ui/app.js is what stops a
  // missing/blank/non-positive salary reaching here at all. This clamp
  // guards the other half — a genuine but very low salary packaging a car
  // whose lease payment alone exceeds it — so netAnnualCost below can never
  // be inflated by a deduction that could never actually be withheld from
  // pay. Reported `annualPreTaxDeduction` stays the true, uncapped figure
  // (what the lease actually costs pre-tax); only the netIncome comparison
  // that derives the *cost* of packaging uses the capped value.
  const safeGrossSalary = Number.isFinite(grossSalary) ? Math.max(0, grossSalary) : 0;
  const cappedPreTaxDeduction = Math.min(annualPreTaxDeduction, safeGrossSalary);
  const withPackaging = netIncome(
    { grossSalary, preTaxDeductions: cappedPreTaxDeduction },
    tables
  );

  // True cost of the lease is the fall in take-home pay caused by the
  // pre-tax deduction, plus the post-tax contribution paid on top (which
  // never touches pre-tax pay and so is not captured by the netIncome
  // comparison above).
  const netAnnualCost =
    withoutPackaging.netAnnual - withPackaging.netAnnual + annualPostTaxContribution;

  return {
    financedAmount,
    residual,
    monthlyLeasePayment,
    annualPreTaxDeduction,
    annualPostTaxContribution,
    annualFbt: fbt,
    netAnnualCost,
    netMonthlyCost: netAnnualCost / 12,
    // So callers (compare.js) can disclose the FBT treatment — in particular
    // phevIneligible — without recomputing fbtTreatment themselves.
    treatment
  };
}
