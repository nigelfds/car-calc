import { driveAwayPrice } from './onroad.js';
import { runningCosts } from './running-costs.js';
import { resaleValue } from './resale.js';
import { novatedQuote } from './novated.js';
import { loanSummary, monthlyRepayment } from './loan.js';
import { upfrontQuote } from './upfront.js';

const RATE_DEFAULTS = { electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240 };

function vehicleContext(vehicle, inputs, tables) {
  const onRoad = driveAwayPrice({ listPrice: vehicle.listPrice }, tables);
  const running = runningCosts({
    vehicle,
    annualKm: inputs.annualKm,
    rates: RATE_DEFAULTS
  });
  const resale = resaleValue({
    driveAwayTotal: onRoad.total,
    termMonths: inputs.termMonths,
    depreciationCurve: vehicle.depreciationCurve
  });
  return { onRoad, running, resale, years: inputs.termMonths / 12 };
}

export function optionCosts({ vehicle, inputs }, tables) {
  const { onRoad, running, resale, years } = vehicleContext(vehicle, inputs, tables);

  const novated = novatedQuote({
    driveAwayTotal: onRoad.total,
    termMonths: inputs.termMonths,
    leaseRatePct: inputs.leaseRatePct,
    adminFeeAnnual: inputs.adminFeeAnnual,
    runningCostsAnnualExGst: running.totalExGst,
    runningCostsAnnualIncGst: running.totalIncGst,
    leaseStartDate: inputs.leaseStartDate,
    vehicleValue: vehicle.listPrice,
    grossSalary: inputs.grossSalary,
    residualPctOverride: inputs.residualPctOverride ?? null
  }, tables);

  // Paying the balloon buys the car outright, so the resale value is credited.
  const novatedTco = novated.netAnnualCost * years + novated.residual - resale;

  const principal = Math.max(0, onRoad.total - inputs.deposit);
  const loan = loanSummary({
    principal,
    annualRatePct: inputs.loanRatePct,
    termMonths: inputs.termMonths
  });
  const loanRunningTotal = running.totalIncGst * years;
  const loanTco = loan.totalRepaid + inputs.deposit + loanRunningTotal - resale;

  const upfront = upfrontQuote({
    driveAwayTotal: onRoad.total,
    termMonths: inputs.termMonths,
    opportunityRatePct: inputs.opportunityRatePct,
    runningCostsAnnualIncGst: running.totalIncGst
  });
  const upfrontTco =
    upfront.cashOutlay + upfront.opportunityCost + upfront.runningCostsTotal - resale;

  return {
    novated: {
      option: 'novated',
      monthlyCost: novated.netMonthlyCost,
      tco: novatedTco,
      feasible: true,
      detail: { ...novated, resale, driveAway: onRoad.total }
    },
    loan: {
      option: 'loan',
      monthlyCost: loan.monthlyRepayment + running.totalIncGst / 12,
      tco: loanTco,
      feasible: true,
      detail: { ...loan, runningCostsTotal: loanRunningTotal, resale, driveAway: onRoad.total }
    },
    upfront: {
      option: 'upfront',
      monthlyCost: upfront.netMonthlyRunningCost,
      tco: upfrontTco,
      feasible: inputs.savings >= onRoad.total,
      detail: { ...upfront, resale, driveAway: onRoad.total }
    }
  };
}

export function reachableVehicle({ vehicles, budgetMonthly, option, inputs }, tables) {
  const affordable = vehicles
    .map(vehicle => ({ vehicle, costs: optionCosts({ vehicle, inputs }, tables)[option] }))
    .filter(({ costs }) => costs.feasible && costs.monthlyCost <= budgetMonthly);

  if (affordable.length === 0) return null;
  return affordable.reduce((dearest, current) =>
    current.vehicle.listPrice > dearest.vehicle.listPrice ? current : dearest
  ).vehicle;
}

export function crossoverSeries({ vehicles, inputs, budgetRange }, tables) {
  const { min, max, step } = budgetRange;
  const options = ['novated', 'loan', 'upfront'];
  const points = [];

  for (let budget = min; budget <= max; budget += step) {
    const point = { budget };
    for (const option of options) {
      const vehicle = reachableVehicle({ vehicles, budgetMonthly: budget, option, inputs }, tables);
      point[option] = vehicle
        ? optionCosts({ vehicle, inputs }, tables)[option].tco
        : null;
    }
    points.push(point);
  }

  const leaderAt = point => {
    const priced = options
      .filter(o => point[o] !== null)
      .map(o => ({ option: o, tco: point[o] }));
    if (priced.length === 0) return null;
    return priced.reduce((best, cur) => (cur.tco < best.tco ? cur : best)).option;
  };

  const crossovers = [];
  for (let i = 1; i < points.length; i++) {
    const previous = leaderAt(points[i - 1]);
    const current = leaderAt(points[i]);
    if (previous && current && previous !== current) {
      crossovers.push({ budget: points[i].budget, from: previous, to: current });
    }
  }

  return { points, crossovers };
}
