export function luxuryCarTax({ listPrice, isFuelEfficient = true }, tables) {
  const threshold = isFuelEfficient
    ? tables.lct.fuelEfficientThreshold
    : tables.lct.otherThreshold;
  if (listPrice <= threshold) return 0;
  return (listPrice - threshold) * (10 / 11) * tables.lct.rate;
}

export function vicStampDuty({ dutiableValue, isGreen = true }, tables) {
  const units = dutiableValue / 200;
  if (isGreen) return units * tables.vicDuty.greenRatePer200;
  const tier = tables.vicDuty.otherTiers.find(t => dutiableValue <= (t.upTo ?? Infinity));
  return units * tier.ratePer200;
}

export function driveAwayPrice({ listPrice, isGreen = true, isFuelEfficient = true }, tables) {
  const lct = luxuryCarTax({ listPrice, isFuelEfficient }, tables);
  const dutiableValue = listPrice + lct;
  const stampDuty = vicStampDuty({ dutiableValue, isGreen }, tables);
  const registration = tables.registrationAnnual;
  return {
    listPrice,
    lct,
    stampDuty,
    registration,
    total: listPrice + lct + stampDuty + registration
  };
}
