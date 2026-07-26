// Deterministic shortlist scoring. No model call: same inputs always give the
// same order, it costs nothing, and it works with no network.
//
// Each dimension contributes a 0..1 normalised value times a weight. A weight
// is raised when the user actually expressed that preference, so an unstated
// preference still nudges but never dominates.

const WEIGHTS = {
  boot: { stated: 3.0, unstated: 0.5 },
  range: { stated: 2.5, unstated: 0.8 },
  warranty: { stated: 0, unstated: 0.6 },
  value: { stated: 0, unstated: 1.0 }
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

// A ranked list (rankVehicles' full output, not pre-sliced) is naturally
// dominated by whichever family scores best, since near-identical trims of
// the same car score alike (same body, same boot, similar range) — with a
// tight filter that can fill a five-card shortlist with one model shown
// five ways. collapseToTopPerFamily keeps the ranker's judgement about
// *which* trim is best (still the highest-scoring one) but shows each
// family only once, so a shortlist of N cards is N genuine choices.
//
// otherTrims is derived from `ranked` itself — the full set the caller
// passed in, before collapsing — never from the collapsed output, so a
// buyer who likes the family but not this exact trim can see there's more
// to look at. It's null when this was the only matching variant in its
// family, so callers can skip the line entirely rather than print "0 other
// trims".
export function collapseToTopPerFamily(ranked, limit = 5) {
  const byFamily = new Map();
  for (const entry of ranked) {
    const familyId = entry.vehicle.familyId;
    if (!byFamily.has(familyId)) byFamily.set(familyId, []);
    byFamily.get(familyId).push(entry);
  }

  const collapsed = [];
  for (const entries of byFamily.values()) {
    // Same tie-break rule as rankVehicles: highest score wins, ties go to
    // the lower id — so this doesn't depend on `ranked`'s incoming order.
    const best = entries.reduce((top, entry) =>
      entry.score > top.score ||
      (entry.score === top.score && entry.vehicle.id.localeCompare(top.vehicle.id) < 0)
        ? entry
        : top
    );
    const others = entries.filter(entry => entry.vehicle.id !== best.vehicle.id);
    const otherTrims = others.length > 0
      ? { count: others.length, fromPrice: Math.min(...others.map(entry => entry.vehicle.listPrice)) }
      : null;
    collapsed.push({ ...best, otherTrims });
  }

  return collapsed
    .sort((a, b) => b.score - a.score || a.vehicle.id.localeCompare(b.vehicle.id))
    .slice(0, limit);
}
