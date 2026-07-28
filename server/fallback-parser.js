const BODY_TYPES = [
  { match: /\bsuv\b/i, value: 'SUV' },
  { match: /\bsedan\b/i, value: 'Sedan' },
  { match: /\bhatch(back)?\b/i, value: 'Hatch' },
  { match: /\bute\b/i, value: 'Ute' }
];

function toNumber(raw) {
  return Number(raw.replace(/[$,\s]/g, ''));
}

const SALARY_MIN = 20000;
const SALARY_WORD_PROXIMITY_CHARS = 20;
const SALARY_WORD_RE = /\b(?:earn|salary|income|on|make)\b/gi;

// Matches every plausible salary-shaped figure in the text: $NNNk, $NN,NNN
// (or plain $NNNN+), bare NNNk, or a bare 5+ digit number with no symbol.
const CANDIDATE_RE = /\$\s*([\d,]+(?:\.\d+)?)\s*k\b|\$\s*([\d,]{4,})|\b([\d,]+(?:\.\d+)?)\s*k\b|\b(\d{5,})\b/gi;

function findSalaryCandidates(text) {
  const candidates = [];
  for (const m of text.matchAll(CANDIDATE_RE)) {
    let raw;
    let isK;
    if (m[1] !== undefined) { raw = m[1]; isK = true; }
    else if (m[2] !== undefined) { raw = m[2]; isK = false; }
    else if (m[3] !== undefined) { raw = m[3]; isK = true; }
    else { raw = m[4]; isK = false; }
    const value = toNumber(raw);
    candidates.push({ value: isK ? value * 1000 : value, start: m.index, end: m.index + m[0].length });
  }
  return candidates;
}

// Smallest character gap between [start, end) and the nearest salary word
// occurrence (0 if a salary word overlaps/touches the figure).
function distanceToNearestSalaryWord(text, start, end) {
  let best = Infinity;
  for (const m of text.matchAll(SALARY_WORD_RE)) {
    const wordStart = m.index;
    const wordEnd = m.index + m[0].length;
    const dist = wordStart >= end ? wordStart - end : wordEnd <= start ? start - wordEnd : 0;
    if (dist < best) best = dist;
  }
  return best;
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

  const monthlyStart = monthly ? monthly.index : -1;
  const monthlyEnd = monthly ? monthly.index + monthly[0].length : -1;

  const candidates = findSalaryCandidates(text).filter(c => {
    const overlapsMonthly = monthly && c.start < monthlyEnd && c.end > monthlyStart;
    return !overlapsMonthly && c.value >= SALARY_MIN;
  });

  if (candidates.length > 0) {
    const near = candidates
      .map(c => ({ ...c, dist: distanceToNearestSalaryWord(text, c.start, c.end) }))
      .filter(c => c.dist <= SALARY_WORD_PROXIMITY_CHARS)
      .sort((a, b) => a.dist - b.dist || b.value - a.value);

    const chosen = near.length > 0
      ? near[0]
      : candidates.reduce((max, c) => (c.value > max.value ? c : max), candidates[0]);

    result.grossSalary = chosen.value;
  }

  for (const { match, value } of BODY_TYPES) {
    if (match.test(text)) result.bodyTypes.push(value);
  }

  if (/\bdog\b|\bpram\b|\bcamping\b|\bbig boot\b|\blarge boot\b/i.test(text)) {
    result.minBootLitres = /\blarge dog\b|\bbig dog\b|\bcrate\b|\bbig boot\b|\blarge boot\b/i.test(text) ? 500 : 400;
  }

  const range = text.match(/(\d{3})\s*(?:\+)?\s*km/i);
  if (range) result.minRangeKm = Number(range[1]);

  const seats = text.match(/(\d)\s*seat/i);
  if (seats) result.seats = Number(seats[1]);

  const years = text.match(/(\d)\s*year/i);
  if (years) result.termMonths = Number(years[1]) * 12;

  return result;
}
