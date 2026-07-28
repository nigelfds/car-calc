// A plug-in hybrid runs on two fuels, and the split between them moves its
// running cost more than any other single figure — mostly-battery is about
// what a BEV costs, mostly-petrol is about what a petrol car costs. The share
// is therefore an input the user sets, not a constant chosen here: real-world
// studies consistently find private PHEVs fall well short of the electric
// share their type-approval figures assume.
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
