export function resolvePhase(leaseStartDate, tables) {
  let current = tables.fbtPhases[0];
  for (const phase of tables.fbtPhases) {
    if (leaseStartDate >= phase.from) current = phase;
  }
  return current;
}

// Plug-in hybrids were eligible for the electric-car FBT exemption until
// 1 April 2025 and are not eligible after it.
//
// The cut-off is a date comparison, so a lease start date before it makes a
// PHEV exempt here — and that is only true in real life where a binding
// financial commitment was already in place on 1 April 2025. Nothing in the
// inputs can tell us whether that commitment exists, so the treatment carries
// `phevExemptByDate` and the card discloses the assumption (ui/cars.js). It is
// a separate flag rather than something the UI re-derives from the date,
// because the date the exemption ended is tax knowledge and belongs here.
//
// The ineligible case is not a discount, it is the absence of the exemption:
// an ineligible PHEV pays FBT on the full statutory formula, which is why
// discountRate stays 0 rather than becoming 1.
export function fbtTreatment({ leaseStartDate, vehicleValue, powertrain = 'bev' }, tables) {
  const phase = resolvePhase(leaseStartDate, tables);
  const overThreshold = vehicleValue > tables.lct.fuelEfficientThreshold;
  const isPhev = powertrain === 'phev';
  const beforeCutOff = leaseStartDate < tables.phevFbtExemptionEnded;
  const phevIneligible = isPhev && !beforeCutOff;

  if (phevIneligible || overThreshold) {
    return {
      exempt: false, discountRate: 0, overThreshold, phevIneligible,
      phevExemptByDate: false,
      phase
    };
  }
  const exemptCap = phase.fullExemptionUpTo;
  const exempt = exemptCap === null || vehicleValue <= exemptCap;
  return {
    exempt,
    discountRate: exempt ? 0 : phase.discountRate,
    overThreshold: false,
    phevIneligible: false,
    // True only where the exemption survives *because* of the date: a PHEV
    // that is exempt for any other reason does not exist, and a BEV's
    // exemption has nothing to do with this cut-off.
    phevExemptByDate: isPhev && exempt,
    phase
  };
}

export function annualFbt({ baseValue, treatment }, tables) {
  if (treatment.exempt) return 0;
  const { statutoryRate, grossUpType1, rate } = tables.fbt;
  const taxableValue = baseValue * statutoryRate * (1 - treatment.discountRate);
  return taxableValue * grossUpType1 * rate;
}
