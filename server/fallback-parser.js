const BODY_TYPES = [
  { match: /\bsuv\b/i, value: 'SUV' },
  { match: /\bsedan\b/i, value: 'Sedan' },
  { match: /\bhatch(back)?\b/i, value: 'Hatch' },
  { match: /\bwagon\b/i, value: 'Wagon' },
  { match: /\bute\b/i, value: 'Ute' }
];

function toNumber(raw) {
  return Number(raw.replace(/[$,\s]/g, ''));
}

export function parseKeywords(text) {
  const result = {
    bodyTypes: [],
    minBootLitres: null,
    minRangeKm: null,
    seats: null,
    grossSalary: null,
    monthlyBudget: null,
    termMonths: null
  };
  if (typeof text !== 'string') return result;

  const monthly = text.match(/\$?([\d,.]+)\s*k?\s*(?:per month|a month|\/month|pm\b|monthly)/i);
  if (monthly) {
    const value = toNumber(monthly[1]);
    result.monthlyBudget = /k/i.test(monthly[0]) ? value * 1000 : value;
  }

  const salary = text.match(/\$?([\d,.]+)\s*k\b|\$([\d,]{5,})/i);
  if (salary) {
    const raw = salary[1] ?? salary[2];
    const value = toNumber(raw);
    const scaled = salary[1] ? value * 1000 : value;
    if (scaled !== result.monthlyBudget && scaled >= 20000) result.grossSalary = scaled;
  }

  for (const { match, value } of BODY_TYPES) {
    if (match.test(text)) result.bodyTypes.push(value);
  }

  if (/\bdog\b|\bpram\b|\bcamping\b|\bbig boot\b|\blarge boot\b/i.test(text)) {
    result.minBootLitres = /\blarge dog\b|\bbig dog\b|\bcrate\b/i.test(text) ? 500 : 400;
  }

  const range = text.match(/(\d{3})\s*(?:\+)?\s*km/i);
  if (range) result.minRangeKm = Number(range[1]);

  const seats = text.match(/(\d)\s*seat/i);
  if (seats) result.seats = Number(seats[1]);

  const years = text.match(/(\d)\s*year/i);
  if (years) result.termMonths = Number(years[1]) * 12;

  return result;
}
