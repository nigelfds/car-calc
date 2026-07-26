export function resaleValue({ driveAwayTotal, termMonths, depreciationCurve }) {
  const years = termMonths / 12;
  const lastIndex = depreciationCurve.length - 1;

  if (years <= lastIndex) {
    const lower = Math.floor(years);
    const upper = Math.min(lower + 1, lastIndex);
    const fraction = years - lower;
    const retained =
      depreciationCurve[lower] +
      (depreciationCurve[upper] - depreciationCurve[lower]) * fraction;
    return driveAwayTotal * retained;
  }

  const finalDecline = depreciationCurve[lastIndex - 1] - depreciationCurve[lastIndex];
  const extraYears = years - lastIndex;
  const retained = Math.max(0.05, depreciationCurve[lastIndex] - finalDecline * extraYears);
  return driveAwayTotal * retained;
}
