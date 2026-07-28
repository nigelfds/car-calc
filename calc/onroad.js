export function luxuryCarTax({ listPrice, isFuelEfficient = true }, tables) {
  const threshold = isFuelEfficient
    ? tables.lct.fuelEfficientThreshold
    : tables.lct.otherThreshold;
  if (listPrice <= threshold) return 0;
  return (listPrice - threshold) * (10 / 11) * tables.lct.rate;
}

// Victoria charges three different ways, and which one applies is decided
// before price is looked at:
//
//   non-passenger vehicle   flat $5.40 per $200, at any value
//   green passenger car     flat $8.40 per $200, at any value
//   any other passenger car tiered from $8.40 up to $18.00 per $200
//
// Non-passenger is tested first because it is a category, not a concession —
// a ute is a goods vehicle whatever its emissions, so it is neither "green"
// nor tiered. Every ute in the dataset was being billed at $8.40 for want of
// this branch, overstating duty by $814-$1,005 each. That was invisible in
// the tests because the green rate and the first ordinary tier are both
// $8.40, so green-versus-ordinary comparisons agreed below $80,809 and hid a
// third rate that agrees with neither.
export function vicStampDuty({ dutiableValue, isGreen = true, isNonPassenger = false }, tables) {
  const units = dutiableValue / 200;
  if (isNonPassenger) return units * tables.vicDuty.nonPassengerRatePer200;
  if (isGreen) return units * tables.vicDuty.greenRatePer200;
  const tier = tables.vicDuty.otherTiers.find(t => dutiableValue <= (t.upTo ?? Infinity));
  return units * tier.ratePer200;
}

export function driveAwayPrice({ listPrice, isGreen = true, isFuelEfficient = true, isNonPassenger = false }, tables) {
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
  const stampDuty = vicStampDuty({ dutiableValue, isGreen, isNonPassenger }, tables);
  const registration = tables.registrationAnnual;
  return {
    listPrice,
    lct,
    stampDuty,
    registration,
    total: listPrice + stampDuty + registration
  };
}
