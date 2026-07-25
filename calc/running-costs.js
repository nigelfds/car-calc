export function runningCosts({ vehicle, annualKm, rates }) {
  const kwh = (vehicle.consumptionKwhPer100km / 100) * annualKm;
  const electricity = kwh * (rates.electricityCentsPerKwh / 100);
  const insurance = vehicle.insuranceAnnual;
  const other = rates.otherRunningCostsAnnual;
  const totalIncGst = insurance + electricity + other;
  return {
    insurance,
    electricity,
    other,
    totalIncGst,
    totalExGst: totalIncGst * 10 / 11
  };
}
