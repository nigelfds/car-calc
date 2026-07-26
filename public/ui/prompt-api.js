// Chrome's built-in Prompt API, on-device. Desktop Chrome only, and only once
// the model has downloaded — so this is strictly an enhancement. Every failure
// path returns null and the caller falls back to the server.

import { clampParsed } from '../../calc/clamp.js';

export const PARSE_SCHEMA = {
  type: 'object',
  properties: {
    bodyTypes: {
      type: 'array',
      items: { type: 'string', enum: ['SUV', 'Sedan', 'Hatch', 'Wagon', 'Ute'] }
    },
    minBootLitres: { type: ['number', 'null'] },
    minRangeKm: { type: ['number', 'null'] },
    seats: { type: ['integer', 'null'] },
    grossSalary: { type: ['number', 'null'] },
    monthlyBudget: { type: ['number', 'null'] },
    termMonths: { type: ['integer', 'null'] }
  },
  additionalProperties: false
};

const SYSTEM = `You extract car-buying preferences from a person's description.
Convert natural phrasing into numbers: "145k" means 145000; "big boot for a large dog"
implies minBootLitres of at least 500. A salary is annual; a budget is monthly.
Use null for anything the person did not indicate. Never calculate costs or taxes.`;

export async function isPromptApiAvailable() {
  try {
    if (typeof globalThis.LanguageModel === 'undefined') return false;
    return (await globalThis.LanguageModel.availability()) === 'available';
  } catch {
    return false;
  }
}

export async function parseOnDevice(text) {
  if (!(await isPromptApiAvailable())) return null;

  let session = null;
  try {
    session = await globalThis.LanguageModel.create({
      initialPrompts: [{ role: 'system', content: SYSTEM }]
    });
    const raw = await session.prompt(text, { responseConstraint: PARSE_SCHEMA });
    // Bound the same way the server bounds tier 2, so the two tiers never
    // disagree on what counts as a valid salary, budget, boot, range or term.
    return clampParsed(JSON.parse(raw));
  } catch {
    return null;
  } finally {
    // destroy() is cleanup, not part of the contract — this function must
    // never throw, so a throwing destroy() must not escape the finally.
    try { session?.destroy?.(); } catch { /* ignore */ }
  }
}
