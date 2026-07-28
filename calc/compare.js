import { driveAwayPrice } from './onroad.js';
import { runningCosts } from './running-costs.js';
import { resaleValue } from './resale.js';
import { novatedQuote } from './novated.js';
import { loanSummary } from './loan.js';
import { upfrontQuote, forgoneReturn } from './upfront.js';
import { resolvePhase } from './fbt.js';

function vehicleContext(vehicle, inputs, tables) {
  // The isGreen / isFuelEfficient flags have been on driveAwayPrice since the
  // beginning with nothing ever passing them, because every car in the
  // dataset was a BEV and every BEV qualifies for both. A PHEV may qualify
  // for neither, so this is where they finally get passed. A row without them
  // is a BEV (see data/schema.js) and keeps the true defaults.
  const onRoad = driveAwayPrice({
    listPrice: vehicle.listPrice,
    isGreen: vehicle.isGreenForVicDuty ?? true,
    isFuelEfficient: vehicle.isFuelEfficientForLct ?? true
  }, tables);
  const running = runningCosts({
    vehicle,
    annualKm: inputs.annualKm,
    // Ignored outright for a BEV; for a PHEV it is the single biggest lever
    // on the figure. Defaulting to 100 keeps a caller that has not been
    // updated producing the same answer it always did.
    batterySharePct: inputs.phevBatterySharePct ?? 100,
    // I5: these used to be hardcoded here, duplicating data/rates.json and
    // ignoring both the data file and the rates panel's edits entirely.
    // calc/ stays pure — no file reads — so the caller (ui/app.js's
    // buildInputs) is what threads data/rates.json's values through as
    // plain arguments, exactly like every other rate in `inputs`.
    rates: {
      electricityCentsPerKwh: inputs.electricityCentsPerKwh,
      otherRunningCostsAnnual: inputs.otherRunningCostsAnnual,
      petrolCentsPerLitre: inputs.petrolCentsPerLitre
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
    residualPctOverride: inputs.residualPctOverride ?? null,
    powertrain: vehicle.powertrain ?? 'bev'
  }, tables);

  // A PHEV that lost its FBT exemption on 1 April 2025 still costs out —
  // it just pays FBT on the full statutory formula instead of getting an
  // exemption or discount (see calc/fbt.js). Surfaced on all three options,
  // not just novated, so a card comparing them can disclose it consistently.
  const phevIneligible = novated.treatment?.phevIneligible ?? false;
  // The other half of the same disclosure, and the more dangerous one: a lease
  // start date before the cut-off makes these figures ~$47,000 cheaper over
  // the term, on an assumption (a binding commitment by 1 April 2025) the
  // inputs cannot confirm. Reported alongside, so a card cannot show the
  // cheap answer without showing why it is cheap.
  const phevExemptByDate = novated.treatment?.phevExemptByDate ?? false;

  // Gross outlay is everything that actually leaves your pocket, before any
  // credit for what you are left holding. Each option's TCO is then that
  // minus resale, so the two figures are derived from one number and cannot
  // drift apart. Anything comparing options on "value retained" must divide
  // by the gross, never by the net — see valueRatio below.
  //
  // For a novated lease the balloon is part of the gross: paying the residual
  // is what buys the car outright at the end of the term.
  const novatedGross = novated.netAnnualCost * years + novated.residual;
  const novatedTco = novatedGross - resale;

  const principal = Math.max(0, onRoad.total - inputs.deposit);
  const loan = loanSummary({
    principal,
    annualRatePct: inputs.loanRatePct,
    termMonths: inputs.termMonths
  });
  const loanRunningTotal = running.totalIncGst * years;
  // A deposit is savings spent early, exactly like a cash purchase, so it is
  // charged the same forgone return. Without this a deposit only ever looked
  // like a saving — it cut the interest but its cost of capital was free.
  const depositOpportunityCost = forgoneReturn({
    amount: inputs.deposit,
    opportunityRatePct: inputs.opportunityRatePct,
    termMonths: inputs.termMonths
  });
  const loanGross =
    loan.totalRepaid + inputs.deposit + loanRunningTotal + depositOpportunityCost;
  const loanTco = loanGross - resale;

  const upfront = upfrontQuote({
    driveAwayTotal: onRoad.total,
    termMonths: inputs.termMonths,
    opportunityRatePct: inputs.opportunityRatePct,
    runningCostsAnnualIncGst: running.totalIncGst
  });
  const upfrontGross =
    upfront.cashOutlay + upfront.opportunityCost + upfront.runningCostsTotal;
  const upfrontTco = upfrontGross - resale;

  return {
    novated: {
      option: 'novated',
      monthlyCost: novated.netMonthlyCost,
      tco: novatedTco,
      feasible: true,
      detail: {
        ...novated, resale, grossOutlay: novatedGross, driveAway: onRoad.total,
        phevIneligible, phevExemptByDate
      }
    },
    loan: {
      option: 'loan',
      monthlyCost: loan.monthlyRepayment + running.totalIncGst / 12,
      tco: loanTco,
      feasible: true,
      detail: {
        ...loan,
        runningCostsTotal: loanRunningTotal,
        depositOpportunityCost,
        resale,
        grossOutlay: loanGross,
        driveAway: onRoad.total,
        phevIneligible,
        phevExemptByDate
      }
    },
    upfront: {
      option: 'upfront',
      monthlyCost: upfront.netMonthlyRunningCost,
      tco: upfrontTco,
      feasible: inputs.savings >= onRoad.total,
      detail: {
        ...upfront, resale, grossOutlay: upfrontGross, driveAway: onRoad.total,
        phevIneligible, phevExemptByDate
      }
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
  const gross = costs?.detail?.grossOutlay;
  if (typeof gross !== 'number' || !Number.isFinite(gross) || gross <= 0) return null;
  return costs.detail.resale / gross;
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

