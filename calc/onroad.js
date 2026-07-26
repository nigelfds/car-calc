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
  // LCT is a wholesale tax remitted by the importer/manufacturer/dealer at
  // the point the car is first sold — unlike stamp duty and registration,
  // which are state charges applied at retail settlement/registration, LCT
  // is already embedded in the advertised list price (MLP/RRP) by the time
  // a buyer ever sees it. So `lct` below is reported for information only
  // (how much of this car's list price is LCT — see luxuryCarTax's own
  // export for buyers who want that figure); it must NOT be added to the
  // dutiable value or the on-road total, or the car is taxed twice and the
  // stamp-duty base is inflated on top of that.
  const lct = luxuryCarTax({ listPrice, isFuelEfficient }, tables);
  const dutiableValue = listPrice;
  const stampDuty = vicStampDuty({ dutiableValue, isGreen }, tables);
  const registration = tables.registrationAnnual;
  return {
    listPrice,
    lct,
    stampDuty,
    registration,
    total: listPrice + stampDuty + registration
  };
}
