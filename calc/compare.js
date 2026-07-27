import { driveAwayPrice } from './onroad.js';
import { runningCosts } from './running-costs.js';
import { resaleValue } from './resale.js';
import { novatedQuote } from './novated.js';
import { loanSummary } from './loan.js';
import { upfrontQuote } from './upfront.js';

function vehicleContext(vehicle, inputs, tables) {
  const onRoad = driveAwayPrice({ listPrice: vehicle.listPrice }, tables);
  const running = runningCosts({
    vehicle,
    annualKm: inputs.annualKm,
    // I5: these used to be hardcoded here, duplicating data/rates.json and
    // ignoring both the data file and the rates panel's edits entirely.
    // calc/ stays pure — no file reads — so the caller (ui/app.js's
    // buildInputs) is what threads data/rates.json's values through as
    // plain arguments, exactly like every other rate in `inputs`.
    rates: {
      electricityCentsPerKwh: inputs.electricityCentsPerKwh,
      otherRunningCostsAnnual: inputs.otherRunningCostsAnnual
    }
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

const ALL_OPTIONS = ['novated', 'loan', 'upfront'];

// "Can any of the three ways of paying get this buyer into this car at this
// budget?" Lives here, in the pure core, because two places need the same
// answer: the verdict in section 2 and the shortlist in section 3. They used
// to disagree — the shortlist screened only on boot/range/seats/body and
// never saw the budget at all, so it would recommend a $68,900 Model Y on
// $400/mo while the verdict beside it called that car out of reach.
export function isVehicleReachable({ vehicle, budgetMonthly, inputs }, tables) {
  const costs = optionCosts({ vehicle, inputs }, tables);
  return ALL_OPTIONS.some(option => {
    const entry = costs[option];
    return entry.feasible && entry.monthlyCost <= budgetMonthly;
  });
}

// Returns the surviving vehicles, in the order given and by identity, so
// callers can keep ranking and comparing them by reference.
export function reachableVehicles({ vehicles, budgetMonthly, inputs }, tables) {
  return vehicles.filter(vehicle =>
    isVehicleReachable({ vehicle, budgetMonthly, inputs }, tables)
  );
}

// Which lever is actually stopping this option, and what it would take.
// The totals row rendered a bare "out of reach" on every blocked option,
// which hid the fact that the fixes are different: a lease or a loan needs a
// bigger monthly budget, while cash needs the whole drive-away price sitting
// in savings. Savings is checked first — an unaffordable cash purchase is
// blocked by the money you don't have, not by its (small) running costs.
export function optionBlocker(costs, budgetMonthly) {
  if (!costs.feasible) return { kind: 'savings', needed: costs.detail.driveAway };
  if (costs.monthlyCost > budgetMonthly) return { kind: 'budget', needed: costs.monthlyCost };
  return null;
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

  const stepCount = Math.round((max - min) / step) + 1;
  for (let i = 0; i < stepCount; i++) {
    const budget = min + i * step;
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
