import { z } from 'zod';
import { clampParsed } from '../calc/clamp.js';

export { clampParsed };

const BODY_TYPES = ['SUV', 'Sedan', 'Hatch', 'Wagon', 'Ute'];

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
