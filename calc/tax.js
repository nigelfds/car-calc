export function incomeTax(taxableIncome, tables) {
  let tax = 0;
  let lower = 0;
  for (const bracket of tables.incomeTaxBrackets) {
    const upper = bracket.upTo ?? Infinity;
    if (taxableIncome > lower) {
      tax += (Math.min(taxableIncome, upper) - lower) * bracket.rate;
    }
    lower = upper;
  }
  return tax;
}

export function medicareLevy(taxableIncome, tables) {
  const { rate, lowIncomeThreshold, shadeOutTo } = tables.medicareLevy;
  if (taxableIncome <= lowIncomeThreshold) return 0;
  if (taxableIncome >= shadeOutTo) return taxableIncome * rate;
  return (taxableIncome - lowIncomeThreshold) * 0.10;
}

export function lito(taxableIncome, tables) {
  const { max, taperFrom, taperRate, secondTaperFrom, secondTaperRate } = tables.lito;
  if (taxableIncome <= taperFrom) return max;
  let offset = max - (Math.min(taxableIncome, secondTaperFrom) - taperFrom) * taperRate;
  if (taxableIncome > secondTaperFrom) {
    offset -= (taxableIncome - secondTaperFrom) * secondTaperRate;
  }
  return Math.max(0, offset);
}

export function netIncome({ grossSalary, preTaxDeductions = 0 }, tables) {
  const taxableIncome = Math.max(0, grossSalary - preTaxDeductions);
  const gross = incomeTax(taxableIncome, tables);
  const offset = lito(taxableIncome, tables);
  const tax = Math.max(0, gross - offset);
  const levy = medicareLevy(taxableIncome, tables);
  const totalTax = tax + levy;
  const netAnnual = taxableIncome - totalTax;
  return {
    taxableIncome,
    incomeTax: tax,
    medicareLevy: levy,
    lito: offset,
    totalTax,
    netAnnual,
    netMonthly: netAnnual / 12
  };
}
