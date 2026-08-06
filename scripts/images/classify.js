// scripts/images/classify.js — decides whether a Commons search hit can be
// accepted for a family automatically, or needs a human to confirm it.
//
// The problem this exists for: these cars carry different badges in different
// markets, so the Australian name is often not the name the photograph is filed
// under. A Sealion 6 is filed as a Song Plus, an EX5 as a Galaxy E5. Most such
// hits are the right car — but not all, and nothing in the filename says which.
// A survey of the live dataset turned up an ID.5 offered for the ID.4 and a
// 1959 Morris Mini for the Mini Cooper — both caught here, because the model
// term this function requires is simply absent from those titles.
//
// That is the failure docs/phev-research-wave.md describes for REEVs mis-filed
// as PHEVs: "wrong in a way the schema cannot catch". A photograph of the wrong
// car above a correct price costs the same credibility a wrong price would.
//
// So the bias is deliberate and one-directional: a false flag costs the reader
// twenty seconds, a false auto-accept ships the wrong car.
//
// A known limit: the sibling-clash check below only protects against confusion
// with a family we hold in our own dataset (Seal against Seal 6, say). The
// Seal U — sold here as the Sealion 6 — is a real, different car, but we hold
// no "Seal U" family, so there is no sibling for the clash rule to find, and a
// Seal U hit offered for the Seal auto-accepts. Nothing computed from families
// we hold can flag a car we don't hold. The contact sheet review after each
// curation run is the backstop for this class of miss, not this function.

// Fold the three ways the same name is written differently across Commons:
// diacritics (Škoda / Skoda), glued letter-digit pairs (MG4 / MG 4) and
// zero-padded numbers (Sealion 07 / Sealion 7). Each of these caused a false
// flag in the survey before it was handled.
export function normalise(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b0+(\d)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Whole-term containment, not substring. " seal " must not match inside
// "sealion", which is exactly the pair the dataset contains.
export function containsTerm(haystack, needle) {
  const n = normalise(needle);
  return n.length > 0 && ` ${normalise(haystack)} `.includes(` ${n} `);
}

// Families of the same make whose model name overlaps this one in either
// direction — BYD Seal against Seal 6 and Sealion 6. Derived from the dataset
// rather than hand-listed, so it stays correct as the research waves add
// families.
function siblingsOf(family, families) {
  return families.filter(other =>
    other.id !== family.id &&
    normalise(other.make) === normalise(family.make) &&
    (containsTerm(other.model, family.model) || containsTerm(family.model, other.model))
  );
}

export function classify({ family, candidateTitle, families }) {
  if (!candidateTitle) {
    return { verdict: 'manual', why: 'no candidate returned for this family' };
  }

  // The make is advisory: the search query already constrained the brand, and
  // requiring it caused false flags on files titled "Ora 5 001.jpg" and
  // "MERCEDES-EQ EQB China". The model is what must be present.
  if (!containsTerm(candidateTitle, family.model)) {
    return { verdict: 'manual', why: 'model absent from the title — probably a market alias' };
  }

  // A more specific sibling matching the same title means the hit is more
  // likely to be that car than this one.
  const clash = siblingsOf(family, families).find(sibling =>
    containsTerm(candidateTitle, sibling.model) &&
    normalise(sibling.model).length > normalise(family.model).length
  );
  if (clash) {
    return { verdict: 'manual', why: `ambiguous with ${clash.make} ${clash.model}` };
  }

  return { verdict: 'auto', why: 'model matches with no sibling clash' };
}
