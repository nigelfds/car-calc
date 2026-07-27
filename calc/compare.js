import { driveAwayPrice } from './onroad.js';
import { runningCosts } from './running-costs.js';
import { resaleValue } from './resale.js';
import { novatedQuote } from './novated.js';
import { loanSummary } from './loan.js';
import { upfrontQuote } from './upfront.js';
import { resolvePhase } from './fbt.js';

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

// Return on the money spent, expressed as "of everything this costs you over
// the term, how much are you still holding at the end?" — resale ÷ total cost,
// higher is better.
//
// This is what lets the three option tiles be compared at all now that each
// reaches the dearest car it can individually afford. Raw total cost cannot:
// a cheaper car always costs less, so comparing totals across different cars
// systematically crowns whichever option is stuck shopping lowest (cash,
// bounded by savings, "won" at high budgets purely by being capped at a
// cheaper car). A ratio is scale-free, so it survives the comparison.
export function valueRatio(costs) {
  if (!costs || typeof costs.tco !== 'number' || costs.tco <= 0) return null;
  return costs.detail.resale / costs.tco;
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

// Where the novated line stops being able to climb, and why.
//
// calc/fbt.js treats the LCT fuel-efficient threshold as a hard edge rather
// than a taper: one dollar over and the lease is not exempt and gets no
// discount either. The net monthly cost roughly doubles across that dollar,
// so a novated lease cannot reach the next car up until the budget doubles
// too. On the chart that reads as an unexplained plateau.
//
// The binding cliff is phase-dependent: from April 2027 full exemption is
// capped at $75,000, below the LCT threshold, so that becomes the first edge
// a buyer hits. Resolved from the lease start date rather than hardcoded.
export function fbtCliff({ vehicles, inputs }, tables) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return null;

  const phase = resolvePhase(inputs.leaseStartDate, tables);
  const lctThreshold = tables.lct.fuelEfficientThreshold;
  const cliffPrice = phase.fullExemptionUpTo !== null && phase.fullExemptionUpTo < lctThreshold
    ? phase.fullExemptionUpTo
    : lctThreshold;

  const below = vehicles.filter(v => v.listPrice <= cliffPrice);
  const above = vehicles.filter(v => v.listPrice > cliffPrice);
  // A cliff is only meaningful if there are cars on both sides of it.
  if (below.length === 0 || above.length === 0) return null;

  const carBelow = below.reduce((best, v) => (v.listPrice > best.listPrice ? v : best));
  const carAbove = above.reduce((best, v) => (v.listPrice < best.listPrice ? v : best));

  const budgetAt = optionCosts({ vehicle: carBelow, inputs }, tables).novated.monthlyCost;
  const budgetNeeded = optionCosts({ vehicle: carAbove, inputs }, tables).novated.monthlyCost;

  // If crossing costs no more per month there is no cliff worth drawing.
  if (!(budgetNeeded > budgetAt)) return null;

  return { cliffPrice, budgetAt, budgetNeeded, carBelow, carAbove };
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
