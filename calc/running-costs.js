// A plug-in hybrid runs on two fuels, and the split between them decides
// which one it mostly is — mostly-battery costs about what a BEV costs to
// run, mostly-petrol about what a petrol car costs. Measured on the Sealion 6
// Dynamic ER at 15,000km: the yearly fuel and energy bill goes $798 -> $1,463
// across the full range of this figure, so it roughly doubles.
//
// Worth knowing what that is and is not. It is the largest single lever on
// the RUNNING cost, but running costs are a small share of a packaged novated
// lease, so the same swing moves the monthly figure by only about $35 and the
// five-year total by around $2,000. An earlier version of this comment, and
// the hint in index.html, claimed it was the biggest lever on the page —
// true of the fuel bill alone, false of the number the user actually reads.
//
// The share is an input the user sets rather than a constant chosen here:
// real-world studies consistently find private PHEVs fall well short of the
// electric share their type-approval figures assume, and the honest answer
// depends on whether they can charge at home.
//
// A BEV ignores the share entirely. It has no combustion side, so there is
// nothing for the petrol term to describe.
export function runningCosts({ vehicle, annualKm, batterySharePct = 100, rates }) {
  const isPhev = vehicle.powertrain === 'phev';
  const share = isPhev ? Math.min(100, Math.max(0, batterySharePct)) / 100 : 1;

  const electricKm = annualKm * share;
  const petrolKm = annualKm - electricKm;

  const kwh = (vehicle.consumptionKwhPer100km / 100) * electricKm;
  const electricity = kwh * (rates.electricityCentsPerKwh / 100);

  const litres = isPhev ? (vehicle.fuelConsumptionL100km / 100) * petrolKm : 0;
  const petrol = litres * ((rates.petrolCentsPerLitre ?? 0) / 100);

  const insurance = vehicle.insuranceAnnual;
  const other = rates.otherRunningCostsAnnual;
  const totalIncGst = insurance + electricity + petrol + other;
  return {
    insurance,
    electricity,
    petrol,
    other,
    totalIncGst,
    totalExGst: totalIncGst * 10 / 11
  };
}
