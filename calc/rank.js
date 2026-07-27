// Deterministic shortlist scoring. No model call: same inputs always give the
// same order, it costs nothing, and it works with no network.
//
// Each dimension contributes a 0..1 normalised value times a weight. A weight
// is raised when the user actually expressed that preference, so an unstated
// preference still nudges but never dominates.

// Price carries twice what it used to. At 1.0 it was the weakest lever on the
// board — the entire spread of the market, $0 to $120,000, was worth one point
// against boot's three, so a car being $15,000 cheaper counted for about a
// tenth of what a large boot counted for.
//
// Note what this can and cannot reach. The shortlist is bracketed by price
// before it is scored (bracketAroundPrice), so within the at-budget band every
// candidate is already inside ±5% of the anchor and the whole value term
// varies by ~0.05 there — doubling it buys ~0.05 more. The band it actually
// moves is "just under your budget", which spans 70–95% of the anchor: a real
// 25% spread, where the value term now varies by ~0.33 instead of ~0.17.
const WEIGHTS = {
  boot: { stated: 3.0, unstated: 0.5 },
  range: { stated: 2.5, unstated: 0.8 },
  warranty: { stated: 0, unstated: 0.6 },
  value: { stated: 0, unstated: 2.0 }
};

const ratio = (value, reference) =>
  reference > 0 ? Math.min(1, value / reference) : 0;

export function scoreVehicle(vehicle, preferences = {}) {
  const bootWanted = typeof preferences.minBootLitres === 'number';
  const rangeWanted = typeof preferences.minRangeKm === 'number';

  const bootWeight = bootWanted ? WEIGHTS.boot.stated : WEIGHTS.boot.unstated;
  const rangeWeight = rangeWanted ? WEIGHTS.range.stated : WEIGHTS.range.unstated;

  // Normalise against generous ceilings so the scale is stable across fleets.
  const boot = ratio(vehicle.bootLitresSeatsUp, 900);
  const range = ratio(vehicle.rangeKm, 700);
  const warranty = ratio(vehicle.warrantyYears, 10);
  // Cheaper is better, all else equal.
  const value = 1 - ratio(vehicle.listPrice, 120000);

  return (
    boot * bootWeight +
    range * rangeWeight +
    warranty * WEIGHTS.warranty.unstated +
    value * WEIGHTS.value.unstated
  );
}

const median = numbers => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

// Reasons exist to help a reader tell cards apart, so every fact here is
// judged against the pool of vehicles it's being shown alongside — not
// against the user's own filter numbers (which every candidate in the pool
// already clears, so restating them says nothing). `pool` is whatever
// rankVehicles was called with; reasonsFor never mutates it and never
// touches the clock, network or Math.random, so the same (vehicle,
// preferences, pool) triple always produces the same reasons.
function reasonsFor(vehicle, preferences, pool) {
  const group = pool && pool.length > 0 ? pool : [vehicle];
  const boots = group.map(v => v.bootLitresSeatsUp);
  const ranges = group.map(v => v.rangeKm);
  const prices = group.map(v => v.listPrice);
  const warranties = group.map(v => v.warrantyYears);

  const maxBoot = Math.max(...boots);
  const maxRange = Math.max(...ranges);
  const maxWarranty = Math.max(...warranties);
  const minPrice = Math.min(...prices);
  const medianBoot = median(boots);
  const medianRange = median(ranges);
  const medianPrice = median(prices);

  const facts = [];
  const isGroupOfOne = group.length <= 1;

  // Towing only surfaces when the user actually asked for tow capacity —
  // otherwise a big tow rating is trivia, not a reason this car is here.
  if (typeof preferences.minTowKg === 'number' && typeof vehicle.towKg === 'number' && vehicle.towKg >= preferences.minTowKg) {
    const maxTow = Math.max(...group.map(v => v.towKg ?? 0));
    facts.push({
      weight: vehicle.towKg === maxTow && !isGroupOfOne ? 4 : 3,
      text: vehicle.towKg === maxTow && !isGroupOfOne
        ? `best tow rating here, ${vehicle.towKg}kg`
        : `${vehicle.towKg}kg tow rating`
    });
  }

  if (!isGroupOfOne && vehicle.bootLitresSeatsUp === maxBoot) {
    facts.push({ weight: 3.5, text: `biggest boot of this group, ${vehicle.bootLitresSeatsUp}L` });
  } else if (medianBoot > 0 && vehicle.bootLitresSeatsUp >= medianBoot * 1.15) {
    facts.push({ weight: 2, text: `unusually large boot, ${vehicle.bootLitresSeatsUp}L` });
  }

  if (!isGroupOfOne && vehicle.rangeKm === maxRange) {
    facts.push({ weight: 3.5, text: `longest range of this group, ${vehicle.rangeKm}km` });
  } else if (medianRange > 0 && vehicle.rangeKm >= medianRange * 1.15) {
    facts.push({ weight: 2, text: `unusually long range, ${vehicle.rangeKm}km` });
  }

  if (vehicle.warrantyYears >= 7 && !isGroupOfOne && vehicle.warrantyYears === maxWarranty) {
    facts.push({ weight: 2.5, text: `${vehicle.warrantyYears}-year warranty, longer than the rest of this group` });
  } else if (vehicle.warrantyYears >= 7) {
    facts.push({ weight: 1.5, text: `${vehicle.warrantyYears}-year warranty` });
  }

  if (!isGroupOfOne && vehicle.listPrice === minPrice) {
    facts.push({ weight: 3, text: 'cheapest of this group' });
  } else if (medianPrice > 0 && vehicle.listPrice <= medianPrice * 0.9) {
    facts.push({ weight: 1.8, text: 'low price for what it offers' });
  }

  // Highest-weight facts first; ties keep the order they were pushed in
  // above (boot, then range, then warranty, then price), which is fixed
  // for a given vehicle — so this stays deterministic.
  facts.sort((a, b) => b.weight - a.weight);
  const chosen = facts.slice(0, 2).map(f => f.text);

  if (chosen.length === 0) {
    chosen.push(`${vehicle.rangeKm}km range, ${vehicle.bootLitresSeatsUp}L boot`);
  }
  return chosen;
}

export function rankVehicles(vehicles, preferences = {}, limit = 5) {
  return vehicles
    .map(vehicle => ({
      vehicle,
      score: scoreVehicle(vehicle, preferences),
      reasons: reasonsFor(vehicle, preferences, vehicles)
    }))
    // Ties break on id, so the order never depends on input array order.
    .sort((a, b) => b.score - a.score || a.vehicle.id.localeCompare(b.vehicle.id))
    .slice(0, limit);
}

// The shortlist answers a narrower question than "your five best matches":
// given the dearest car the recommended payment option actually reaches,
// what is the best car just under that ceiling, at it, and one step past it?
// Three cars framed by price beat five ranked in the abstract, because the
// ceiling is the number the whole page has been working out.
//
// The `above` band is deliberately out of reach — it is the "if you stretched"
// option, and callers should label it as such rather than implying it is
// affordable.
const BRACKET_TOLERANCE = 0.05;
// How far outside the tolerance a car may sit and still count as "just"
// under or over. Without an outer bound the `above` slot goes to the
// best-ranked car at *any* price — a $62k Tesla against a $37k ceiling —
// which is a fantasy, not a stretch.
const BRACKET_WINDOW = 0.30;
// Two below, two at, one above. Two at the ceiling gives the price point the
// buyer can actually reach a genuine choice rather than a single
// take-it-or-leave-it; one stretch is enough to show what a little more buys.
const DEFAULT_COUNTS = { below: 2, at: 2, above: 1 };

export function bracketAroundPrice(
  ranked,
  anchorPrice,
  { tolerance = BRACKET_TOLERANCE, window = BRACKET_WINDOW, counts = DEFAULT_COUNTS } = {}
) {
  if (!Array.isArray(ranked) || ranked.length === 0) return [];
  if (typeof anchorPrice !== 'number' || !Number.isFinite(anchorPrice) || anchorPrice <= 0) return [];

  const low = anchorPrice * (1 - tolerance);
  const high = anchorPrice * (1 + tolerance);
  const floor = anchorPrice * (1 - window);
  const ceiling = anchorPrice * (1 + window);

  // `ranked` arrives best-first, so the first match in each band is that
  // band's best car — the slot goes to the best car in the price range, not
  // to whichever car sits closest to the anchor. Anything outside the window
  // belongs to no band and is skipped.
  const bandOf = vehicle => {
    const price = vehicle.listPrice;
    if (price < floor || price > ceiling) return null;
    if (price < low) return 'below';
    if (price > high) return 'above';
    return 'at';
  };

  // Family identity, with a fallback so fixtures and any row lacking a
  // familyId are each treated as their own family rather than all collapsing
  // into one notional group.
  const familyOf = vehicle => vehicle.familyId ?? `#${vehicle.id}`;

  // How many other variants of this car the filtered set holds, and what the
  // cheapest of them costs — so a buyer who likes the model but not this exact
  // trim can see there is more to look at.
  const otherTrimsFor = entry => {
    const family = familyOf(entry.vehicle);
    const siblings = ranked.filter(other =>
      familyOf(other.vehicle) === family && other.vehicle.id !== entry.vehicle.id
    );
    return siblings.length > 0
      ? { count: siblings.length, fromPrice: Math.min(...siblings.map(s => s.vehicle.listPrice)) }
      : null;
  };

  // Bands are filled from every matching VARIANT, not from a list already
  // collapsed to one variant per family. Collapsing first starved the bands:
  // a family whose best-scoring variant sat under budget could never supply
  // the stretch card even when it had a variant squarely in that band, so a
  // filtered search that genuinely offered 7 at-budget / 33 below / 4 above
  // rendered three cards.
  //
  // One trim per family WITHIN a band, not across the whole selection. Two
  // trims of the same car at nearly the same price are redundant; the same car
  // at $72,000 and at $99,000 is two genuinely different propositions, and
  // forbidding that was itself starving the stretch band.
  //
  // Filled in display order — at-budget, then below, then the stretch.
  //
  // `ranked` is best-first, so taking the first N in a band gives the N best
  // cars at that price point rather than the N nearest the anchor. A band with
  // too few cars simply yields fewer cards — it never borrows from a
  // neighbour, which would put a card under a label that misdescribes it.
  const picked = { below: [], at: [], above: [] };

  for (const band of ['at', 'below', 'above']) {
    const seenInBand = new Set();
    for (const entry of ranked) {
      if (picked[band].length >= (counts[band] ?? 0)) break;
      if (bandOf(entry.vehicle) !== band) continue;
      const family = familyOf(entry.vehicle);
      if (seenInBand.has(family)) continue;
      seenInBand.add(family);
      picked[band].push({ band, entry: { ...entry, otherTrims: otherTrimsFor(entry) } });
    }
  }

  // At-budget first: those cars are the answer to the question the whole page
  // has been working out, so they should not be scrolled past. Cheaper
  // alternatives come next, and the stretch last.
  return [...picked.at, ...picked.below, ...picked.above];
}
