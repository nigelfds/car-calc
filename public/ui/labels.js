// One name per way of paying, in the grammatical shapes the page actually
// needs.
//
// Four separate maps used to disagree. The legend said "Car loan", the verdict
// tile said "Direct loan", the shortlist's cost table said "Loan" and the
// summary bar said "A car loan" — four names for one thing, on one screen,
// and every rename costs the reader a moment working out whether they are
// looking at something new. The legend is the version a reader meets first, so
// it is the one the rest now match: novated lease, car loan, cash. "Direct
// loan" and "Buy upfront" are deliberately gone.
//
// Three maps rather than one map of objects because that is how they are read
// at the call site — `OPTION_NAME[option]` says what it gives you, where
// `OPTION_LABELS[option].name` makes every caller name the shape twice.

// The option key order the page presents them in, everywhere. Exported so
// nothing has to write the array out again and risk a fourth ordering.
export const OPTIONS = ['novated', 'loan', 'upfront'];

// The option's name, in full. Legend, verdict tiles, chart end-labels.
export const OPTION_NAME = {
  novated: 'Novated lease',
  loan: 'Car loan',
  upfront: 'Cash'
};

// Tight columns only. The shortlist's cost table lives in a column that was
// ~236px before the layout rework and is not much wider now, and the full
// names wrap there. The same words, shortened — never a different word.
export const OPTION_NAME_SHORT = {
  novated: 'Novated',
  loan: 'Loan',
  upfront: 'Cash'
};

// As the subject of a sentence: "A novated lease reaches up to $61,802 of car".
export const OPTION_PHRASE = {
  novated: 'A novated lease',
  loan: 'A car loan',
  upfront: 'Paying cash'
};
