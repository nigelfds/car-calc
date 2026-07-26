import express from 'express';
import { askClaude, MODELS } from '../claude.js';
import { explainSchema } from '../schema.js';

const TOOL = {
  name: 'explain_recommendation',
  description: 'Explain in plain English why the winning financing option won.',
  input_schema: {
    type: 'object',
    properties: {
      explanation: {
        type: 'string',
        description: 'Two to four sentences. Use only the figures supplied. No new numbers.'
      }
    },
    required: ['explanation']
  }
};

const SYSTEM = `You explain a car financing recommendation to an Australian buyer in plain English.
Every dollar figure has already been computed and is supplied to you. Use only those figures —
never calculate, estimate, or introduce a number that is not given. Mention the balloon payment
when a novated lease wins, since buyers routinely overlook it. Do not give financial advice.`;

const router = express.Router();

router.post('/', async (req, res) => {
  const { result } = req.body ?? {};
  if (!result) return res.status(400).json({ error: 'result is required' });

  const explanation = await askClaude({
    model: MODELS.explain,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(result, null, 2) }],
    tool: TOOL,
    schema: explainSchema
  });

  res.json({
    explanation: explanation?.explanation ?? null,
    source: explanation ? 'claude' : 'none'
  });
});

export default router;
