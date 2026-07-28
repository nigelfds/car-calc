import { z } from 'zod';
import { clampParsed } from '../calc/clamp.js';

export { clampParsed };

// No Wagon: the body-type filter offers four types, and a value the UI
// cannot show is a filter nobody can reach. Re-add here and in the checkbox
// row together if a wagon ever goes on sale.
const BODY_TYPES = ['SUV', 'Sedan', 'Hatch', 'Ute'];

export const parseSchema = z.object({
  bodyTypes: z.array(z.enum(BODY_TYPES)).optional(),
  minBootLitres: z.number().nullable().optional(),
  minRangeKm: z.number().nullable().optional(),
  seats: z.number().int().nullable().optional(),
  grossSalary: z.number().nullable().optional(),
  monthlyBudget: z.number().nullable().optional(),
  termMonths: z.number().int().nullable().optional(),
  clarifyingQuestion: z.string().nullable().optional()
});

export const explainSchema = z.object({
  explanation: z.string().min(1)
});
