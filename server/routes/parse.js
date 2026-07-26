import express from 'express';
import { askClaude, aiEnabled, MODELS } from '../claude.js';
import { parseSchema, clampParsed } from '../schema.js';
import { parseKeywords } from '../fallback-parser.js';

const TOOL = {
  name: 'record_preferences',
  description: 'Record the car preferences and financial details stated by the user.',
  input_schema: {
    type: 'object',
    properties: {
      bodyTypes: { type: 'array', items: { type: 'string', enum: ['SUV', 'Sedan', 'Hatch', 'Wagon', 'Ute'] } },
      minBootLitres: { type: ['number', 'null'] },
      minRangeKm: { type: ['number', 'null'] },
      seats: { type: ['integer', 'null'] },
      grossSalary: { type: ['number', 'null'], description: 'Annual salary before tax in AUD' },
      monthlyBudget: { type: ['number', 'null'], description: 'Monthly car spend from take-home pay in AUD' },
      termMonths: { type: ['integer', 'null'] },
      clarifyingQuestion: {
        type: ['string', 'null'],
        description: 'One short question, only if the input is too vague to act on. Otherwise null.'
      }
    }
  }
};

const SYSTEM = `You extract structured car-buying preferences from a person's description.
You never calculate costs, taxes, or affordability — a separate deterministic engine does that.
Convert natural phrasing into numbers: "145k" means 145000; "big boot for a large dog" implies
minBootLitres of at least 500. Set a field to null when the user did not indicate it. Ask a
clarifying question only when the input is too vague to filter on at all.`;

export function mergeParsed(keywordResult, claudeResult) {
  if (!claudeResult) return keywordResult;
  const merged = { ...keywordResult };
  for (const [key, value] of Object.entries(claudeResult)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && value.length === 0) continue;
      merged[key] = value;
    }
  }
  return merged;
}

const router = express.Router();

router.post('/', async (req, res) => {
  const { text, history = [] } = req.body ?? {};
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'text is required' });
  }

  const keywordResult = parseKeywords(text);

  const claudeResult = await askClaude({
    model: MODELS.parse,
    system: SYSTEM,
    messages: [...history, { role: 'user', content: text }],
    tool: TOOL,
    schema: parseSchema
  });

  const merged = clampParsed(mergeParsed(keywordResult, claudeResult));
  res.json({
    preferences: merged,
    clarifyingQuestion: claudeResult?.clarifyingQuestion ?? null,
    source: claudeResult ? 'claude' : (aiEnabled() ? 'fallback' : 'none')
  });
});

export default router;
