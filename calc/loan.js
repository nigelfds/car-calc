export function monthlyRepayment({ principal, annualRatePct, termMonths }) {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

export function loanSummary({ principal, annualRatePct, termMonths }) {
  const payment = monthlyRepayment({ principal, annualRatePct, termMonths });
  const totalRepaid = payment * termMonths;
  return {
    monthlyRepayment: payment,
    totalRepaid,
    totalInterest: totalRepaid - principal
  };
}
