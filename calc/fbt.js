export function resolvePhase(leaseStartDate, tables) {
  let current = tables.fbtPhases[0];
  for (const phase of tables.fbtPhases) {
    if (leaseStartDate >= phase.from) current = phase;
  }
  return current;
}

// Plug-in hybrids were eligible for the electric-car FBT exemption until
// 1 April 2025 and are not eligible after it. A pre-existing binding
// financial commitment could carry the exemption past that date; this tool
// does not model that, and the UI says so.
//
// This is not a discount, it is the absence of the exemption: an ineligible
// PHEV pays FBT on the full statutory formula, which is why discountRate
// stays 0 rather than becoming 1.
export function fbtTreatment({ leaseStartDate, vehicleValue, powertrain = 'bev' }, tables) {
  const phase = resolvePhase(leaseStartDate, tables);
  const overThreshold = vehicleValue > tables.lct.fuelEfficientThreshold;
  const phevIneligible =
    powertrain === 'phev' && leaseStartDate >= tables.phevFbtExemptionEnded;

  if (phevIneligible || overThreshold) {
    return { exempt: false, discountRate: 0, overThreshold, phevIneligible, phase };
  }
  const exemptCap = phase.fullExemptionUpTo;
  const exempt = exemptCap === null || vehicleValue <= exemptCap;
  return {
    exempt,
    discountRate: exempt ? 0 : phase.discountRate,
    overThreshold: false,
    phevIneligible: false,
    phase
  };
}

export function annualFbt({ baseValue, treatment }, tables) {
  if (treatment.exempt) return 0;
  const { statutoryRate, grossUpType1, rate } = tables.fbt;
  const taxableValue = baseValue * statutoryRate * (1 - treatment.discountRate);
  return taxableValue * grossUpType1 * rate;
}
