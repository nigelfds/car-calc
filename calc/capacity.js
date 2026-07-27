// How much car each way of paying can get you at a given monthly budget.
//
// This is what step 2 of the app is about, and it deliberately knows nothing
// about specific cars. The chart it feeds used to plot the total cost of a
// *different car per funding option* at each budget, which is not a
// comparison at all — a cheaper car always costs less, so it crowned whichever
// option was stuck shopping lowest. Asking "how much car does this budget
// buy?" instead removes cars from the question entirely, and the answers are
// directly comparable because they are all denominated in dollars of car.

import { optionCosts } from './compare.js';

const OPTIONS = ['novated', 'loan', 'upfront'];

// Fallbacks for an empty fleet, so a caller with no data still gets a usable
// curve instead of NaN. Mid-range values for an Australian EV.
const FALLBACK_PROFILE = {
  consumptionKwhPer100km: 16,
  insuranceAnnual: 1800,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
};

// The cheapest car on the market, used as the capacity floor.
export function cheapestPrice(vehicles = []) {
  const prices = vehicles.map(v => v.listPrice).filter(Number.isFinite);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

const median = numbers => {
  const sorted = numbers.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length / 2)];
};

// Running costs depend on a car's consumption and insurance, so "how much car
// can I afford" is not perfectly car-independent. Medians make the answer
// describe a typical EV rather than any particular one, which is what keeps
// step 2 free of specific cars. The UI states the assumption; step 3 uses each
// car's real figures.
export function representativeProfile(vehicles = []) {
  return {
    consumptionKwhPer100km:
      median(vehicles.map(v => v.consumptionKwhPer100km)) ?? FALLBACK_PROFILE.consumptionKwhPer100km,
    insuranceAnnual:
      median(vehicles.map(v => v.insuranceAnnual)) ?? FALLBACK_PROFILE.insuranceAnnual,
    depreciationCurve: FALLBACK_PROFILE.depreciationCurve
  };
}

// Widest price the solver will consider. Above the dataset's dearest car by a
// margin, so a very large budget still reports a real ceiling rather than
// silently pinning to the top of the range.
const SEARCH_CEILING = 250000;
// 250000 / 2^40 is far below a cent, so the answer is exact for our purposes.
const SEARCH_ITERATIONS = 40;

// The dearest list price this option supports at this budget. Monthly cost is
// monotonic in price for all three options, so a bisection finds the boundary
// exactly and costs 40 evaluations rather than one per car in the fleet.
// `floorPrice` is the cheapest car actually on the market. Without it the
// solver reports arithmetic that has no product behind it — "at $400/mo a loan
// reaches a $3,177 car" — which drew a curve whose low end was fiction and
// contradicted the entry marker, which counts real cars. Below the floor there
// is nothing to buy, so capacity is nothing.
export function maxAffordablePrice(
  { budgetMonthly, option, inputs, profile, floorPrice = 0 },
  tables
) {
  const affordable = price => {
    const vehicle = { id: 'probe', listPrice: price, ...profile };
    const costs = optionCosts({ vehicle, inputs }, tables)[option];
    return costs.feasible && costs.monthlyCost <= budgetMonthly;
  };

  // Nothing at all is reachable — return a hard zero rather than a tiny
  // positive number, so callers can treat it as "this option is out".
  if (!affordable(1)) return 0;

  let low = 1;
  let high = SEARCH_CEILING;
  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (affordable(mid)) low = mid; else high = mid;
  }
  return low < floorPrice ? 0 : low;
}

export function purchasingPowerSeries({ inputs, profile, budgetRange, floorPrice = 0 }, tables) {
  const { min, max, step } = budgetRange;
  const stepCount = Math.round((max - min) / step) + 1;
  const points = [];

  for (let i = 0; i < stepCount; i++) {
    const budget = min + i * step;
    const point = { budget };
    for (const option of OPTIONS) {
      point[option] = maxAffordablePrice(
        { budgetMonthly: budget, option, inputs, profile, floorPrice }, tables
      );
    }
    points.push(point);
  }

  // The leader is whichever option buys the MOST car — the opposite direction
  // to the old cost-based series, where the lowest number won.
  const leaderAt = point => {
    const reachable = OPTIONS.filter(option => point[option] > 0);
    if (reachable.length === 0) return null;
    return reachable.reduce((best, cur) => (point[cur] > point[best] ? cur : best));
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

// The budget at which an option can first reach anything at all, and the car
// that sets it. A chart line just begins partway across when nothing below
// that budget is reachable, which reads as missing data rather than as "this
// way of paying cannot buy you a car yet".
//
// Chosen on monthly cost, not on list price: the two differ. In the shipped
// dataset the cheapest car to buy (MG 4 Urban 43, $29,840) is not the
// cheapest to finance — the BYD Dolphin Essential costs $150 more but $7/mo
// less, because insurance and consumption differ.
//
// Unlike maxAffordablePrice this one does need the real fleet: it names a car.
export function optionEntryPoint({ vehicles, inputs, option }, tables) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return null;

  let best = null;
  for (const vehicle of vehicles) {
    const costs = optionCosts({ vehicle, inputs }, tables)[option];
    // Cash is bounded by savings at any budget, so an unaffordable car can
    // never be the entry point however cheap its running costs are.
    if (!costs.feasible) continue;
    if (best === null || costs.monthlyCost < best.budget) {
      best = { budget: costs.monthlyCost, vehicle };
    }
  }
  return best;
}
