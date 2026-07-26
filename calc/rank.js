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

function reasonsFor(vehicle, preferences) {
  const reasons = [];
  if (typeof preferences.minBootLitres === 'number') {
    reasons.push(`${vehicle.bootLitresSeatsUp}L boot, ${vehicle.bootLitresSeatsUp - preferences.minBootLitres}L more than you asked for`);
  }
  if (typeof preferences.minRangeKm === 'number') {
    reasons.push(`${vehicle.rangeKm}km range`);
  }
  if (vehicle.warrantyYears >= 7) {
    reasons.push(`${vehicle.warrantyYears}-year warranty`);
  }
  if (reasons.length === 0) {
    reasons.push(`${vehicle.rangeKm}km range, ${vehicle.bootLitresSeatsUp}L boot`);
  }
  return reasons;
}

export function rankVehicles(vehicles, preferences = {}, limit = 5) {
  return vehicles
    .map(vehicle => ({
      vehicle,
      score: scoreVehicle(vehicle, preferences),
      reasons: reasonsFor(vehicle, preferences)
    }))
    // Ties break on id, so the order never depends on input array order.
    .sort((a, b) => b.score - a.score || a.vehicle.id.localeCompare(b.vehicle.id))
    .slice(0, limit);
}
