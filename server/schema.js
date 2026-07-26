import { z } from 'zod';

const BODY_TYPES = ['SUV', 'Sedan', 'Hatch', 'Wagon', 'Ute'];
const TERMS = [12, 24, 36, 48, 60];

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

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function clampParsed(parsed) {
  const out = { ...parsed };
  if (typeof out.grossSalary === 'number') out.grossSalary = clamp(out.grossSalary, 20000, 1000000);
  if (typeof out.monthlyBudget === 'number') out.monthlyBudget = clamp(out.monthlyBudget, 100, 10000);
  if (typeof out.minBootLitres === 'number') out.minBootLitres = clamp(out.minBootLitres, 0, 3000);
  if (typeof out.minRangeKm === 'number') out.minRangeKm = clamp(out.minRangeKm, 0, 1000);
  if (typeof out.seats === 'number') out.seats = clamp(out.seats, 2, 9);
  if (typeof out.termMonths === 'number') {
    out.termMonths = TERMS.reduce((best, t) =>
      Math.abs(t - out.termMonths) < Math.abs(best - out.termMonths) ? t : best
    );
  }
  return out;
}
